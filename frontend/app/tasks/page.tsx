'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TasksResponse } from '@/lib/types';

export default function TasksPage() {
    const { data, isLoading, mutate } = useSWR<TasksResponse>('/api/tasks', fetcher);

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-800">⏰ 定时任务</h1>
                <p className="text-sm text-gray-500 mt-1">
                    查看和管理定时任务
                </p>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2].map(i => (
                        <div key={i} className="glass-card p-4 animate-pulse">
                            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            ) : data?.tasks && data.tasks.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {data.tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onRefresh={() => mutate()}
                        />
                    ))}
                </div>
            ) : (
                <div className="glass-card p-8 text-center">
                    <p className="text-4xl mb-4">📭</p>
                    <p className="text-gray-500">还没有定时任务</p>
                    <p className="text-sm text-gray-400 mt-2">
                        在主对话页面说"每天12点帮我..."来创建定时任务
                    </p>
                </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">
                    💡 <strong>提示：</strong>在主对话页面通过自然语言创建和管理定时任务
                </p>
            </div>
        </div>
    );
}
