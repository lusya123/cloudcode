"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, History, Clock, Activity, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
    const pathname = usePathname();

    const links = [
        { href: '/', label: '对话', icon: Home },
        { href: '/history', label: '历史', icon: History },
        { href: '/tasks', label: '任务', icon: Clock },
        { href: '/monitor', label: '监控', icon: Activity },
    ];

    return (
        <div className="w-64 h-full glass-sidebar flex flex-col p-4">
            <div className="mb-8 px-4 py-2">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
                    Cloud Code
                </h1>
            </div>

            <nav className="flex-1 space-y-2">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                isActive
                                    ? "bg-white shadow-glass text-blue-600 font-medium"
                                    : "text-gray-600 hover:bg-white/50 hover:text-gray-900"
                            )}
                        >
                            <Icon size={20} />
                            <span>{link.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200/50">
                <Link href="/settings">
                    <div className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-900 cursor-pointer hover:bg-white/50 rounded-xl transition-all">
                        <Settings size={20} />
                        <span>设置</span>
                    </div>
                </Link>
            </div>
        </div>
    );
}
