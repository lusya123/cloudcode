'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { StatusCard } from '@/components/monitor/StatusCard';
import { MetricsChart } from '@/components/monitor/MetricsChart';

export default function MonitorPage() {
    const { data: status } = useSWR('/api/status', fetcher, {
        refreshInterval: 5000
    });

    const memoryUsed = status?.memory?.heapUsed || 0;
    const memoryTotal = status?.memory?.heapTotal || 1;
    const memoryPercent = (memoryUsed / memoryTotal) * 100;

    return (
        <div className="max-w-2xl mx-auto px-6 py-8">
            <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">系统监控</h1>
            <p className="text-[13px] text-gray-500 mt-1">实时查看系统状态</p>

            <div className="mt-10">
                <StatusCard />
            </div>

            <div className="mt-12">
                <h2 className="text-[15px] font-medium text-gray-900 mb-6">资源使用</h2>
                <div className="space-y-6">
                    <MetricsChart label="内存使用" value={memoryPercent} />
                    <MetricsChart label="会话占用" value={(status?.activeSessions || 0) * 33.33} />
                    <MetricsChart label="任务负载" value={Math.min((status?.taskCount || 0) * 10, 100)} />
                </div>
            </div>

            <div className="mt-12">
                <h2 className="text-[15px] font-medium text-gray-900 mb-4">系统信息</h2>
                <div className="space-y-3">
                    {[
                        { label: '运行时间', value: status?.uptime || '-' },
                        { label: '活跃会话', value: status?.activeSessions || 0 },
                        { label: '定时任务', value: status?.taskCount || 0 },
                        { label: '内存使用', value: `${(memoryUsed / 1024 / 1024).toFixed(1)} MB / ${(memoryTotal / 1024 / 1024).toFixed(1)} MB` },
                    ].map(item => (
                        <div key={item.label} className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-[13px] text-gray-500">{item.label}</span>
                            <span className="text-[13px] font-medium text-gray-900">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[13px] text-gray-500">系统运行正常</span>
            </div>
        </div>
    );
}
