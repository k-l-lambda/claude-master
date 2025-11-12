#!/usr/bin/env node

/**
 * Test script to display model emojis
 * Shows how different models are displayed with their icons
 */

import chalk from 'chalk';

console.log('\n' + chalk.bold.cyan('🎨 Model Emoji Icon Display Test'));
console.log(chalk.dim('─'.repeat(80)));
console.log();

// Helper function to get model emoji (duplicated from display.ts for testing)
function getModelEmoji(model) {
  // Claude models
  if (model.includes('opus')) return '🧠'; // Opus - powerful brain
  if (model.includes('haiku')) return '⚡'; // Haiku - fast lightning
  if (model.includes('sonnet')) return '🚀'; // Sonnet - balanced rocket

  // Qwen models
  const lowerModel = model.toLowerCase();
  if (lowerModel.includes('qwen') || lowerModel.includes('coder-model')) {
    return '✡️'; // Qwen - blue diamond
  }

  return '🤖'; // Default
}

// Test cases
const testModels = [
  // Claude models
  { name: 'claude-opus-4-1-20250805', shortName: 'opus', provider: 'Claude' },
  { name: 'claude-sonnet-4-5-20250929', shortName: 'sonnet', provider: 'Claude' },
  { name: 'claude-haiku-4-5-20251001', shortName: 'haiku', provider: 'Claude' },

  // Qwen models
  { name: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', shortName: 'qwen', provider: 'Qwen' },
  { name: 'qwen-max', shortName: 'qwen-max', provider: 'Qwen' },
  { name: 'qwen-plus', shortName: 'qwen-plus', provider: 'Qwen' },
  { name: 'qwen-turbo', shortName: 'qwen-turbo', provider: 'Qwen' },
  { name: 'coder-model', shortName: 'coder-model', provider: 'Qwen (OAuth)' },

  // Unknown
  { name: 'unknown-model', shortName: 'unknown', provider: 'Unknown' },
];

console.log(chalk.bold('📋 Test Results:'));
console.log();

// Group by provider
const providers = [...new Set(testModels.map(m => m.provider))];

providers.forEach(provider => {
  console.log(chalk.bold.white(`\n${provider}:`));
  const models = testModels.filter(m => m.provider === provider);

  models.forEach(({ name, shortName }) => {
    const emoji = getModelEmoji(name);
    const displayName = shortName.padEnd(20);
    console.log(`  ${emoji} ${chalk.cyan(displayName)} ${chalk.dim(name)}`);
  });
});

// Simulate Worker header display
console.log('\n' + chalk.bold('🖥️  Simulated Worker Headers:'));
console.log();

function displayWorkerHeader(model, mode) {
  const emoji = getModelEmoji(model);
  const modeEmoji = mode === 'reset' ? '🔄' : '💬';
  const separator = chalk.green('─'.repeat(80));

  console.log(separator);
  console.log(chalk.green.bold(`[WORKER] ${modeEmoji} Processing Instruction (Model: ${model}) ${emoji}`));
  console.log(separator);
}

displayWorkerHeader('sonnet', 'reset');
console.log();

displayWorkerHeader('qwen-max', 'continue');
console.log();

displayWorkerHeader('opus', 'reset');
console.log();

displayWorkerHeader('qwen', 'continue');
console.log();

// Summary
console.log(chalk.bold('\n✨ Summary:'));
console.log();
console.log('  Claude Models:');
console.log('    🧠 Opus   - Most powerful, deep reasoning');
console.log('    🚀 Sonnet - Balanced performance and quality');
console.log('    ⚡ Haiku  - Fast and efficient');
console.log();
console.log('  Qwen Models:');
console.log('    ✡️ All Qwen variants - Efficient code generation');
console.log();
console.log('  Default:');
console.log('    🤖 Unknown models - Generic AI icon');
console.log();

console.log(chalk.dim('─'.repeat(80)));
console.log(chalk.green.bold('✓') + ' Test completed successfully!');
console.log();
