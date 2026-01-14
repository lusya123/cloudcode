import * as fs from 'fs/promises';
import * as path from 'path';
import readline from 'readline/promises';

const CONFIG_DIR = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');

async function main(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const appId = await rl.question('Feishu App ID: ');
  const appSecret = await rl.question('Feishu App Secret: ');
  const encryptKey = await rl.question('Feishu Encrypt Key (optional): ');
  const verificationToken = await rl.question('Feishu Verification Token (optional): ');
  const apiKey = await rl.question('Anthropic API Key: ');
  const baseUrl = await rl.question('Anthropic Base URL (optional): ');

  await rl.close();

  const credentials = {
    feishu: {
      appId: appId.trim(),
      appSecret: appSecret.trim(),
      encryptKey: encryptKey.trim() || undefined,
      verificationToken: verificationToken.trim() || undefined
    },
    anthropic: {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined
    }
  };

  await fs.writeFile(path.join(CONFIG_DIR, 'credentials.json'), JSON.stringify(credentials, null, 2));

  const tasksPath = path.join(CONFIG_DIR, 'tasks.json');
  const sessionsPath = path.join(CONFIG_DIR, 'sessions.json');

  try {
    await fs.access(tasksPath);
  } catch {
    await fs.writeFile(tasksPath, JSON.stringify({ tasks: [] }, null, 2));
  }

  try {
    await fs.access(sessionsPath);
  } catch {
    await fs.writeFile(sessionsPath, JSON.stringify({ lastActive: null, sessions: [] }, null, 2));
  }

  console.log('Configuration initialized in', CONFIG_DIR);
}

main().catch((error) => {
  console.error('Failed to initialize config:', error);
  process.exit(1);
});
