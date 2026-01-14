import type { StatusInfo } from '../../lib/types';

function Bar({ label, value }: { label: string; value: number }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-line">
        <div className="h-2 rounded-full bg-ink" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function MetricsChart({ status }: { status: StatusInfo }) {
  const heapPercent = status.heapTotal ? (status.heapUsed / status.heapTotal) * 100 : 0;
  const rssPercent = status.heapTotal ? (status.rss / status.heapTotal) * 100 : 0;

  return (
    <div className="panel rounded-2xl p-5">
      <h3 className="text-lg font-semibold">Memory Profile</h3>
      <div className="mt-4 space-y-4">
        <Bar label="Heap Usage" value={heapPercent} />
        <Bar label="RSS vs Heap" value={rssPercent} />
      </div>
    </div>
  );
}
