/**
 * API Client for CloudClaude Frontend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030';

// Fetcher for SWR
export const fetcher = async (url: string) => {
    const res = await fetch(`${API_BASE}${url}`);
    if (!res.ok) {
        throw new Error('An error occurred while fetching the data.');
    }
    return res.json();
};

// Send chat message
export async function sendMessage(message: string, sessionId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
    });
    return res.json();
}

// Trigger task manually
export async function triggerTask(taskId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}/trigger`, {
        method: 'POST',
    });
    return res.json();
}

// Get sessions
export async function getSessions(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/sessions`);
    return res.json();
}

// Get session messages
export async function getSessionMessages(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
    return res.json();
}

// Create new session
export async function createSession(name?: string, workingDir?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, workingDir }),
    });
    return res.json();
}

// Get tasks
export async function getTasks(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/tasks`);
    return res.json();
}

// Get status
export async function getStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/status`);
    return res.json();
}
