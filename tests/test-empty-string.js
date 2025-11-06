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

console.log('=== 关键问题：空字符串 vs null/undefined ===\n');

// 场景 1: 传递空字符串作为 apiKey（可能导致发送空的 X-Api-Key 头）
console.log('测试 1: apiKey = "" (空字符串)');
try {
  const client1 = new Anthropic({
    authToken: authToken,
    apiKey: '',  // 空字符串
  });

  console.log('SDK 保存的值:');
  console.log('  apiKey:', JSON.stringify(client1.apiKey));
  console.log('  apiKey == null:', client1.apiKey == null);
  console.log('  apiKey === "":', client1.apiKey === '');
  console.log('');
  console.log('根据 SDK 源码，apiKeyAuth() 检查: if (this.apiKey == null)');
  console.log('  结果:', client1.apiKey == null ? '不发送 X-Api-Key 头' : '会发送 X-Api-Key 头（值为空字符串）');
  console.log('');

  const response1 = await client1.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('✓ API 调用成功\n');
} catch (error) {
  console.log('✗ API 调用失败:', error.message);
  if (error.status) console.log('  HTTP 状态码:', error.status);
  console.log('');
}

// 场景 2: 传递 undefined 作为 apiKey
console.log('测试 2: apiKey = undefined');
try {
  const client2 = new Anthropic({
    authToken: authToken,
    apiKey: undefined,
  });

  console.log('SDK 保存的值:');
  console.log('  apiKey:', JSON.stringify(client2.apiKey));
  console.log('  apiKey == null:', client2.apiKey == null);
  console.log('');
  console.log('根据 SDK 源码，apiKeyAuth() 检查: if (this.apiKey == null)');
  console.log('  结果:', client2.apiKey == null ? '不发送 X-Api-Key 头' : '会发送 X-Api-Key 头');
  console.log('');

  const response2 = await client2.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('✓ API 调用成功\n');
} catch (error) {
  console.log('✗ API 调用失败:', error.message);
  if (error.status) console.log('  HTTP 状态码:', error.status);
  console.log('');
}

// 场景 3: 不传递 apiKey 字段（让它使用默认值）
console.log('测试 3: 不传递 apiKey 字段');
try {
  const client3 = new Anthropic({
    authToken: authToken,
  });

  console.log('SDK 保存的值:');
  console.log('  apiKey:', JSON.stringify(client3.apiKey));
  console.log('  apiKey == null:', client3.apiKey == null);
  console.log('');
  console.log('根据 SDK 源码，apiKeyAuth() 检查: if (this.apiKey == null)');
  console.log('  结果:', client3.apiKey == null ? '不发送 X-Api-Key 头' : '会发送 X-Api-Key 头');
  console.log('');

  const response3 = await client3.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'hi' }],
  });
  console.log('✓ API 调用成功\n');
} catch (error) {
  console.log('✗ API 调用失败:', error.message);
  if (error.status) console.log('  HTTP 状态码:', error.status);
  console.log('');
}
