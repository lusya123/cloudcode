'use client';

import { useRef, useEffect } from 'react';
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
            <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-400 text-[15px]">开始对话</p>
                    <p className="text-gray-300 text-[13px] mt-1">发送消息与 Cloud Code 交互</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">
                {messages.map((message, index) => (
                    <div key={index} className={message.role === 'user' ? 'flex justify-end' : ''}>
                        <div className={`${message.role === 'user' ? 'max-w-[85%]' : 'w-full'}`}>
                            {message.role === 'assistant' && (
                                <p className="text-[11px] text-gray-400 mb-1.5 font-medium">Cloud Code</p>
                            )}
                            <div className={`text-[14px] leading-relaxed ${
                                message.role === 'user'
                                    ? 'bg-gray-900 text-white px-4 py-2.5 rounded-2xl rounded-br-md'
                                    : 'text-gray-700'
                            }`}>
                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
