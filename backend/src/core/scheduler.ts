import cron from 'node-cron';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledTask {
    id: string;
    name: string;
    cron: string;
    instruction: string;
    enabled: boolean;
    lastRun?: number;
    lastStatus?: 'success' | 'failure';
}

export class TaskScheduler {
    private tasks: Map<string, ScheduledTask> = new Map();
    private jobs: Map<string, cron.ScheduledTask> = new Map();

    constructor() {
        // Load persisted tasks if any (Stub)
    }

    addTask(task: Omit<ScheduledTask, 'id' | 'enabled'>): ScheduledTask {
        const newTask: ScheduledTask = {
            id: uuidv4(),
            enabled: true,
            ...task
        };

        this.tasks.set(newTask.id, newTask);
        this.scheduleJob(newTask);

        logger.info(`Task added: ${newTask.name}`);
        return newTask;
    }

    private scheduleJob(task: ScheduledTask) {
        if (this.jobs.has(task.id)) {
            this.jobs.get(task.id)?.stop();
        }

        if (!task.enabled) return;

        try {
            const job = cron.schedule(task.cron, async () => {
                logger.info(`Running task: ${task.name}`);
                // Here we would create a temporary Session and have the GatewayAgent execute the instruction
                // For MVP, just log
                task.lastRun = Date.now();
                task.lastStatus = 'success';
            });
            this.jobs.set(task.id, job);
        } catch (e) {
            logger.error(`Failed to schedule task ${task.name}:`, e);
        }
    }

    getTasks(): ScheduledTask[] {
        return Array.from(this.tasks.values());
    }
}
