"use client";

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { MessageList } from '@/components/chat/MessageList';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function HistoryDetailPage() {
    const params = useParams();
    const { data, error } = useSWR(`/history/${params.id}`, fetcher);

    if (!data) return <div className="p-8">Loading...</div>;
    if (error) return <div className="p-8 text-red-500">Error loading session</div>;

    const { session, messages } = data;

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            <header className="px-6 py-4 glass-card m-4 mb-0 flex items-center gap-4 shrink-0">
                <Link href="/history" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="font-semibold text-lg">{session.name}</h1>
                    <p className="text-xs text-gray-400 font-mono">{session.workingDir}</p>
                </div>
            </header>

            <MessageList messages={messages} />

            {/* Read-only notification */}
            <div className="p-4 text-center text-xs text-gray-400">
                This is an archived view of the session.
            </div>
        </div>
    );
}
