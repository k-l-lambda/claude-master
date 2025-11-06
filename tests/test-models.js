#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';

// 加载 .env.local
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath });
}

const authToken = process.env.ANTHROPIC_AUTH_TOKEN || undefined;
const apiKey = process.env.ANTHROPIC_API_KEY || undefined;
const baseURL = process.env.ANTHROPIC_BASE_URL;

console.log('=== 测试不同模型 ===\n');

const models = [
  'claude-3-5-sonnet-20241022',  // 旧版 Sonnet 3.5
  'claude-sonnet-4-5-20250929',  // 新版 Sonnet 4.5
];

for (const model of models) {
  console.log(`测试模型: ${model}`);

  try {
    const client = new Anthropic({
      authToken: authToken,
      apiKey: apiKey,
      baseURL: baseURL,
    });

    const response = await client.messages.create({
      model: model,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    console.log(`  ✓ 成功 - ${response.content[0].text.substring(0, 50)}...`);
  } catch (error) {
    console.log(`  ✗ 失败 - ${error.message}`);
    if (error.status) console.log(`    状态码: ${error.status}`);
  }
  console.log('');
}

console.log('测试 Thinking 功能');
try {
  const client = new Anthropic({
    authToken: authToken,
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'What is 2+2?' }],
    thinking: {
      type: 'enabled',
      budget_tokens: 1000,
    },
  });

  console.log('  ✓ Thinking 功能可用');
} catch (error) {
  console.log(`  ✗ Thinking 功能不可用 - ${error.message}`);
}
