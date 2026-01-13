import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
};

const initConfig = async () => {
    console.log('Welcome to CloudClaude Configuration Wizard');
    console.log('-------------------------------------------');

    const appId = await question('Feishu App ID: ');
    const appSecret = await question('Feishu App Secret: ');
    const encryptKey = await question('Feishu Encrypt Key: ');
    const verificationToken = await question('Feishu Verification Token: ');
    const apiKey = await question('Anthropic API Key: ');
    const workspaceRoot = await question('Workspace Root (default: ./workspace): ') || './workspace';

    const configContent = `server:
  port: 3000
  host: 0.0.0.0

feishu:
  appId: "${appId}"
  appSecret: "${appSecret}"
  encryptKey: "${encryptKey}"
  verificationToken: "${verificationToken}"

claude:
  apiKey: "${apiKey}"
  model: "claude-3-opus-20240229"

workspace:
  root: "${workspaceRoot}"
`;

    const configPath = path.join(process.cwd(), 'config.yaml');
    fs.writeFileSync(configPath, configContent);

    console.log(`\nConfiguration saved to ${configPath}`);
    console.log('You can now run "npm start" to start the server.');

    rl.close();
};

initConfig();
