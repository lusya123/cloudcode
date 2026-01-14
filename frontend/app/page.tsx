import { ChatBox } from '@/components/chat/ChatBox';

export default function HomePage() {
    return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden">
            <ChatBox />
        </div>
    );
}
