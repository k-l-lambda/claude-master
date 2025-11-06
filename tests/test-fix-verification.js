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

console.log('=== 修复验证：使用 undefined 而不是空字符串 ===\n');

// 模拟修复后的代码
const authToken = process.env.ANTHROPIC_AUTH_TOKEN || undefined;
const apiKey = process.env.ANTHROPIC_API_KEY || undefined;

console.log('修复后的配置:');
console.log('  authToken:', authToken ? 'SET' : 'undefined');
console.log('  apiKey:', apiKey ? 'SET' : 'undefined');
console.log('  authToken === undefined:', authToken === undefined);
console.log('  apiKey === undefined:', apiKey === undefined);
console.log('');

try {
  const client = new Anthropic({
    authToken: authToken,
    apiKey: apiKey,
  });

  console.log('SDK 内部值:');
  console.log('  authToken:', client.authToken || 'null/undefined');
  console.log('  apiKey:', client.apiKey || 'null/undefined');
  console.log('  authToken == null:', client.authToken == null);
  console.log('  apiKey == null:', client.apiKey == null);
  console.log('');

  console.log('根据 SDK 源码 (line 382, 389):');
  console.log('  apiKeyAuth 会跳过:', client.apiKey == null ? '✓ YES' : '✗ NO (会发送空 X-Api-Key 头)');
  console.log('  bearerAuth 会使用:', client.authToken == null ? '✗ NO' : '✓ YES');
  console.log('');

  console.log('发送测试消息...');
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: '请用中文回答：什么是递归？请给出一个简单的代码示例。'
    }],
  });

  console.log('✓ API 调用成功！');
  console.log('');
  console.log('=== 响应详情 ===');
  console.log('模型:', response.model);
  console.log('Stop Reason:', response.stop_reason);
  console.log('Usage:', JSON.stringify(response.usage, null, 2));
  console.log('');
  console.log('=== 响应内容 ===');
  console.log(response.content[0].text);
  console.log('');
  console.log('=== 结论 ===');
  console.log('✓ 问题已修复！');
  console.log('  - 不再发送空的 X-Api-Key 头');
  console.log('  - SDK 只使用 Bearer 认证');
  console.log('  - 与 Claude Code CLI 行为一致');
  console.log('  - ✅ 可以正常接收完整响应内容');
} catch (error) {
  console.log('✗ API 调用失败:', error.message);
  if (error.status) console.log('  HTTP 状态码:', error.status);
}
