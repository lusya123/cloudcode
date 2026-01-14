'use client';

import { useState, useEffect, KeyboardEvent, useCallback } from 'react';
import { MessageList } from './MessageList';
import { Message } from '@/lib/types';
import { sendMessage, getSessions, getSessionMessages } from '@/lib/api';

interface ChatBoxProps {
    sessionId?: string;  // Optional: If provided, load messages for this specific session
}

export function ChatBox({ sessionId: propSessionId }: ChatBoxProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(propSessionId || null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    // Load session and messages on mount or when sessionId prop changes
    const loadSessionAndMessages = useCallback(async () => {
        setIsLoadingHistory(true);
        try {
            let targetSessionId = propSessionId;

            // If no specific session provided, get the active session
            if (!targetSessionId) {
                const sessionsData = await getSessions();
                targetSessionId = sessionsData.activeId;
            }

            if (targetSessionId) {
                setSessionId(targetSessionId);

                // Load messages for the session
                try {
                    const messagesData = await getSessionMessages(targetSessionId);
                    if (messagesData.messages && messagesData.messages.length > 0) {
                        // Convert backend messages to frontend format
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
                    // Session exists but no messages yet, that's ok
                    console.log('No messages found for session');
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

            // Update sessionId if returned (especially for new sessions)
            if (response.sessionId) {
                setSessionId(response.sessionId);
            }

            // If a new session was created, clear messages for clean start
            if (response.isNewSession) {
                // Keep only the current exchange for the new session
                setMessages([userMessage, assistantMessage]);
            }
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

    if (isLoadingHistory) {
        return (
            <div className="flex flex-col h-full items-center justify-center">
                <div className="text-gray-400">加载消息历史...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
            <MessageList messages={messages} />

            <div className="p-4 border-t border-black/5 bg-white/50 flex-shrink-0">
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
