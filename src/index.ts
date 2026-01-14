import express from 'express';
import bodyParser from 'body-parser';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FeishuAdapter } from './adapters/feishu-adapter';
import { GatewayAgent } from './agents/gateway-agent';
import { SessionManager } from './managers/session-manager';
import { TaskScheduler } from './scheduler/task-scheduler';
import { logger, LOG_DIR } from './utils/logger';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

async function main(): Promise<void> {
  const app = express();
  app.use(bodyParser.json({ limit: '2mb' }));

  const feishuAdapter = new FeishuAdapter(logger);
  await feishuAdapter.init();

  const sessionManager = new SessionManager({ dataDir: DATA_DIR, logger });
  await sessionManager.init();

  const taskScheduler = new TaskScheduler(feishuAdapter, sessionManager, logger, DATA_DIR);
  await taskScheduler.init();

  const gateway = new GatewayAgent(sessionManager, taskScheduler);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/webhook/feishu', async (req, res) => {
    if (req.body?.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    const timestamp = req.header('x-lark-request-timestamp') || '';
    const nonce = req.header('x-lark-request-nonce') || '';
    const signature = req.header('x-lark-signature') || '';

    const isValid = feishuAdapter.verifyWebhook(timestamp, nonce, signature);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    res.json({ code: 0 });

    try {
      const message = await feishuAdapter.receiveMessage(req.body);
      if (!message) {
        return;
      }

      const response = await gateway.handleMessage(message.message, message.chatId);
      if (response.reply) {
        await feishuAdapter.sendMessage(response.reply, message.chatId);
      }
    } catch (error) {
      logger.error('Webhook processing failed', { error });
    }
    return;
  });

  app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body as { message?: string; sessionId?: string };
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      if (sessionId) {
        await sessionManager.switchSession(sessionId);
      }
      const chatId = sessionId || 'web';
      const response = await gateway.handleMessage(message, chatId);
      if (sessionId && !response.sessionId) {
        response.sessionId = sessionId;
      }
      return res.json(response);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/history', (_req, res) => {
    res.json({ sessions: sessionManager.listSessions() });
  });

  app.get('/api/history/:id', async (req, res) => {
    const record = await sessionManager.getSession(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json({ session: record.metadata, messages: record.messages });
  });

  app.post('/api/history/:id/continue', async (req, res) => {
    const { message } = req.body as { message?: string };
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    try {
      const response = await sessionManager.executeInSession(message, { sessionId: req.params.id });
      return res.json(response);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/tasks', async (_req, res) => {
    const tasks = await taskScheduler.listTasks();
    res.json({ tasks });
  });

  app.post('/api/tasks/:id/trigger', async (req, res) => {
    try {
      await taskScheduler.triggerTask(req.params.id);
      res.json({ status: 'triggered' });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  app.get('/api/tasks/:id/logs', async (req, res) => {
    const logs = await taskScheduler.getTaskLogs(req.params.id);
    res.json({ logs });
  });

  app.get('/api/status', async (_req, res) => {
    const uptime = process.uptime();
    const tasks = await taskScheduler.listTasks();
    const sessions = sessionManager.listSessions();
    const cpuLoad = os.loadavg()[0];
    const cpuCount = os.cpus().length || 1;
    const cpu = Math.min(100, Math.round((cpuLoad / cpuCount) * 100));
    const memory = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
    const disk = getDiskUsage();

    res.json({
      uptime: formatUptime(uptime),
      activeSessions: sessions.length,
      taskCount: tasks.length,
      cpu,
      memory,
      disk
    });
  });

  app.get('/api/logs', async (_req, res) => {
    try {
      const logPath = path.join(LOG_DIR, 'combined.log');
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split(/\r?\n/).slice(-200);
      res.json({ logs: lines.map((line) => ({ line })) });
    } catch {
      res.json({ logs: [] });
    }
  });

  app.listen(PORT, () => {
    logger.info(`Server listening on ${PORT}`);
  });
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getDiskUsage(): number {
  try {
    const output = execSync('df -k /').toString().split(/\r?\n/)[1];
    const parts = output.trim().split(/\s+/);
    const total = Number(parts[1]);
    const used = Number(parts[2]);
    if (!total) {
      return 0;
    }
    return Math.round((used / total) * 100);
  } catch {
    return 0;
  }
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
