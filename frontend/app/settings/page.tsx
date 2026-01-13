"use client";

import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/api';
import { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export default function SettingsPage() {
    const { data: config, error } = useSWR('http://localhost:3004/api/settings', fetcher);
    const [formData, setFormData] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        if (config) {
            setFormData(config);
        }
    }, [config]);

    const handleChange = (section: string, key: string, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setStatus(null);
        try {
            await axios.post('http://localhost:3004/api/settings', formData);
            setStatus({ type: 'success', message: 'Configuration saved successfully. The system will now use the new settings.' });
            mutate('http://localhost:3004/api/settings'); // Refresh SWR
        } catch (e) {
            console.error(e);
            setStatus({ type: 'error', message: 'Failed to save configuration.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (error) return <div className="p-8 text-red-500">Failed to load settings. Ensure backend is running.</div>;
    if (!config) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="p-8 h-full overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6">System Settings</h1>

            {status && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {status.message}
                </div>
            )}

            <div className="space-y-6 max-w-2xl">
                {/* Claude Configuration */}
                <section className="glass-card p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        🤖 AI Model Configuration
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Anthropic API Key
                            </label>
                            <input
                                type="password"
                                value={formData.claude?.apiKey || ''}
                                onChange={(e) => handleChange('claude', 'apiKey', e.target.value)}
                                placeholder="sk-ant-..."
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                            <p className="text-xs text-gray-400 mt-1">Leave as "******" to keep existing key unchanged.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Base URL (Optional)
                            </label>
                            <input
                                type="text"
                                value={formData.claude?.baseURL || ''}
                                onChange={(e) => handleChange('claude', 'baseURL', e.target.value)}
                                placeholder="https://api.anthropic.com/v1"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                            <p className="text-xs text-gray-400 mt-1">For using proxies or compatible APIs.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Model Name
                            </label>
                            <input
                                type="text"
                                value={formData.claude?.model || ''}
                                onChange={(e) => handleChange('claude', 'model', e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </section>

                {/* Feishu Configuration */}
                <section className="glass-card p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        📢 Feishu Integration
                    </h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
                                <input
                                    type="text"
                                    value={formData.feishu?.appId || ''}
                                    onChange={(e) => handleChange('feishu', 'appId', e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">App Secret</label>
                                <input
                                    type="password"
                                    value={formData.feishu?.appSecret || ''}
                                    onChange={(e) => handleChange('feishu', 'appSecret', e.target.value)}
                                    placeholder="******"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Verification Token</label>
                            <input
                                type="password"
                                value={formData.feishu?.verificationToken || ''}
                                onChange={(e) => handleChange('feishu', 'verificationToken', e.target.value)}
                                placeholder="******"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200"
                            />
                        </div>
                    </div>
                </section>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    >
                        <Save size={20} />
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
}
