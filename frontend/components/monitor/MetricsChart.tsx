'use client';

import useSWR from 'swr';
import type { StatusResponse } from '../../lib/types';

const Meter = ({ label, value }: { label: string; value: number }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="h-2 rounded-full bg-gray-100">
      <div
        className="h-2 rounded-full bg-blue-500"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  </div>
);

export function MetricsChart() {
  const { data } = useSWR<StatusResponse>('/api/status', { refreshInterval: 5000 });

  return (
    <div className="glass-card space-y-4 p-4">
      <h3 className="text-sm font-semibold">Resource Usage</h3>
      <div className="space-y-3">
        <Meter label="CPU" value={data?.cpu ?? 0} />
        <Meter label="Memory" value={data?.memory ?? 0} />
        <Meter label="Disk" value={data?.disk ?? 0} />
      </div>
    </div>
  );
}
