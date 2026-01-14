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
        <div className="py-5 border-b border-gray-100">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="text-[14px] font-medium text-gray-900">{task.name}</h3>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${task.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                            {task.enabled ? '启用' : '禁用'}
                        </span>
                    </div>
                    <div className="mt-2 space-y-1 text-[12px] text-gray-500">
                        <p>{cronToHuman(task.cron)}</p>
                        <p className="truncate max-w-md">{task.workingDir}</p>
                        {task.lastRun && (
                            <p className="flex items-center gap-1.5">
                                上次执行: {task.lastStatus === 'success' ? '成功' : '失败'}
                                <span className={`w-1.5 h-1.5 rounded-full ${task.lastStatus === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleTrigger}
                        disabled={isRunning || !task.enabled}
                        className="text-[12px] px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                        {isRunning ? '执行中' : '执行'}
                    </button>
                    <button className="text-[12px] px-3 py-1.5 text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
                        日志
                    </button>
                </div>
            </div>
        </div>
    );
}
