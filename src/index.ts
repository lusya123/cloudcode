import http from 'http';
import express from 'express';
import { FeishuAdapter } from './adapters/feishu-adapter';
import { GatewayAgent } from './agents/gateway-agent';
import { SessionManager } from './managers/session-manager';
import { TaskScheduler } from './scheduler/task-scheduler';
import { getCoreTools } from './utils/tool-definitions';
import { EventBus } from './utils/event-bus';
import { Logger } from './utils/logger';
import { loadCredentials, loadMcpServers, loadProviderConfig } from './utils/config-loader';
import { McpClient } from './mcp/mcp-client';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});

const logger = new Logger('Server');
const credentials = loadCredentials();
const providerConfig = loadProviderConfig();

if (providerConfig.apiKey) {
  process.env.ANTHROPIC_API_KEY = providerConfig.apiKey;
} else {
  delete process.env.ANTHROPIC_API_KEY;
  logger.warn('Provider API key is empty. Update config/providers.json to enable AI calls.');
}
if (providerConfig.baseUrl) {
  process.env.ANTHROPIC_BASE_URL = providerConfig.baseUrl;
} else {
  delete process.env.ANTHROPIC_BASE_URL;
}

const server = http.createServer(app);
const eventBus = new EventBus(server);

const tools = getCoreTools();
const mcpClient = new McpClient();
const mcpConfig = loadMcpServers();

(async () => {
  for (const [name, config] of Object.entries(mcpConfig.servers)) {
    try {
      await mcpClient.connect(name, config);
      logger.info(`Connected MCP server: ${name}`);
    } catch (error: any) {
      logger.warn(`Failed to connect MCP server ${name}: ${error.message}`);
    }
  }
  const mcpTools = mcpClient.getAllTools();
  if (mcpTools.length) {
    tools.push(...mcpTools);
  }
})();

const sessionManager = new SessionManager({
  dataDir: process.env.DATA_DIR || `${process.cwd()}/data`,
  tools,
  mcpClient,
  providerConfig
});

const adapter = new FeishuAdapter();
const scheduler = new TaskScheduler(sessionManager, adapter, eventBus);
const gateway = new GatewayAgent(sessionManager, scheduler, eventBus);

scheduler.init();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/webhook/feishu', async (req, res) => {
  if (req.body?.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }

  const timestamp = req.headers['x-lark-request-timestamp'] as string | undefined;
  const nonce = req.headers['x-lark-request-nonce'] as string | undefined;
  const signature = req.headers['x-lark-signature'] as string | undefined;

  if (credentials.feishu.encryptKey && timestamp && nonce && signature) {
    const valid = adapter.verifyWebhook(timestamp, nonce, credentials.feishu.encryptKey, signature);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  if (!adapter.verifyToken(req.body)) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.json({ code: 0 });

  try {
    const message = await adapter.receiveMessage(req.body);
    if (!message) {
      return;
    }

    const reply = await gateway.handleMessage(message);
    await adapter.sendMessage(reply, message.chatId);
    return;
  } catch (error: any) {
    logger.error('Failed to process webhook message', { error: error.message });
    return;
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    let reply: string;
    if (sessionId) {
      reply = await sessionManager.executeInSession(sessionId, message);
    } else {
      reply = await gateway.handleMessage({ message, chatId: 'api' });
    }
    return res.json({ reply });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/history', async (_req, res) => {
  const sessions = await sessionManager.listSessions();
  res.json({ sessions });
});

app.get('/api/history/:id', async (req, res) => {
  const messages = await sessionManager.getSessionMessages(req.params.id);
  res.json({ messages });
});

app.get('/api/tasks', (_req, res) => {
  res.json({ tasks: scheduler.listTasks() });
});

app.post('/api/tasks', async (req, res) => {
  const task = req.body;
  if (!task?.name || !task?.cron || !task?.instruction || !task?.workingDir) {
    return res.status(400).json({ error: 'name, cron, instruction, workingDir required' });
  }
  try {
    await scheduler.addTask({
      id: `task_${Date.now()}`,
      name: task.name,
      cron: task.cron,
      enabled: task.enabled !== false,
      instruction: task.instruction,
      workingDir: task.workingDir,
      context: task.context,
      createdAt: new Date().toISOString()
    });
    return res.json({ status: 'ok' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:taskId/trigger', async (req, res) => {
  try {
    const result = await scheduler.triggerTask(req.params.taskId);
    res.json({ result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status', (_req, res) => {
  const memory = process.memoryUsage();
  res.json({
    uptime: process.uptime(),
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    sessions: sessionManager.listSessions(),
    tasks: scheduler.listTasks()
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  logger.info(`CloudClaude server listening on port ${port}`);
});
