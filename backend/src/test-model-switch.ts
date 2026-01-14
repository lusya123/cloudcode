import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3005/api';
const sessionId = uuidv4();

async function runTest() {
    console.log(`Starting Model Switch Test (Session: ${sessionId})`);

    try {
        // Step 1: Start a session
        await axios.post(`${API_URL}/chat`, {
            sessionId,
            message: "Hello"
        });

        // Step 2: Request model switch
        // We use a fake model name and a fake local URL to verify it tries to use it.
        // In a real scenario, this would fail if the model doesn't exist, but we just want to check if the AGENT switches the config.
        // Ideally, GatewayAgent would log the switch.

        console.log("Sending switch request...");
        const switchRes = await axios.post(`${API_URL}/chat`, {
            sessionId,
            message: "Switch model to my-custom-model with base url http://localhost:9999/v1"
        });

        console.log(`CloudClaude Reply: ${switchRes.data.reply}`);

        // Step 3: Verify (In a real e2e, we might check internal state or logs, 
        // but here we rely on the agent's confirmation message)
        if (switchRes.data.reply.includes("Model switched to") || switchRes.data.reply.includes("Connection error")) {
            console.log("SUCCESS: Model switch processed (Confirmed: Agent attempted to use new configuration).");
        } else {
            console.log("FAILURE: Model switch response not affirmative.", switchRes.data.reply);
        }

    } catch (e: any) {
        console.error('Error:', e.message);
        if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
    }
}

runTest();
