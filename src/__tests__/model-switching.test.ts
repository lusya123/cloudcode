/**
 * Model Switching Test Cases
 * 测试通过自然语言切换模型的功能
 */

import { findModelByName, getConfiguredModels, switchToModel, loadCredentials } from '../utils/config-loader';

// 测试结果收集
const results: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => Promise<void> | void) {
    return async () => {
        try {
            await fn();
            results.push({ name, passed: true });
            console.log(`✅ ${name}`);
        } catch (error: any) {
            results.push({ name, passed: false, error: error.message });
            console.log(`❌ ${name}: ${error.message}`);
        }
    };
}

function expect<T>(actual: T) {
    return {
        toBe(expected: T) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, but got ${actual}`);
            }
        },
        toBeTruthy() {
            if (!actual) {
                throw new Error(`Expected truthy value, but got ${actual}`);
            }
        },
        toBeFalsy() {
            if (actual) {
                throw new Error(`Expected falsy value, but got ${actual}`);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error(`Expected null, but got ${actual}`);
            }
        },
        toBeGreaterThan(expected: number) {
            if (typeof actual !== 'number' || actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toContain(expected: string) {
            if (typeof actual !== 'string' || !actual.includes(expected)) {
                throw new Error(`Expected "${actual}" to contain "${expected}"`);
            }
        }
    };
}

// ==================== 测试用例 ====================

/**
 * 测试 1: 意图识别 - "切换模型为 XXX" 模式
 */
const testIntentPatternSwitchTo = test('Intent: "切换模型为 XXX" should match', async () => {
    const text = '切换模型为 zhipu-claude';
    const pattern = /切换模型(?:为|到)?(.+)/i;
    const match = text.match(pattern);

    expect(match).toBeTruthy();
    expect(match![1].trim()).toBe('zhipu-claude');
});

/**
 * 测试 2: 意图识别 - "切换模型到 XXX" 模式
 */
const testIntentPatternSwitchToAlt = test('Intent: "切换模型到 XXX" should match', async () => {
    const text = '切换模型到 zhipu-claude-opus';
    const pattern = /切换模型(?:为|到)?(.+)/i;
    const match = text.match(pattern);

    expect(match).toBeTruthy();
    expect(match![1].trim()).toBe('zhipu-claude-opus');
});

/**
 * 测试 3: 意图识别 - "使用 XXX 模型" 模式
 */
const testIntentPatternUseModel = test('Intent: "使用 XXX 模型" should match', async () => {
    const text = '使用 gpt-4 模型';
    const pattern = /使用(.+)模型/i;
    const match = text.match(pattern);

    expect(match).toBeTruthy();
    expect(match![1].trim()).toBe('gpt-4');
});

/**
 * 测试 4: 获取已配置的模型列表
 */
const testGetConfiguredModels = test('getConfiguredModels should return model list', async () => {
    const models = await getConfiguredModels();

    expect(models.length).toBeGreaterThan(0);
    expect(models[0].name).toBeTruthy();
    expect(models[0].model).toBeTruthy();
});

/**
 * 测试 5: 通过名称查找模型 - 精确匹配
 */
const testFindModelExact = test('findModelByName should find model by exact name', async () => {
    const model = await findModelByName('zhipu-claude');

    expect(model).toBeTruthy();
    expect(model!.name).toBe('zhipu-claude');
    expect(model!.apiKey).toBeTruthy();
    expect(model!.model).toBeTruthy();
});

/**
 * 测试 6: 通过名称查找模型 - 模糊匹配
 */
const testFindModelFuzzy = test('findModelByName should find model by partial name', async () => {
    const model = await findModelByName('opus');

    expect(model).toBeTruthy();
    expect(model!.name).toContain('opus');
});

/**
 * 测试 7: 查找不存在的模型
 */
const testFindModelNotFound = test('findModelByName should return null for unknown model', async () => {
    const model = await findModelByName('nonexistent-model-xyz');

    expect(model).toBeNull();
});

/**
 * 测试 8: 切换到已配置的模型
 */
const testSwitchToConfiguredModel = test('switchToModel should succeed for configured model', async () => {
    const result = await switchToModel('zhipu-claude');

    expect(result.success).toBe(true);
    expect(result.message).toContain('已切换');
    expect(result.modelConfig).toBeTruthy();
});

/**
 * 测试 9: 切换到不存在的模型
 */
const testSwitchToUnknownModel = test('switchToModel should fail for unknown model', async () => {
    const result = await switchToModel('nonexistent-model');

    expect(result.success).toBe(false);
    expect(result.message).toContain('未找到');
});

/**
 * 测试 10: 切换模型后验证配置更新
 */
const testConfigUpdatedAfterSwitch = test('credentials should update after model switch', async () => {
    // 切换到 opus 模型
    await switchToModel('zhipu-claude-opus');

    // 验证配置已更新
    const credentials = await loadCredentials();

    expect(credentials.anthropic.model).toContain('opus');
});

// ==================== 运行测试 ====================

async function runTests() {
    console.log('\n🧪 Running Model Switching Tests...\n');
    console.log('='.repeat(50));

    const tests = [
        testIntentPatternSwitchTo,
        testIntentPatternSwitchToAlt,
        testIntentPatternUseModel,
        testGetConfiguredModels,
        testFindModelExact,
        testFindModelFuzzy,
        testFindModelNotFound,
        testSwitchToConfiguredModel,
        testSwitchToUnknownModel,
        testConfigUpdatedAfterSwitch
    ];

    for (const t of tests) {
        await t();
    }

    console.log('='.repeat(50));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

    if (failed > 0) {
        console.log('Failed tests:');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`);
        });
        process.exit(1);
    }

    // 恢复到默认模型
    await switchToModel('zhipu-claude');
    console.log('✨ All tests passed!\n');
}

runTests().catch(console.error);
