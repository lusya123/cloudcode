# CloudClaude - 完整系统设计文档

> 基于 Claude Agent SDK 的 24/7 云端智能助手
>
> 版本：1.0
> 日期：2024-01-13

---

## 目录

1. [重要说明](#重要说明)
2. [系统概览](#系统概览)
3. [Agent 能力要求](#agent-能力要求)
4. [工具执行器](#工具执行器tool-executor)
5. [Agentic Loop](#agentic-loop代理执行循环)
6. [安全机制](#安全机制)
7. [上下文持久化](#上下文持久化)
8. [Sub-agents](#sub-agents子代理)
9. [Hooks 事件系统](#hooks-事件系统)
10. [MCP 集成](#mcpmodel-context-protocol集成)
11. [CLAUDE.md 项目记忆](#claudemd-项目记忆)
12. [技术选型](#技术选型)
13. [系统架构](#系统架构)
14. [配置文件设计](#配置文件设计)
15. [核心组件实现](#核心组件实现)
16. [部署指南](#部署指南)
17. [使用示例](#使用示例)
18. [开发计划](#开发计划)

---

## 重要说明

> ⚠️ **核心理解**：Claude API 本身只是一个大语言模型，它只能输出文本或 `tool_use` 请求。当 Claude 说"我要执行 `ls -la`"时，它只是**输出了这段文字**，并不会真的执行。
>
> **真正执行命令的是后端代码**。CloudClaude 必须实现完整的**工具执行器（Tool Executor）**，才能让 Agent 真正具备执行能力。

---

## 系统概览

### 核心理念

**云服务器就是 Claude 的私人电脑**，用户通过飞书与 Claude 进行自然语言交互，支持：
- ✅ 多任务并发执行
- ✅ 定时任务自动运行
- ✅ 会话管理和上下文保持
- ✅ 自然语言配置系统
- ✅ 24/7 无间断运行

### 核心特性

| 特性 | 说明 |
|------|------|
| **完整 Agent 能力** | 像 Claude Code 一样，能执行命令、编辑文件、完成复杂任务 |
| **混合交互模式** | 智能判断用户意图，关键决策点请求确认 |
| **多工作目录** | 每个会话/任务可以在不同目录工作 |
| **临时任务** | 不需要会话的一次性任务快速执行 |
| **定时任务** | Cron 调度，自动执行并推送结果 |
| **Skills 支持** | 完整支持 Claude Code Skills |
| **资源优化** | 适配 2核4G 云服务器 |

---

## Agent 能力要求

CloudClaude 必须具备完整的 Agent 能力，运行起来就像 Claude Code 一样，能够完成 Claude Code 能做的所有事情。

### 核心 Agent 能力

#### 1. 命令执行能力

系统必须能够执行各种命令：

| 能力 | 说明 | 示例 |
|------|------|------|
| **Linux 命令** | 执行任意 Linux/Shell 命令 | `ls`, `grep`, `curl`, `docker` |
| **包管理** | 安装和管理软件包 | `npm install`, `pip install`, `apt install` |
| **进程管理** | 启动、停止、监控进程 | `pm2 start`, `systemctl`, `kill` |
| **网络操作** | HTTP 请求、API 调用 | `curl`, `wget`, API 集成 |
| **文件系统** | 创建、删除、移动文件和目录 | `mkdir`, `rm`, `mv`, `cp` |

#### 2. 文件编辑能力

系统必须能够读取和修改文件：

| 能力 | 说明 |
|------|------|
| **读取文件** | 读取任意文本文件内容 |
| **编辑文件** | 精确修改文件的指定部分 |
| **创建文件** | 创建新文件并写入内容 |
| **搜索文件** | 在文件中搜索内容（grep 能力） |
| **批量操作** | 批量重命名、替换等 |

#### 3. 定时任务执行能力

定时任务必须具备完整的 Agent 能力：

```
定时任务触发
  ↓
创建临时 Agent Session
  ↓
执行任务指令（具备完整 Agent 能力）
  ├─→ 执行 Shell 命令
  ├─→ 读取/修改文件
  ├─→ 调用 API
  └─→ 运行脚本
  ↓
收集执行结果
  ↓
推送通知到飞书
```

**示例：每日抖音数据采集任务**
```json
{
  "id": "task_douyin",
  "name": "每日抖音数据采集",
  "cron": "0 12 * * *",
  "instruction": "运行 /home/projects/douyin/collect.py，采集数据后更新到飞书表格",
  "workingDir": "/home/projects/douyin",
  "context": {
    "script": "collect.py",
    "bitable": { "appToken": "xxx", "tableId": "xxx" }
  }
}
```

执行时，Agent 会：
1. `cd /home/projects/douyin`
2. `python collect.py`
3. 解析输出结果
4. 调用飞书 API 更新表格
5. 将结果推送给用户

### Skills 系统

#### Skills 加载路径

Claude Code / Agent SDK 的 Skills 加载机制：

| 路径 | 说明 | 优先级 |
|------|------|--------|
| `~/.claude/skills/` | **全局 Skills**（用户主目录） | 所有会话都能使用 |
| `<工作目录>/.claude/skills/` | **项目 Skills**（当前工作目录） | 仅该项目会话使用 |

**CloudClaude 的 Skills 存放位置**：

```
# 全局 Skills（推荐，所有会话共享）
~/.claude/skills/
├── feishu-bitable/
│   └── skill.md
├── server-monitor/
│   └── skill.md
└── data-collector/
    └── skill.md

# 项目 Skills（可选，特定项目使用）
/home/projects/douyin-analyzer/.claude/skills/
└── douyin-collector/
    └── skill.md
```

#### 预置 Skills

系统应预置一些常用 Skills 到全局目录（`~/.claude/skills/`），让所有会话都能使用：

| Skill | 用途 | 说明 |
|-------|------|------|
| **feishu-bitable** | 飞书多维表格操作 | 读取、写入、更新表格数据 |
| **server-monitor** | 服务器监控 | 检查 CPU、内存、磁盘、进程 |
| **git-operations** | Git 操作 | 提交、推送、拉取、合并 |
| **docker-manage** | Docker 管理 | 容器启停、镜像管理 |
| **data-collector** | 数据采集 | 网页爬取、API 调用 |

**示例 Skill: feishu-bitable**
```markdown
---
name: feishu-bitable
description: 操作飞书多维表格
---

## 使用场景
当需要读取或写入飞书多维表格时使用此 Skill。

## 前置条件
- 需要 App Token 和 Table ID
- 需要飞书应用有表格读写权限

## 操作步骤
1. 获取 tenant_access_token
2. 调用 Bitable API
3. 处理返回数据

## API 参考
- 读取记录: GET /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
- 写入记录: POST /open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records
```

#### 自定义 Skills

用户可以通过对话创建自定义 Skills：

```
用户: "帮我创建一个 skill，用来采集抖音账号数据"

系统: "好的，我来创建这个 Skill。请告诉我：
      1. 采集哪些数据？（粉丝数、点赞数等）
      2. 数据源是什么？（API、网页）
      3. 输出格式是什么？（JSON、表格）
      4. 这个 Skill 是全局使用还是仅限某个项目？"

用户: "采集粉丝数和作品数，从抖音开放平台 API，输出 JSON，全局使用"

系统: "✅ 已创建 Skill: douyin-collector
      位置: ~/.claude/skills/douyin-collector/skill.md

      这个 Skill 会：
      1. 调用抖音开放平台 API
      2. 获取指定账号的粉丝数和作品数
      3. 返回 JSON 格式数据

      所有会话都可以使用这个 Skill"
```

### Agent 工具集

Agent 需要具备以下工具：

| 工具 | 功能 | 对应 Claude Code |
|------|------|-----------------|
| **Bash** | 执行 Shell 命令 | Bash tool |
| **Read** | 读取文件内容 | Read tool |
| **Write** | 写入文件 | Write tool |
| **Edit** | 编辑文件 | Edit tool |
| **Glob** | 文件模式匹配 | Glob tool |
| **Grep** | 内容搜索 | Grep tool |
| **WebFetch** | HTTP 请求 | WebFetch tool |

**实现方式**：使用 Claude Agent SDK 的工具定义功能，并实现对应的工具执行器。

---

## 工具执行器（Tool Executor）

> 🔴 **这是 CloudClaude 能否真正"执行"的核心组件**

### 为什么需要工具执行器

```
用户消息 → 后端调用 Claude API
                ↓
          Claude 返回 tool_use: Bash("ls -la")
                ↓
          ┌─────────────────────────────────────┐
          │  工具执行器（Tool Executor）        │  ← 必须实现
          │  真正执行 ls -la 命令               │
          │  返回执行结果                       │
          └─────────────────────────────────────┘
                ↓
          把结果发回 Claude API
                ↓
          Claude 生成最终回复 → 推送到飞书
```

如果不实现工具执行器，Claude 只能"纸上谈兵"——它会说"我执行了命令"，但实际上什么都没发生。

### 完整工具 Schema 定义

#### 1. Bash 工具

```typescript
interface BashInput {
  command: string;           // 要执行的命令（必填）
  timeout?: number;          // 超时时间，毫秒，最大 600000（10分钟）
  description?: string;      // 命令描述
  run_in_background?: boolean; // 是否后台运行
}

interface BashOutput {
  output: string;            // 命令输出
  exitCode: number;          // 退出码
  killed?: boolean;          // 是否被终止
  shellId?: string;          // 后台运行时的 Shell ID
}
```

#### 2. Read 工具

```typescript
interface ReadInput {
  file_path: string;         // 文件绝对路径（必填）
  offset?: number;           // 起始行号
  limit?: number;            // 读取行数
}

interface ReadOutput {
  content: string;           // 文件内容（带行号）
  total_lines: number;       // 文件总行数
  lines_returned: number;    // 返回的行数
}
```

#### 3. Write 工具

```typescript
interface WriteInput {
  file_path: string;         // 文件绝对路径（必填）
  content: string;           // 要写入的内容（必填）
}

interface WriteOutput {
  message: string;           // 操作结果消息
  bytes_written: number;     // 写入字节数
}
```

#### 4. Edit 工具

```typescript
interface EditInput {
  file_path: string;         // 文件绝对路径（必填）
  old_string: string;        // 要替换的文本（必填）
  new_string: string;        // 替换后的文本（必填）
  replace_all?: boolean;     // 是否替换所有匹配项
}

interface EditOutput {
  message: string;           // 操作结果消息
  replacements: number;      // 替换次数
}
```

#### 5. Glob 工具

```typescript
interface GlobInput {
  pattern: string;           // Glob 模式（必填），如 "**/*.ts"
  path?: string;             // 搜索目录，默认当前目录
}

interface GlobOutput {
  matches: string[];         // 匹配的文件列表
  count: number;             // 匹配数量
}
```

#### 6. Grep 工具

```typescript
interface GrepInput {
  pattern: string;           // 正则表达式（必填）
  path?: string;             // 搜索路径
  glob?: string;             // 文件过滤模式
  output_mode?: 'content' | 'files_with_matches' | 'count';
  '-i'?: boolean;            // 忽略大小写
  '-n'?: boolean;            // 显示行号
  '-B'?: number;             // 显示匹配行前 N 行
  '-A'?: number;             // 显示匹配行后 N 行
  '-C'?: number;             // 显示匹配行前后 N 行
  head_limit?: number;       // 限制返回数量
  multiline?: boolean;       // 多行模式
}

interface GrepOutput {
  matches: Array<{
    file: string;
    line_number?: number;
    line: string;
    before_context?: string[];
    after_context?: string[];
  }>;
  total_matches: number;
}
```

#### 7. WebFetch 工具

```typescript
interface WebFetchInput {
  url: string;               // URL（必填）
  prompt: string;            // 处理提示（必填）
}

interface WebFetchOutput {
  content: string;           // 处理后的内容
  status: number;            // HTTP 状态码
}
```

#### 8. TodoWrite 工具

```typescript
interface TodoWriteInput {
  todos: Array<{
    content: string;         // 任务内容
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;      // 进行时描述
  }>;
}

interface TodoWriteOutput {
  message: string;
  stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
}
```

#### 9. Task 工具（子代理调用）

```typescript
interface TaskInput {
  description: string;       // 任务简述
  prompt: string;            // 任务详细指令
  subagent_type: string;     // 子代理类型
  model?: 'sonnet' | 'opus' | 'haiku'; // 模型选择
  run_in_background?: boolean;
}

interface TaskOutput {
  result: string;            // 执行结果
  agent_id: string;          // 代理 ID
  duration_ms?: number;      // 执行时长
}
```

#### 10. AskUserQuestion 工具

```typescript
interface AskUserQuestionInput {
  questions: Array<{
    question: string;        // 问题内容
    header: string;          // 简短标签（最多12字符）
    options: Array<{
      label: string;         // 选项标签
      description: string;   // 选项说明
    }>;
    multiSelect?: boolean;   // 是否多选
  }>;
}

interface AskUserQuestionOutput {
  answers: Record<string, string>; // 用户回答
}
```

### 工具执行器实现

**文件**: `src/executors/tool-executor.ts`

```typescript
import { exec, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ToolExecutor {
  private workingDir: string;
  private bashSessions: Map<string, any> = new Map();

  constructor(workingDir: string) {
    this.workingDir = workingDir;
  }

  /**
   * 执行工具调用
   */
  async execute(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'Bash':
        return this.executeBash(input);
      case 'Read':
        return this.executeRead(input);
      case 'Write':
        return this.executeWrite(input);
      case 'Edit':
        return this.executeEdit(input);
      case 'Glob':
        return this.executeGlob(input);
      case 'Grep':
        return this.executeGrep(input);
      case 'WebFetch':
        return this.executeWebFetch(input);
      case 'TodoWrite':
        return this.executeTodoWrite(input);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Bash 命令执行
   */
  private async executeBash(input: BashInput): Promise<BashOutput> {
    const timeout = input.timeout || 120000; // 默认 2 分钟

    try {
      const { stdout, stderr } = await execAsync(input.command, {
        cwd: this.workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: { ...process.env, PATH: process.env.PATH }
      });

      return {
        output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : ''),
        exitCode: 0
      };
    } catch (error: any) {
      return {
        output: error.stdout || '' + '\n' + (error.stderr || error.message),
        exitCode: error.code || 1,
        killed: error.killed
      };
    }
  }

  /**
   * 读取文件
   */
  private async executeRead(input: ReadInput): Promise<ReadOutput> {
    const filePath = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.join(this.workingDir, input.file_path);

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const offset = input.offset || 0;
    const limit = input.limit || 2000;
    const selectedLines = lines.slice(offset, offset + limit);

    // 添加行号（模拟 cat -n 格式）
    const numberedContent = selectedLines
      .map((line, i) => `${String(offset + i + 1).padStart(6)}\t${line}`)
      .join('\n');

    return {
      content: numberedContent,
      total_lines: lines.length,
      lines_returned: selectedLines.length
    };
  }

  /**
   * 写入文件
   */
  private async executeWrite(input: WriteInput): Promise<WriteOutput> {
    const filePath = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.join(this.workingDir, input.file_path);

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.content, 'utf-8');

    return {
      message: `Successfully wrote to ${filePath}`,
      bytes_written: Buffer.byteLength(input.content, 'utf-8')
    };
  }

  /**
   * 编辑文件
   */
  private async executeEdit(input: EditInput): Promise<EditOutput> {
    const filePath = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.join(this.workingDir, input.file_path);

    let content = await fs.readFile(filePath, 'utf-8');

    let replacements = 0;
    if (input.replace_all) {
      const regex = new RegExp(this.escapeRegex(input.old_string), 'g');
      const matches = content.match(regex);
      replacements = matches ? matches.length : 0;
      content = content.replace(regex, input.new_string);
    } else {
      if (content.includes(input.old_string)) {
        content = content.replace(input.old_string, input.new_string);
        replacements = 1;
      }
    }

    if (replacements === 0) {
      throw new Error(`old_string not found in file: ${input.old_string.substring(0, 50)}...`);
    }

    await fs.writeFile(filePath, content, 'utf-8');

    return {
      message: `Successfully edited ${filePath}`,
      replacements
    };
  }

  /**
   * Glob 文件匹配
   */
  private async executeGlob(input: GlobInput): Promise<GlobOutput> {
    const searchPath = input.path || this.workingDir;
    const matches = await glob(input.pattern, {
      cwd: searchPath,
      absolute: true,
      nodir: true
    });

    return {
      matches: matches.sort(),
      count: matches.length
    };
  }

  /**
   * Grep 内容搜索（使用 ripgrep）
   */
  private async executeGrep(input: GrepInput): Promise<GrepOutput> {
    const args = ['--json'];

    if (input['-i']) args.push('-i');
    if (input['-n']) args.push('-n');
    if (input['-B']) args.push('-B', String(input['-B']));
    if (input['-A']) args.push('-A', String(input['-A']));
    if (input['-C']) args.push('-C', String(input['-C']));
    if (input.glob) args.push('--glob', input.glob);
    if (input.multiline) args.push('-U', '--multiline-dotall');

    args.push(input.pattern);
    args.push(input.path || this.workingDir);

    try {
      const { stdout } = await execAsync(`rg ${args.join(' ')}`, {
        cwd: this.workingDir,
        maxBuffer: 10 * 1024 * 1024
      });

      // 解析 ripgrep JSON 输出
      const matches = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line))
        .filter(item => item.type === 'match')
        .map(item => ({
          file: item.data.path.text,
          line_number: item.data.line_number,
          line: item.data.lines.text.trim()
        }));

      return {
        matches: input.head_limit ? matches.slice(0, input.head_limit) : matches,
        total_matches: matches.length
      };
    } catch (error) {
      return { matches: [], total_matches: 0 };
    }
  }

  /**
   * WebFetch 网页获取
   */
  private async executeWebFetch(input: WebFetchInput): Promise<WebFetchOutput> {
    const axios = require('axios');
    const TurndownService = require('turndown');

    const response = await axios.get(input.url, {
      timeout: 30000,
      headers: { 'User-Agent': 'CloudClaude/1.0' }
    });

    // HTML 转 Markdown
    const turndown = new TurndownService();
    const markdown = turndown.turndown(response.data);

    return {
      content: markdown.substring(0, 50000), // 限制长度
      status: response.status
    };
  }

  /**
   * TodoWrite 任务管理
   */
  private async executeTodoWrite(input: TodoWriteInput): Promise<TodoWriteOutput> {
    // 存储到内存或文件
    const stats = {
      total: input.todos.length,
      pending: input.todos.filter(t => t.status === 'pending').length,
      in_progress: input.todos.filter(t => t.status === 'in_progress').length,
      completed: input.todos.filter(t => t.status === 'completed').length
    };

    return {
      message: 'Todos updated successfully',
      stats
    };
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
```

---

## Agentic Loop（代理执行循环）

### 核心循环架构

CloudClaude 的核心是一个**工具执行循环**，它不断调用 Claude API 并执行返回的工具调用，直到任务完成。

```
┌─────────────────────────────────────────────────────────┐
│ 1. 接收用户消息                                          │
│    └─ 飞书 Webhook → 解析消息内容                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. 调用 Claude API                                       │
│    └─ 发送消息 + 工具定义 + 系统提示                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. 解析响应                                              │
│    └─ 检查是否包含 tool_use blocks                      │
└─────────────────────────────────────────────────────────┘
                        ↓
            ┌─────────────────┐
            │ 有 tool_use?    │
            └────────┬────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
         是                    否
          │                     │
          ↓                     ↓
┌─────────────────────┐  ┌─────────────────────┐
│ 4. 执行工具         │  │ 6. 返回最终结果     │
│  ├─ 触发 PreToolUse │  │    └─ 发送到飞书    │
│  ├─ 调用执行器      │  └─────────────────────┘
│  └─ 触发 PostToolUse│
└─────────┬───────────┘
          │
          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. 反馈结果                                              │
│    └─ 封装 tool_result → 添加到消息历史                 │
│    └─ 回到步骤 2，继续循环                              │
└─────────────────────────────────────────────────────────┘
```

### 循环终止条件

| 条件 | 说明 |
|------|------|
| **自然终止** | Claude 返回纯文本响应（无 tool_use） |
| **错误终止** | 工具执行失败或超时 |
| **用户中断** | 用户发送取消指令 |
| **最大轮次** | 达到 max_turns 限制（默认 100） |

### 实现代码

**文件**: `src/core/agentic-loop.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ToolExecutor } from '../executors/tool-executor';
import { HooksManager } from './hooks-manager';
import { Logger } from '../utils/logger';

interface AgenticLoopOptions {
  workingDir: string;
  maxTurns?: number;
  systemPrompt?: string;
  tools: Anthropic.Tool[];
  hooks?: HooksManager;
}

interface Message {
  role: 'user' | 'assistant';
  content: any;
}

export class AgenticLoop {
  private client: Anthropic;
  private executor: ToolExecutor;
  private options: AgenticLoopOptions;
  private messages: Message[] = [];
  private hooks?: HooksManager;
  private logger: Logger;

  constructor(options: AgenticLoopOptions) {
    this.client = new Anthropic();
    this.executor = new ToolExecutor(options.workingDir);
    this.options = options;
    this.hooks = options.hooks;
    this.logger = new Logger('AgenticLoop');
  }

  /**
   * 运行 Agentic Loop
   */
  async run(userMessage: string): Promise<string> {
    // 添加用户消息
    this.messages.push({
      role: 'user',
      content: userMessage
    });

    let turns = 0;
    const maxTurns = this.options.maxTurns || 100;

    while (turns < maxTurns) {
      turns++;
      this.logger.info(`Turn ${turns}/${maxTurns}`);

      // 调用 Claude API
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: this.options.systemPrompt || this.getDefaultSystemPrompt(),
        tools: this.options.tools,
        messages: this.messages
      });

      // 检查是否有工具调用
      const toolUseBlocks = response.content.filter(
        block => block.type === 'tool_use'
      );

      // 保存助手响应
      this.messages.push({
        role: 'assistant',
        content: response.content
      });

      // 如果没有工具调用，返回文本结果
      if (toolUseBlocks.length === 0) {
        const textBlocks = response.content.filter(
          block => block.type === 'text'
        );
        return textBlocks.map(b => b.text).join('\n');
      }

      // 执行所有工具调用
      const toolResults = await this.executeTools(toolUseBlocks);

      // 添加工具结果到消息历史
      this.messages.push({
        role: 'user',
        content: toolResults
      });

      // 检查是否应该停止
      if (response.stop_reason === 'end_turn') {
        const textBlocks = response.content.filter(
          block => block.type === 'text'
        );
        if (textBlocks.length > 0) {
          return textBlocks.map(b => b.text).join('\n');
        }
      }
    }

    throw new Error(`Exceeded maximum turns (${maxTurns})`);
  }

  /**
   * 执行工具调用
   */
  private async executeTools(toolUseBlocks: any[]): Promise<any[]> {
    const results = [];

    for (const block of toolUseBlocks) {
      const { id, name, input } = block;

      this.logger.info(`Executing tool: ${name}`, { input });

      try {
        // PreToolUse Hook
        if (this.hooks) {
          const hookResult = await this.hooks.trigger('PreToolUse', {
            toolName: name,
            input,
            toolUseId: id
          });

          if (hookResult.decision === 'block') {
            results.push({
              type: 'tool_result',
              tool_use_id: id,
              content: `Tool blocked: ${hookResult.reason || 'Blocked by hook'}`,
              is_error: true
            });
            continue;
          }
        }

        // 执行工具
        const output = await this.executor.execute(name, input);

        // PostToolUse Hook
        if (this.hooks) {
          await this.hooks.trigger('PostToolUse', {
            toolName: name,
            input,
            output,
            toolUseId: id
          });
        }

        results.push({
          type: 'tool_result',
          tool_use_id: id,
          content: typeof output === 'string' ? output : JSON.stringify(output, null, 2)
        });

      } catch (error: any) {
        this.logger.error(`Tool execution failed: ${name}`, error);

        results.push({
          type: 'tool_result',
          tool_use_id: id,
          content: `Error: ${error.message}`,
          is_error: true
        });
      }
    }

    return results;
  }

  /**
   * 获取默认系统提示
   */
  private getDefaultSystemPrompt(): string {
    return `You are CloudClaude, an AI assistant running on a cloud server.
You have access to tools that allow you to execute commands, read/write files, and search content.
Your working directory is: ${this.options.workingDir}

Always use tools to accomplish tasks. Be careful with destructive operations.
When executing bash commands, prefer to show the output to the user.`;
  }

  /**
   * 获取消息历史
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * 清空消息历史
   */
  clearMessages(): void {
    this.messages = [];
  }
}
```

---

## 安全机制

### 权限控制系统

CloudClaude 实现多层权限控制，保护服务器安全。

#### 权限检查流程

```
工具调用请求
    ↓
1. 检查 Deny 规则  ─→ 匹配则直接阻止
    ↓
2. 检查 Allow 规则 ─→ 匹配则直接通过
    ↓
3. 检查 Ask 规则   ─→ 匹配则请求用户确认
    ↓
4. 默认行为       ─→ 根据工具类型决定
```

#### 权限配置

**文件**: `config/permissions.json`

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf /)",
      "Bash(dd if=*)",
      "Bash(mkfs.*)",
      "Bash(shutdown*)",
      "Bash(reboot*)",
      "Read(/etc/shadow)",
      "Read(/etc/passwd)",
      "Write(/etc/*)",
      "Write(/usr/*)",
      "Write(/bin/*)"
    ],
    "allow": [
      "Read(**)",
      "Glob(**)",
      "Grep(**)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(pwd)",
      "Bash(whoami)",
      "Bash(npm *)",
      "Bash(node *)",
      "Bash(python *)",
      "Bash(git *)"
    ],
    "ask": [
      "Bash(apt *)",
      "Bash(pip install *)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Write(**)",
      "Edit(**)"
    ]
  }
}
```

#### 权限检查器实现

**文件**: `src/security/permission-checker.ts`

```typescript
import * as minimatch from 'minimatch';

interface PermissionConfig {
  deny: string[];
  allow: string[];
  ask: string[];
}

export class PermissionChecker {
  private config: PermissionConfig;

  constructor(config: PermissionConfig) {
    this.config = config;
  }

  /**
   * 检查工具调用权限
   */
  check(toolName: string, input: any): 'allow' | 'deny' | 'ask' {
    const pattern = this.buildPattern(toolName, input);

    // 1. 检查 Deny 规则
    for (const rule of this.config.deny) {
      if (this.matchRule(pattern, rule)) {
        return 'deny';
      }
    }

    // 2. 检查 Allow 规则
    for (const rule of this.config.allow) {
      if (this.matchRule(pattern, rule)) {
        return 'allow';
      }
    }

    // 3. 检查 Ask 规则
    for (const rule of this.config.ask) {
      if (this.matchRule(pattern, rule)) {
        return 'ask';
      }
    }

    // 4. 默认行为
    return this.getDefaultBehavior(toolName);
  }

  private buildPattern(toolName: string, input: any): string {
    switch (toolName) {
      case 'Bash':
        return `Bash(${input.command})`;
      case 'Read':
        return `Read(${input.file_path})`;
      case 'Write':
        return `Write(${input.file_path})`;
      case 'Edit':
        return `Edit(${input.file_path})`;
      default:
        return `${toolName}(*)`;
    }
  }

  private matchRule(pattern: string, rule: string): boolean {
    // 提取工具名和参数
    const patternMatch = pattern.match(/^(\w+)\((.+)\)$/);
    const ruleMatch = rule.match(/^(\w+)\((.+)\)$/);

    if (!patternMatch || !ruleMatch) return false;

    const [, patternTool, patternArg] = patternMatch;
    const [, ruleTool, ruleArg] = ruleMatch;

    if (patternTool !== ruleTool) return false;

    return minimatch(patternArg, ruleArg);
  }

  private getDefaultBehavior(toolName: string): 'allow' | 'deny' | 'ask' {
    // 只读工具默认允许
    const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch'];
    if (readOnlyTools.includes(toolName)) {
      return 'allow';
    }
    // 其他工具默认需要确认
    return 'ask';
  }
}
```

### 危险命令拦截

**文件**: `src/security/command-filter.ts`

```typescript
export class CommandFilter {
  private dangerousPatterns = [
    // 系统破坏
    /rm\s+(-rf?|--recursive)\s+[\/~]/,
    /dd\s+if=/,
    /mkfs\./,
    /fdisk/,
    /parted/,

    // 权限提升
    /sudo\s+su/,
    /chmod\s+777/,
    /chown\s+root/,

    // 网络攻击
    /nmap/,
    /netcat|nc\s+-/,

    // 系统控制
    /shutdown/,
    /reboot/,
    /init\s+0/,
    /systemctl\s+(stop|disable)\s+(ssh|sshd|network)/,

    // Fork 炸弹
    /:\(\)\s*{\s*:\|:&\s*}\s*;/,

    // 敏感文件访问
    /cat\s+\/etc\/(shadow|passwd)/,
    /base64.*\/etc/
  ];

  /**
   * 检查命令是否安全
   */
  isSafe(command: string): { safe: boolean; reason?: string } {
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          safe: false,
          reason: `Command matches dangerous pattern: ${pattern}`
        };
      }
    }
    return { safe: true };
  }
}
```

### 工作目录隔离

每个 Session 只能访问其工作目录及子目录：

```typescript
export class PathValidator {
  private workingDir: string;
  private allowedPaths: string[];

  constructor(workingDir: string, allowedPaths: string[] = []) {
    this.workingDir = path.resolve(workingDir);
    this.allowedPaths = allowedPaths.map(p => path.resolve(p));
  }

  /**
   * 验证路径是否允许访问
   */
  isAllowed(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);

    // 检查是否在工作目录内
    if (resolved.startsWith(this.workingDir)) {
      return true;
    }

    // 检查是否在允许的路径列表中
    for (const allowed of this.allowedPaths) {
      if (resolved.startsWith(allowed)) {
        return true;
      }
    }

    return false;
  }
}
```

---

## 上下文持久化

### Session 存储结构

```
/opt/cloud-claude/data/sessions/
├── session_001/
│   ├── metadata.json        # 会话元信息
│   ├── messages.json        # 对话历史
│   ├── context.json         # 执行上下文
│   └── checkpoints/         # 文件检查点
│       ├── cp_001.json
│       └── cp_002.json
├── session_002/
│   └── ...
```

### Session 数据结构

**文件**: `src/types/session.ts`

```typescript
interface SessionMetadata {
  id: string;
  name: string;
  type: 'interactive' | 'project' | 'ephemeral';
  workingDir: string;
  createdAt: string;
  lastUsed: string;
  messageCount: number;
  totalTokens: number;
}

interface SessionContext {
  environmentVariables: Record<string, string>;
  bashHistory: string[];
  currentDir: string;
  permissions: string[];
}

interface SessionCheckpoint {
  id: string;
  timestamp: string;
  files: Array<{
    path: string;
    content: string;
    operation: 'create' | 'modify' | 'delete';
  }>;
}
```

### 上下文压缩

当对话历史过长时，自动压缩以节省 Token：

```typescript
export class ContextCompactor {
  private maxTokens: number;
  private compactionThreshold: number;

  constructor(maxTokens = 100000, threshold = 0.8) {
    this.maxTokens = maxTokens;
    this.compactionThreshold = threshold;
  }

  /**
   * 检查是否需要压缩
   */
  needsCompaction(messages: Message[], currentTokens: number): boolean {
    return currentTokens > this.maxTokens * this.compactionThreshold;
  }

  /**
   * 执行压缩
   */
  async compact(messages: Message[], client: Anthropic): Promise<Message[]> {
    // 保留最近的消息
    const recentMessages = messages.slice(-10);
    const oldMessages = messages.slice(0, -10);

    // 让 Claude 生成摘要
    const summaryResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation history concisely, preserving key decisions, code changes, and context:\n\n${JSON.stringify(oldMessages)}`
        }
      ]
    });

    const summary = summaryResponse.content[0].type === 'text'
      ? summaryResponse.content[0].text
      : '';

    // 返回压缩后的消息
    return [
      {
        role: 'user',
        content: `[Previous conversation summary]\n${summary}`
      },
      ...recentMessages
    ];
  }
}
```

### 文件检查点

支持回滚文件修改：

```typescript
export class FileCheckpointer {
  private checkpointsDir: string;
  private checkpoints: Map<string, SessionCheckpoint> = new Map();

  constructor(sessionDir: string) {
    this.checkpointsDir = path.join(sessionDir, 'checkpoints');
  }

  /**
   * 创建检查点
   */
  async createCheckpoint(files: Array<{ path: string; content: string; operation: string }>): Promise<string> {
    const checkpointId = `cp_${Date.now()}`;
    const checkpoint: SessionCheckpoint = {
      id: checkpointId,
      timestamp: new Date().toISOString(),
      files
    };

    await fs.mkdir(this.checkpointsDir, { recursive: true });
    await fs.writeFile(
      path.join(this.checkpointsDir, `${checkpointId}.json`),
      JSON.stringify(checkpoint, null, 2)
    );

    this.checkpoints.set(checkpointId, checkpoint);
    return checkpointId;
  }

  /**
   * 回滚到检查点
   */
  async rewind(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // 恢复文件
    for (const file of checkpoint.files) {
      if (file.operation === 'delete') {
        await fs.writeFile(file.path, file.content);
      } else if (file.operation === 'create') {
        await fs.unlink(file.path).catch(() => {});
      } else {
        await fs.writeFile(file.path, file.content);
      }
    }
  }
}
```

---

## Sub-agents（子代理）

### 子代理架构

CloudClaude 支持创建子代理来并行处理任务。

```
主 Agent 收到复杂任务
    ↓
分析任务，决定拆分
    ↓
创建多个 Sub-agents（并行）
├─→ Sub-agent 1: 代码审查
├─→ Sub-agent 2: 测试执行
└─→ Sub-agent 3: 文档更新
    ↓
各自独立执行（独立 context）
    ↓
收集所有结果
    ↓
主 Agent 汇总并返回
```

### 子代理定义

```typescript
interface AgentDefinition {
  name: string;
  description: string;        // Claude 何时使用该代理
  prompt: string;             // 代理的系统提示
  tools?: string[];           // 允许的工具列表（null = 继承全部）
  model?: 'sonnet' | 'opus' | 'haiku';
}

// 预定义的子代理
const builtInAgents: Record<string, AgentDefinition> = {
  'code-reviewer': {
    name: 'code-reviewer',
    description: '代码质量审查，检查代码风格、安全问题和最佳实践',
    prompt: `You are a code reviewer. Analyze code for:
- Code quality and style
- Security vulnerabilities
- Performance issues
- Best practices
Provide specific, actionable feedback.`,
    tools: ['Read', 'Grep', 'Glob']
  },

  'test-runner': {
    name: 'test-runner',
    description: '执行测试并分析结果',
    prompt: `You are a test runner. Your job is to:
- Run tests using appropriate commands
- Analyze test results
- Report failures with details
- Suggest fixes for failing tests`,
    tools: ['Bash', 'Read', 'Grep']
  },

  'explorer': {
    name: 'explorer',
    description: '探索代码库结构和内容',
    prompt: `You are a codebase explorer. Help users understand:
- Project structure
- File organization
- Key components
- Dependencies`,
    tools: ['Read', 'Glob', 'Grep', 'Bash']
  }
};
```

### 子代理执行器

**文件**: `src/agents/subagent-executor.ts`

```typescript
export class SubagentExecutor {
  private definitions: Record<string, AgentDefinition>;
  private parentTools: Anthropic.Tool[];

  constructor(definitions: Record<string, AgentDefinition>, parentTools: Anthropic.Tool[]) {
    this.definitions = { ...builtInAgents, ...definitions };
    this.parentTools = parentTools;
  }

  /**
   * 执行子代理任务
   */
  async execute(
    agentType: string,
    prompt: string,
    workingDir: string
  ): Promise<{ result: string; agentId: string }> {
    const definition = this.definitions[agentType];
    if (!definition) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    // 过滤工具
    const tools = definition.tools
      ? this.parentTools.filter(t => definition.tools!.includes(t.name))
      : this.parentTools;

    // 创建独立的 Agentic Loop
    const loop = new AgenticLoop({
      workingDir,
      systemPrompt: definition.prompt,
      tools,
      maxTurns: 50  // 子代理限制较少的轮次
    });

    const result = await loop.run(prompt);
    const agentId = `subagent_${Date.now()}`;

    return { result, agentId };
  }

  /**
   * 并行执行多个子代理
   */
  async executeParallel(
    tasks: Array<{ agentType: string; prompt: string }>,
    workingDir: string
  ): Promise<Array<{ agentType: string; result: string }>> {
    const promises = tasks.map(task =>
      this.execute(task.agentType, task.prompt, workingDir)
        .then(r => ({ agentType: task.agentType, result: r.result }))
    );

    return Promise.all(promises);
  }
}
```

---

## Hooks 事件系统

### Hook 类型

| Hook | 触发时机 | 用途 |
|------|---------|------|
| **PreToolUse** | 工具执行前 | 拦截/修改/阻止工具调用 |
| **PostToolUse** | 工具执行后 | 处理结果、记录日志 |
| **UserPromptSubmit** | 用户消息提交时 | 修改/增强用户输入 |
| **SessionStart** | 会话开始时 | 初始化资源 |
| **SessionEnd** | 会话结束时 | 清理资源 |
| **Stop** | Agent 完成时 | 最终处理 |

### Hook 管理器

**文件**: `src/core/hooks-manager.ts`

```typescript
type HookType = 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'SessionStart' | 'SessionEnd' | 'Stop';

interface HookMatcher {
  matcher: string | RegExp;  // 匹配工具名或模式
  hooks: HookFunction[];
  timeout?: number;
}

type HookFunction = (context: HookContext) => Promise<HookResult>;

interface HookContext {
  toolName?: string;
  input?: any;
  output?: any;
  toolUseId?: string;
  sessionId?: string;
  userMessage?: string;
}

interface HookResult {
  decision?: 'allow' | 'block' | 'modify';
  reason?: string;
  modifiedInput?: any;
  modifiedOutput?: any;
}

export class HooksManager {
  private hooks: Map<HookType, HookMatcher[]> = new Map();

  /**
   * 注册 Hook
   */
  register(type: HookType, matcher: HookMatcher): void {
    const existing = this.hooks.get(type) || [];
    existing.push(matcher);
    this.hooks.set(type, existing);
  }

  /**
   * 触发 Hook
   */
  async trigger(type: HookType, context: HookContext): Promise<HookResult> {
    const matchers = this.hooks.get(type) || [];

    for (const matcher of matchers) {
      // 检查是否匹配
      if (!this.matchesMatcher(context, matcher)) {
        continue;
      }

      // 执行所有 hook 函数
      for (const hookFn of matcher.hooks) {
        try {
          const result = await Promise.race([
            hookFn(context),
            this.timeout(matcher.timeout || 5000)
          ]);

          // 如果决定阻止，立即返回
          if (result.decision === 'block') {
            return result;
          }

          // 如果修改了输入/输出，更新 context
          if (result.modifiedInput) {
            context.input = result.modifiedInput;
          }
          if (result.modifiedOutput) {
            context.output = result.modifiedOutput;
          }
        } catch (error) {
          console.error(`Hook execution failed:`, error);
        }
      }
    }

    return { decision: 'allow' };
  }

  private matchesMatcher(context: HookContext, matcher: HookMatcher): boolean {
    if (!context.toolName) return true;

    if (typeof matcher.matcher === 'string') {
      return context.toolName === matcher.matcher || matcher.matcher === '*';
    }

    return matcher.matcher.test(context.toolName);
  }

  private timeout(ms: number): Promise<HookResult> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Hook timeout')), ms)
    );
  }
}
```

### 使用示例

```typescript
const hooksManager = new HooksManager();

// 拦截危险的 Bash 命令
hooksManager.register('PreToolUse', {
  matcher: 'Bash',
  hooks: [
    async (context) => {
      const command = context.input?.command || '';
      if (command.includes('rm -rf')) {
        return {
          decision: 'block',
          reason: 'Dangerous command blocked: rm -rf'
        };
      }
      return { decision: 'allow' };
    }
  ]
});

// 记录所有工具调用
hooksManager.register('PostToolUse', {
  matcher: '*',
  hooks: [
    async (context) => {
      console.log(`Tool executed: ${context.toolName}`, {
        input: context.input,
        output: context.output
      });
      return { decision: 'allow' };
    }
  ]
});
```

---

## MCP（Model Context Protocol）集成

### MCP 概述

MCP 允许 CloudClaude 连接外部工具和服务，扩展 Agent 能力。

### MCP 服务器配置

**文件**: `config/mcp-servers.json`

```json
{
  "servers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "description": "浏览器自动化"
    },
    "postgres": {
      "type": "stdio",
      "command": "mcp-server-postgres",
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/db"
      },
      "description": "PostgreSQL 数据库访问"
    },
    "filesystem": {
      "type": "stdio",
      "command": "mcp-server-filesystem",
      "args": ["/home/data"],
      "description": "文件系统访问"
    }
  }
}
```

### MCP 客户端实现

**文件**: `src/mcp/mcp-client.ts`

```typescript
import { spawn, ChildProcess } from 'child_process';

interface McpServerConfig {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
}

export class McpClient {
  private servers: Map<string, ChildProcess> = new Map();
  private tools: Map<string, McpTool[]> = new Map();

  /**
   * 连接 MCP 服务器
   */
  async connect(name: string, config: McpServerConfig): Promise<void> {
    const process = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.servers.set(name, process);

    // 初始化连接
    await this.sendRequest(name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {}
    });

    // 获取可用工具
    const toolsResponse = await this.sendRequest(name, 'tools/list', {});
    this.tools.set(name, toolsResponse.tools);
  }

  /**
   * 获取所有 MCP 工具
   */
  getAllTools(): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = [];

    for (const [serverName, serverTools] of this.tools) {
      for (const tool of serverTools) {
        tools.push({
          name: `mcp__${serverName}__${tool.name}`,
          description: tool.description,
          input_schema: tool.inputSchema
        });
      }
    }

    return tools;
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(fullName: string, input: any): Promise<any> {
    // 解析工具名: mcp__serverName__toolName
    const match = fullName.match(/^mcp__(\w+)__(.+)$/);
    if (!match) {
      throw new Error(`Invalid MCP tool name: ${fullName}`);
    }

    const [, serverName, toolName] = match;
    return this.sendRequest(serverName, 'tools/call', {
      name: toolName,
      arguments: input
    });
  }

  /**
   * 发送请求到 MCP 服务器
   */
  private async sendRequest(serverName: string, method: string, params: any): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }

    return new Promise((resolve, reject) => {
      const requestId = Date.now();
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method,
        params
      }) + '\n';

      server.stdin!.write(request);

      const handler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === requestId) {
            server.stdout!.off('data', handler);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (e) {
          // 忽略解析错误，继续等待
        }
      };

      server.stdout!.on('data', handler);

      // 超时处理
      setTimeout(() => {
        server.stdout!.off('data', handler);
        reject(new Error('MCP request timeout'));
      }, 30000);
    });
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    for (const [name, server] of this.servers) {
      server.kill();
    }
    this.servers.clear();
    this.tools.clear();
  }
}
```

---

## CLAUDE.md 项目记忆

### 概述

CLAUDE.md 是项目级的记忆文件，让 Claude 理解项目上下文。

### 加载顺序

```
1. ~/.claude/CLAUDE.md          # 全局配置
2. /project/.claude/CLAUDE.md   # 项目配置（覆盖全局）
3. /project/CLAUDE.md           # 项目根目录配置
```

### 示例 CLAUDE.md

```markdown
# CloudClaude 项目

## 项目概述
基于 Claude Agent SDK 的 24/7 云端智能助手。

## 技术栈
- 语言: TypeScript
- 运行时: Node.js 18+
- 消息平台: 飞书

## 目录结构
- src/: 源代码
- config/: 配置文件
- data/: 运行时数据

## 常用命令
- npm run dev: 开发模式启动
- npm run build: 构建项目
- npm test: 运行测试
- pm2 start: 生产环境启动

## 编码规范
- 使用 TypeScript 严格模式
- 变量命名: camelCase
- 类型命名: PascalCase
- 文件命名: kebab-case

## 重要提醒
- 不要提交 .env 文件
- 配置文件在 config/ 目录
- 日志在 logs/ 目录
```

### CLAUDE.md 加载器

**文件**: `src/utils/claude-md-loader.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class ClaudeMdLoader {
  /**
   * 加载项目的 CLAUDE.md 文件
   */
  async load(workingDir: string): Promise<string> {
    const contents: string[] = [];

    // 1. 全局配置
    const globalPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
    const globalContent = await this.readFile(globalPath);
    if (globalContent) {
      contents.push('# Global Configuration\n' + globalContent);
    }

    // 2. 项目 .claude 目录配置
    const projectClaudePath = path.join(workingDir, '.claude', 'CLAUDE.md');
    const projectClaudeContent = await this.readFile(projectClaudePath);
    if (projectClaudeContent) {
      contents.push('# Project Configuration\n' + projectClaudeContent);
    }

    // 3. 项目根目录配置
    const rootPath = path.join(workingDir, 'CLAUDE.md');
    const rootContent = await this.readFile(rootPath);
    if (rootContent) {
      contents.push('# Project Root Configuration\n' + rootContent);
    }

    return contents.join('\n\n---\n\n');
  }

  private async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}
```

---

## 技术选型

### 方案对比

我们评估了三种方案：

| 方案 | 描述 | 优势 | 劣势 | 结论 |
|------|------|------|------|------|
| **A: 改造 Claude Code** | Fork 并修改核心代码 | 功能完整 | 代码混淆，几乎不可能 | ❌ 不可行 |
| **B: Agent SDK** | 使用官方 SDK 重新设计 | 官方支持，可控，快速 | 需要理解 SDK | ✅ **推荐** |
| **C: 插件扩展** | 通过插件扩展 Claude Code | 利用现有生态 | 无法 24/7 独立运行 | ⚠️ 辅助方案 |

### 技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **语言** | TypeScript | ^5.3.0 | 类型安全的 JavaScript |
| **运行时** | Node.js | 18+ | 服务器端 JavaScript |
| **核心 SDK** | @anthropic-ai/sdk | ^0.30.0 | Claude Agent SDK（完整类型定义） |
| **Web 框架** | Express | ^4.18.2 | HTTP 服务器 |
| **任务调度** | node-cron | ^3.0.3 | Cron 定时任务 |
| **HTTP 客户端** | axios | ^1.6.0 | 飞书 API 调用 |
| **日志** | winston | ^3.11.0 | 结构化日志 |
| **进程管理** | PM2 | latest | 生产环境守护进程 |

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────┐
│         飞书 (Feishu/Lark)                      │
│    用户通过自然语言交互                          │
└──────────────┬────────────────┬─────────────────┘
               │ Webhook        │ API Push
               ↓                ↑
┌──────────────────────────────────────────────────┐
│        Message Adapter (消息适配器)              │
│  - receiveMessage(webhook)                      │
│  - sendMessage(msg, userId)                     │
│  - 加载 credentials.json                        │
└──────────────┬─────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────┐
│      Gateway Agent (网关智能体)                  │
│      基于 Claude Agent SDK                       │
│                                                  │
│  职责：                                          │
│  1. 分析用户意图 (自然语言理解)                  │
│  2. 管理会话元信息 (sessions.json)              │
│  3. 分发任务到对应 Session                       │
│  4. 处理配置修改 (通过对话)                      │
│  5. 混合模式：智能判断 + 关键点确认              │
│                                                  │
│  上下文：只维护轻量级元信息                      │
└────┬─────────────────┬──────────────────────────┘
     │                 │
     ↓                 ↓
┌──────────────┐  ┌──────────────────────┐
│ Scheduler    │  │  Session Manager     │
│              │  │                      │
│ - 读 tasks   │  │  - 创建/管理 Session  │
│ - node-cron  │  │  - 并发控制           │
│ - 触发执行   │  │  - 使用 Agent SDK    │
└──────┬───────┘  └──────┬───────────────┘
       │                 │
       └────────┬────────┘
                ↓
    ┌────────────────────────────┐
    │  Claude Code Sessions      │
    │  (Agent SDK 实例池)        │
    │                            │
    │  Task Session 1 (临时)     │
    │  Task Session 2 (临时)     │
    │  Project Session (长期)    │
    │  ...                       │
    │                            │
    │  每个 Session:             │
    │  - 独立的工作目录           │
    │  - 完整的上下文管理         │
    │  - 可调用 Skills            │
    │  - 可创建 Sub-agents       │
    └────────────────────────────┘
```

### 数据流

#### 1. 用户主动交互流程

```
用户发消息 (飞书)
  ↓
Webhook 接收 (Message Adapter)
  ↓
解析消息 (extractMessage)
  ↓
意图分析 (Gateway Agent)
  ↓
┌─────────────────────────┐
│ 意图类型判断              │
├─────────────────────────┤
│ new_session            │ → 创建新会话
│ switch_session         │ → 切换会话
│ task_execution         │ → 执行临时任务
│ schedule_task          │ → 设置定时任务
│ configure              │ → 配置系统
│ continue               │ → 继续当前会话
└─────────────────────────┘
  ↓
执行对应操作
  ↓
返回结果
  ↓
发送回复 (飞书 API)
```

#### 2. 定时任务流程

```
Cron 时间到达
  ↓
Scheduler 触发
  ↓
读取任务配置 (tasks.json)
  ↓
创建临时 Session
  ↓
执行任务 (Agent SDK)
  ↓
格式化结果
  ↓
主动推送 (飞书 API)
```

#### 3. 并发任务流程

```
用户: "帮我做 A 和 B"
  ↓
Gateway Agent 分析
  ↓
检测到多任务意图
  ↓
并发创建 Task Sessions
  ├─→ Task A (Session 1)
  └─→ Task B (Session 2)
       ↓
  各自独立执行
       ↓
  完成时主动推送结果
```

---

## 配置文件设计

### 目录结构

```
/opt/cloud-claude/              # 系统根目录
├── config/
│   ├── credentials.json        # 敏感凭证（不进版本控制）
│   ├── tasks.json             # 定时任务配置（自包含）
│   ├── sessions.json          # 会话状态（运行时维护）
│   ├── permissions.json       # 权限配置
│   └── mcp-servers.json       # MCP 服务器配置
├── data/
│   └── sessions/              # Session 持久化
│       ├── session_xxx/
│       │   ├── metadata.json  # 会话元信息
│       │   ├── messages.json  # 对话历史
│       │   ├── context.json   # 执行上下文
│       │   └── checkpoints/   # 文件检查点
│       └── ...
├── src/
│   ├── index.ts               # 主入口
│   ├── types/                 # TypeScript 类型定义
│   │   ├── config.ts          # 配置类型
│   │   ├── feishu.ts          # 飞书消息类型
│   │   ├── session.ts         # 会话类型
│   │   ├── task.ts            # 任务类型
│   │   ├── tools.ts           # 工具类型定义
│   │   └── hooks.ts           # Hook 类型定义
│   ├── adapters/
│   │   └── feishu-adapter.ts  # 飞书适配器
│   ├── agents/
│   │   ├── gateway-agent.ts   # Gateway Agent
│   │   └── subagent-executor.ts # 子代理执行器
│   ├── core/                  # 核心组件
│   │   ├── agentic-loop.ts    # Agent 执行循环
│   │   └── hooks-manager.ts   # Hook 管理器
│   ├── executors/             # 工具执行器
│   │   └── tool-executor.ts   # 工具执行器实现
│   ├── security/              # 安全组件
│   │   ├── permission-checker.ts # 权限检查器
│   │   ├── command-filter.ts  # 命令过滤器
│   │   └── path-validator.ts  # 路径验证器
│   ├── managers/
│   │   ├── session-manager.ts # Session 管理器
│   │   ├── context-compactor.ts # 上下文压缩器
│   │   └── file-checkpointer.ts # 文件检查点
│   ├── mcp/                   # MCP 集成
│   │   └── mcp-client.ts      # MCP 客户端
│   ├── scheduler/
│   │   └── task-scheduler.ts  # 任务调度器
│   └── utils/
│       ├── config-loader.ts   # 配置加载
│       ├── claude-md-loader.ts # CLAUDE.md 加载器
│       └── logger.ts          # 日志
├── scripts/
│   └── init-config.ts         # 初始化脚本
├── dist/                      # 编译输出
├── tsconfig.json              # TypeScript 配置
├── logs/
│   ├── combined.log
│   └── error.log
├── package.json
├── CLAUDE.md                  # 项目记忆文件
├── .env                       # 环境变量
└── .env.example
```

### 配置文件详解

#### 1. credentials.json - 全局凭证

**位置**: `config/credentials.json`

**用途**: 存储敏感的 API 凭证和密钥

**安全**: 不进版本控制，权限 600

```json
{
  "feishu": {
    "appId": "cli_xxx",
    "appSecret": "xxx",
    "encryptKey": "xxx",
    "verificationToken": "xxx"
  },
  "anthropic": {
    "apiKey": "sk-ant-xxx"
  }
}
```

#### 2. tasks.json - 定时任务配置

**位置**: `config/tasks.json`

**用途**: 存储所有定时任务的配置

**特点**: 每个任务自包含所有执行所需信息

```json
{
  "tasks": [
    {
      "id": "task_001",
      "name": "每日抖音数据采集",
      "cron": "0 12 * * *",
      "enabled": true,
      "instruction": "采集抖音数据并更新到飞书多维表格",
      "workingDir": "/home/projects/douyin-collector",
      "context": {
        "bitable": {
          "appToken": "bascxxx1",
          "tableId": "tblxxx1"
        },
        "accounts": ["account1", "account2"]
      },
      "sessionId": null,
      "createdAt": "2024-01-13T10:00:00Z"
    },
    {
      "id": "task_002",
      "name": "每日服务器健康检查",
      "cron": "0 9,18 * * *",
      "enabled": true,
      "instruction": "检查所有服务器状态，生成健康报告",
      "workingDir": "/opt/cloud-claude",
      "context": {
        "servers": ["server1", "server2"]
      },
      "sessionId": null,
      "createdAt": "2024-01-13T11:00:00Z"
    }
  ]
}
```

**字段说明**:
- `id`: 任务唯一标识
- `name`: 任务名称
- `cron`: Cron 表达式
- `enabled`: 是否启用
- `instruction`: 任务指令（自然语言）
- `workingDir`: 工作目录
- `context`: 任务上下文（自包含所有信息）
- `sessionId`: 关联的会话 ID（可选）

#### 3. sessions.json - 会话元信息

**位置**: `config/sessions.json`

**用途**: 存储会话的元信息（不存储对话历史）

**维护**: 系统自动维护

```json
{
  "lastActive": "session_001",
  "sessions": [
    {
      "id": "session_001",
      "name": "日常工作",
      "type": "interactive",
      "workingDir": "/opt/cloud-claude",
      "createdAt": "2024-01-13T10:00:00Z",
      "lastUsed": "2024-01-13T15:30:00Z",
      "messageCount": 25
    },
    {
      "id": "session_douyin",
      "name": "抖音数据采集项目",
      "type": "project",
      "workingDir": "/home/projects/douyin-collector",
      "createdAt": "2024-01-13T11:00:00Z",
      "lastUsed": "2024-01-13T12:00:00Z",
      "messageCount": 50
    }
  ]
}
```

**字段说明**:
- `lastActive`: 最后活跃的会话 ID
- `sessions`: 会话列表
  - `id`: 会话唯一标识
  - `name`: 会话名称
  - `type`: 类型（interactive/project）
  - `workingDir`: 工作目录
  - `createdAt`: 创建时间
  - `lastUsed`: 最后使用时间
  - `messageCount`: 消息数量

---

## 核心组件实现

### 1. Message Adapter (消息适配器)

**文件**: `src/adapters/feishu-adapter.js`

**职责**:
- 接收飞书 Webhook 消息
- 验证签名和解密
- 调用飞书 API 发送消息
- 管理 Access Token

**关键方法**:
- `getAccessToken()`: 获取并缓存 Access Token
- `verifyWebhook()`: 验证 Webhook 签名
- `receiveMessage()`: 解析飞书消息
- `sendMessage()`: 发送文本消息
- `sendCard()`: 发送卡片消息

**实现**: 见代码文件

### 2. Gateway Agent (网关智能体)

**文件**: `src/agents/gateway-agent.js`

**职责**:
- 分析用户意图
- 路由到对应的处理逻辑
- 管理会话元信息
- 处理配置修改
- 实现混合交互模式

**意图类型**:

| 意图类型 | 触发条件 | 处理方式 |
|---------|---------|---------|
| `new_session` | "创建新项目"、"新建会话" | 创建新 Session |
| `switch_session` | "切换到 XX 项目" | 切换活跃 Session |
| `list_sessions` | "查看所有会话" | 列出会话列表 |
| `task_execution` | "帮我做 XX"（临时任务） | 创建临时 Session 执行 |
| `schedule_task` | "每天 12 点帮我..." | 设置定时任务 |
| `configure` | "添加飞书表格" | 配置系统 |
| `continue` | 其他消息 | 继续当前会话 |

**核心流程**:

```javascript
async handleMessage(userMessage, chatId) {
  // 1. 分析意图
  const intent = await this.analyzeIntent(userMessage);

  // 2. 根据意图路由
  switch(intent.type) {
    case 'new_session':
      return await this.handleNewSession(intent, userMessage, chatId);
    case 'task_execution':
      return await this.handleTaskExecution(intent, userMessage, chatId);
    case 'continue':
      return await this.handleContinue(userMessage, chatId);
    // ...
  }
}
```

### 3. Session Manager (会话管理器)

**文件**: `src/managers/session-manager.js`

**职责**:
- 创建和管理 Agent SDK 实例
- 控制并发数量（2核4G 限制）
- 执行任务和会话操作
- LRU 策略卸载会话

**资源管理**:

```
内存分配（总 4GB）:
- 系统预留:    500MB
- Gateway:     100MB
- Session Pool: 最多 3 个并发
  - 每个 Session: ~300-600MB
- 缓冲区:      500MB
```

**并发控制**:

```javascript
async executeInSession(sessionId, instruction) {
  // 获取或加载 Session
  let agent = this.runningSessions.get(sessionId);

  if (!agent) {
    // 检查并发限制
    if (this.runningSessions.size >= this.maxConcurrentSessions) {
      await this.evictLRUSession();
    }

    agent = await this.loadSession(sessionId);
  }

  // 执行
  return await agent.run(instruction);
}
```

### 4. Task Scheduler (任务调度器)

**文件**: `src/scheduler/task-scheduler.js`

**职责**:
- 加载和调度定时任务
- 执行任务并发送通知
- 管理任务生命周期

**工作流程**:

```javascript
// 初始化时加载所有任务
init() {
  const tasks = loadTasks();
  tasks.tasks.forEach(task => {
    if (task.enabled) {
      cron.schedule(task.cron, () => this.executeTask(task));
    }
  });
}

// 执行任务
async executeTask(task) {
  // 1. 发送开始通知
  await this.adapter.sendMessage(`⏰ 定时任务开始：${task.name}`);

  // 2. 执行任务
  const result = await this.sessionManager.executeEphemeralTask(task);

  // 3. 发送完成通知
  await this.adapter.sendMessage(`✅ 定时任务完成：${task.name}\n\n${result}`);
}
```

### 5. Webhook Server (HTTP 服务器)

**文件**: `src/index.js`

**职责**:
- 接收 Webhook 请求
- 提供健康检查端点
- 提供管理 API
- 异步处理消息

**端点**:

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/webhook/feishu` | POST | 飞书 Webhook |
| `/api/tasks/:taskId/trigger` | POST | 手动触发任务 |

**消息处理**:

```javascript
app.post('/webhook/feishu', async (req, res) => {
  // 1. URL 验证（首次配置）
  if (req.body.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }

  // 2. 验证签名
  const isValid = adapter.verifyWebhook(...);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 3. 立即响应（防止超时）
  res.json({ code: 0 });

  // 4. 异步处理
  processMessageAsync(req.body);
});
```

---

## 部署指南

### 环境要求

| 项目 | 要求 |
|------|------|
| **服务器** | 2核4G，Linux |
| **Node.js** | 18.0+ |
| **存储** | 20GB+ |
| **网络** | 公网 IP 或域名 |

### 部署步骤

#### 1. 服务器准备

```bash
# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 创建项目目录
sudo mkdir -p /opt/cloud-claude
sudo chown $USER:$USER /opt/cloud-claude
cd /opt/cloud-claude

# 克隆或上传代码
git clone https://github.com/your-repo/cloud-claude.git .
# 或者使用 scp 上传
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 初始化配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env

# 运行初始化脚本（交互式配置）
npm run init
```

**初始化脚本会询问**:
- 飞书 App ID、App Secret
- Anthropic API Key
- 其他配置

**生成的文件**:
- `config/credentials.json`
- `config/tasks.json`
- `config/sessions.json`

#### 4. 配置飞书应用

1. **创建应用**
   - 访问 [飞书开放平台](https://open.feishu.cn/)
   - 创建企业自建应用

2. **配置权限**
   - `im:message` - 接收消息
   - `im:message:send_as_bot` - 发送消息

3. **配置事件订阅**
   - 请求地址: `http://your-server:3000/webhook/feishu`
   - 订阅事件: `im.message.receive_v1`

4. **获取凭证**
   - App ID
   - App Secret
   - Encrypt Key（可选）
   - Verification Token

#### 5. 启动服务

**开发模式**:
```bash
npm run dev
```

**生产模式（使用 PM2）**:
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/index.js --name cloud-claude

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

**PM2 常用命令**:
```bash
pm2 list              # 查看进程
pm2 logs cloud-claude # 查看日志
pm2 restart cloud-claude  # 重启
pm2 stop cloud-claude     # 停止
pm2 delete cloud-claude   # 删除
```

#### 6. 配置反向代理（可选）

**Nginx 配置**:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**配置 SSL（推荐）**:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### 7. 防火墙配置

```bash
# 开放端口
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 验证部署

```bash
# 检查服务状态
pm2 status

# 检查健康端点
curl http://localhost:3000/health

# 查看日志
tail -f /opt/cloud-claude/logs/combined.log
```

---

## 使用示例

### 场景 1：创建新项目

```
用户: "帮我创建一个新项目，用来分析抖音数据"

系统: "好的，新会话的工作目录是什么？（例如：/home/projects/my-app）"

用户: "/home/projects/douyin-analyzer"

系统: "已创建新会话 [抖音数据分析]，工作目录：/home/projects/douyin-analyzer
      请问需要做什么？"

用户: "初始化一个 Python 项目，需要 pandas 和 requests"

系统: [执行创建目录、初始化 venv、安装依赖]
      "✅ 已完成：
      - 创建项目目录
      - 初始化 Python 虚拟环境
      - 安装 pandas 和 requests
      - 创建 requirements.txt"
```

### 场景 2：设置定时任务

```
用户: "每天中午12点帮我采集抖音数据"

系统: "好的，需要以下信息：
      1. 具体要做什么？
      2. 工作目录是？
      3. 需要访问飞书表格吗？如果需要，请提供 App Token 和 Table ID"

用户: "采集指定账号的粉丝数据，更新到飞书表格
     工作目录: /home/projects/douyin-analyzer
     App Token: bascxxx
     Table ID: tblxxx"

系统: "✅ 已设置定时任务：
      - 名称：抖音数据采集
      - 时间：每天 12:00
      - 目录：/home/projects/douyin-analyzer
      - 表格：bascxxx / tblxxx

      明天中午 12:00 会自动执行，完成后会通知你！"
```

### 场景 3：执行临时任务

```
用户: "帮我检查一下服务器磁盘使用情况"

系统: "正在检查..."

[30秒后]
系统: "✅ 服务器磁盘使用情况：

      /dev/sda1: 45% (18G/40G)
      /dev/sdb1: 78% (156G/200G) ⚠️

      建议：/dev/sdb1 使用率较高，建议清理"
```

### 场景 4：并发任务

```
用户: "帮我做两件事：
     1. 创建一个数据分析的 skill
     2. 给服务器设置监控脚本"

系统: "已启动 2 个任务，完成后会通知你：
      1. 创建数据分析 skill
      2. 设置服务器监控脚本"

[2分钟后]
系统: "✅ 任务 1 完成：创建数据分析 skill

      已创建 skill: data-analysis.md
      位置: /opt/cloud-claude/.claude/skills/data-analysis/"

[3分钟后]
系统: "✅ 任务 2 完成：设置服务器监控脚本

      已创建监控脚本，配置为每小时检查一次：
      - CPU 使用率
      - 内存使用率
      - 磁盘空间

      异常时会自动通知你"
```

### 场景 5：切换会话

```
用户: "切换到抖音项目"

系统: "已切换到会话 [抖音数据分析]
      工作目录：/home/projects/douyin-analyzer
      上次使用：2小时前"

用户: "查看一下数据采集脚本的代码"

系统: [读取并显示代码]
      "当前的数据采集脚本 (collector.py)：

      ```python
      import requests
      import pandas as pd
      ...
      ```"
```

### 场景 6：定时任务自动执行

```
[12:00 定时触发]
系统: "⏰ 定时任务开始：抖音数据采集"

[12:02 任务完成]
系统: "✅ 定时任务完成：抖音数据采集

      本次采集结果：
      - 账号数：5
      - 新增粉丝：1,234
      - 数据已更新到飞书表格
      - 详细数据：https://feishu.cn/base/bascxxx"
```

### 场景 7：配置管理

```
用户: "帮我添加一个新的飞书表格配置"

系统: "好的，请提供以下信息：
      1. 表格用途（如：用户反馈、销售数据）
      2. App Token
      3. Table ID"

用户: "用途：用户反馈
     App Token: bascyyy
     Table ID: tblyyy"

系统: "✅ 已添加表格配置：
      - 名称：用户反馈表
      - App Token: bascyyy
      - Table ID: tblyyy

      现在可以在任务中使用这个表格了"
```

---

## 开发计划

### 时间估算

| 阶段 | 任务 | 时间 | 优先级 |
|------|------|------|--------|
| **Week 1** | | | |
| 第1-2天 | 学习 Agent SDK API 和文档 | 2天 | P0 |
| 第3-4天 | 实现 Message Adapter（飞书集成） | 2天 | P0 |
| 第5天 | 实现配置加载和工具类 | 1天 | P0 |
| **Week 2** | | | |
| 第6-7天 | 实现 Gateway Agent（核心逻辑） | 2天 | P0 |
| 第8天 | 实现 Session Manager | 1天 | P0 |
| 第9天 | 实现 Task Scheduler | 1天 | P0 |
| 第10天 | 集成测试和调试 | 1天 | P0 |
| **Week 3** | | | |
| 第11-12天 | 部署到云服务器，配置 PM2 和 Nginx | 2天 | P0 |
| 第13天 | 端到端测试（所有场景） | 1天 | P0 |
| 第14-15天 | 性能优化和监控配置 | 2天 | P1 |

**总计：2-3 周**

### 里程碑

#### Milestone 1: 核心功能（Week 1）
- ✅ Agent SDK 集成
- ✅ 飞书消息收发
- ✅ 基础配置系统

#### Milestone 2: 完整功能（Week 2）
- ✅ Gateway Agent 完整实现
- ✅ Session 管理
- ✅ 定时任务
- ✅ 并发控制

#### Milestone 3: 生产就绪（Week 3）
- ✅ 部署和配置
- ✅ 监控和日志
- ✅ 性能优化
- ✅ 文档完善

### 后续优化方向

| 优化项 | 说明 | 优先级 |
|--------|------|--------|
| **向量数据库** | 长期历史检索 | P2 |
| **Web UI** | 可视化管理界面 | P2 |
| **多平台支持** | 钉钉、企业微信 | P3 |
| **插件市场** | Skills 共享平台 | P3 |
| **监控告警** | Prometheus + Grafana | P1 |
| **备份恢复** | 配置和数据备份 | P1 |

---

## 附录

### A. 常见问题

**Q: 为什么不直接改造 Claude Code？**

A: Claude Code 核心代码是编译/混淆的，无法修改。使用 Agent SDK 是官方推荐的方式，功能等价且更可控。

**Q: Agent SDK 支持所有 Claude Code 功能吗？**

A: 是的。Agent SDK 是 Claude Code 的底层，支持：
- Session 管理
- Skills 调用
- Sub-agents
- 工具使用
- 上下文管理

**Q: 2核4G 够用吗？**

A: 够用。通过并发控制（最多 3 个 Session）和资源优化，可以稳定运行。

**Q: 如何扩展到其他消息平台？**

A: 只需实现新的 Adapter（如 `dingtalk-adapter.js`），其他组件无需修改。

**Q: 定时任务失败了怎么办？**

A: 系统会自动发送失败通知到飞书，包含错误信息。可以通过日志查看详细错误。

### B. 资源链接

- [Claude Agent SDK 文档](https://platform.claude.com/docs/en/agent-sdk/overview)
- [飞书开放平台](https://open.feishu.cn/)
- [Node.js 文档](https://nodejs.org/)
- [PM2 文档](https://pm2.keymetrics.io/)

### C. 贡献指南

欢迎贡献代码和提出建议！请遵循以下步骤：

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

---

## 版本历史

- **v1.0** (2024-01-13)
  - 初始设计
  - 完整架构定义
  - 核心组件实现规划

---

**文档维护者**: Claude & 薛宏宇

**最后更新**: 2024-01-13
