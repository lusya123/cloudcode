import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3004/api', // Should be env var
    headers: {
        'Content-Type': 'application/json',
    },
});

export const fetcher = (url: string) => api.get(url).then((res) => res.data);

export const chatApi = {
    sendMessage: (sessionId: string, message: string) =>
        api.post('/chat', { sessionId, message }),

    getHistory: (sessionId: string) =>
        api.get(`/history/${sessionId}`),

    triggerTask: (taskId: string) =>
        api.post(`/tasks/${taskId}/trigger`),
};
