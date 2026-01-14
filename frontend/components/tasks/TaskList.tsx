'use client';

import useSWR from 'swr';
import { fetcher } from '../../lib/api';
import { TaskCard } from './TaskCard';
import type { ScheduledTask } from '../../lib/types';

interface TaskResponse {
  tasks: ScheduledTask[];
}

export function TaskList() {
  const { data, error, isLoading } = useSWR<TaskResponse>('/api/tasks', fetcher, {
    refreshInterval: 5000
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Loading tasks...</p>;
  }

  if (error) {
    return <p className="text-sm text-muted">Failed to load tasks.</p>;
  }

  if (!data?.tasks?.length) {
    return <p className="text-sm text-muted">No scheduled tasks yet.</p>;
  }

  return (
    <div className="grid gap-4">
      {data.tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
