'use client';

import useSWR from 'swr';
import type { SessionsResponse } from '../../lib/types';
import { HistoryCard } from './HistoryCard';

export function HistoryList() {
  const { data, isLoading } = useSWR<SessionsResponse>('/api/history');

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading sessions...</p>;
  }

  if (!data?.sessions?.length) {
    return <p className="text-sm text-gray-400">No sessions yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.sessions.map((session) => (
        <HistoryCard key={session.id} session={session} />
      ))}
    </div>
  );
}
