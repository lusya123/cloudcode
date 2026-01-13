# TypeScript 配置说明

## 为什么选择 TypeScript

### 优势

1. **类型安全** ✅
   - 编译时捕获错误
   - 减少运行时 bug
   - 更好的代码质量

2. **更好的开发体验** ✅
   - IDE 智能提示
   - 自动补全
   - 重构更安全

3. **Agent SDK 完整支持** ✅
   - 官方提供完整类型定义
   - API 更清晰
   - 减少查文档时间

4. **更易维护** ✅
   - 接口清晰
   - 代码自文档化
   - 团队协作更顺畅

### 成本

- ⚠️ 需要编译步骤
- ⚠️ 学习曲线（如果不熟悉 TS）
- ⚠️ 配置略复杂

**结论：收益 >> 成本，强烈推荐！**

---

## 项目配置

### 1. TypeScript 配置 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",           // 目标 JS 版本
    "module": "commonjs",         // 模块系统
    "outDir": "./dist",           // 输出目录
    "rootDir": "./src",           // 源码目录
    "strict": true,               // 严格模式
    "esModuleInterop": true,      // 兼容 CommonJS
    "skipLibCheck": true          // 跳过类型检查 node_modules
  }
}
```

### 2. 开发工具

**tsx - 开发时运行 TypeScript**
```bash
npm run dev   # 使用 tsx watch 自动重启
```

**tsc - 编译到生产代码**
```bash
npm run build # 编译到 dist/
npm start     # 运行编译后的代码
```

---

## 类型定义结构

### 目录组织

```
src/
├── types/
│   ├── config.ts       # 配置相关类型
│   ├── feishu.ts       # 飞书 API 类型
│   ├── session.ts      # 会话类型
│   └── task.ts         # 任务类型
```

### 示例：类型定义

**types/config.ts**
```typescript
export interface Credentials {
  feishu: {
    appId: string;
    appSecret: string;
    encryptKey?: string;
    verificationToken: string;
  };
  anthropic: {
    apiKey: string;
  };
}

export interface SessionMetadata {
  id: string;
  name: string;
  type: 'interactive' | 'project';
  workingDir: string;
  createdAt: string;
  lastUsed: string;
  messageCount: number;
}

export interface SessionsConfig {
  lastActive: string | null;
  sessions: SessionMetadata[];
}
```

**types/task.ts**
```typescript
export interface ScheduledTask {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  instruction: string;
  workingDir: string;
  context?: Record<string, any>;
  sessionId?: string | null;
  createdAt: string;
}

export interface TasksConfig {
  tasks: ScheduledTask[];
}
```

**types/feishu.ts**
```typescript
export interface FeishuMessage {
  userId: string;
  userName: string;
  message: string;
  messageId: string;
  chatId: string;
}

export interface FeishuWebhookBody {
  type: string;
  event?: {
    sender: {
      sender_id: {
        open_id: string;
        user_id: string;
      };
    };
    message: {
      message_type: string;
      content: string;
      message_id: string;
      chat_id: string;
    };
  };
  challenge?: string;
}
```

---

## 核心组件 TypeScript 版本

### 1. Feishu Adapter

**src/adapters/feishu-adapter.ts**

```typescript
import crypto from 'crypto';
import axios from 'axios';
import { loadCredentials } from '../utils/config-loader';
import type { FeishuMessage, FeishuWebhookBody } from '../types/feishu';
import type { Credentials } from '../types/config';

export class FeishuAdapter {
  private credentials: Credentials['feishu'];
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.credentials = loadCredentials().feishu;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    const response = await axios.post<{
      tenant_access_token: string;
      expire: number;
    }>(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: this.credentials.appId,
        app_secret: this.credentials.appSecret
      }
    );

    this.accessToken = response.data.tenant_access_token;
    this.tokenExpiry = Date.now() + (response.data.expire - 60) * 1000;

    return this.accessToken;
  }

  verifyWebhook(
    timestamp: string,
    nonce: string,
    encryptKey: string,
    signature: string
  ): boolean {
    const str = timestamp + nonce + encryptKey;
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return hash === signature;
  }

  async receiveMessage(webhookBody: FeishuWebhookBody): Promise<FeishuMessage | null> {
    const event = webhookBody.event;

    if (!event || event.message.message_type !== 'text') {
      return null;
    }

    return {
      userId: event.sender.sender_id.open_id,
      userName: event.sender.sender_id.user_id,
      message: JSON.parse(event.message.content).text,
      messageId: event.message.message_id,
      chatId: event.message.chat_id
    };
  }

  async sendMessage(message: string, chatId: string): Promise<void> {
    const token = await this.getAccessToken();

    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages',
      {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: message })
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          receive_id_type: 'chat_id'
        }
      }
    );
  }
}
```

### 2. Config Loader

**src/utils/config-loader.ts**

```typescript
import fs from 'fs';
import path from 'path';
import type { Credentials, SessionsConfig } from '../types/config';
import type { TasksConfig } from '../types/task';

const CONFIG_DIR = process.env.CONFIG_DIR || '/opt/cloud-claude/config';

export function loadCredentials(): Credentials {
  const filePath = path.join(CONFIG_DIR, 'credentials.json');
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as Credentials;
}

export function loadTasks(): TasksConfig {
  const filePath = path.join(CONFIG_DIR, 'tasks.json');

  if (!fs.existsSync(filePath)) {
    return { tasks: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as TasksConfig;
}

export function saveTasks(tasks: TasksConfig): void {
  const filePath = path.join(CONFIG_DIR, 'tasks.json');
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2));
}

export function loadSessions(): SessionsConfig {
  const filePath = path.join(CONFIG_DIR, 'sessions.json');

  if (!fs.existsSync(filePath)) {
    return { lastActive: null, sessions: [] };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as SessionsConfig;
}

export function saveSessions(sessions: SessionsConfig): void {
  const filePath = path.join(CONFIG_DIR, 'sessions.json');
  fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2));
}
```

---

## 开发流程

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（自动重启）
npm run dev

# 3. 类型检查（不编译）
npm run type-check
```

### 生产构建

```bash
# 1. 清理旧文件
npm run clean

# 2. 编译
npm run build

# 3. 运行
npm start

# 或使用 PM2
pm2 start dist/index.js --name cloud-claude
```

---

## TypeScript 最佳实践

### 1. 使用严格模式

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,              // 启用所有严格检查
    "noImplicitAny": true,       // 禁止隐式 any
    "strictNullChecks": true     // 严格 null 检查
  }
}
```

### 2. 定义清晰的接口

```typescript
// ❌ 不好
function handleMessage(msg: any) { }

// ✅ 好
function handleMessage(msg: FeishuMessage) { }
```

### 3. 使用类型守卫

```typescript
function isFeishuMessage(obj: any): obj is FeishuMessage {
  return obj &&
    typeof obj.userId === 'string' &&
    typeof obj.message === 'string';
}

// 使用
if (isFeishuMessage(data)) {
  // TypeScript 知道 data 是 FeishuMessage
  console.log(data.message);
}
```

### 4. 避免类型断言

```typescript
// ❌ 不好
const config = JSON.parse(content) as Credentials;

// ✅ 好 - 添加运行时验证
function parseCredentials(content: string): Credentials {
  const data = JSON.parse(content);

  if (!data.feishu || !data.anthropic) {
    throw new Error('Invalid credentials format');
  }

  return data as Credentials;
}
```

---

## 常见问题

### Q: 编译后的文件在哪里？
A: 在 `dist/` 目录下，与 `src/` 结构一致。

### Q: 开发时需要每次编译吗？
A: 不需要，使用 `npm run dev` 会自动使用 `tsx` 直接运行 TypeScript。

### Q: 如何处理第三方库没有类型定义？
A: 使用 `@types/` 包，或在 `src/types/global.d.ts` 中声明：

```typescript
declare module 'some-package' {
  export function someFunction(): void;
}
```

### Q: 生产环境运行 TypeScript 还是 JavaScript？
A: 运行编译后的 JavaScript（`dist/`），更快且稳定。

---

## 迁移指南（从 JS 到 TS）

如果已有 JavaScript 代码，迁移步骤：

1. **重命名文件**
   ```bash
   mv src/index.js src/index.ts
   ```

2. **添加类型注解（渐进式）**
   ```typescript
   // 开始时可以用 any
   function foo(x: any): any { }

   // 逐步细化
   function foo(x: string): number { }
   ```

3. **启用严格模式**
   ```json
   {
     "strict": false  // 开始
     // 逐步改为
     "strict": true
   }
   ```

---

## 总结

使用 TypeScript 的 CloudClaude 项目具有：

✅ **更高的代码质量** - 编译时类型检查
✅ **更好的开发体验** - IDE 智能提示
✅ **更易维护** - 接口清晰，自文档化
✅ **更少的 bug** - 运行前捕获错误
✅ **完整的 SDK 支持** - Agent SDK 原生 TypeScript

**推荐所有新项目使用 TypeScript！**
