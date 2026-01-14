'use client';

interface MetricsChartProps {
    label: string;
    value: number;
    maxValue?: number;
}

export function MetricsChart({ label, value, maxValue = 100 }: MetricsChartProps) {
    const percentage = Math.min((value / maxValue) * 100, 100);

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] text-gray-600">{label}</span>
                <span className="text-[13px] font-medium text-gray-900">{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
