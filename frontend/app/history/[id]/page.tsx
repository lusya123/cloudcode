'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ChatBox } from '../../../components/chat/ChatBox';
import { fetcher } from '../../../lib/api';
import type { ChatMessage } from '../../../lib/types';

interface HistoryDetailResponse {
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
}

function normalizeContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (block?.type === 'text') {
          return block.text;
        }
        if (block?.type === 'tool_use') {
          return `[Tool use: ${block.name}]`;
        }
        if (block?.type === 'tool_result') {
          return `[Tool result] ${block.content || ''}`;
        }
        return JSON.stringify(block);
      })
      .join('\n');
  }
  return JSON.stringify(content);
}

export default function HistoryDetailPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  const { data, isLoading } = useSWR<HistoryDetailResponse>(
    sessionId ? `/api/history/${sessionId}` : null,
    fetcher
  );

  const messages = useMemo<ChatMessage[]>(() => {
    if (!data?.messages) return [];
    return data.messages.map((msg, index) => ({
      id: `${msg.role}-${index}`,
      role: msg.role,
      content: normalizeContent(msg.content)
    }));
  }, [data]);

  return (
    <section className="space-y-6">
      <div className="surface rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Session</p>
        <h2 className="mt-2 text-2xl font-semibold">History detail</h2>
        <p className="mt-2 text-sm text-muted">
          Continue the conversation using the same session context.
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted">Loading messages...</p>
      ) : (
        <ChatBox sessionId={sessionId} initialMessages={messages} />
      )}
    </section>
  );
}
