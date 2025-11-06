#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';

console.log('环境变量检查:');
console.log('ANTHROPIC_AUTH_TOKEN:', process.env.ANTHROPIC_AUTH_TOKEN ? `SET (${process.env.ANTHROPIC_AUTH_TOKEN.length} chars)` : 'NOT SET');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? `SET (${process.env.ANTHROPIC_API_KEY.length} chars)` : 'NOT SET');
console.log('');

// 测试 1: 只传递 authToken
console.log('测试 1: 只传递 authToken (正确方式)');
try {
  const client1 = new Anthropic({
    authToken: process.env.ANTHROPIC_AUTH_TOKEN,
  });
  console.log('✓ Client 创建成功');

  const response = await client1.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  console.log('✓ API 调用成功:', response.content[0].text);
} catch (error) {
  console.log('✗ 错误:', error.message);
}

console.log('');

// 测试 2: 同时传递 authToken 和 apiKey (apiKey 为空字符串)
console.log('测试 2: 同时传递 authToken 和 apiKey (apiKey 为空字符串)');
try {
  const client2 = new Anthropic({
    authToken: process.env.ANTHROPIC_AUTH_TOKEN,
    apiKey: '',  // 空字符串
  });
  console.log('✓ Client 创建成功');

  const response = await client2.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  console.log('✓ API 调用成功:', response.content[0].text);
} catch (error) {
  console.log('✗ 错误:', error.message);
}

console.log('');

// 测试 3: 同时传递 authToken 和 undefined apiKey
console.log('测试 3: 同时传递 authToken 和 undefined apiKey');
try {
  const client3 = new Anthropic({
    authToken: process.env.ANTHROPIC_AUTH_TOKEN,
    apiKey: undefined,
  });
  console.log('✓ Client 创建成功');

  const response = await client3.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Hi' }],
  });
  console.log('✓ API 调用成功:', response.content[0].text);
} catch (error) {
  console.log('✗ 错误:', error.message);
}
