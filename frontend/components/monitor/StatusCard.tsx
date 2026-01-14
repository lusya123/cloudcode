import type { StatusInfo } from '../../lib/types';

export function StatusCard({ status }: { status: StatusInfo }) {
  return (
    <div className="panel rounded-2xl p-5">
      <h3 className="text-lg font-semibold">System Status</h3>
      <div className="mt-4 grid gap-3 text-sm text-muted">
        <div className="flex items-center justify-between">
          <span>Uptime</span>
          <span>{Math.round(status.uptime / 60)} min</span>
        </div>
        <div className="flex items-center justify-between">
          <span>RSS</span>
          <span>{Math.round(status.rss / 1024 / 1024)} MB</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Heap</span>
          <span>{Math.round(status.heapUsed / 1024 / 1024)} / {Math.round(status.heapTotal / 1024 / 1024)} MB</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Sessions</span>
          <span>{status.sessions.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Tasks</span>
          <span>{status.tasks.length}</span>
        </div>
      </div>
    </div>
  );
}
