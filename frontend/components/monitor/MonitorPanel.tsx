'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../lib/api';
import type { StatusInfo } from '../../lib/types';
import { StatusCard } from './StatusCard';
import { MetricsChart } from './MetricsChart';

export function MonitorPanel() {
  const { data, error, isLoading, mutate } = useSWR<StatusInfo>('/api/status', fetcher, {
    refreshInterval: 5000
  });
  const [socketStatus, setSocketStatus] = useState('disconnected');

  const wsUrl = useMemo(() => {
    if (typeof window === 'undefined') return null;
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.hostname}:3000/ws`;
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => setSocketStatus('connected');
    socket.onclose = () => setSocketStatus('disconnected');
    socket.onerror = () => setSocketStatus('error');
    socket.onmessage = () => {
      mutate();
    };
    return () => socket.close();
  }, [wsUrl, mutate]);

  if (isLoading) {
    return <p className="text-sm text-muted">Loading system metrics...</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-muted">Unable to load system metrics.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted">
        <span className="h-2 w-2 rounded-full bg-ink" />
        <span>WebSocket {socketStatus}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <StatusCard status={data} />
        <MetricsChart status={data} />
      </div>
    </div>
  );
}
