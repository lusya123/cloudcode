import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3004/api';
const sessionId = uuidv4();

async function runTest() {
    console.log(`Starting E2E Verification (Session: ${sessionId})`);

    // Helper to send message
    async function sendMessage(content: string) {
        console.log(`\nUser: ${content}`);
        try {
            const res = await axios.post(`${API_URL}/chat`, {
                sessionId,
                message: content
            });
            console.log(`CloudClaude: ${res.data.reply}`);
            return res.data.reply;
        } catch (e: any) {
            console.error('Error:', e.message);
            if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
            return null;
        }
    }

    // 1. Basic Chat
    console.log('\n--- Test 1: Basic Chat ---');
    await sendMessage('Hello, who are you?');

    // 2. Command Execution (Bash)
    console.log('\n--- Test 2: Bash Execution ---');
    await sendMessage('List the files in the current directory.');

    // 3. File IO (Write then Read) - Requires Agent Loop
    console.log('\n--- Test 3: File Write & Read (Multi-turn) ---');
    const filename = `test_e2e_${Date.now()}.txt`;
    await sendMessage(`Write "Verification Success" to a file named ${filename}, and then read it back to confirm.`);

    // 4. Task Scheduling
    console.log('\n--- Test 4: Task Scheduling ---');
    await sendMessage('Schedule a task named "LogTest" to run "echo TaskRunning" every minute (* * * * *).');

    // 5. Verify Task List
    console.log('\n--- Test 5: Verify Task Created ---');
    const tasks = await axios.get(`${API_URL}/tasks`);
    console.log('Active Tasks:', JSON.stringify(tasks.data, null, 2));

    console.log('\nE2E Verification Complete.');
}

runTest();
