/**
 * Utility Functions
 */

// Format relative time
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return '刚刚';
    } else if (diffMinutes < 60) {
        return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
        return `${diffHours}小时前`;
    } else if (diffDays < 7) {
        return `${diffDays}天前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

// Format date time
export function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('zh-CN');
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Parse cron expression to human readable
export function cronToHuman(cron: string): string {
    const parts = cron.split(' ');
    if (parts.length < 5) return cron;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return `每天 ${hour}:${minute.padStart(2, '0')}`;
    }
    if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `每${days[parseInt(dayOfWeek)]} ${hour}:${minute.padStart(2, '0')}`;
    }

    return cron;
}

// Class name helper
export function cn(...classes: (string | undefined | false)[]): string {
    return classes.filter(Boolean).join(' ');
}
