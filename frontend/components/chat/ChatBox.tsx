'use client';

import { useState, useEffect, KeyboardEvent, useCallback } from 'react';
import { MessageList } from './MessageList';
import { Message } from '@/lib/types';
import { sendMessage, getSessions, getSessionMessages } from '@/lib/api';

interface ChatBoxProps {
    sessionId?: string;
}

export function ChatBox({ sessionId: propSessionId }: ChatBoxProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(propSessionId || null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const loadSessionAndMessages = useCallback(async () => {
        setIsLoadingHistory(true);
        try {
            let targetSessionId = propSessionId;
            if (!targetSessionId) {
                const sessionsData = await getSessions();
                targetSessionId = sessionsData.activeId;
            }
            if (targetSessionId) {
                setSessionId(targetSessionId);
                try {
                    const messagesData = await getSessionMessages(targetSessionId);
                    if (messagesData.messages && messagesData.messages.length > 0) {
                        const formattedMessages: Message[] = messagesData.messages.map((m: any) => ({
                            role: m.role === 'assistant' ? 'assistant' : 'user',
                            content: typeof m.content === 'string'
                                ? m.content
                                : m.content?.[0]?.text || JSON.stringify(m.content),
                            timestamp: m.timestamp || new Date().toISOString()
                        }));
                        setMessages(formattedMessages);
                    } else {
                        setMessages([]);
                    }
                } catch {
                    setMessages([]);
                }
            }
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [propSessionId]);

    useEffect(() => {
        loadSessionAndMessages();
    }, [loadSessionAndMessages]);

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
            const response = await sendMessage(userMessage.content, sessionId || undefined);
            const assistantMessage: Message = {
                role: 'assistant',
                content: response.reply || response.result || '处理完成',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);
            if (response.sessionId) {
                setSessionId(response.sessionId);
            }
            if (response.isNewSession) {
                setMessages([userMessage, assistantMessage]);
            }
        } catch {
            const errorMessage: Message = {
                role: 'assistant',
                content: '请求失败，请稍后重试',
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

    if (isLoadingHistory) {
        return (
            <div className="flex flex-col h-full items-center justify-center">
                <div className="text-[13px] text-gray-400">加载中...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <MessageList messages={messages} />

            <div className="border-t border-gray-200 bg-white">
                <div className="max-w-2xl mx-auto px-6 py-4">
                    <div className="flex gap-3 items-end">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="输入消息..."
                            className="flex-1 px-4 py-3 text-[14px] border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-gray-400 transition-colors bg-gray-50 placeholder:text-gray-400"
                            rows={1}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="h-11 px-5 bg-gray-900 text-white text-[13px] font-medium rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isLoading ? '发送中' : '发送'}
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">
                        Enter 发送 · Shift + Enter 换行
                    </p>
                </div>
            </div>
        </div>
    );
}
