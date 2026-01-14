'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage } from '../../lib/types';
import { MessageList } from './MessageList';

interface ChatBoxProps {
  sessionId?: string;
  initialMessages?: ChatMessage[];
}

export function ChatBox({ sessionId, initialMessages = [] }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (initialMessages.length) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const canSend = input.trim().length > 0 && !isSending;

  const sendMessage = async () => {
    if (!canSend) return;
    const content = input.trim();
    setInput('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId })
      });
      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'No response received.',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Failed to reach the backend. Check server status.',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const placeholder = useMemo(() => {
    if (sessionId) {
      return 'Continue this session...';
    }
    return 'Message the gateway agent...';
  }, [sessionId]);

  return (
    <div className="flex h-[70vh] flex-col gap-4 rounded-3xl border border-line bg-white/70 p-6 shadow-soft">
      <MessageList messages={messages} />
      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] w-full resize-none rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{isSending ? 'Sending...' : 'Ready'}</span>
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.2em] transition ${
              canSend ? 'bg-ink text-white' : 'bg-line text-muted'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
