'use client';

import useSWR from 'swr';
import { HistoryCard } from './HistoryCard';
import { fetcher } from '../../lib/api';
import type { SessionSummary } from '../../lib/types';

interface HistoryResponse {
  sessions: SessionSummary[];
}

export function HistoryList() {
  const { data, error, isLoading } = useSWR<HistoryResponse>('/api/history', fetcher);

  if (isLoading) {
    return <p className="text-sm text-muted">Loading sessions...</p>;
  }

  if (error) {
    return <p className="text-sm text-muted">Failed to load sessions.</p>;
  }

  if (!data?.sessions?.length) {
    return <p className="text-sm text-muted">No sessions available.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.sessions.map(session => (
        <HistoryCard key={session.id} session={session} />
      ))}
    </div>
  );
}
