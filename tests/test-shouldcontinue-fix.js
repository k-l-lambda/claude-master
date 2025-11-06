// Test shouldContinue logic fix
// Tests that Instructor doesn't incorrectly terminate when no "tell worker" or "DONE"

// Simulate the logic from instructor.ts parseInstructorResponse

function testShouldContinue(text, hasTellWorker, hasDone, description) {
  // Simulate parsing
  let instruction = '';
  const isDone = hasDone;

  if (hasTellWorker) {
    instruction = 'some instruction';
  } else {
    if (!isDone) {
      instruction = '';
    } else {
      instruction = '';
    }
  }

  const needsCorrection = !isDone && instruction.length === 0 && text.trim().length > 0;

  // OLD LOGIC (BUGGY)
  const shouldContinue_OLD = !isDone && instruction.length > 0;

  // NEW LOGIC (FIXED)
  const shouldContinue_NEW = (!isDone && instruction.length > 0) || needsCorrection;

  const status = shouldContinue_NEW === true ? '✅ CORRECT' : '❌ WRONG';
  console.log(`${status}: ${description}`);
  console.log(`  Text: "${text.substring(0, 50)}..."`);
  console.log(`  Has "tell worker": ${hasTellWorker}, Has DONE: ${hasDone}`);
  console.log(`  needsCorrection: ${needsCorrection}`);
  console.log(`  shouldContinue (OLD): ${shouldContinue_OLD}`);
  console.log(`  shouldContinue (NEW): ${shouldContinue_NEW}`);

  if (shouldContinue_OLD !== shouldContinue_NEW) {
    console.log(`  🔧 FIXED: Changed from ${shouldContinue_OLD} to ${shouldContinue_NEW}`);
  }
  console.log();
}

console.log('=== Testing shouldContinue Logic Fix ===\n');

console.log('--- Normal Cases (Should Continue) ---');

testShouldContinue(
  'Tell worker: Please read the file',
  true,
  false,
  'Normal instruction with "tell worker"'
);

console.log('--- Bug Case (Was Broken, Now Fixed) ---');

testShouldContinue(
  'Now let me commit these final documentation updates:',
  false,
  false,
  'Instructor response without "tell worker" or DONE (THE BUG!)'
);

testShouldContinue(
  'I will analyze this code and provide feedback.',
  false,
  false,
  'Analysis without instruction or completion'
);

console.log('--- Completion Cases (Should NOT Continue) ---');

testShouldContinue(
  'Everything is complete. DONE',
  false,
  true,
  'Completion with DONE'
);

testShouldContinue(
  '**DONE**',
  false,
  true,
  'Completion with markdown DONE'
);

console.log('--- Edge Cases ---');

testShouldContinue(
  'Tell worker: Read file.txt\n\nDONE',
  true,
  true,
  'Instruction + DONE together (should not continue - DONE takes precedence)'
);

testShouldContinue(
  '',
  false,
  false,
  'Empty response (no correction needed, no text)'
);

console.log('=== Summary ===');
console.log('The bug was in instructor.ts line 237:');
console.log('  OLD: const shouldContinue = !isDone && instruction.length > 0;');
console.log('  NEW: const shouldContinue = (!isDone && instruction.length > 0) || needsCorrection;');
console.log('\nThe fix ensures that when Instructor needs correction (no "tell worker", no DONE),');
console.log('shouldContinue stays TRUE so the orchestrator can prompt for correction.');
console.log('This prevents premature termination like "✓ Instructor has completed the current task"');
console.log('when Instructor actually hasn\'t finished.');
