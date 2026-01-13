'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { StatusCard } from '@/components/monitor/StatusCard';
import { MetricsChart } from '@/components/monitor/MetricsChart';

export default function MonitorPage() {
    const { data: status } = useSWR('/api/status', fetcher, {
        refreshInterval: 5000
    });

    // Calculate memory percentage
    const memoryUsed = status?.memory?.heapUsed || 0;
    const memoryTotal = status?.memory?.heapTotal || 1;
    const memoryPercent = (memoryUsed / memoryTotal) * 100;

    return (
        <div className="p-6 space-y-6">
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-800">📊 系统监控</h1>
                <p className="text-sm text-gray-500 mt-1">
                    实时查看系统状态和资源使用
                </p>
            </div>

            {/* Status Cards */}
            <StatusCard />

            {/* Resource Usage */}
            <div>
                <h2 className="text-lg font-semibold text-gray-700 mb-4">资源使用</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <MetricsChart
                        label="内存使用"
                        value={memoryPercent}
                        color="#2383e2"
                    />
                    <MetricsChart
                        label="会话占用"
                        value={(status?.activeSessions || 0) * 33.33}
                        color="#10b981"
                    />
                    <MetricsChart
                        label="任务负载"
                        value={Math.min((status?.taskCount || 0) * 10, 100)}
                        color="#8b5cf6"
                    />
                </div>
            </div>

            {/* System Info */}
            <div>
                <h2 className="text-lg font-semibold text-gray-700 mb-4">系统信息</h2>
                <div className="glass-card p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">运行时间</span>
                        <span className="font-medium">{status?.uptime || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">活跃会话</span>
                        <span className="font-medium">{status?.activeSessions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">定时任务</span>
                        <span className="font-medium">{status?.taskCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">内存使用</span>
                        <span className="font-medium">
                            {(memoryUsed / 1024 / 1024).toFixed(1)} MB / {(memoryTotal / 1024 / 1024).toFixed(1)} MB
                        </span>
                    </div>
                </div>
            </div>

            {/* Status Indicator */}
            <div className="glass-card p-4 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-sm text-gray-600">系统运行正常</span>
            </div>
        </div>
    );
}
