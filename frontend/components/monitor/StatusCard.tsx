'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { SystemStatus } from '@/lib/types';

export function StatusCard() {
    const { data: status } = useSWR<SystemStatus>('/api/status', fetcher, {
        refreshInterval: 5000
    });

    if (!status) {
        return (
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass-card p-4 text-center animate-pulse">
                        <div className="h-8 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-4">
            <div className="glass-card p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{status.uptime}</p>
                <p className="text-sm text-gray-500">运行时间</p>
            </div>
            <div className="glass-card p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{status.activeSessions}</p>
                <p className="text-sm text-gray-500">活跃会话</p>
            </div>
            <div className="glass-card p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{status.taskCount}</p>
                <p className="text-sm text-gray-500">定时任务</p>
            </div>
        </div>
    );
}
