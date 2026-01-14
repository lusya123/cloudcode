import { ChatBox } from '@/components/chat/ChatBox';

export default function HomePage() {
    return (
        <div className="h-full flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 border-b border-black/5 flex-shrink-0">
                <h1 className="text-xl font-semibold text-gray-800">💬 与 CloudClaude 对话</h1>
                <p className="text-sm text-gray-500 mt-1">
                    发送消息执行任务、管理会话或配置系统
                </p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
                <ChatBox />
            </div>
        </div>
    );
}
