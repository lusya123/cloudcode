import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import logger from '../utils/logger';

/**
 * Skill Metadata (for System Prompt injection)
 */
export interface SkillMeta {
    name: string;              // Skill Name
    description: string;       // Short description
    path: string;              // File path
    source: 'global' | 'project';
}

/**
 * Complete Skill Content (returned when called)
 */
export interface SkillContent {
    name: string;
    description: string;
    content: string;           // Full Markdown content
    source: 'global' | 'project';
    path: string;
}

/**
 * Skill Loader
 * Scans, manages, and loads Skills
 */
export class SkillLoader {
    private globalSkillsDir: string;    // ~/.claude/skills/
    private projectSkillsDir: string;   // <workingDir>/.claude/skills/
    private skillsCache: Map<string, SkillMeta> = new Map();

    constructor(homeDir: string, workingDir: string) {
        this.globalSkillsDir = path.join(homeDir, '.claude', 'skills');
        this.projectSkillsDir = path.join(workingDir, '.claude', 'skills');
    }

    /**
     * Scan and load metadata for all Skills
     * Project skills override global skills with the same name
     */
    async scanSkills(): Promise<SkillMeta[]> {
        this.skillsCache.clear();

        // Load global Skills first
        await this.scanDirectory(this.globalSkillsDir, 'global');

        // Load project Skills (override global)
        await this.scanDirectory(this.projectSkillsDir, 'project');

        logger.info(`Loaded ${this.skillsCache.size} skills`);
        return Array.from(this.skillsCache.values());
    }

    /**
     * Scan skills in a specific directory
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
                    } catch (e) {
                        // skill.md not found or failed to parse, skip
                        logger.debug(`Skipping invalid skill in ${dir}/${entry.name}: ${(e as Error).message}`);
                    }
                }
            }
        } catch (e) {
            // Directory usually doesn't exist, just skip
            logger.debug(`Skill directory not found: ${dir}`);
        }
    }

    /**
     * Parse YAML frontmatter from skill.md
     */
    private async parseSkillMeta(filePath: string, source: 'global' | 'project'): Promise<SkillMeta> {
        const content = await fs.readFile(filePath, 'utf-8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

        if (!frontmatterMatch) {
            throw new Error('No frontmatter found');
        }

        const frontmatter = yaml.load(frontmatterMatch[1]) as any;

        return {
            name: frontmatter.name,
            description: frontmatter.description || '',
            path: filePath,
            source
        };
    }

    /**
     * Get available Skills list
     */
    getAvailableSkills(): SkillMeta[] {
        return Array.from(this.skillsCache.values());
    }

    /**
     * Generate Skills Prompt for System Prompt
     */
    generateSkillsPrompt(): string {
        const skills = this.getAvailableSkills();
        if (skills.length === 0) {
            return '';
        }

        let prompt = '\n## Available Skills\n\n';
        prompt += 'The following skills are available. You can use the `Skill` tool to call them:\n\n';

        for (const skill of skills) {
            prompt += `- **${skill.name}**: ${skill.description}\n`;
        }

        prompt += '\nWhen the user sends `/skill-name` or you determine a task matches a skill, use the Skill tool to load the full instructions.\n';

        return prompt;
    }

    /**
     * Load full content of a specific Skill
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
     * Check if a Skill exists
     */
    hasSkill(skillName: string): boolean {
        return this.skillsCache.has(skillName);
    }
}
