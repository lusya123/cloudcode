import cron from 'node-cron';
import type { ScheduledTask, TasksConfig } from '../types/task';
import { loadTasks, saveTasks } from '../utils/config-loader';
import { SessionManager } from '../managers/session-manager';
import type { FeishuAdapter } from '../adapters/feishu-adapter';
import type { EventBus } from '../utils/event-bus';
import { Logger } from '../utils/logger';

export class TaskScheduler {
  private sessionManager: SessionManager;
  private adapter?: FeishuAdapter;
  private tasksConfig: TasksConfig;
  private eventBus?: EventBus;
  private logger: Logger;

  constructor(sessionManager: SessionManager, adapter?: FeishuAdapter, eventBus?: EventBus) {
    this.sessionManager = sessionManager;
    this.adapter = adapter;
    this.tasksConfig = loadTasks();
    this.eventBus = eventBus;
    this.logger = new Logger('TaskScheduler');
  }

  init(): void {
    this.tasksConfig.tasks.forEach(task => {
      if (task.enabled) {
        cron.schedule(task.cron, () => this.executeTask(task));
      }
    });
  }

  async addTask(task: ScheduledTask): Promise<void> {
    this.tasksConfig.tasks.push(task);
    saveTasks(this.tasksConfig);
    if (task.enabled) {
      cron.schedule(task.cron, () => this.executeTask(task));
    }
  }

  listTasks(): ScheduledTask[] {
    return [...this.tasksConfig.tasks];
  }

  async executeTask(task: ScheduledTask): Promise<void> {
    try {
      await this.notify(`Scheduled task started: ${task.name}`);
      const result = await this.sessionManager.executeEphemeralTask(task.instruction, task.workingDir);
      await this.notify(`Scheduled task completed: ${task.name}\n\n${result}`);
      this.eventBus?.broadcast('task_completed', { taskId: task.id, result });
    } catch (error: any) {
      const message = `Scheduled task failed: ${task.name}\n${error.message}`;
      await this.notify(message);
      this.eventBus?.broadcast('task_failed', { taskId: task.id, error: error.message });
      this.logger.error(message);
    }
  }

  async triggerTask(taskId: string): Promise<string> {
    const task = this.tasksConfig.tasks.find(item => item.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    await this.executeTask(task);
    return `Triggered task ${task.name}`;
  }

  private async notify(message: string): Promise<void> {
    if (!this.adapter) {
      return;
    }
    const defaultChatId = process.env.FEISHU_CHAT_ID;
    if (!defaultChatId) {
      return;
    }
    await this.adapter.sendMessage(message, defaultChatId);
  }
}
