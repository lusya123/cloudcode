import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';

export interface SkillMeta {
  name: string;
  description: string;
  path: string;
  source: 'global' | 'project';
}

export interface SkillContent {
  name: string;
  description: string;
  content: string;
  source: 'global' | 'project';
  path: string;
}

export class SkillLoader {
  private globalSkillsDir: string;
  private projectSkillsDir: string;
  private skillsCache: Map<string, SkillMeta> = new Map();

  constructor(homeDir: string, workingDir: string) {
    this.globalSkillsDir = path.join(homeDir, '.claude', 'skills');
    this.projectSkillsDir = path.join(workingDir, '.claude', 'skills');
  }

  async scanSkills(): Promise<SkillMeta[]> {
    this.skillsCache.clear();

    await this.scanDirectory(this.globalSkillsDir, 'global');
    await this.scanDirectory(this.projectSkillsDir, 'project');

    return Array.from(this.skillsCache.values());
  }

  private async scanDirectory(dir: string, source: 'global' | 'project'): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(dir, entry.name, 'skill.md');
          try {
            const meta = await this.parseSkillMeta(skillPath, source);
            this.skillsCache.set(meta.name, meta);
          } catch {
            continue;
          }
        }
      }
    } catch {
      return;
    }
  }

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

  getAvailableSkills(): SkillMeta[] {
    return Array.from(this.skillsCache.values());
  }

  generateSkillsPrompt(): string {
    const skills = this.getAvailableSkills();
    if (skills.length === 0) {
      return '';
    }

    let prompt = '\n## Available Skills\n\n';
    prompt += 'The following skills are available. Use the Skill tool to load them when relevant:\n\n';

    for (const skill of skills) {
      prompt += `- **${skill.name}**: ${skill.description}\n`;
    }

    prompt += '\nIf the user sends `/skill-name` or the task clearly matches a skill, load it.\n';

    return prompt;
  }

  async loadSkillContent(skillName: string): Promise<SkillContent> {
    const meta = this.skillsCache.get(skillName);

    if (!meta) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const content = await fs.readFile(meta.path, 'utf-8');
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

  hasSkill(skillName: string): boolean {
    return this.skillsCache.has(skillName);
  }
}
