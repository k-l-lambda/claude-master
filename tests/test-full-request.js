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

console.log('测试完整请求（与 yarn dev 相同的配置）...\n');

try {
  const response = await client.messages.create({
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
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      }
    ],
    thinking: {
      type: 'enabled',
      budget_tokens: 10000,
    },
  });

  console.log('✓ 请求成功！');
  console.log('响应内容:', JSON.stringify(response.content, null, 2));
} catch (error) {
  console.log('✗ 请求失败:', error.message);
  console.log('完整错误:', error);
}
