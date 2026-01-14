import { ChatBox } from '../components/chat/ChatBox';

export default function HomePage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Gateway Chat</h2>
        <p className="text-sm text-gray-500">All operations happen through this chat.</p>
      </div>
      <ChatBox />
    </section>
  );
}
