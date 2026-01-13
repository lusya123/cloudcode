"use client";

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Cpu, HardDrive, Activity, Search } from 'lucide-react';

export default function MonitorPage() {
    const { data: status } = useSWR('/status', fetcher, { refreshInterval: 2000 });

    const metrics = [
        { label: 'CPU Usage', value: status?.cpu ? `${status.cpu}%` : '0%', icon: Cpu, color: 'text-blue-500', bg: 'bg-blue-50' },
        { label: 'Memory', value: status?.memory ? `${status.memory}%` : '0%', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50' },
        { label: 'Disk', value: status?.disk ? `${status.disk}%` : '0%', icon: HardDrive, color: 'text-orange-500', bg: 'bg-orange-50' },
        { label: 'Active Tasks', value: status?.taskCount || 0, icon: Search, color: 'text-green-500', bg: 'bg-green-50' },
    ];

    return (
        <div className="p-8 h-full overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6">系统监控</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {metrics.map((m, i) => {
                    const Icon = m.icon;
                    return (
                        <div key={i} className="glass-card p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${m.bg} ${m.color}`}>
                                    <Icon size={20} />
                                </div>
                                <span className="text-sm text-gray-500">{m.label}</span>
                            </div>
                            <div className="text-2xl font-bold">{m.value}</div>
                        </div>
                    );
                })}
            </div>

            <div className="glass-card p-6">
                <h3 className="font-semibold mb-4">System Details</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">Uptime</span>
                        <span className="font-mono">{status?.uptime ? Math.floor(status.uptime / 60) + ' minutes' : '-'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">Status</span>
                        <span className="text-green-600 font-medium">● Online</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
