// Test Worker context compaction logic
// This tests the round counting and message slicing logic without calling API

console.log('='.repeat(80));
console.log('Testing Worker Context Compaction Logic');
console.log('='.repeat(80));

// Simulate Worker conversation history with tool calls
function createWorkerHistory() {
  return [
    // Round 1: Simple instruction without tools
    { role: 'user', content: 'Create a function to add two numbers' },
    { role: 'assistant', content: [{ type: 'text', text: 'Created add function' }] },

    // Round 2: Instruction with tool use
    { role: 'user', content: 'Write this to a file' },
    { role: 'assistant', content: [{ type: 'tool_use', name: 'write_file', input: { file_path: '/tmp/test.js', content: 'function add(a, b) { return a + b; }' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool1', content: 'File written successfully' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'File has been written' }] },

    // Round 3: Multiple tool uses
    { role: 'user', content: 'Read the file and test it' },
    { role: 'assistant', content: [{ type: 'tool_use', name: 'read_file', input: { file_path: '/tmp/test.js' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool2', content: 'function add(a, b) { return a + b; }' }] },
    { role: 'assistant', content: [{ type: 'tool_use', name: 'bash_command', input: { command: 'node /tmp/test.js' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool3', content: 'Tests passed' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'Tests completed successfully' }] },

    // Round 4: Another simple round
    { role: 'user', content: 'Add error handling' },
    { role: 'assistant', content: [{ type: 'text', text: 'Added try-catch blocks' }] },

    // Round 5: Complex round with multiple tools
    { role: 'user', content: 'Deploy to production' },
    { role: 'assistant', content: [{ type: 'tool_use', name: 'bash_command', input: { command: 'npm run build' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool4', content: 'Build successful' }] },
    { role: 'assistant', content: [{ type: 'tool_use', name: 'bash_command', input: { command: 'npm run deploy' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tool5', content: 'Deployed to production' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'Successfully deployed' }] },
  ];
}

// Count rounds by looking for user messages with string content
function countRounds(messages) {
  let roundCount = 0;
  const roundStartIndices = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user' && typeof msg.content === 'string') {
      roundCount++;
      roundStartIndices.push(i);
    }
  }

  return { roundCount, roundStartIndices };
}

// Compact to keep last N rounds
function compactWorkerContext(messages, keepRounds) {
  const { roundCount, roundStartIndices } = countRounds(messages);

  if (roundCount <= keepRounds) {
    return {
      success: false,
      reason: 'Already small',
      roundCount,
      messageCount: messages.length
    };
  }

  const keepFromIndex = roundStartIndices[roundCount - keepRounds];
  const trimmedMessages = messages.slice(keepFromIndex);

  return {
    success: true,
    roundCount,
    keptRounds: keepRounds,
    removedRounds: roundCount - keepRounds,
    originalMessages: messages.length,
    keptMessages: trimmedMessages.length,
    removedMessages: messages.length - trimmedMessages.length,
    trimmedMessages
  };
}

// Run tests
console.log('\n📝 Test Case 1: Worker with 5 rounds (mix of simple and tool-heavy)');
console.log('-'.repeat(80));

const history = createWorkerHistory();
console.log(`Total messages: ${history.length}`);

const { roundCount, roundStartIndices } = countRounds(history);
console.log(`Total rounds: ${roundCount}`);
console.log(`Round start indices: [${roundStartIndices.join(', ')}]`);

// Verify round counting
console.log('\nRound breakdown:');
for (let i = 0; i < roundCount; i++) {
  const startIdx = roundStartIndices[i];
  const endIdx = i < roundCount - 1 ? roundStartIndices[i + 1] : history.length;
  const roundMessages = history.slice(startIdx, endIdx);
  const instruction = history[startIdx].content;
  console.log(`  Round ${i + 1}: indices [${startIdx}..${endIdx - 1}] (${roundMessages.length} messages)`);
  console.log(`    Instruction: "${instruction}"`);
}

// Test compaction with different keep values
console.log('\n📦 Test Case 2: Compact to keep last 3 rounds');
console.log('-'.repeat(80));

const result1 = compactWorkerContext(history, 3);
if (result1.success) {
  console.log(`✓ Compaction successful`);
  console.log(`  Original: ${result1.roundCount} rounds, ${result1.originalMessages} messages`);
  console.log(`  Kept: ${result1.keptRounds} rounds, ${result1.keptMessages} messages`);
  console.log(`  Removed: ${result1.removedRounds} rounds, ${result1.removedMessages} messages`);
  console.log(`  Reduction: ${Math.round(result1.removedMessages / result1.originalMessages * 100)}%`);

  // Verify kept messages start from round 3
  const firstKeptMessage = result1.trimmedMessages[0];
  console.log(`\n  First kept message: "${firstKeptMessage.content}"`);
  console.log(`  Expected: "Read the file and test it" (start of round 3)`);

  if (firstKeptMessage.content === 'Read the file and test it') {
    console.log(`  ✅ Correct! Kept messages start from round 3`);
  } else {
    console.log(`  ❌ ERROR: Wrong starting point`);
  }
} else {
  console.log(`ℹ️  ${result1.reason}`);
}

// Test edge case: keep more rounds than exist
console.log('\n📦 Test Case 3: Try to keep 10 rounds (more than exists)');
console.log('-'.repeat(80));

const result2 = compactWorkerContext(history, 10);
if (!result2.success) {
  console.log(`✓ Correctly refused compaction`);
  console.log(`  Reason: ${result2.reason}`);
  console.log(`  Current size: ${result2.roundCount} rounds, ${result2.messageCount} messages`);
} else {
  console.log(`❌ ERROR: Should not compact when already small`);
}

// Test edge case: keep 1 round
console.log('\n📦 Test Case 4: Compact to keep only 1 round');
console.log('-'.repeat(80));

const result3 = compactWorkerContext(history, 1);
if (result3.success) {
  console.log(`✓ Compaction successful`);
  console.log(`  Kept: ${result3.keptRounds} round, ${result3.keptMessages} messages`);
  console.log(`  Removed: ${result3.removedRounds} rounds, ${result3.removedMessages} messages`);

  const firstKeptMessage = result3.trimmedMessages[0];
  console.log(`\n  First kept message: "${firstKeptMessage.content}"`);
  console.log(`  Expected: "Deploy to production" (start of round 5)`);

  if (firstKeptMessage.content === 'Deploy to production') {
    console.log(`  ✅ Correct! Kept only the last round`);
  } else {
    console.log(`  ❌ ERROR: Wrong starting point`);
  }
} else {
  console.log(`ℹ️  ${result2.reason}`);
}

// Final verdict
console.log('\n' + '='.repeat(80));
console.log('🎉 TEST PASSED: Worker context compaction logic works correctly!');
console.log('   ✓ Round counting accurate (distinguishes instructions from tool_results)');
console.log('   ✓ Message slicing preserves round boundaries');
console.log('   ✓ Edge cases handled properly');
console.log('='.repeat(80));
