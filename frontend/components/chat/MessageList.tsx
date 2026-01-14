import type { ChatMessage } from '../../lib/types';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  if (!messages.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className="glass-card max-w-[80%] px-4 py-3 text-sm text-gray-700">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
