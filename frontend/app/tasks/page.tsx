import { TaskForm } from '../../components/tasks/TaskForm';
import { TaskList } from '../../components/tasks/TaskList';

export default function TasksPage() {
  return (
    <section className="space-y-6">
      <div className="surface rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Scheduler</p>
        <h2 className="mt-2 text-2xl font-semibold">Task center</h2>
        <p className="mt-2 text-sm text-muted">
          Add recurring tasks and keep tabs on what is running.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <TaskForm />
        <TaskList />
      </div>
    </section>
  );
}
