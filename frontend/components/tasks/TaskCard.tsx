'use client';

import { useState } from 'react';
import { Task } from '@/lib/types';
import { triggerTask } from '@/lib/api';
import { cronToHuman } from '@/lib/utils';

interface TaskCardProps {
    task: Task;
    onRefresh?: () => void;
}

export function TaskCard({ task, onRefresh }: TaskCardProps) {
    const [isRunning, setIsRunning] = useState(false);

    const handleTrigger = async () => {
        setIsRunning(true);
        try {
            await triggerTask(task.id);
            onRefresh?.();
        } catch (error) {
            console.error('Failed to trigger task:', error);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="glass-card p-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">⏰</span>
                    <h3 className="font-semibold text-gray-800">{task.name}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${task.enabled
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                    {task.enabled ? '✅ 启用' : '⏸️ 禁用'}
                </span>
            </div>

            <div className="mt-3 space-y-1 text-sm text-gray-500">
                <p>🕐 {cronToHuman(task.cron)}</p>
                <p className="truncate">📂 {task.workingDir}</p>
                {task.lastRun && (
                    <p>
                        📊 上次执行: {task.lastStatus === 'success' ? '✅ 成功' : '❌ 失败'}
                    </p>
                )}
            </div>

            <div className="flex gap-2 mt-4">
                <button
                    onClick={handleTrigger}
                    disabled={isRunning || !task.enabled}
                    className="glass-button text-sm py-1.5 px-3"
                >
                    {isRunning ? '执行中...' : '立即执行'}
                </button>
                <button className="text-sm py-1.5 px-3 text-gray-600 hover:bg-black/5 rounded-lg transition-colors">
                    查看日志
                </button>
            </div>
        </div>
    );
}
