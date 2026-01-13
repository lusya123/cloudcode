'use client';

interface MetricsChartProps {
    label: string;
    value: number;
    maxValue?: number;
    color?: string;
}

export function MetricsChart({ label, value, maxValue = 100, color = '#2383e2' }: MetricsChartProps) {
    const percentage = Math.min((value / maxValue) * 100, 100);
    const isWarning = percentage > 80;

    return (
        <div className="glass-card p-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">{label}</span>
                <span className={`text-sm font-medium ${isWarning ? 'text-orange-500' : 'text-gray-800'}`}>
                    {percentage.toFixed(0)}%
                    {isWarning && ' ⚠️'}
                </span>
            </div>
            <div className="progress-bar">
                <div
                    className="progress-bar-fill"
                    style={{
                        width: `${percentage}%`,
                        background: isWarning
                            ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                            : `linear-gradient(90deg, ${color}, ${color}88)`
                    }}
                />
            </div>
        </div>
    );
}
