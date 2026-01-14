'use client';

import { useState } from 'react';
import type { ScheduledTask } from '../../lib/types';

export function TaskCard({ task }: { task: ScheduledTask }) {
  const [isRunning, setIsRunning] = useState(false);

  const triggerTask = async () => {
    setIsRunning(true);
    try {
      await fetch(`/api/tasks/${task.id}/trigger`, { method: 'POST' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold">{task.name}</h3>
      <p className="text-xs text-gray-500">Cron: {task.cron}</p>
      <p className="text-xs text-gray-400">Status: {task.enabled ? 'Enabled' : 'Paused'}</p>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded-md border border-black/10 bg-white/80 px-3 py-1 text-xs text-gray-600"
          onClick={triggerTask}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Now'}
        </button>
        <a
          className="rounded-md border border-black/10 bg-white/80 px-3 py-1 text-xs text-gray-600"
          href={`/tasks?logs=${task.id}`}
        >
          View Logs
        </a>
      </div>
    </div>
  );
}
