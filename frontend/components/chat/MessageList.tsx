import type { ChatMessage } from '../../lib/types';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto pr-2">
      {messages.map(message => (
        <div
          key={message.id}
          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-soft ${
            message.role === 'user'
              ? 'ml-auto bg-ink text-white'
              : 'bg-white text-ink'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.timestamp && (
            <p className="mt-2 text-xs opacity-70">{message.timestamp}</p>
          )}
        </div>
      ))}
    </div>
  );
}
