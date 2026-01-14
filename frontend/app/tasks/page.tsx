'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TasksResponse } from '@/lib/types';

export default function TasksPage() {
    const { data, isLoading, mutate } = useSWR<TasksResponse>('/api/tasks', fetcher);

    return (
        <div className="max-w-2xl mx-auto px-6 py-8">
            <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">定时任务</h1>
            <p className="text-[13px] text-gray-500 mt-1">查看和管理定时任务</p>

            <div className="mt-8">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2].map(i => (
                            <div key={i} className="py-5 border-b border-gray-100 animate-pulse">
                                <div className="h-4 bg-gray-100 rounded w-1/4 mb-3"></div>
                                <div className="h-3 bg-gray-100 rounded w-1/2 mb-2"></div>
                                <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                            </div>
                        ))}
                    </div>
                ) : data?.tasks && data.tasks.length > 0 ? (
                    <div>
                        {data.tasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onRefresh={() => mutate()}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-16 text-center">
                        <p className="text-gray-400 text-[14px]">还没有定时任务</p>
                        <p className="text-gray-300 text-[13px] mt-1">在对话中说"每天12点帮我..."来创建</p>
                    </div>
                )}
            </div>

            <div className="mt-8 py-4 border-t border-gray-100">
                <p className="text-[12px] text-gray-400">
                    提示：通过自然语言在对话中创建和管理定时任务
                </p>
            </div>
        </div>
    );
}
