import { ChatBox } from '../components/chat/ChatBox';

export default function Page() {
  return (
    <section className="space-y-6">
      <div className="surface rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Gateway</p>
        <h2 className="mt-2 text-2xl font-semibold">Talk to your CloudClaude agent</h2>
        <p className="mt-2 text-sm text-muted">
          Use this console as the single entry point for tasks, scheduling, and session management.
        </p>
      </div>
      <ChatBox />
    </section>
  );
}
