import { ToolExecutor } from './executors/tool-executor';
import { TaskScheduler } from './core/scheduler';
import logger from './utils/logger';
import path from 'path';

async function runTest() {
    console.log('Starting CloudClaude Local System Test...');

    // 1. Test Tool Executor
    console.log('\n[1/3] Testing Tool Executor...');
    const executor = new ToolExecutor(process.cwd());
    await executor.init();

    try {
        const listResult = await executor.execute('Bash', { command: 'ls -la' });
        console.log('✅ Bash Tool (ls -la): Success');
        // console.log(listResult.output.substring(0, 100) + '...');
    } catch (e) {
        console.error('❌ Bash Tool Failed:', e);
    }

    // 2. Test File Operations
    console.log('\n[2/3] Testing File Operations...');
    const testFile = 'test_write.txt';
    try {
        await executor.execute('Write', { file_path: testFile, content: 'Hello CloudClaude' });
        console.log('✅ Write Tool: Success');

        const readResult = await executor.execute('Read', { file_path: testFile });
        if (readResult.content.includes('Hello CloudClaude')) {
            console.log('✅ Read Tool: Success');
        } else {
            console.error('❌ Read Tool: Content Mismatch');
        }
    } catch (e) {
        console.error('❌ File Ops Failed:', e);
    }

    // 3. Test Scheduler
    console.log('\n[3/3] Testing Scheduler...');
    const scheduler = new TaskScheduler();
    const task = scheduler.addTask({
        name: 'Test Task',
        cron: '* * * * *',
        instruction: 'echo hello'
    });

    if (scheduler.getTasks().length === 1) {
        console.log('✅ Scheduler Add Task: Success');
    } else {
        console.error('❌ Scheduler Failed');
    }

    console.log('\nSystem Test Complete.');
    process.exit(0);
}

runTest();
