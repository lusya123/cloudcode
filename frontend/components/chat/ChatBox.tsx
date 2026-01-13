'use client';

import { useState, KeyboardEvent } from 'react';
import { MessageList } from './MessageList';
import { Message } from '@/lib/types';
import { sendMessage } from '@/lib/api';

export function ChatBox() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await sendMessage(userMessage.content);

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.reply || response.result || '处理完成',
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                role: 'assistant',
                content: '❌ 请求失败，请稍后重试',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            <MessageList messages={messages} />

            <div className="p-4 border-t border-black/5 bg-white/50">
                <div className="flex gap-3">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="发送消息给 CloudClaude..."
                        className="flex-1 glass-input px-4 py-3 resize-none"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="glass-button px-6"
                    >
                        {isLoading ? '⏳' : '发送'}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    按 Enter 发送，Shift + Enter 换行
                </p>
            </div>
        </div>
    );
}
