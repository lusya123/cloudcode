"use client";

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import Link from 'next/link';
import { Clock, Folder } from 'lucide-react';
import { formatTime, cn } from '@/lib/utils';

export default function HistoryPage() {
    const { data, error } = useSWR('/history', fetcher);
    const sessions = data?.sessions || [];

    if (error) return <div className="p-8 text-red-500">Failed to load history</div>;

    return (
        <div className="p-8 h-full overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6">历史记录</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map((session: any) => (
                    <Link key={session.id} href={`/history/${session.id}`}>
                        <div className="glass-card p-6 h-full flex flex-col hover:glass-hover transition-all cursor-pointer group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="bg-blue-50 p-3 rounded-lg text-blue-500 group-hover:bg-blue-100 transition-colors">
                                    <Folder size={24} />
                                </div>
                                <span className={cn(
                                    "text-xs px-2 py-1 rounded-full",
                                    session.status === 'active' ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
                                )}>
                                    {session.status}
                                </span>
                            </div>

                            <h3 className="font-semibold text-lg mb-2 truncate">{session.name}</h3>
                            <p className="text-sm text-gray-400 mb-4 line-clamp-2 break-all font-mono text-xs">
                                {session.workingDir}
                            </p>

                            <div className="mt-auto flex items-center gap-2 text-xs text-gray-400">
                                <Clock size={12} />
                                <span>{formatTime(session.lastUsed)}</span>
                                <span className="mx-1">•</span>
                                <span>{session.messages?.length || 0} messages</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
