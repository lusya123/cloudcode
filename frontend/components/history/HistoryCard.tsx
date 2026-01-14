import Link from 'next/link';
import type { SessionSummary } from '../../lib/types';

export function HistoryCard({ session }: { session: SessionSummary }) {
  return (
    <Link
      href={`/history/${session.id}`}
      className="panel block rounded-2xl p-5 transition hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{session.name}</h3>
        <span className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted">
          {session.type}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted">{session.workingDir}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
        <span>Messages: {session.messageCount}</span>
        <span>Last used: {new Date(session.lastUsed).toLocaleString()}</span>
      </div>
    </Link>
  );
}
