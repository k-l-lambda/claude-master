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

  // CORRECT LOGIC (needsCorrection and shouldContinue are separate concerns)
  const shouldContinue = !isDone && instruction.length > 0;

  const expectedContinue = hasTellWorker && !hasDone;
  const expectedCorrection = !hasTellWorker && !hasDone && text.trim().length > 0;

  const continueCorrect = shouldContinue === expectedContinue ? '✅' : '❌';
  const correctionCorrect = needsCorrection === expectedCorrection ? '✅' : '❌';

  console.log(`${continueCorrect}${correctionCorrect} ${description}`);
  console.log(`  Has "tell worker": ${hasTellWorker}, Has DONE: ${hasDone}`);
  console.log(`  needsCorrection: ${needsCorrection} (expected: ${expectedCorrection})`);
  console.log(`  shouldContinue: ${shouldContinue} (expected: ${expectedContinue})`);

  if (needsCorrection && shouldContinue) {
    console.log(`  ⚠️  WARNING: Both needsCorrection and shouldContinue are true - semantic conflict!`);
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
console.log('Corrected logic in instructor.ts:');
console.log('  const shouldContinue = !isDone && instruction.length > 0;');
console.log('');
console.log('Key insight:');
console.log('  - needsCorrection and shouldContinue are SEPARATE concerns');
console.log('  - needsCorrection = true means "need to prompt for correction"');
console.log('  - shouldContinue = false means "don\'t continue to Worker, handle correction first"');
console.log('  - Orchestrator checks needsCorrection BEFORE shouldContinue');
console.log('  - After correction, orchestrator gets NEW shouldContinue value');
console.log('');
console.log('Why they should NOT both be true:');
console.log('  - Semantic conflict: can\'t "continue" AND "need correction" at same time');
console.log('  - Clear separation: correction flow vs. normal flow');
console.log('  - Orchestrator handles each independently');

