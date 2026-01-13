'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export function Header() {
    const { data: status } = useSWR('/api/status', fetcher, {
        refreshInterval: 10000
    });

    return (
        <header className="h-14 border-b border-black/5 bg-white/50 backdrop-blur-sm flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-700">
                    {/* Page title can be set via context or props */}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                {status && (
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-400"></span>
                            运行中
                        </span>
                        <span>⏱️ {status.uptime}</span>
                        <span>📁 {status.activeSessions} 会话</span>
                    </div>
                )}

                <button className="p-2 hover:bg-black/5 rounded-lg transition-colors">
                    ⚙️
                </button>
            </div>
        </header>
    );
}
