/**
 * Task Scheduler for CloudClaude
 * Schedules and executes cron-based tasks
 */

import cron from 'node-cron';
import { FeishuAdapter } from '../adapters/feishu-adapter';
import { SessionManager } from '../managers/session-manager';
import { loadTasks, saveTasks } from '../utils/config-loader';
import { Logger } from '../utils/logger';
import { Task, TasksConfig, TaskLogEntry } from '../types/task';

const logger = new Logger('TaskScheduler');

export class TaskScheduler {
    private adapter: FeishuAdapter;
    private sessionManager: SessionManager;
    private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
    private taskLogs: TaskLogEntry[] = [];
    private tasksConfig: TasksConfig = { tasks: [] };

    constructor(adapter: FeishuAdapter, sessionManager: SessionManager) {
        this.adapter = adapter;
        this.sessionManager = sessionManager;
    }

    /**
     * Initialize: load and schedule all tasks
     */
    async init(): Promise<void> {
        this.tasksConfig = await loadTasks();

        for (const task of this.tasksConfig.tasks) {
            if (task.enabled) {
                this.scheduleTask(task);
            }
        }

        logger.info(`Initialized with ${this.scheduledTasks.size} scheduled tasks`);
    }

    /**
     * Schedule a single task
     */
    private scheduleTask(task: Task): void {
        if (!cron.validate(task.cron)) {
            logger.error(`Invalid cron expression for task ${task.id}: ${task.cron}`);
            return;
        }

        const scheduledTask = cron.schedule(task.cron, () => {
            this.executeTask(task);
        });

        this.scheduledTasks.set(task.id, scheduledTask);
        logger.info(`Scheduled task: ${task.name} (${task.cron})`);
    }

    /**
     * Execute a task
     */
    async executeTask(task: Task): Promise<void> {
        const startTime = Date.now();

        this.logTask(task.id, task.name, 'started', `Task started: ${task.instruction}`);

        try {
            // Send start notification
            await this.adapter.sendMessage(`⏰ 定时任务开始：${task.name}`);

            // Execute task using session manager
            const result = await this.sessionManager.executeEphemeralTask(task);

            // Update task status
            await this.updateTaskStatus(task.id, 'success');

            // Send completion notification
            const duration = Date.now() - startTime;
            await this.adapter.sendMessage(
                `✅ 定时任务完成：${task.name}\n\n` +
                `耗时：${(duration / 1000).toFixed(1)}秒\n\n` +
                `结果：${result.substring(0, 1000)}${result.length > 1000 ? '...' : ''}`
            );

            this.logTask(task.id, task.name, 'success', result, duration);

        } catch (error: any) {
            const duration = Date.now() - startTime;

            // Update task status
            await this.updateTaskStatus(task.id, 'error');

            // Send error notification
            await this.adapter.sendMessage(
                `❌ 定时任务失败：${task.name}\n\n` +
                `错误：${error.message}`
            );

            this.logTask(task.id, task.name, 'error', error.message, duration);
            logger.error(`Task execution failed: ${task.name}`, error);
        }
    }

    /**
     * Manually trigger a task
     */
    async triggerTask(taskId: string): Promise<void> {
        const task = this.tasksConfig.tasks.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        logger.info(`Manually triggering task: ${task.name}`);
        await this.executeTask(task);
    }

    /**
     * Add a new task
     */
    async addTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
        const newTask: Task = {
            ...task,
            id: `task_${Date.now()}`,
            createdAt: new Date().toISOString()
        };

        this.tasksConfig.tasks.push(newTask);
        await saveTasks(this.tasksConfig);

        if (newTask.enabled) {
            this.scheduleTask(newTask);
        }

        logger.info(`Added task: ${newTask.name}`);
        return newTask;
    }

    /**
     * Update a task
     */
    async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
        const index = this.tasksConfig.tasks.findIndex(t => t.id === taskId);
        if (index === -1) {
            return null;
        }

        // Stop existing schedule
        const existing = this.scheduledTasks.get(taskId);
        if (existing) {
            existing.stop();
            this.scheduledTasks.delete(taskId);
        }

        // Update task
        const updatedTask = {
            ...this.tasksConfig.tasks[index],
            ...updates
        };
        this.tasksConfig.tasks[index] = updatedTask;
        await saveTasks(this.tasksConfig);

        // Reschedule if enabled
        if (updatedTask.enabled) {
            this.scheduleTask(updatedTask);
        }

        logger.info(`Updated task: ${updatedTask.name}`);
        return updatedTask;
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId: string): Promise<boolean> {
        const index = this.tasksConfig.tasks.findIndex(t => t.id === taskId);
        if (index === -1) {
            return false;
        }

        // Stop schedule
        const existing = this.scheduledTasks.get(taskId);
        if (existing) {
            existing.stop();
            this.scheduledTasks.delete(taskId);
        }

        // Remove task
        this.tasksConfig.tasks.splice(index, 1);
        await saveTasks(this.tasksConfig);

        logger.info(`Deleted task: ${taskId}`);
        return true;
    }

    /**
     * Get all tasks (always reload from file to ensure sync)
     */
    async getTasks(): Promise<Task[]> {
        // Reload from file to get any externally added tasks
        await this.reloadTasks();
        return this.tasksConfig.tasks;
    }

    /**
     * Get all tasks synchronously (uses cached data, may be stale)
     */
    getTasksSync(): Task[] {
        return this.tasksConfig.tasks;
    }

    /**
     * Reload tasks from file and schedule any new ones
     */
    async reloadTasks(): Promise<void> {
        const oldTaskIds = new Set(this.tasksConfig.tasks.map(t => t.id));
        this.tasksConfig = await loadTasks();

        // Schedule any new tasks that weren't previously scheduled
        for (const task of this.tasksConfig.tasks) {
            if (task.enabled && !this.scheduledTasks.has(task.id)) {
                this.scheduleTask(task);
                if (!oldTaskIds.has(task.id)) {
                    logger.info(`New task detected and scheduled: ${task.name}`);
                }
            }
        }
    }

    /**
     * Get task logs
     */
    getLogs(taskId?: string, limit: number = 50): TaskLogEntry[] {
        let logs = this.taskLogs;
        if (taskId) {
            logs = logs.filter(l => l.taskId === taskId);
        }
        return logs.slice(-limit);
    }

    /**
     * Update task status
     */
    private async updateTaskStatus(taskId: string, status: 'success' | 'error'): Promise<void> {
        const index = this.tasksConfig.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            this.tasksConfig.tasks[index].lastRun = new Date().toISOString();
            this.tasksConfig.tasks[index].lastStatus = status;
            await saveTasks(this.tasksConfig);
        }
    }

    /**
     * Log task execution
     */
    private logTask(
        taskId: string,
        taskName: string,
        status: 'started' | 'success' | 'error',
        message: string,
        duration?: number
    ): void {
        this.taskLogs.push({
            timestamp: new Date().toISOString(),
            taskId,
            taskName,
            status,
            message,
            duration
        });

        // Keep only last 500 logs
        if (this.taskLogs.length > 500) {
            this.taskLogs = this.taskLogs.slice(-500);
        }
    }

    /**
     * Stop all scheduled tasks
     */
    stopAll(): void {
        for (const [taskId, scheduledTask] of this.scheduledTasks) {
            scheduledTask.stop();
            logger.info(`Stopped task: ${taskId}`);
        }
        this.scheduledTasks.clear();
    }
}
