'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/lib/types';

interface MessageListProps {
    messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <p className="text-4xl mb-4">💬</p>
                    <p>开始对话吧！</p>
                    <p className="text-sm mt-2">发送消息与 CloudClaude 交互</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
                <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-[80%] px-4 py-2 overflow-hidden ${message.role === 'user' ? 'message-user' : 'message-assistant'
                            }`}
                    >
                        <p className="whitespace-pre-wrap text-sm break-words overflow-wrap-anywhere">{message.content}</p>
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
}
