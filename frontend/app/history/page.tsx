'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { HistoryCard } from '@/components/history/HistoryCard';
import { SessionsResponse } from '@/lib/types';

export default function HistoryPage() {
    const { data, isLoading } = useSWR<SessionsResponse>('/api/sessions', fetcher);

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-800">📚 历史记录</h1>
                <p className="text-sm text-gray-500 mt-1">
                    查看所有会话历史，点击继续对话
                </p>
            </div>

            {isLoading ? (
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-card p-4 animate-pulse">
                            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            ) : data?.sessions && data.sessions.length > 0 ? (
                <div className="grid gap-4">
                    {data.sessions.map(session => (
                        <HistoryCard
                            key={session.id}
                            session={session}
                            isActive={session.id === data.activeId}
                        />
                    ))}
                </div>
            ) : (
                <div className="glass-card p-8 text-center">
                    <p className="text-4xl mb-4">📭</p>
                    <p className="text-gray-500">还没有任何会话</p>
                    <p className="text-sm text-gray-400 mt-2">
                        在主对话页面开始对话后会自动创建会话
                    </p>
                </div>
            )}
        </div>
    );
}
