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
        <Link href={`/history/${session.id}`} className="block">
            <div className={`py-4 px-1 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${isActive ? 'bg-gray-50' : ''}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <h3 className="text-[14px] font-medium text-gray-900 truncate">{session.name}</h3>
                        {isActive && (
                            <span className="text-[11px] px-2 py-0.5 bg-gray-900 text-white rounded-full flex-shrink-0">当前</span>
                        )}
                    </div>
                    <span className="text-[12px] text-gray-400 flex-shrink-0 ml-4">{formatRelativeTime(session.lastUsed)}</span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-[12px] text-gray-400">
                    <span className="truncate">{session.workingDir}</span>
                    <span className="flex-shrink-0">{session.messageCount} 消息</span>
                </div>
            </div>
        </Link>
    );
}
