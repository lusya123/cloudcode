import cron from 'node-cron';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { Logger } from 'winston';
import type { ScheduledTask, TaskLogEntry } from '../types/task';
import { loadTasks, saveTasks } from '../utils/config-loader';
import type { SessionManager } from '../managers/session-manager';
import type { FeishuAdapter } from '../adapters/feishu-adapter';

export class TaskScheduler {
  private adapter: FeishuAdapter;
  private sessionManager: SessionManager;
  private logger?: Logger;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private dataDir: string;

  constructor(adapter: FeishuAdapter, sessionManager: SessionManager, logger?: Logger, dataDir?: string) {
    this.adapter = adapter;
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
  }

  async init(): Promise<void> {
    const tasksConfig = await loadTasks();

    for (const task of tasksConfig.tasks) {
      if (task.enabled) {
        this.registerTask(task);
      }
    }
  }

  async listTasks(): Promise<ScheduledTask[]> {
    const tasksConfig = await loadTasks();
    return tasksConfig.tasks;
  }

  async addTask(task: ScheduledTask): Promise<void> {
    const tasksConfig = await loadTasks();
    tasksConfig.tasks.push(task);
    await saveTasks(tasksConfig);

    if (task.enabled) {
      this.registerTask(task);
    }
  }

  async triggerTask(taskId: string): Promise<void> {
    const tasksConfig = await loadTasks();
    const task = tasksConfig.tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    await this.executeTask(task);
  }

  async getTaskLogs(taskId: string): Promise<TaskLogEntry[]> {
    const filePath = this.getLogsPath(taskId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as TaskLogEntry[];
    } catch {
      return [];
    }
  }

  private registerTask(task: ScheduledTask): void {
    const scheduledTask = cron.schedule(task.cron, () => {
      this.executeTask(task).catch((error) => {
        this.logger?.error('Scheduled task failed', { taskId: task.id, error });
      });
    });

    this.scheduledTasks.set(task.id, scheduledTask);
    this.logger?.info('Task scheduled', { id: task.id, cron: task.cron });
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    const startMessage = `Scheduled task started: ${task.name}`;
    this.logger?.info(startMessage, { taskId: task.id });
    await this.appendLog(task.id, { timestamp: new Date().toISOString(), status: 'running', message: startMessage });

    try {
      await this.adapter.sendMessage(`[TASK] ${task.name} started`, task.context?.chatId);
    } catch {
      // ignore notification failures
    }

    try {
      const result = await this.sessionManager.executeEphemeralTask(task);
      const successMessage = `Task completed: ${task.name}`;
      await this.appendLog(task.id, {
        timestamp: new Date().toISOString(),
        status: 'success',
        message: `${successMessage}\n${result}`
      });
      await this.adapter.sendMessage(`[OK] ${task.name} completed\n\n${result}`, task.context?.chatId);
    } catch (error: any) {
      const failMessage = `Task failed: ${task.name}`;
      await this.appendLog(task.id, {
        timestamp: new Date().toISOString(),
        status: 'error',
        message: `${failMessage}\n${error.message}`
      });
      await this.adapter.sendMessage(`[ERROR] ${task.name} failed\n${error.message}`, task.context?.chatId);
    }
  }

  private async appendLog(taskId: string, entry: TaskLogEntry): Promise<void> {
    const logs = await this.getTaskLogs(taskId);
    logs.push(entry);
    const filePath = this.getLogsPath(taskId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(logs.slice(-200), null, 2));
  }

  private getLogsPath(taskId: string): string {
    return path.join(this.dataDir, 'tasks', taskId, 'logs.json');
  }
}
