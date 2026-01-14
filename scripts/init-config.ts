import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { ensureConfigDir, getConfigDir } from '../src/utils/config-loader';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

async function main(): Promise<void> {
  ensureConfigDir();
  const configDir = getConfigDir();

  const appId = await ask('Feishu App ID: ');
  const appSecret = await ask('Feishu App Secret: ');
  const encryptKey = await ask('Feishu Encrypt Key (optional): ');
  const verificationToken = await ask('Feishu Verification Token (optional): ');
  const anthropicKey = await ask('Anthropic API Key: ');
  const anthropicBaseUrl = await ask('Anthropic Base URL (optional): ');
  const anthropicModel = await ask('Default model (optional): ');

  const credentials = {
    feishu: {
      appId,
      appSecret,
      encryptKey: encryptKey || undefined,
      verificationToken: verificationToken || undefined
    }
  };

  fs.writeFileSync(
    path.join(configDir, 'credentials.json'),
    JSON.stringify(credentials, null, 2)
  );

  const tasksPath = path.join(configDir, 'tasks.json');
  if (!fs.existsSync(tasksPath)) {
    fs.writeFileSync(tasksPath, JSON.stringify({ tasks: [] }, null, 2));
  }

  const sessionsPath = path.join(configDir, 'sessions.json');
  if (!fs.existsSync(sessionsPath)) {
    fs.writeFileSync(sessionsPath, JSON.stringify({ lastActive: null, sessions: [] }, null, 2));
  }

  const permissionsPath = path.join(configDir, 'permissions.json');
  if (!fs.existsSync(permissionsPath)) {
    fs.writeFileSync(
      permissionsPath,
      JSON.stringify(
        {
          permissions: {
            deny: [
              'Bash(rm -rf /)',
              'Bash(dd if=*)',
              'Bash(mkfs.*)',
              'Bash(shutdown*)',
              'Bash(reboot*)',
              'Read(/etc/shadow)',
              'Read(/etc/passwd)',
              'Write(/etc/*)',
              'Write(/usr/*)',
              'Write(/bin/*)'
            ],
            allow: [
              'Read(**)',
              'Glob(**)',
              'Grep(**)',
              'Bash(ls *)',
              'Bash(cat *)',
              'Bash(pwd)',
              'Bash(whoami)',
              'Bash(npm *)',
              'Bash(node *)',
              'Bash(python *)',
              'Bash(git *)'
            ],
            ask: [
              'Bash(apt *)',
              'Bash(pip install *)',
              'Bash(curl *)',
              'Bash(wget *)',
              'Write(**)',
              'Edit(**)'
            ]
          }
        },
        null,
        2
      )
    );
  }

  const providersPath = path.join(configDir, 'providers.json');
  if (!fs.existsSync(providersPath)) {
    fs.writeFileSync(
      providersPath,
      JSON.stringify(
        {
          provider: 'anthropic',
          apiKey: anthropicKey,
          baseUrl: anthropicBaseUrl || 'https://api.anthropic.com',
          model: anthropicModel || 'claude-sonnet-4-20250514'
        },
        null,
        2
      )
    );
  }

  const mcpPath = path.join(configDir, 'mcp-servers.json');
  if (!fs.existsSync(mcpPath)) {
    fs.writeFileSync(
      mcpPath,
      JSON.stringify(
        {
          servers: {}
        },
        null,
        2
      )
    );
  }

  console.log(`Config initialized in ${configDir}`);
  rl.close();
}

main().catch(error => {
  console.error(error);
  rl.close();
  process.exit(1);
});
