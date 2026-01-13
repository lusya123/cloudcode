# CloudClaude 前端设计文档

> 基于 Next.js 的极简管理界面
>
> 版本：1.0
> 日期：2026-01-13

---

## 目录

1. [设计原则](#设计原则)
2. [技术栈](#技术栈)
3. [页面结构](#页面结构)
4. [功能设计](#功能设计)
5. [API 设计](#api-设计)
6. [部署方案](#部署方案)

---

## 设计原则

### 核心理念

**极简、实用、快速**

- ✅ 无登录 - 单用户直接访问
- ✅ 极简 UI - 黑白灰配色，大量留白
- ✅ 实时更新 - WebSocket 推送状态
- ✅ 响应式 - 支持桌面和移动端

### 定位

前端是**管理和监控界面**，不是替代飞书：

- 飞书：日常对话交互（保留）
- 前端：查看历史、管理任务、系统监控

---

## 技术栈

### 前端框架

| 技术 | 版本 | 说明 |
|------|------|------|
| **Next.js** | 14+ | React 全栈框架，App Router |
| **TypeScript** | ^5.3.0 | 类型安全 |
| **Tailwind CSS** | ^3.4.0 | 原子化 CSS，极简风格 |
| **Shadcn/ui** | latest | 无依赖的组件库（可选） |
| **SWR** | ^2.2.0 | 数据获取和缓存 |

### 为什么选择这些？

**Next.js 14**
- App Router：更简洁的路由
- Server Components：性能更好
- API Routes：前后端一体

**Tailwind CSS**
- 极简风格的最佳选择
- 无需写 CSS 文件
- 响应式开箱即用

**SWR**
- 自动缓存和重新验证
- 实时数据更新
- 代码简洁

---

## 页面结构

### 整体布局

```
┌─────────────────────────────────────────────────┐
│  CloudClaude                    [系统状态] [⚙️]  │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│  侧边栏   │           主内容区                    │
│          │                                      │
│  💬 对话  │      [根据选择显示不同内容]           │
│  📚 历史  │                                      │
│  ⏰ 任务  │      唯一的输入框在对话页面            │
│  📊 监控  │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

### 目录结构

```
frontend/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 首页（主对话）
│   ├── history/
│   │   ├── page.tsx            # 历史记录列表
│   │   └── [id]/page.tsx       # 历史记录详情（可继续对话）
│   ├── tasks/
│   │   └── page.tsx            # 任务中心
│   ├── monitor/
│   │   └── page.tsx            # 系统监控
│   └── api/                    # API Routes
│       ├── chat/route.ts       # 对话 API
│       ├── history/route.ts    # 历史记录 API
│       ├── tasks/route.ts      # 任务 API
│       └── status/route.ts     # 状态 API
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # 侧边栏
│   │   └── Header.tsx          # 顶部栏
│   ├── chat/
│   │   ├── ChatBox.tsx         # 对话框（唯一输入位置）
│   │   └── MessageList.tsx     # 消息列表
│   ├── history/
│   │   ├── HistoryCard.tsx     # 历史记录卡片
│   │   └── HistoryList.tsx     # 历史记录列表
│   ├── tasks/
│   │   ├── TaskCard.tsx        # 任务卡片
│   │   └── TaskForm.tsx        # 任务表单
│   └── monitor/
│       ├── StatusCard.tsx      # 状态卡片
│       └── MetricsChart.tsx    # 指标图表
├── lib/
│   ├── api.ts                  # API 客户端
│   ├── types.ts                # 类型定义
│   └── utils.ts                # 工具函数
├── public/
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 功能设计

### 核心交互模式

**唯一输入位置**：只有主对话页面有输入框，这是与 Gateway Agent 交互的唯一入口。

**历史记录**：只读列表，点击后可查看详情并继续对话（此时切换到该会话）。

**所有操作**：创建任务、配置系统、管理会话等都通过主对话页面的自然语言完成。

---

### 1. 主对话页面（首页）

**路由**: `/`

**功能**:
- 与 Gateway Agent 对话（唯一输入位置）
- 查看当前对话历史
- 所有操作通过自然语言完成

**布局**:

```
┌─────────────────────────────────────────┐
│  与 Gateway Agent 对话                   │
├─────────────────────────────────────────┤
│                                         │
│  [消息历史]                              │
│                                         │
│  用户: 帮我检查服务器状态                │
│  Claude: 正在检查...                    │
│                                         │
│  用户: 创建一个每天12点的数据采集任务    │
│  Claude: 好的，请告诉我...              │
│                                         │
├─────────────────────────────────────────┤
│  [输入框]                        [发送]  │
└─────────────────────────────────────────┘
```

**核心组件**:

```tsx
// components/chat/ChatBox.tsx
export function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: input })
    });
    // 更新消息列表
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="与 Gateway Agent 对话..."
      />
    </div>
  );
}
```

---

### 2. 历史记录页面

**路由**: `/history`

**功能**:
- 查看所有历史项目会话（只读列表）
- 点击进入详情页查看完整对话
- 可以继续与历史会话对话

**布局**:

```
┌─────────────────────────────────────────┐
│  历史记录                                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📁 抖音数据分析项目              │   │
│  │ /home/projects/douyin-analyzer  │   │
│  │ 最后使用: 2小时前                │   │
│  │ 消息数: 50                       │   │
│  │                         [查看 →] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📁 服务器配置优化                │   │
│  │ /opt/cloud-claude               │   │
│  │ 最后使用: 昨天                   │   │
│  │ 消息数: 25                       │   │
│  │                         [查看 →] │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**历史详情页**:

**路由**: `/history/[id]`

```
┌─────────────────────────────────────────┐
│  ← 返回历史  |  抖音数据分析项目         │
├─────────────────────────────────────────┤
│                                         │
│  [完整对话历史 - 只读显示]               │
│                                         │
│  用户: 帮我创建抖音数据采集项目          │
│  Claude: 好的，工作目录是？              │
│  用户: /home/projects/douyin-analyzer   │
│  ...                                    │
│                                         │
├─────────────────────────────────────────┤
│  [输入框 - 继续对话]             [发送]  │
└─────────────────────────────────────────┘
```

**核心组件**:

```tsx
// components/history/HistoryCard.tsx
export function HistoryCard({ session }: { session: Session }) {
  return (
    <Link href={`/history/${session.id}`}>
      <div className="glass-card p-4 hover:glass-hover cursor-pointer">
        <h3 className="font-semibold">📁 {session.name}</h3>
        <p className="text-sm text-gray-500">{session.workingDir}</p>
        <p className="text-xs text-gray-400">
          最后使用: {formatTime(session.lastUsed)}
        </p>
        <p className="text-xs text-gray-400">
          消息数: {session.messageCount}
        </p>
      </div>
    </Link>
  );
}
```

---

### 3. 任务中心页面

**路由**: `/tasks`

**功能**:
- 查看定时任务列表（只读）
- 手动触发任务
- 查看任务执行历史
- 创建/编辑/删除任务需要在主对话页面通过自然语言完成

**布局**:

```
┌─────────────────────────────────────────┐
│  定时任务                                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⏰ 每日抖音数据采集              │   │
│  │ 时间: 每天 12:00                │   │
│  │ 状态: ✅ 启用                   │   │
│  │ 上次执行: 2小时前 (成功)        │   │
│  │                                 │   │
│  │ [立即执行] [查看日志]           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ⏰ 服务器健康检查                │   │
│  │ 时间: 每天 9:00, 18:00          │   │
│  │ 状态: ✅ 启用                   │   │
│  │ 上次执行: 4小时前 (成功)        │   │
│  │                                 │   │
│  │ [立即执行] [查看日志]           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  💡 提示: 在主对话页面说"创建新任务"    │
└─────────────────────────────────────────┘
```

**核心组件**:

```tsx
// components/tasks/TaskCard.tsx
export function TaskCard({ task }: { task: ScheduledTask }) {
  const [isRunning, setIsRunning] = useState(false);

  const triggerTask = async () => {
    setIsRunning(true);
    await fetch(`/api/tasks/${task.id}/trigger`, { method: 'POST' });
    setIsRunning(false);
  };

  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold">⏰ {task.name}</h3>
      <p className="text-sm text-gray-500">时间: {task.cron}</p>
      <p className="text-xs text-gray-400">
        状态: {task.enabled ? '✅ 启用' : '⏸️ 禁用'}
      </p>
      <div className="flex gap-2 mt-2">
        <button onClick={triggerTask} disabled={isRunning}>
          {isRunning ? '执行中...' : '立即执行'}
        </button>
        <button>查看日志</button>
      </div>
    </div>
  );
}
```

---

### 4. 系统监控页面

**路由**: `/monitor`

**功能**:
- 实时系统状态（只读）
- 资源使用情况
- 运行日志
- 错误告警

**布局**:

```
┌─────────────────────────────────────────┐
│  系统监控                               │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │ 运行时间  │ │ 活跃会话  │ │ 任务数  ││
│  │ 24小时   │ │    3     │ │   5    ││
│  └──────────┘ └──────────┘ └─────────┘│
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 资源使用                         │   │
│  │ CPU:  [████░░░░░░] 45%          │   │
│  │ 内存: [██████░░░░] 62%          │   │
│  │ 磁盘: [███░░░░░░░] 28%          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 最近日志                         │   │
│  │ [INFO] Task completed: 抖音采集  │   │
│  │ [INFO] Session created: xxx     │   │
│  │ [WARN] High memory usage        │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**核心组件**:

```tsx
// components/monitor/StatusCard.tsx
export function StatusCard() {
  const { data: status } = useSWR('/api/status', fetcher, {
    refreshInterval: 5000 // 每5秒刷新
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="border rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">运行时间</p>
        <p className="text-2xl font-bold">{status?.uptime}</p>
      </div>
      <div className="border rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">活跃会话</p>
        <p className="text-2xl font-bold">{status?.activeSessions}</p>
      </div>
      <div className="border rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">任务数</p>
        <p className="text-2xl font-bold">{status?.taskCount}</p>
      </div>
    </div>
  );
}
```

---

## API 设计

### 后端 API 扩展

需要在现有后端添加以下 API：

#### 1. 对话 API

```typescript
// POST /api/chat
interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface ChatResponse {
  reply: string;
  sessionId: string;
}
```

#### 2. 历史记录 API

```typescript
// GET /api/history
interface HistoryResponse {
  sessions: Session[];
}

// GET /api/history/:id
interface HistoryDetailResponse {
  session: Session;
  messages: Message[];
}

// POST /api/history/:id/continue
interface ContinueChatRequest {
  message: string;
}
```

#### 3. 任务 API

```typescript
// GET /api/tasks
interface TasksResponse {
  tasks: ScheduledTask[];
}

// POST /api/tasks/:id/trigger
// 手动触发任务

// GET /api/tasks/:id/logs
interface TaskLogsResponse {
  logs: Array<{
    timestamp: string;
    status: 'success' | 'error';
    message: string;
  }>;
}

// 注意: 创建/编辑/删除任务通过主对话 API 完成
```

#### 4. 状态 API

```typescript
// GET /api/status
interface StatusResponse {
  uptime: string;
  activeSessions: number;
  taskCount: number;
  cpu: number;
  memory: number;
  disk: number;
}

// GET /api/logs
interface LogsResponse {
  logs: Array<{
    level: string;
    message: string;
    timestamp: string;
  }>;
}
```

---

## 部署方案

### 方案 A：独立部署（推荐）

前端和后端分开部署：

```
前端: http://your-domain.com (Next.js)
后端: http://your-domain.com/api (Express)
```

**Nginx 配置**:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3001;  # Next.js
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:3000;  # Express
    }

    # Webhook（飞书）
    location /webhook {
        proxy_pass http://localhost:3000;
    }
}
```

### 方案 B：集成部署

将 Next.js 构建为静态文件，由 Express 提供：

```typescript
// 后端 src/index.ts
import express from 'express';
import path from 'path';

const app = express();

// API 路由
app.use('/api', apiRouter);
app.use('/webhook', webhookRouter);

// 静态文件（Next.js 构建产物）
app.use(express.static(path.join(__dirname, '../frontend/out')));

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/out/index.html'));
});
```

**推荐方案 A**，因为：
- 前后端独立开发
- 更新前端不影响后端
- 更容易调试

---

## 开发计划

### 时间估算

| 阶段 | 任务 | 时间 |
|------|------|------|
| **Day 1-2** | Next.js 项目初始化 + 布局 | 2天 |
| **Day 3-4** | 对话页面 + API 集成 | 2天 |
| **Day 5** | 会话管理页面 | 1天 |
| **Day 6** | 任务中心页面 | 1天 |
| **Day 7** | 系统监控页面 | 1天 |
| **Day 8** | 后端 API 扩展 | 1天 |
| **Day 9** | 集成测试 | 1天 |
| **Day 10** | 部署和优化 | 1天 |

**总计：10 天（2 周）**

---

## 设计规范（Notion/Apple 玻璃质感风格）

### 配色方案

```css
/* 主色调：柔和的灰白 + 玻璃质感 */
--bg-primary: #fafafa;           /* 浅灰背景 */
--bg-glass: rgba(255, 255, 255, 0.7);  /* 玻璃效果 */
--bg-glass-hover: rgba(255, 255, 255, 0.9);
--text-primary: #37352f;         /* Notion 风格深灰 */
--text-secondary: #787774;       /* 次要文字 */
--border: rgba(0, 0, 0, 0.06);   /* 半透明边框 */
--accent: #2383e2;               /* 蓝色强调（Apple 风格） */
--shadow: 0 1px 3px rgba(0, 0, 0, 0.05);  /* 轻微阴影 */
```

### 玻璃质感效果

```css
/* 玻璃卡片 */
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}

/* 侧边栏玻璃效果 */
.glass-sidebar {
  background: rgba(247, 247, 247, 0.8);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

/* 悬浮效果 */
.glass-hover:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 组件风格

- **卡片**: 玻璃质感，圆角 12px，轻微阴影
- **按钮**: 半透明背景，hover 时增强玻璃效果
- **输入框**: 玻璃质感，圆角 8px
- **间距**: 统一使用 4 的倍数（4px, 8px, 16px, 24px）
- **动画**: 使用 cubic-bezier(0.4, 0, 0.2, 1) 缓动

### 字体

```css
/* Apple 系统字体 */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
```

### 视觉层次

```
背景层 (最底层)
  ↓
玻璃卡片层 (backdrop-filter)
  ↓
内容层
  ↓
悬浮层 (hover 状态)
```

### Tailwind 配置扩展

```javascript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.7)',
          dark: 'rgba(247, 247, 247, 0.8)',
        }
      },
      backdropBlur: {
        xs: '2px',
        glass: '20px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.12)',
      }
    }
  }
}
```

---

## package.json

```json
{
  "name": "cloud-claude-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "swr": "^2.2.4",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.3"
  }
}
```

---

## 总结

这个前端设计：

✅ **单一输入** - 只有主对话页面有输入框，与 Gateway Agent 交互
✅ **历史归档** - 历史记录为只读列表，点击可查看并继续对话
✅ **自然语言操作** - 所有配置、任务创建通过对话完成
✅ **极简** - 玻璃质感，Notion/Apple 风格
✅ **实用** - 4 个核心页面，功能清晰
✅ **快速** - Next.js + SWR，性能优秀
✅ **易维护** - TypeScript + 组件化
✅ **无登录** - 单用户直接访问

**核心交互模式**：
- 主对话页面 = 唯一输入位置
- 历史页面 = 只读归档 + 可继续对话
- 任务/监控页面 = 只读展示

**预计开发时间：10 天（2 周）**

---

**下一步**：
1. 初始化 Next.js 项目
2. 创建基础布局和路由（主对话、历史、任务、监控）
3. 实现主对话页面（唯一输入位置）
4. 实现历史记录页面（只读列表 + 详情页）
5. 实现任务和监控页面（只读展示）
6. 扩展后端 API
7. 集成测试和部署
