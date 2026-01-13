"use client";

import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { MessageList } from './MessageList';
import { chatApi } from '@/lib/api';

export function ChatBox() {
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string>(''); // Managed by backend ideally

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsLoading(true);

        try {
            // Use existing session or create new
            const res = await chatApi.sendMessage(sessionId || 'new_session_' + Date.now(), userMsg);

            setSessionId(res.data.sessionId);

            setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to connect to backend.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <MessageList messages={messages} />

            <div className="p-4 border-t border-gray-100 bg-white/50 backdrop-blur-md">
                <div className="max-w-3xl mx-auto relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask CloudClaude to do something..."
                        className="w-full pl-6 pr-12 py-4 rounded-2xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none bg-white text-gray-800"
                        rows={1}
                        style={{ minHeight: '60px' }}
                    />

                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-3 top-3 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md hover:shadow-lg"
                    >
                        {isLoading ? <Sparkles className="animate-spin" size={20} /> : <Send size={20} />}
                    </button>
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">
                    CloudClaude can execute commands and modify files. Use with caution.
                </p>
            </div>
        </div>
    );
}
