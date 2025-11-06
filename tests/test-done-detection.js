// Test DONE detection regex from parseInstructorResponse
// This tests the regex used in src/instructor.ts line 184

// The regex pattern from instructor.ts
const DONE_REGEX = /\*\*DONE\*\*|__DONE__|_DONE_|(?:^|\n)\s*DONE[\s.!]*$/;

function testDoneDetection(text, shouldMatch, description) {
  const lastLine = text.trim().split('\n').slice(-3).join('\n');
  const isDone = DONE_REGEX.test(lastLine);

  const status = isDone === shouldMatch ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${description}`);
  if (isDone !== shouldMatch) {
    console.log(`  Expected: ${shouldMatch}, Got: ${isDone}`);
    console.log(`  Last 3 lines: "${lastLine}"`);
  }
}

console.log('=== Testing DONE Detection Regex ===\n');

console.log('--- Should MATCH (Valid DONE signals) ---');

// Markdown formatted DONE
testDoneDetection('**DONE**', true, 'Markdown bold: **DONE**');
testDoneDetection('__DONE__', true, 'Markdown bold alt: __DONE__');
testDoneDetection('_DONE_', true, 'Markdown italic: _DONE_');

// Standalone DONE at end (must be uppercase)
testDoneDetection('DONE', true, 'Plain DONE');
testDoneDetection('Done', false, 'Mixed case: Done (should not match)');
testDoneDetection('done', false, 'Lowercase: done (should not match)');
testDoneDetection('DONE.', true, 'DONE with period');
testDoneDetection('DONE!', true, 'DONE with exclamation');
testDoneDetection('  DONE  ', true, 'DONE with whitespace');
testDoneDetection('Some text\nDONE', true, 'DONE on last line after text');
testDoneDetection('Line 1\nLine 2\nDONE', true, 'DONE after multiple lines');
testDoneDetection('Tell worker: do something\n\nDONE', true, 'DONE after instruction');

// Multiline scenarios
testDoneDetection('I will do this task.\n\nDONE', true, 'DONE after blank line');
testDoneDetection('First line\nSecond line\nThird line\nDONE.', true, 'DONE at end with period');

console.log('\n--- Should NOT MATCH (DONE in conversation) ---');

// DONE in middle of sentence
testDoneDetection('This is not DONE yet', false, 'DONE in middle of sentence');
testDoneDetection('We need to get this DONE', false, 'DONE at end of sentence (not standalone)');
testDoneDetection('When this is DONE, we can continue', false, 'DONE in middle with comma');
testDoneDetection('Is it DONE? No, not yet.', false, 'DONE with question mark (in sentence)');

// DONE at beginning (should not match - only end matters)
testDoneDetection('DONE is what we need to achieve', false, 'DONE at start of sentence');
testDoneDetection('DONE\nBut we need more work', false, 'DONE followed by more text');

// DONE in casual conversation
testDoneDetection('I am done thinking about this', false, 'Lowercase "done" in sentence');
testDoneDetection('The task is almost done', false, 'Lowercase "done" at end of sentence');
testDoneDetection('Let me know when you are DONE with that', false, 'DONE in question');

// Edge cases
testDoneDetection('DONE_WITH_UNDERSCORES', false, 'DONE as part of identifier');
testDoneDetection('TODO: DONE items', false, 'DONE in TODO list');
testDoneDetection('Status: DONE (pending review)', false, 'DONE with text after');

console.log('\n--- Edge Cases ---');

// Multiple lines before DONE (testing last 3 lines limit)
testDoneDetection('Line 1\nLine 2\nLine 3\nLine 4\nDONE', true, 'DONE after 4 lines (within last 3)');

// Empty lines
testDoneDetection('\n\n\nDONE', true, 'DONE after empty lines');

// Whitespace variations
testDoneDetection('\t\tDONE\t\t', true, 'DONE with tabs');
testDoneDetection('Text here\n    DONE    ', true, 'DONE with indent');

console.log('\n--- Real-world Scenarios ---');

// Typical Instructor responses
testDoneDetection(
  'I will analyze the code and provide feedback.\n\nTell worker: Please read the file src/index.ts\n\n',
  false,
  'Instruction without DONE'
);

testDoneDetection(
  'The analysis is complete.\n\n**DONE**',
  true,
  'Completion with markdown DONE'
);

testDoneDetection(
  'Tell worker: Fix the bug in line 42\n\nAfter that we can mark this as DONE for now.',
  false,
  'Instruction mentioning "DONE" casually'
);

testDoneDetection(
  'I have reviewed the changes and everything looks good.\n\nDONE',
  true,
  'Review completion with plain DONE'
);

testDoneDetection(
  'Let me check if this is done...\nTell worker: Run the tests',
  false,
  'Casual "done" followed by instruction'
);

testDoneDetection(
  'All tasks completed successfully.\n\nDone!',
  false,
  'Natural completion statement with "Done!" (should not match - must be uppercase)'
);

console.log('\n=== Test Summary ===');
console.log('✅ All PASS: Regex correctly identifies DONE signals');
console.log('❌ Any FAIL: Regex needs adjustment');
