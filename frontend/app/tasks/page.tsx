'use client';

import useSWR from 'swr';
import type { TasksResponse } from '../../lib/types';
import { TaskCard } from '../../components/tasks/TaskCard';
import { TaskForm } from '../../components/tasks/TaskForm';

export default function TasksPage() {
  const { data, isLoading } = useSWR<TasksResponse>('/api/tasks');

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Scheduled Tasks</h2>
        <p className="text-sm text-gray-500">Run and monitor scheduled automation.</p>
      </div>

      <TaskForm />

      {isLoading && <p className="text-sm text-gray-400">Loading tasks...</p>}
      {!isLoading && (!data?.tasks?.length ? (
        <p className="text-sm text-gray-400">No scheduled tasks yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ))}
    </section>
  );
}
