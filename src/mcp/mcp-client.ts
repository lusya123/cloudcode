import { spawn, ChildProcess } from 'child_process';
import type Anthropic from '@anthropic-ai/sdk';

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

  async connect(name: string, config: McpServerConfig): Promise<void> {
    const child = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.servers.set(name, child);

    await this.sendRequest(name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {}
    });

    const toolsResponse = await this.sendRequest(name, 'tools/list', {});
    this.tools.set(name, toolsResponse.tools || []);
  }

  getAllTools(): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = [];

    for (const [serverName, serverTools] of this.tools) {
      for (const tool of serverTools) {
        const rawSchema = tool.inputSchema as Record<string, unknown> | undefined;
        const normalizedSchema =
          rawSchema && typeof rawSchema === 'object' && 'type' in rawSchema
            ? rawSchema
            : { type: 'object', properties: {} };

        tools.push({
          name: `mcp__${serverName}__${tool.name}`,
          description: tool.description,
          input_schema: normalizedSchema as Anthropic.Tool['input_schema']
        });
      }
    }

    return tools;
  }

  async callTool(fullName: string, input: any): Promise<any> {
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
        } catch {
          // Ignore parse errors and continue listening.
        }
      };

      server.stdout!.on('data', handler);

      setTimeout(() => {
        server.stdout!.off('data', handler);
        reject(new Error('MCP request timeout'));
      }, 30000);
    });
  }

  async disconnectAll(): Promise<void> {
    for (const [, server] of this.servers) {
      server.kill();
    }
    this.servers.clear();
    this.tools.clear();
  }
}
