import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class ClaudeMdLoader {
  async load(workingDir: string): Promise<string> {
    const contents: string[] = [];

    const globalPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
    const globalContent = await this.readFile(globalPath);
    if (globalContent) {
      contents.push('# Global Configuration\n' + globalContent);
    }

    const projectClaudePath = path.join(workingDir, '.claude', 'CLAUDE.md');
    const projectClaudeContent = await this.readFile(projectClaudePath);
    if (projectClaudeContent) {
      contents.push('# Project Configuration\n' + projectClaudeContent);
    }

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
