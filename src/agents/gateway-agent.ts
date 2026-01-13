/**
 * Gateway Agent for CloudClaude
 * Analyzes user intent and routes to appropriate handlers
 */

import { FeishuAdapter } from '../adapters/feishu-adapter';
import { SessionManager } from '../managers/session-manager';
import { TaskScheduler } from '../scheduler/task-scheduler';
import { Logger } from '../utils/logger';
import { ParsedFeishuMessage } from '../types/feishu';

const logger = new Logger('GatewayAgent');

// Intent types
type IntentType =
    | 'new_session'
    | 'switch_session'
    | 'list_sessions'
    | 'task_execution'
    | 'schedule_task'
    | 'list_tasks'
    | 'configure'
    | 'help'
    | 'continue';

interface Intent {
    type: IntentType;
    params?: Record<string, any>;
    confidence?: number;
}

export class GatewayAgent {
    private adapter: FeishuAdapter;
    private sessionManager: SessionManager;
    private taskScheduler: TaskScheduler;
    private defaultWorkingDir: string;

    constructor(
        adapter: FeishuAdapter,
        sessionManager: SessionManager,
        taskScheduler: TaskScheduler,
        defaultWorkingDir: string = process.cwd()
    ) {
        this.adapter = adapter;
        this.sessionManager = sessionManager;
        this.taskScheduler = taskScheduler;
        this.defaultWorkingDir = defaultWorkingDir;
    }

    /**
     * Handle incoming message
     */
    async handleMessage(message: ParsedFeishuMessage): Promise<void> {
        const { text, chatId } = message;

        logger.info(`Received message: ${text.substring(0, 100)}`);

        try {
            // Check for skill command
            if (text.startsWith('/')) {
                await this.handleSkillCommand(text, chatId);
                return;
            }

            // Analyze intent
            const intent = await this.analyzeIntent(text);
            logger.info(`Intent: ${intent.type}`, { params: intent.params });

            // Route to handler
            switch (intent.type) {
                case 'new_session':
                    await this.handleNewSession(text, chatId, intent.params);
                    break;
                case 'switch_session':
                    await this.handleSwitchSession(chatId, intent.params);
                    break;
                case 'list_sessions':
                    await this.handleListSessions(chatId);
                    break;
                case 'schedule_task':
                    await this.handleScheduleTask(text, chatId, intent.params);
                    break;
                case 'list_tasks':
                    await this.handleListTasks(chatId);
                    break;
                case 'help':
                    await this.handleHelp(chatId);
                    break;
                case 'task_execution':
                case 'continue':
                default:
                    await this.handleContinue(text, chatId);
                    break;
            }
        } catch (error: any) {
            logger.error('Message handling failed', error);
            await this.adapter.sendMessage(`❌ 处理失败：${error.message}`, chatId);
        }
    }

    /**
     * Analyze user intent using Claude
     */
    private async analyzeIntent(text: string): Promise<Intent> {
        // Quick pattern matching for common intents

        if (/^(创建|新建).*(项目|会话|session)/i.test(text)) {
            return { type: 'new_session', confidence: 0.9 };
        }
        if (/^切换.*(项目|会话)/i.test(text)) {
            const match = text.match(/切换(?:到)?(.+)/);
            return {
                type: 'switch_session',
                params: { query: match?.[1]?.trim() },
                confidence: 0.9
            };
        }
        if (/^(查看|列出|显示).*(会话|项目|session)/i.test(text)) {
            return { type: 'list_sessions', confidence: 0.9 };
        }
        if (/^(查看|列出|显示).*(任务|定时)/i.test(text)) {
            return { type: 'list_tasks', confidence: 0.9 };
        }
        if (/(每天|每周|每月|每小时|定时|cron)/i.test(text)) {
            return { type: 'schedule_task', confidence: 0.8 };
        }
        if (/^(帮助|help|\?|使用说明)/i.test(text)) {
            return { type: 'help', confidence: 0.9 };
        }

        // Default: continue with current session
        return { type: 'continue', confidence: 0.7 };
    }

    /**
     * Handle skill command (/skill-name)
     */
    private async handleSkillCommand(text: string, chatId: string): Promise<void> {
        const match = text.match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
        if (!match) {
            await this.handleContinue(text, chatId);
            return;
        }

        const skillName = match[1];
        const args = match[2] || '';

        await this.adapter.sendMessage(`🔧 正在加载 Skill: ${skillName}...`, chatId);

        // Execute with skill instruction
        await this.handleContinue(
            `Load and execute the "${skillName}" skill. ${args ? `Additional context: ${args}` : ''}`,
            chatId
        );
    }

    /**
     * Handle new session creation
     */
    private async handleNewSession(_text: string, chatId: string, _params?: Record<string, any>): Promise<void> {
        await this.adapter.sendMessage(
            '📁 创建新会话\n\n' +
            '请告诉我：\n' +
            '1. 会话/项目名称是什么？\n' +
            '2. 工作目录是？（例如：/home/projects/my-app）',
            chatId
        );
    }

    /**
     * Handle session switching
     */
    private async handleSwitchSession(chatId: string, params?: Record<string, any>): Promise<void> {
        const sessions = this.sessionManager.getSessions();

        if (sessions.length === 0) {
            await this.adapter.sendMessage('📭 还没有任何会话，发送"创建新会话"来创建一个', chatId);
            return;
        }

        const query = params?.query?.toLowerCase() || '';

        // Find matching session
        const match = sessions.find(s =>
            s.name.toLowerCase().includes(query) ||
            s.id.includes(query)
        );

        if (match) {
            await this.sessionManager.setActiveSession(match.id);
            await this.adapter.sendMessage(
                `✅ 已切换到会话：${match.name}\n` +
                `📂 工作目录：${match.workingDir}\n` +
                `⏰ 上次使用：${new Date(match.lastUsed).toLocaleString('zh-CN')}`,
                chatId
            );
        } else {
            // Show available sessions
            let message = '🔍 未找到匹配的会话，可用会话：\n\n';
            for (const session of sessions.slice(0, 5)) {
                message += `• ${session.name} (${session.id})\n`;
            }
            await this.adapter.sendMessage(message, chatId);
        }
    }

    /**
     * List all sessions
     */
    private async handleListSessions(chatId: string): Promise<void> {
        const sessions = this.sessionManager.getSessions();
        const activeId = this.sessionManager.getActiveSessionId();

        if (sessions.length === 0) {
            await this.adapter.sendMessage('📭 还没有任何会话', chatId);
            return;
        }

        let message = '📚 会话列表：\n\n';
        for (const session of sessions) {
            const isActive = session.id === activeId ? ' ⭐' : '';
            message += `${isActive ? '▶️' : '•'} **${session.name}**${isActive}\n`;
            message += `  📂 ${session.workingDir}\n`;
            message += `  💬 ${session.messageCount} 条消息\n\n`;
        }

        await this.adapter.sendMessage(message, chatId);
    }

    /**
     * Handle task scheduling
     */
    private async handleScheduleTask(_text: string, chatId: string, _params?: Record<string, any>): Promise<void> {
        await this.adapter.sendMessage(
            '⏰ 设置定时任务\n\n' +
            '请提供以下信息：\n' +
            '1. 任务名称\n' +
            '2. 执行时间（如：每天12:00，每周一9:00）\n' +
            '3. 具体要做什么\n' +
            '4. 工作目录（可选）',
            chatId
        );
    }

    /**
     * List all tasks
     */
    private async handleListTasks(chatId: string): Promise<void> {
        const tasks = await this.taskScheduler.getTasks();

        if (tasks.length === 0) {
            await this.adapter.sendMessage('📭 还没有定时任务', chatId);
            return;
        }

        let message = '⏰ 定时任务列表：\n\n';
        for (const task of tasks) {
            const status = task.enabled ? '✅' : '⏸️';
            const lastStatus = task.lastStatus === 'success' ? '成功' :
                task.lastStatus === 'error' ? '失败' : '未执行';
            message += `${status} **${task.name}**\n`;
            message += `  🕐 ${task.cron}\n`;
            message += `  📂 ${task.workingDir}\n`;
            message += `  📊 上次：${lastStatus}\n\n`;
        }

        await this.adapter.sendMessage(message, chatId);
    }

    /**
     * Show help
     */
    private async handleHelp(chatId: string): Promise<void> {
        const help = `🤖 **CloudClaude 使用帮助**

**会话管理**
• 创建新会话 - 创建新的工作会话
• 查看会话 - 列出所有会话
• 切换到 xxx - 切换到指定会话

**定时任务**
• 查看任务 - 列出所有定时任务
• 每天12点帮我... - 创建定时任务

**Skills**
• /skill-name - 执行指定 Skill

**其他**
• 直接发送消息与 Claude 对话
• Claude 可以执行命令、编辑文件等
• 所有操作都在云服务器上执行`;

        await this.adapter.sendMessage(help, chatId);
    }

    /**
     * Continue with current session
     */
    private async handleContinue(text: string, chatId: string): Promise<void> {
        let sessionId = this.sessionManager.getActiveSessionId();

        // Create default session if none exists
        if (!sessionId) {
            const session = await this.sessionManager.createSession(
                '默认会话',
                this.defaultWorkingDir,
                'interactive'
            );
            sessionId = session.id;
        }

        // Send "thinking" indicator
        await this.adapter.sendMessage('🤔 思考中...', chatId);

        // Execute in session
        const result = await this.sessionManager.executeInSession(sessionId, text);

        if (result.success) {
            await this.adapter.sendMessage(result.result, chatId);
        } else {
            await this.adapter.sendMessage(`❌ ${result.result}`, chatId);
        }
    }
}
