import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3004/api';
const sessionId = uuidv4();

async function runTest() {
    console.log(`Starting Session Tool Verification (Initial Session: ${sessionId})`);

    try {
        const res = await axios.post(`${API_URL}/chat`, {
            sessionId,
            message: "Please start a new chat session for me."
        });
        console.log(`CloudClaude Reply: ${res.data.reply}`);

        // Check if history contains a new session (stub check since we don't switch context in script)
        const history = await axios.get(`${API_URL}/history`);
        console.log('Sessions in History:', history.data.sessions.map((s: any) => s.id));

    } catch (e: any) {
        console.error('Error:', e.message);
        if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
    }
}

runTest();
