import { ChatBox } from '@/components/chat/ChatBox';

export default function HomePage() {
    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-black/5">
                <h1 className="text-xl font-semibold text-gray-800">💬 与 CloudClaude 对话</h1>
                <p className="text-sm text-gray-500 mt-1">
                    发送消息执行任务、管理会话或配置系统
                </p>
            </div>
            <div className="flex-1">
                <ChatBox />
            </div>
        </div>
    );
}
