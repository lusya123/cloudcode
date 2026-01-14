import type { ScheduledTask } from '../../lib/types';

export function TaskCard({ task }: { task: ScheduledTask }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{task.name}</h3>
        <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
          task.enabled ? 'bg-ink text-white' : 'bg-line text-muted'
        }`}>
          {task.enabled ? 'Active' : 'Paused'}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">{task.instruction}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
        <span>Cron: {task.cron}</span>
        <span>Dir: {task.workingDir}</span>
      </div>
    </div>
  );
}
