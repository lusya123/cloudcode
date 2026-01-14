'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { HistoryCard } from '@/components/history/HistoryCard';
import { SessionsResponse } from '@/lib/types';

export default function HistoryPage() {
    const { data, isLoading } = useSWR<SessionsResponse>('/api/sessions', fetcher);

    return (
        <div className="max-w-2xl mx-auto px-6 py-8">
            <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">历史记录</h1>
            <p className="text-[13px] text-gray-500 mt-1">查看所有会话历史</p>

            <div className="mt-8">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="py-4 border-b border-gray-100 animate-pulse">
                                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2"></div>
                                <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : data?.sessions && data.sessions.length > 0 ? (
                    <div>
                        {data.sessions.map(session => (
                            <HistoryCard
                                key={session.id}
                                session={session}
                                isActive={session.id === data.activeId}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-16 text-center">
                        <p className="text-gray-400 text-[14px]">还没有任何会话</p>
                        <p className="text-gray-300 text-[13px] mt-1">开始对话后会自动创建会话</p>
                    </div>
                )}
            </div>
        </div>
    );
}
