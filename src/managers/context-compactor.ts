import type Anthropic from '@anthropic-ai/sdk';
import type { SessionMessage } from '../types/session';

export class ContextCompactor {
  private maxTokens: number;
  private compactionThreshold: number;
  private model: string;

  constructor(model = 'claude-sonnet-4-20250514', maxTokens = 100000, threshold = 0.8) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.compactionThreshold = threshold;
  }

  needsCompaction(messages: SessionMessage[], currentTokens: number): boolean {
    if (messages.length === 0) {
      return false;
    }
    return currentTokens > this.maxTokens * this.compactionThreshold;
  }

  estimateTokens(messages: SessionMessage[]): number {
    const content = JSON.stringify(messages);
    return Math.ceil(content.length / 4);
  }

  async compact(messages: SessionMessage[], client: Anthropic): Promise<SessionMessage[]> {
    const recentMessages = messages.slice(-10);
    const oldMessages = messages.slice(0, -10);

    if (oldMessages.length === 0) {
      return messages;
    }

    const summaryResponse = await client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Summarize this conversation history concisely, preserving key decisions, code changes, and context:\n\n${JSON.stringify(oldMessages)}`
        }
      ]
    });

    const summary = summaryResponse.content[0]?.type === 'text'
      ? summaryResponse.content[0].text
      : '';

    return [
      {
        role: 'user',
        content: `[Previous conversation summary]\n${summary}`
      },
      ...recentMessages
    ];
  }

  setModel(model: string): void {
    this.model = model;
  }
}
