import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export const metadata: Metadata = {
    title: 'CloudClaude - 云端智能助手',
    description: '24/7 云端 Claude 智能助手管理界面',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="zh-CN">
            <body>
                <div className="flex min-h-screen">
                    <Sidebar />
                    <main className="flex-1 ml-56">
                        <Header />
                        <div className="h-[calc(100vh-56px)]">
                            {children}
                        </div>
                    </main>
                </div>
            </body>
        </html>
    );
}
