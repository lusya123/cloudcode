import { HistoryList } from '../../components/history/HistoryList';

export default function HistoryPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Session History</h2>
        <p className="text-sm text-gray-500">Browse previous conversations.</p>
      </div>
      <HistoryList />
    </section>
  );
}
