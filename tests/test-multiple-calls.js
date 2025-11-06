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

console.log('=== 测试连续多次调用 ===\n');

async function testCall(round) {
  console.log(`Round ${round}: 发送请求...`);
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      messages: [{ role: 'user', content: `This is test round ${round}` }],
      tools: [{
        name: 'test',
        description: 'test tool',
        input_schema: { type: 'object', properties: {} }
      }],
    });
    console.log(`  ✓ 成功\n`);
    return true;
  } catch (error) {
    console.log(`  ✗ 失败: ${error.message}\n`);
    return false;
  }
}

// 测试5次连续调用
for (let i = 1; i <= 5; i++) {
  const success = await testCall(i);
  if (!success) {
    console.log(`在第 ${i} 次调用时失败`);
    break;
  }
  // 等待1秒
  await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log('测试完成');
