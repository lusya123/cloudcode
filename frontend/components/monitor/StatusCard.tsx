'use client';

import useSWR from 'swr';
import type { StatusResponse } from '../../lib/types';

export function StatusCard() {
  const { data } = useSWR<StatusResponse>('/api/status', { refreshInterval: 5000 });

  const items = [
    { label: 'Uptime', value: data?.uptime ?? '--' },
    { label: 'Active Sessions', value: data?.activeSessions ?? '--' },
    { label: 'Tasks', value: data?.taskCount ?? '--' }
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="glass-card p-4 text-center">
          <p className="text-xs text-gray-500">{item.label}</p>
          <p className="text-lg font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
