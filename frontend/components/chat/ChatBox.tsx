'use client';

import { useEffect, useState } from 'react';
import { MessageList } from './MessageList';
import type { ChatMessage } from '../../lib/types';

export function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('cloudclaude.session');
    if (stored) {
      setSessionId(stored);
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, sessionId: sessionId || undefined })
      });
      const data = await response.json();

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        window.localStorage.setItem('cloudclaude.session', data.sessionId);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || 'No response.'
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Failed to send message.'
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="glass-card flex h-[70vh] flex-col gap-4 p-4">
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} />
      </div>
      <div className="flex gap-2 border-t border-black/5 pt-3">
        <input
          className="flex-1 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
          placeholder="Talk to the gateway agent..."
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
    </div>
  );
}
