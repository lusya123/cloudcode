import type { McpServersConfig } from '../types/config';
import { loadMcpServers } from '../utils/config-loader';

export class McpClient {
  private servers: McpServersConfig['servers'] = [];

  async init(): Promise<void> {
    const config = await loadMcpServers();
    this.servers = config.servers;
  }

  listServers(): McpServersConfig['servers'] {
    return this.servers;
  }
}
