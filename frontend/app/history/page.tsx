import { HistoryList } from '../../components/history/HistoryList';

export default function HistoryPage() {
  return (
    <section className="space-y-6">
      <div className="surface rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Sessions</p>
        <h2 className="mt-2 text-2xl font-semibold">Conversation history</h2>
        <p className="mt-2 text-sm text-muted">
          Review previous sessions and resume any thread when needed.
        </p>
      </div>
      <HistoryList />
    </section>
  );
}
