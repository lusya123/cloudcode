'use client';

import Link from 'next/link';
import { Session } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

interface HistoryCardProps {
    session: Session;
    isActive?: boolean;
}

export function HistoryCard({ session, isActive }: HistoryCardProps) {
    return (
        <Link href={`/history/${session.id}`}>
            <div className={`glass-card glass-hover p-4 cursor-pointer ${isActive ? 'ring-2 ring-blue-400' : ''}`}>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📁</span>
                        <h3 className="font-semibold text-gray-800">{session.name}</h3>
                        {isActive && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">当前</span>}
                    </div>
                </div>

                <p className="text-sm text-gray-500 mt-2 truncate">
                    {session.workingDir}
                </p>

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span>⏰ {formatRelativeTime(session.lastUsed)}</span>
                    <span>💬 {session.messageCount} 消息</span>
                </div>
            </div>
        </Link>
    );
}
