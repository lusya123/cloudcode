'use client';

import useSWR from 'swr';

export function StatusIndicator() {
  const { data } = useSWR('/api/status', { refreshInterval: 8000 });
  const healthy = Boolean(data?.uptime);

  return (
    <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs text-gray-600 shadow-sm">
      <span className={`h-2 w-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      <span>{healthy ? 'Online' : 'Unknown'}</span>
    </div>
  );
}
