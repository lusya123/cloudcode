'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/', label: '对话' },
    { href: '/history', label: '历史' },
    { href: '/tasks', label: '任务' },
    { href: '/monitor', label: '监控' },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-52 h-screen fixed left-0 top-0 flex flex-col border-r border-gray-200 bg-gray-50/50">
            <div className="h-14 flex items-center px-5 border-b border-gray-200">
                <span className="text-[15px] font-semibold text-gray-900 tracking-tight">Cloud Code</span>
            </div>

            <nav className="flex-1 py-3 px-3">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center h-9 px-3 rounded-md text-[13px] transition-colors cursor-pointer ${
                                isActive
                                    ? 'bg-gray-900 text-white font-medium'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="px-5 py-4 border-t border-gray-200">
                <p className="text-[11px] text-gray-400">v1.0</p>
            </div>
        </aside>
    );
}
