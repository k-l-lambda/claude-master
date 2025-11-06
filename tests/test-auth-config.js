#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';

// 加载 .env.local 文件 (与 index.ts 相同)
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath });
  console.log('✓ 已加载 .env.local');
} else {
  console.log('✗ 未找到 .env.local');
}
console.log('');

// 模拟您的 index.ts 逻辑
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';
const apiKey = process.env.ANTHROPIC_API_KEY || '';

console.log('=== 配置检查 ===');
console.log('authToken 是否设置:', !!authToken, authToken ? `(${authToken.length} chars)` : '');
console.log('apiKey 是否设置:', !!apiKey, apiKey ? `(${apiKey.length} chars)` : '');
console.log('authToken === "":', authToken === '');
console.log('apiKey === "":', apiKey === '');
console.log('');

// 测试场景 1: 原始代码方式 - 总是传递两个值
console.log('=== 测试 1: 当前代码方式 (总是传递 authToken 和 apiKey) ===');
try {
  const client1 = new Anthropic({
    authToken: authToken,  // 可能是 '' 或实际值
    apiKey: apiKey,        // 可能是 '' 或实际值
  });

  console.log('SDK 内部接收到的值:');
  console.log('- authToken:', client1.authToken || 'null/undefined/empty');
  console.log('- apiKey:', client1.apiKey || 'null/undefined/empty');
  console.log('');

  const response1 = await client1.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'test' }],
  });
  console.log('✓ 成功:', response1.content[0].text);
} catch (error) {
  console.log('✗ 失败:', error.message);
  if (error.status) console.log('HTTP 状态码:', error.status);
}

console.log('');

// 测试场景 2: 优化方式 - 只传递有值的字段
console.log('=== 测试 2: 优化方式 (只传递非空值) ===');
try {
  const config = {};
  if (authToken) config.authToken = authToken;
  if (apiKey) config.apiKey = apiKey;

  const client2 = new Anthropic(config);

  console.log('SDK 内部接收到的值:');
  console.log('- authToken:', client2.authToken || 'null/undefined/empty');
  console.log('- apiKey:', client2.apiKey || 'null/undefined/empty');
  console.log('');

  const response2 = await client2.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'test' }],
  });
  console.log('✓ 成功:', response2.content[0].text);
} catch (error) {
  console.log('✗ 失败:', error.message);
  if (error.status) console.log('HTTP 状态码:', error.status);
}
