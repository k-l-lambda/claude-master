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

console.log('=== 模拟实际场景 ===\n');

// 模拟 Round 1: Instructor 的初始请求
console.log('Round 1: Instructor 初始请求');
try {
  const response1 = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: 'Read README.md to get aware your task.',
    messages: [{ role: 'user', content: 'Start working on the task.' }],
    tools: [
      {
        name: 'read_file',
        description: 'Read contents of a file from the filesystem',
        input_schema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path']
        }
      }
    ],
  });
  console.log('  ✓ 成功');
  console.log(`  Response: ${JSON.stringify(response1.content[0]).substring(0, 100)}...\n`);
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}\n`);
  process.exit(1);
}

// 模拟 Round 2: Instructor 审查 Worker 响应（这里失败了）
console.log('Round 2: Instructor 审查 Worker 响应');
try {
  const response2 = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8192,
    system: 'Read README.md to get aware your task.',
    messages: [
      { role: 'user', content: 'Start working on the task.' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: "I'll start by reading the README.md file to understand the task." }]
      },
      {
        role: 'user',
        content: "Worker says: I'll help you read the README.md file to understand the task."
      }
    ],
    tools: [
      {
        name: 'read_file',
        description: 'Read contents of a file from the filesystem',
        input_schema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path']
        }
      }
    ],
  });
  console.log('  ✓ 成功');
  console.log(`  Response: ${JSON.stringify(response2.content[0]).substring(0, 100)}...\n`);
} catch (error) {
  console.log(`  ✗ 失败: ${error.message}`);
  console.log(`  Status: ${error.status}`);
  console.log(`  这就是您遇到的错误！\n`);
}
