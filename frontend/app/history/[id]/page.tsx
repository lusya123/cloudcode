'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChatBox } from '@/components/chat/ChatBox';

export default function HistoryDetailPage() {
    const params = useParams();
    const sessionId = params.id as string;

    return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 border-b border-black/5 flex items-center gap-4 flex-shrink-0">
                <Link
                    href="/history"
                    className="text-gray-500 hover:text-gray-800 transition-colors"
                >
                    ← 返回历史
                </Link>
                <div className="border-l border-gray-300 h-4"></div>
                <h1 className="text-lg font-semibold text-gray-800">
                    会话详情
                </h1>
                <span className="text-sm text-gray-400">
                    ID: {sessionId}
                </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
                <ChatBox sessionId={sessionId} />
            </div>
        </div>
    );
}
