// Test Instructor Status Display
import chalk from 'chalk';

console.log('=== Instructor Status Display Test ===\n');

function instructorStatus(workerModel, shouldContinue, needsCorrection) {
  // Model emoji
  let modelEmoji = '🚀'; // default sonnet
  if (workerModel.includes('opus')) {
    modelEmoji = '🧠'; // Opus - powerful brain
  } else if (workerModel.includes('haiku')) {
    modelEmoji = '⚡'; // Haiku - fast lightning
  } else if (workerModel.includes('sonnet')) {
    modelEmoji = '🚀'; // Sonnet - balanced rocket
  }

  // Continue emoji
  const continueEmoji = shouldContinue ? '▶️ ' : '⏹️ ';

  // Correction emoji
  const correctionEmoji = needsCorrection ? '⚠️ ' : '✅';

  // Model short name
  let modelName = 'Sonnet';
  if (workerModel.includes('opus')) modelName = 'Opus';
  else if (workerModel.includes('haiku')) modelName = 'Haiku';
  else if (workerModel.includes('sonnet')) modelName = 'Sonnet';

  console.log(chalk.dim(`[Status] ${modelEmoji} ${modelName} | ${continueEmoji} ${shouldContinue ? 'Continue' : 'Stop'} | ${correctionEmoji} ${needsCorrection ? 'Needs correction' : 'OK'}`));
}

console.log('--- Scenario 1: Normal instruction with Sonnet ---');
console.log('Instructor: "Tell worker: Read the file src/index.ts"');
instructorStatus('claude-sonnet-4-5-20250929', true, false);
console.log();

console.log('--- Scenario 2: Using Opus model ---');
console.log('Instructor: "Tell worker (use opus): Analyze complex system"');
instructorStatus('claude-opus-4-1-20250805', true, false);
console.log();

console.log('--- Scenario 3: Using Haiku model ---');
console.log('Instructor: "Tell worker (use haiku): List files"');
instructorStatus('claude-3-5-haiku-20241022', true, false);
console.log();

console.log('--- Scenario 4: Task completed ---');
console.log('Instructor: "DONE"');
instructorStatus('claude-sonnet-4-5-20250929', false, false);
console.log();

console.log('--- Scenario 5: Needs correction ---');
console.log('Instructor: "Now let me commit these changes..."');
instructorStatus('claude-sonnet-4-5-20250929', false, true);
console.log();

console.log('--- Scenario 6: After correction, continues ---');
console.log('Instructor: "Tell worker: Run the tests"');
instructorStatus('claude-sonnet-4-5-20250929', true, false);
console.log();

console.log('=== Emoji Legend ===\n');
console.log('Model:');
console.log('  🧠 Opus   - Most powerful, best for complex tasks');
console.log('  🚀 Sonnet - Balanced, default model');
console.log('  ⚡ Haiku  - Fastest, best for simple tasks');
console.log();
console.log('Continue:');
console.log('  ▶️  Continue - Will continue to Worker conversation');
console.log('  ⏹️  Stop     - Will stop (DONE or needs correction)');
console.log();
console.log('Format:');
console.log('  ✅ OK              - Proper format ("tell worker:" or "DONE")');
console.log('  ⚠️  Needs correction - Missing "tell worker:" or "DONE"');
console.log();

console.log('=== How to Use ===\n');
console.log('This status line appears after each Instructor response:');
console.log('  - Helps you see which model Worker will use');
console.log('  - Shows if conversation will continue or stop');
console.log('  - Indicates if Instructor needs format correction');
console.log('  - Useful for debugging conversation flow');
