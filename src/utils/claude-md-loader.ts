/**
 * CLAUDE.md Loader for CloudClaude
 * Loads project memory files from global and project directories
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './logger';

const logger = new Logger('ClaudeMdLoader');

export class ClaudeMdLoader {
    /**
     * Load project's CLAUDE.md files
     * Order: global → project .claude → project root
     * Later files override earlier ones for same sections
     */
    async load(workingDir: string): Promise<string> {
        const contents: string[] = [];

        // 1. Global configuration (~/.claude/CLAUDE.md)
        const globalPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
        const globalContent = await this.readFile(globalPath);
        if (globalContent) {
            contents.push('# Global Configuration\n' + globalContent);
            logger.debug(`Loaded global CLAUDE.md from ${globalPath}`);
        }

        // 2. Project .claude directory configuration
        const projectClaudePath = path.join(workingDir, '.claude', 'CLAUDE.md');
        const projectClaudeContent = await this.readFile(projectClaudePath);
        if (projectClaudeContent) {
            contents.push('# Project Configuration\n' + projectClaudeContent);
            logger.debug(`Loaded project CLAUDE.md from ${projectClaudePath}`);
        }

        // 3. Project root configuration
        const rootPath = path.join(workingDir, 'CLAUDE.md');
        const rootContent = await this.readFile(rootPath);
        if (rootContent) {
            contents.push('# Project Root Configuration\n' + rootContent);
            logger.debug(`Loaded root CLAUDE.md from ${rootPath}`);
        }

        if (contents.length === 0) {
            logger.debug(`No CLAUDE.md files found for ${workingDir}`);
            return '';
        }

        return contents.join('\n\n---\n\n');
    }

    /**
     * Read file safely, returning null if not found
     */
    private async readFile(filePath: string): Promise<string | null> {
        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch {
            return null;
        }
    }

    /**
     * Check if any CLAUDE.md files exist for the project
     */
    async hasClaudeMd(workingDir: string): Promise<boolean> {
        const paths = [
            path.join(os.homedir(), '.claude', 'CLAUDE.md'),
            path.join(workingDir, '.claude', 'CLAUDE.md'),
            path.join(workingDir, 'CLAUDE.md')
        ];

        for (const p of paths) {
            try {
                await fs.access(p);
                return true;
            } catch {
                // Continue checking
            }
        }

        return false;
    }
}

// Default instance
export const claudeMdLoader = new ClaudeMdLoader();
