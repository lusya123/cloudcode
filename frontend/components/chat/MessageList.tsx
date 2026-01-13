"use client";

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function MessageList({ messages }: { messages: Message[] }) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                    <div
                        key={idx}
                        className={cn(
                            "flex gap-4 max-w-3xl mx-auto",
                            isUser ? "flex-row-reverse" : "flex-row"
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            isUser ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                        )}>
                            {isUser ? <User size={16} /> : <Bot size={16} />}
                        </div>

                        <div className={cn(
                            "p-4 rounded-2xl shadow-sm border max-w-[80%]",
                            isUser
                                ? "bg-blue-50/50 border-blue-100 text-gray-800 rounded-tr-none"
                                : "bg-white border-gray-100 text-gray-800 rounded-tl-none"
                        )}>
                            <div className="whitespace-pre-wrap leading-relaxed">
                                {msg.content}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={bottomRef} />
        </div>
    );
}
