import { MonitorPanel } from '../../components/monitor/MonitorPanel';

export default function MonitorPage() {
  return (
    <section className="space-y-6">
      <div className="surface rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">System</p>
        <h2 className="mt-2 text-2xl font-semibold">Live monitor</h2>
        <p className="mt-2 text-sm text-muted">
          Track runtime health and resource usage in real time.
        </p>
      </div>
      <MonitorPanel />
    </section>
  );
}
