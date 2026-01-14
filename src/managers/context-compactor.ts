import type { SessionMessage } from '../types/session';

export interface CompactionResult {
  messages: SessionMessage[];
  summary?: string;
}

export class ContextCompactor {
  private maxMessages: number;

  constructor(maxMessages = 40) {
    this.maxMessages = maxMessages;
  }

  compact(messages: SessionMessage[]): CompactionResult {
    if (messages.length <= this.maxMessages) {
      return { messages };
    }

    const keep = messages.slice(-this.maxMessages);
    const trimmedCount = messages.length - keep.length;

    return {
      messages: keep,
      summary: `Previous ${trimmedCount} messages were omitted for context length.`
    };
  }
}
