"use client";

import useSWR from 'swr';
import { fetcher, chatApi } from '@/lib/api';
import { Play, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function TasksPage() {
    const { data } = useSWR('/tasks', fetcher);
    const tasks = data?.tasks || [];
    const [triggering, setTriggering] = useState<string | null>(null);

    const handleTrigger = async (id: string) => {
        setTriggering(id);
        try {
            await chatApi.triggerTask(id);
            alert('Task triggered');
        } catch (e) {
            alert('Failed to trigger task');
        } finally {
            setTriggering(null);
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6">定时任务</h1>

            <div className="grid gap-4">
                {tasks.length === 0 && (
                    <div className="text-gray-400 text-center py-12 glass-card">
                        No scheduled tasks found. Ask the agent to create one.
                    </div>
                )}

                {tasks.map((task: any) => (
                    <div key={task.id} className="glass-card p-6 flex items-center justify-between">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                                <Clock size={24} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">{task.name}</h3>
                                <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-600 mt-1 inline-block">
                                    {task.cron}
                                </code>
                                <p className="text-sm text-gray-500 mt-2">{task.instruction}</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-2">
                                <span className={`flex items-center gap-1 text-sm ${task.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                                    {task.enabled ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                    {task.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </div>

                            <button
                                onClick={() => handleTrigger(task.id)}
                                disabled={!!triggering}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium transition-all"
                            >
                                <Play size={14} className={triggering === task.id ? 'animate-spin' : ''} />
                                Run Now
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
