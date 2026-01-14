'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import type { HistoryDetailResponse } from '../../../lib/types';
import { MessageList } from '../../../components/chat/MessageList';

export default function HistoryDetailPage() {
  const params = useParams();
  const sessionId = params?.id as string;
  const { data, mutate } = useSWR<HistoryDetailResponse>(sessionId ? `/api/history/${sessionId}` : null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }

    setIsSending(true);
    try {
      await fetch(`/api/history/${sessionId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() })
      });
      setInput('');
      await mutate();
    } finally {
      setIsSending(false);
    }
  };

  if (!data) {
    return <p className="text-sm text-gray-400">Loading history...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{data.session.name}</h2>
        <p className="text-sm text-gray-500">{data.session.workingDir}</p>
      </div>
      <div className="glass-card p-4">
        <MessageList messages={data.messages} />
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
          placeholder="Continue this session..."
          disabled={isSending}
        />
        <button
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow"
          onClick={sendMessage}
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </section>
  );
}
