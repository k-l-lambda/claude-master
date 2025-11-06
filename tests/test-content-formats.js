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

console.log('=== 测试不同的 content 格式 ===\n');

// 测试 1: assistant content 是字符串
console.log('测试 1: assistant content 是字符串');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'Start.' },
      { role: 'assistant', content: 'OK' },
      { role: 'user', content: 'Continue.' }
    ],
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}

// 测试 2: assistant content 是数组（只有 text）
console.log('测试 2: assistant content 是数组（只有 text）');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'Start.' },
      { role: 'assistant', content: [{ type: 'text', text: 'OK' }] },
      { role: 'user', content: 'Continue.' }
    ],
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}

// 测试 3: assistant content 是数组（有 tool_use）
console.log('测试 3: assistant content 是数组（有 tool_use）');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'Start.' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: "I'll use a tool" },
          {
            type: 'tool_use',
            id: 'test_1',
            name: 'test_tool',
            input: {}
          }
        ]
      },
      { role: 'user', content: 'Continue.' }
    ],
    tools: [{
      name: 'test_tool',
      description: 'A test tool',
      input_schema: { type: 'object', properties: {} }
    }],
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}

// 测试 4: assistant content 有 tool_use，但没有提供 tool_result
console.log('测试 4: assistant 有 tool_use，下一个 user 消息没有 tool_result');
try {
  await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'Start.' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: "I'll start by reading the README.md file to understand the task." }
        ]
      },
      {
        role: 'user',
        content: "Worker says: I'll help you read the README.md file to understand the task."
      }
    ],
    tools: [{
      name: 'read_file',
      description: 'Read file',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    }],
  });
  console.log('  ✓ 成功\n');
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
}
