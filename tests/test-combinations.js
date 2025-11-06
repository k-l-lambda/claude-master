#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath });
}

const client = new Anthropic({
  authToken: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

console.log('=== 测试不同组合 ===\n');

// 测试 1: 只有基本消息
console.log('测试 1: 基本消息');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}

// 测试 2: 添加 thinking
console.log('测试 2: 添加 thinking');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Hi' }],
    thinking: { type: 'enabled', budget_tokens: 10000 },
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}

// 测试 3: 添加 tools（不加 thinking）
console.log('测试 3: 添加 tools（不加 thinking）');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Hi' }],
    tools: [{
      name: 'test',
      description: 'test tool',
      input_schema: { type: 'object', properties: {} }
    }],
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}

// 测试 4: tools + thinking 一起
console.log('测试 4: tools + thinking 一起');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Hi' }],
    tools: [{
      name: 'test',
      description: 'test tool',
      input_schema: { type: 'object', properties: {} }
    }],
    thinking: { type: 'enabled', budget_tokens: 10000 },
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}

// 测试 5: 添加 system prompt
console.log('测试 5: 添加 system prompt + tools + thinking');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hi' }],
    tools: [{
      name: 'test',
      description: 'test tool',
      input_schema: { type: 'object', properties: {} }
    }],
    thinking: { type: 'enabled', budget_tokens: 10000 },
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}
