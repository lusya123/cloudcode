'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/', label: '对话', icon: '💬' },
    { href: '/history', label: '历史', icon: '📚' },
    { href: '/tasks', label: '任务', icon: '⏰' },
    { href: '/monitor', label: '监控', icon: '📊' },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="glass-sidebar w-56 h-screen fixed left-0 top-0 flex flex-col">
            <div className="p-4 border-b border-black/5">
                <h1 className="text-xl font-bold text-gray-800">☁️ CloudClaude</h1>
            </div>

            <nav className="flex-1 p-3 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive
                                    ? 'bg-white/80 shadow-sm font-medium'
                                    : 'hover:bg-white/50'
                                }`}
                        >
                            <span>{item.icon}</span>
                            <span className="text-sm">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-black/5 text-xs text-gray-500">
                <p>CloudClaude v1.0</p>
            </div>
        </aside>
    );
}
