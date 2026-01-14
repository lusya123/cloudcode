'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export function Header() {
    const { data: status } = useSWR('/api/status', fetcher, {
        refreshInterval: 10000
    });

    return (
        <header className="h-14 border-b border-gray-200 flex items-center justify-end px-6 bg-white">
            <div className="flex items-center gap-4 text-[13px]">
                {status && (
                    <>
                        <div className="flex items-center gap-2 text-gray-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>运行中</span>
                        </div>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">{status.uptime}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">{status.activeSessions} 会话</span>
                    </>
                )}
            </div>
        </header>
    );
}
