import Link from 'next/link';
import type { SessionSummary } from '../../lib/types';

export function HistoryCard({ session }: { session: SessionSummary }) {
  return (
    <Link href={`/history/${session.id}`} className="glass-card glass-hover block p-4">
      <h3 className="text-sm font-semibold">{session.name}</h3>
      <p className="text-xs text-gray-500">{session.workingDir}</p>
      <p className="mt-2 text-xs text-gray-400">Last used: {new Date(session.lastUsed).toLocaleString()}</p>
      <p className="text-xs text-gray-400">Messages: {session.messageCount}</p>
    </Link>
  );
}
