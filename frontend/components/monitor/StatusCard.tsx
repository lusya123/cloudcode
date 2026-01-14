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
            <div className="grid grid-cols-3 gap-8 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i}>
                        <div className="h-8 bg-gray-100 rounded w-16 mb-2"></div>
                        <div className="h-4 bg-gray-100 rounded w-20"></div>
                    </div>
                ))}
            </div>
        );
    }

    const items = [
        { label: '运行时间', value: status.uptime },
        { label: '活跃会话', value: status.activeSessions },
        { label: '定时任务', value: status.taskCount },
    ];

    return (
        <div className="grid grid-cols-3 gap-8">
            {items.map((item) => (
                <div key={item.label}>
                    <p className="text-[28px] font-semibold text-gray-900 tracking-tight">{item.value}</p>
                    <p className="text-[13px] text-gray-500 mt-1">{item.label}</p>
                </div>
            ))}
        </div>
    );
}
