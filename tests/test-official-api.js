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

const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';
const baseURL = process.env.ANTHROPIC_BASE_URL;

console.log('环境配置:');
console.log('  authToken:', authToken ? 'SET' : 'NOT SET');
console.log('  baseURL:', baseURL || 'default');
console.log('');

console.log('=== 关键发现：空字符串可能导致问题 ===\n');

// 测试：使用官方 API 地址 + 空字符串 apiKey
console.log('测试 1: 官方 API + apiKey=""');
try {
  const client = new Anthropic({
    authToken: authToken,
    apiKey: '',  // 空字符串 - 这可能是问题所在！
    baseURL: 'https://api.anthropic.com',  // 官方 API
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('✓ 成功');
} catch (error) {
  console.log('✗ 失败:', error.message);
  if (error.status) console.log('  HTTP 状态码:', error.status);
}

console.log('');

// 测试：使用官方 API 地址 + 不传递 apiKey
console.log('测试 2: 官方 API + 不传递 apiKey');
try {
  const client = new Anthropic({
    authToken: authToken,
    // 不传递 apiKey 字段
    baseURL: 'https://api.anthropic.com',
  });

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('✓ 成功');
} catch (error) {
  console.log('✗ 失败:', error.message);
  if (error.status) console.log('  HTTP 状态码:', error.status);
}

console.log('');
console.log('=== 结论 ===');
console.log('如果测试 1 失败但测试 2 成功，说明：');
console.log('  问题：传递空字符串 apiKey="" 导致 SDK 发送空的 X-Api-Key 头');
console.log('  解决：不要传递空字符串，使用 undefined 或不传递该字段');
