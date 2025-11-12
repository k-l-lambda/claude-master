#!/usr/bin/env node

/**
 * Qwen API Test Script
 *
 * Tests basic Qwen API functionality including:
 * - Basic chat completion
 * - System prompts
 * - Multi-turn conversation
 * - Tool calling
 * - Streaming responses
 *
 * Environment Variables Required:
 * - QWEN_API_KEY: Your Qwen API key
 * - QWEN_BASE_URL: Qwen API base URL (default: https://dashscope.aliyuncs.com/compatible-mode/v1)
 * - QWEN_MODEL: Model to use (default: qwen-max)
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { loadCredentials, checkExistingCredentials } from './qwen-oauth-helper.mjs';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Try to load OAuth credentials first
const oauthCreds = await checkExistingCredentials();

// Helper function to format OAuth resource URL to proper endpoint
function formatOAuthEndpoint(resourceUrl) {
  if (!resourceUrl) return null;

  const suffix = '/v1';
  // Normalize the URL: add protocol if missing, ensure /v1 suffix
  const normalizedUrl = resourceUrl.startsWith('http')
    ? resourceUrl
    : `https://${resourceUrl}`;

  return normalizedUrl.endsWith(suffix)
    ? normalizedUrl
    : `${normalizedUrl}${suffix}`;
}

// Configuration
const config = {
  // If QWEN_API_KEY is explicitly set, use it; otherwise use OAuth
  apiKey: process.env.QWEN_API_KEY || oauthCreds?.access_token,
  // If QWEN_BASE_URL is explicitly set, use it; otherwise use OAuth resource_url
  baseURL: process.env.QWEN_BASE_URL
    || (oauthCreds?.resource_url ? formatOAuthEndpoint(oauthCreds.resource_url) : null)
    || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: process.env.QWEN_MODEL || (oauthCreds ? 'coder-model' : 'qwen-max'),
  usingOAuth: !process.env.QWEN_API_KEY && !!oauthCreds,
};

// Validate configuration
if (!config.apiKey) {
  console.error('❌ Error: No authentication credentials found');
  console.error('');
  console.error('You have two options:');
  console.error('');
  console.error('Option 1: Use OAuth (Recommended - Free access with Qwen Chat account)');
  console.error('  Run: node tests/qwen-oauth-helper.mjs');
  console.error('  This will open a browser for you to log in with your Qwen Chat account');
  console.error('');
  console.error('Option 2: Use API Key');
  console.error('  Set QWEN_API_KEY in .env.local or environment variables');
  console.error('  QWEN_API_KEY=sk-your-key-here');
  console.error('');
  process.exit(1);
}

console.log('🔧 Qwen API Configuration:');
if (config.usingOAuth) {
  console.log('   Auth Method: OAuth (Qwen Chat)');
  console.log(`   Access Token: ${config.apiKey.substring(0, 20)}...`);
  console.log(`   Expires: ${new Date(oauthCreds.expiry_date).toLocaleString()}`);
} else {
  console.log('   Auth Method: API Key');
  console.log(`   API Key: ${config.apiKey.substring(0, 10)}...`);
}
console.log(`   Base URL: ${config.baseURL}`);
console.log(`   Model: ${config.model}`);
console.log('');

// Create client
const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
});

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

// Auth error tracking
let authErrorDetected = false;

function reportTest(name, passed, details) {
  const emoji = passed ? '✅' : '❌';
  console.log(`${emoji} Test: ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  console.log('');

  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
  results.tests.push({ name, passed, details });
}

// Check if error is 401 authentication error
function isAuthenticationError(error) {
  return error.status === 401 || error.message?.includes('401');
}

// Display authentication help
function displayAuthHelp() {
  if (authErrorDetected) return; // Only show once
  authErrorDetected = true;

  console.log('');
  console.log('━'.repeat(60));
  console.log('⚠️  Authentication Error Detected');
  console.log('━'.repeat(60));
  console.log('');

  // Detect which provider is being used
  const baseURL = config.baseURL.toLowerCase();

  // Show OAuth login option first if using Qwen Chat API
  if (baseURL.includes('chat.qwen.ai') || config.usingOAuth) {
    console.log('🔐 Qwen Chat OAuth Authentication Required');
    console.log('');
    console.log('   Run the OAuth helper to log in:');
    console.log('   node tests/qwen-oauth-helper.mjs');
    console.log('');
    console.log('   This will:');
    console.log('   1. Display a QR code and URL');
    console.log('   2. Open your browser to log in');
    console.log('   3. Save your credentials automatically');
    console.log('   4. Enable free API access with your Qwen Chat account');
    console.log('');
  } else if (baseURL.includes('modelscope.cn')) {
    console.log('🔗 ModelScope API requires Alibaba Cloud account binding');
    console.log('');
    console.log('   Visit: https://www.modelscope.cn/my/myaccesstoken');
    console.log('');
    console.log('   Steps:');
    console.log('   1. Log in to ModelScope');
    console.log('   2. Go to API Key management page');
    console.log('   3. Click "Bind Alibaba Cloud Account"');
    console.log('   4. Follow the prompts to complete binding');
    console.log('');
    console.log('💡 Recommended Alternative 1: Use Qwen Chat OAuth (Free)');
    console.log('');
    console.log('   Run: node tests/qwen-oauth-helper.mjs');
    console.log('   This provides free API access with your Qwen Chat account');
    console.log('');
    console.log('💡 Recommended Alternative 2: Use DashScope API');
    console.log('');
    console.log('   Update your qwen-test.local.sh:');
    console.log('   export OPENAI_API_KEY="sk-your-dashscope-key"');
    console.log('   export OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"');
    console.log('   export OPENAI_MODEL="qwen-max"');
    console.log('');
    console.log('   Get DashScope API key at: https://dashscope.aliyun.com/');
    console.log('');
  } else if (baseURL.includes('dashscope.aliyun')) {
    console.log('🔗 DashScope API authentication failed');
    console.log('');
    console.log('   Visit: https://dashscope.aliyun.com/');
    console.log('');
    console.log('   Steps:');
    console.log('   1. Log in with Alibaba Cloud account');
    console.log('   2. Go to API Keys section');
    console.log('   3. Create or regenerate your API key');
    console.log('   4. Update OPENAI_API_KEY in qwen-test.local.sh');
    console.log('');
    console.log('💡 Alternative: Use Qwen Chat OAuth (Free)');
    console.log('');
    console.log('   Run: node tests/qwen-oauth-helper.mjs');
    console.log('   This provides free API access with your Qwen Chat account');
    console.log('');
  } else {
    console.log('🔗 API authentication failed');
    console.log('');
    console.log('   Please check:');
    console.log('   1. Your API key is valid');
    console.log('   2. Your API key has proper permissions');
    console.log('   3. Your account is active');
    console.log('');
    console.log('💡 Try Qwen Chat OAuth (Free)');
    console.log('');
    console.log('   Run: node tests/qwen-oauth-helper.mjs');
    console.log('   This provides free API access with your Qwen Chat account');
    console.log('');
  }

  console.log('📖 For detailed troubleshooting, see:');
  console.log('   docs/QWEN_AUTH_ISSUE.md');
  console.log('');
  console.log('━'.repeat(60));
  console.log('');
}

// Test 1: Basic Chat Completion
async function testBasicChat() {
  console.log('📝 Test 1: Basic Chat Completion');
  console.log('─'.repeat(50));

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'user', content: 'Hello! Please respond with just "Hi there!"' }
      ],
      temperature: 0,
      max_tokens: 100,
    });

    console.log('Request sent successfully');
    console.log('Response received:');
    console.log(`   Model: ${response.model}`);
    console.log(`   Message: ${response.choices[0].message.content}`);
    console.log(`   Finish reason: ${response.choices[0].finish_reason}`);
    console.log(`   Tokens - Input: ${response.usage.prompt_tokens}, Output: ${response.usage.completion_tokens}`);

    const hasContent = response.choices[0].message.content?.length > 0;
    reportTest('Basic Chat Completion', hasContent,
      hasContent ? 'Response received with content' : 'No content in response');

    return response;
  } catch (error) {
    console.error('Error:', error.message);
    if (isAuthenticationError(error)) {
      displayAuthHelp();
    }
    reportTest('Basic Chat Completion', false, `Error: ${error.message}`);
    return null;
  }
}

// Test 2: System Prompt
async function testSystemPrompt() {
  console.log('📝 Test 2: System Prompt');
  console.log('─'.repeat(50));

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Always respond in a friendly and concise manner.' },
        { role: 'user', content: 'What is 2+2?' }
      ],
      temperature: 0,
      max_tokens: 100,
    });

    console.log('Response:', response.choices[0].message.content);

    const hasContent = response.choices[0].message.content?.length > 0;
    reportTest('System Prompt', hasContent,
      hasContent ? 'System prompt processed successfully' : 'No response');

    return response;
  } catch (error) {
    console.error('Error:', error.message);
    if (isAuthenticationError(error)) {
      displayAuthHelp();
    }
    reportTest('System Prompt', false, `Error: ${error.message}`);
    return null;
  }
}

// Test 3: Multi-turn Conversation
async function testMultiTurn() {
  console.log('📝 Test 3: Multi-turn Conversation');
  console.log('─'.repeat(50));

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'user', content: 'My name is Alice.' },
        { role: 'assistant', content: 'Hello Alice! Nice to meet you.' },
        { role: 'user', content: 'What is my name?' }
      ],
      temperature: 0,
      max_tokens: 100,
    });

    console.log('Response:', response.choices[0].message.content);

    const remembersName = response.choices[0].message.content?.toLowerCase().includes('alice');
    reportTest('Multi-turn Conversation', remembersName,
      remembersName ? 'Model remembers context from previous turns' : 'Model did not remember context');

    return response;
  } catch (error) {
    console.error('Error:', error.message);
    if (isAuthenticationError(error)) {
      displayAuthHelp();
    }
    reportTest('Multi-turn Conversation', false, `Error: ${error.message}`);
    return null;
  }
}

// Test 4: Tool Calling (Function Calling)
async function testToolCalling() {
  console.log('📝 Test 4: Tool Calling (Function Calling)');
  console.log('─'.repeat(50));

  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'The temperature unit',
            },
          },
          required: ['location'],
        },
      },
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'user', content: 'What is the weather in Beijing?' }
      ],
      tools: tools,
      tool_choice: 'auto',
      temperature: 0,
    });

    console.log('Response type:', response.choices[0].finish_reason);

    if (response.choices[0].message.tool_calls) {
      console.log('Tool calls detected:');
      for (const toolCall of response.choices[0].message.tool_calls) {
        console.log(`   Function: ${toolCall.function.name}`);
        console.log(`   Arguments: ${toolCall.function.arguments}`);
      }

      reportTest('Tool Calling', true, 'Tool calling works correctly');
      return response;
    } else {
      console.log('Response:', response.choices[0].message.content);
      reportTest('Tool Calling', false, 'No tool calls in response');
      return response;
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (isAuthenticationError(error)) {
      displayAuthHelp();
    }
    reportTest('Tool Calling', false, `Error: ${error.message}`);
    return null;
  }
}

// Test 5: Streaming Response
async function testStreaming() {
  console.log('📝 Test 5: Streaming Response');
  console.log('─'.repeat(50));

  try {
    const stream = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'user', content: 'Count from 1 to 5, one number per line.' }
      ],
      temperature: 0,
      max_tokens: 100,
      stream: true,
    });

    console.log('Streaming response:');
    let fullResponse = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        process.stdout.write(content);
        fullResponse += content;
        chunkCount++;
      }
    }

    console.log('');
    console.log(`\nReceived ${chunkCount} chunks`);

    const hasContent = fullResponse.length > 0;
    reportTest('Streaming Response', hasContent,
      hasContent ? `Received ${chunkCount} chunks successfully` : 'No content in stream');

    return fullResponse;
  } catch (error) {
    console.error('Error:', error.message);
    if (isAuthenticationError(error)) {
      displayAuthHelp();
    }
    reportTest('Streaming Response', false, `Error: ${error.message}`);
    return null;
  }
}

// Test 6: Error Handling
async function testErrorHandling() {
  console.log('📝 Test 6: Error Handling (Invalid Request)');
  console.log('─'.repeat(50));

  try {
    // Try with invalid model
    await client.chat.completions.create({
      model: 'invalid-model-xyz',
      messages: [
        { role: 'user', content: 'Hello' }
      ],
    });

    reportTest('Error Handling', false, 'Expected error but request succeeded');
  } catch (error) {
    console.log('Expected error caught:');
    console.log(`   Status: ${error.status || 'N/A'}`);
    console.log(`   Message: ${error.message}`);

    const isExpectedError = error.status >= 400;
    reportTest('Error Handling', isExpectedError,
      isExpectedError ? 'Error handling works correctly' : 'Unexpected error type');
  }
}

// Test 7: Token Counting
async function testTokenCounting() {
  console.log('📝 Test 7: Token Counting');
  console.log('─'.repeat(50));

  try {
    const testMessage = 'This is a test message for token counting. ' +
                       'It should return usage information with prompt_tokens and completion_tokens.';

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'user', content: testMessage }
      ],
      temperature: 0,
      max_tokens: 50,
    });

    console.log('Token usage:');
    console.log(`   Prompt tokens: ${response.usage.prompt_tokens}`);
    console.log(`   Completion tokens: ${response.usage.completion_tokens}`);
    console.log(`   Total tokens: ${response.usage.total_tokens}`);

    const hasUsage = response.usage &&
                     response.usage.prompt_tokens > 0 &&
                     response.usage.completion_tokens > 0;

    reportTest('Token Counting', hasUsage,
      hasUsage ? 'Token counting works correctly' : 'No usage information returned');

    return response.usage;
  } catch (error) {
    console.error('Error:', error.message);
    if (isAuthenticationError(error)) {
      displayAuthHelp();
    }
    reportTest('Token Counting', false, `Error: ${error.message}`);
    return null;
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Qwen API Test Suite');
  console.log('='.repeat(60));
  console.log('');

  await testBasicChat();
  await testSystemPrompt();
  await testMultiTurn();
  await testToolCalling();
  await testStreaming();
  await testErrorHandling();
  await testTokenCounting();

  console.log('='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Total tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('');

  if (results.failed === 0) {
    console.log('🎉 All tests passed! Qwen API is working correctly.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the test results above');
    console.log('2. Proceed with Phase 1 of the integration plan');
    console.log('3. See docs/QWEN_INTEGRATION_PLAN.md for details');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
    console.log('');
    console.log('Common issues:');
    console.log('- Check your API key is valid');
    console.log('- Verify the base URL is correct');
    console.log('- Ensure the model name is valid');
    console.log('- Check your network connection');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
