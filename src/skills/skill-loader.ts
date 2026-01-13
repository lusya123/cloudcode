/**
 * Skills Loader for CloudClaude
 * Scans and loads skills from global and project directories
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import { Logger } from '../utils/logger';

const logger = new Logger('SkillLoader');

/**
 * Skill metadata (for System Prompt injection)
 */
export interface SkillMeta {
    name: string;
    description: string;
    path: string;
    source: 'global' | 'project';
}

/**
 * Skill full content (when invoked)
 */
export interface SkillContent {
    name: string;
    description: string;
    content: string;
    source: 'global' | 'project';
    path: string;
}

/**
 * Skills Loader
 * Scans, manages, and loads skills from global and project directories
 */
export class SkillLoader {
    private globalSkillsDir: string;
    private projectSkillsDir: string;
    private skillsCache: Map<string, SkillMeta> = new Map();

    constructor(homeDir: string, workingDir: string) {
        this.globalSkillsDir = path.join(homeDir, '.claude', 'skills');
        this.projectSkillsDir = path.join(workingDir, '.claude', 'skills');
    }

    /**
     * Scan and load all skills metadata
     * Project skills override global skills with same name
     */
    async scanSkills(): Promise<SkillMeta[]> {
        this.skillsCache.clear();

        // Load global skills first
        await this.scanDirectory(this.globalSkillsDir, 'global');

        // Load project skills (override global)
        await this.scanDirectory(this.projectSkillsDir, 'project');

        const skills = Array.from(this.skillsCache.values());
        logger.info(`Scanned ${skills.length} skills`);
        return skills;
    }

    /**
     * Scan a directory for skills
     */
    private async scanDirectory(dir: string, source: 'global' | 'project'): Promise<void> {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillPath = path.join(dir, entry.name, 'skill.md');
                    try {
                        const meta = await this.parseSkillMeta(skillPath, source);
                        this.skillsCache.set(meta.name, meta);
                        logger.debug(`Loaded skill: ${meta.name} (${source})`);
                    } catch (e) {
                        // skill.md not found or parse failed, skip
                    }
                }
            }
        } catch (e) {
            // Directory doesn't exist, skip
        }
    }

    /**
     * Parse skill.md YAML frontmatter to extract metadata
     */
    private async parseSkillMeta(filePath: string, source: 'global' | 'project'): Promise<SkillMeta> {
        const content = await fs.readFile(filePath, 'utf-8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

        if (!frontmatterMatch) {
            throw new Error('No frontmatter found');
        }

        const frontmatter = yaml.parse(frontmatterMatch[1]);

        return {
            name: frontmatter.name,
            description: frontmatter.description || '',
            path: filePath,
            source
        };
    }

    /**
     * Get available skills list
     */
    getAvailableSkills(): SkillMeta[] {
        return Array.from(this.skillsCache.values());
    }

    /**
     * Generate skills prompt for System Prompt injection
     */
    generateSkillsPrompt(): string {
        const skills = this.getAvailableSkills();
        if (skills.length === 0) {
            return '';
        }

        let prompt = '\n## Available Skills\n\n';
        prompt += 'The following skills are available. Use the Skill tool to invoke them:\n\n';

        for (const skill of skills) {
            prompt += `- **${skill.name}**: ${skill.description}\n`;
        }

        prompt += '\nWhen a user sends `/skill-name` or you determine the task matches a skill, use the Skill tool to load full instructions.\n';

        return prompt;
    }

    /**
     * Load full skill content
     */
    async loadSkillContent(skillName: string): Promise<SkillContent> {
        const meta = this.skillsCache.get(skillName);

        if (!meta) {
            throw new Error(`Skill not found: ${skillName}`);
        }

        const content = await fs.readFile(meta.path, 'utf-8');

        // Remove frontmatter, return body only
        const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        const body = bodyMatch ? bodyMatch[1].trim() : content;

        return {
            name: meta.name,
            description: meta.description,
            content: body,
            source: meta.source,
            path: meta.path
        };
    }

    /**
     * Check if skill exists
     */
    hasSkill(skillName: string): boolean {
        return this.skillsCache.has(skillName);
    }
}
