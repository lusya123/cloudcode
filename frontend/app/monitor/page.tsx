'use client';

import useSWR from 'swr';
import { StatusCard } from '../../components/monitor/StatusCard';
import { MetricsChart } from '../../components/monitor/MetricsChart';

export default function MonitorPage() {
  const { data } = useSWR<{ logs: Array<{ line: string }> }>('/api/logs', { refreshInterval: 8000 });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">System Monitor</h2>
        <p className="text-sm text-gray-500">Live status from the backend.</p>
      </div>

      <StatusCard />
      <MetricsChart />

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold">Recent Logs</h3>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs text-gray-500">
          {data?.logs?.length
            ? data.logs.map((log, index) => <p key={`${log.line}-${index}`}>{log.line}</p>)
            : 'No logs yet.'}
        </div>
      </div>
    </section>
  );
}
