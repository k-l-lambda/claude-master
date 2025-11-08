import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

// Token counter logic (same as token-counter.ts)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function estimateContentTokens(content) {
  if (typeof content === 'string') {
    return estimateTokens(content);
  }

  let total = 0;
  for (const block of content) {
    if (block.type === 'text') {
      total += estimateTokens(block.text);
    } else if (block.type === 'thinking') {
      total += estimateTokens(block.thinking);
    } else if (block.type === 'tool_use') {
      total += estimateTokens(JSON.stringify(block.input || {}));
    } else if (block.type === 'tool_result') {
      if (typeof block.content === 'string') {
        total += estimateTokens(block.content);
      } else if (Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item.type === 'text') {
            total += estimateTokens(item.text);
          }
        }
      }
    }
  }
  return total;
}

function countConversationTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += 5; // Role overhead
    total += estimateContentTokens(msg.content);
  }
  return total;
}

// Compact prompt (same as compactor.ts)
function getCompactPrompt() {
  return `Please provide a comprehensive summary of the above conversation to preserve context for continuation.

Your summary must include ALL of the following sections:

## 1. Primary Request and Intent
- What is the user fundamentally trying to accomplish?
- What is the broader context or motivation?

## 2. Key Technical Concepts
- What technologies, frameworks, or architectural patterns are central?
- What domain-specific knowledge is essential?

## 3. Files and Code Sections
- Which files have been created, modified, or are central to the work?
- For each important file: Why is it important? What changes were made?
- Include specific code snippets ONLY for the most critical sections

## 4. Errors and fixes
- What errors occurred during the conversation?
- How were they resolved?
- What was learned?

## 5. Problem Solving
- What challenges were encountered?
- What solutions or workarounds were developed?
- What alternatives were considered and why were they rejected?

## 6. All user messages
- List every distinct request, question, or piece of feedback the user provided
- Capture user corrections or changes in direction

## 7. Pending Tasks
- What work remains incomplete?
- What follow-up actions are needed?

## 8. Current Work
- What was the most recent specific action taken?
- What files were just modified and how?
- Include relevant code snippets showing the latest changes

## 9. Optional Next Step
- Based on the conversation flow, what would be the logical next action?
- This should be a specific, actionable suggestion

Format your response as a clear, well-organized summary. Use markdown formatting.
Be thorough but concise. Focus on information needed to continue the work effectively.`;
}

// Main script
async function main() {
  const sessionPath = process.argv[2];
  const outputPath = process.argv[3] || './tests/session1-compacted.jsonl';

  console.log('📖 Reading session file:', sessionPath);
  const content = fs.readFileSync(sessionPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const instructorMessages = [];
  let metadata = null;

  for (const line of lines) {
    const entry = JSON.parse(line);
    if (entry.type === 'instructor-message') {
      instructorMessages.push(entry.message);
    } else if (entry.type === 'session-metadata') {
      metadata = entry;
    }
  }

  const preTokens = countConversationTokens(instructorMessages);
  console.log(`📊 Original: ${instructorMessages.length} messages, ${preTokens.toLocaleString()} tokens`);
  console.log('');

  // Check API key
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_AUTH_TOKEN environment variable not set');
    process.exit(1);
  }

  // Call Claude API for compaction
  console.log('🤖 Calling Claude API for compaction...');
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [
      ...instructorMessages,
      {
        role: 'user',
        content: getCompactPrompt(),
      },
    ],
    system: 'You are a helpful AI assistant tasked with summarizing conversations.',
  });

  // Extract summary text
  let summaryText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      summaryText += block.text;
    }
  }

  console.log('✅ Summary generated');
  console.log('');

  // Create compacted message
  const summaryMessage = {
    role: 'user',
    content: `This session is being continued from a previous conversation that ran out of context. The conversation is summarized below:
${summaryText}.
Please continue the conversation from where we left it off without asking the user any further questions. Continue with the last task that you were asked to work on.`,
  };

  const postTokens = countConversationTokens([summaryMessage]);
  const savedTokens = preTokens - postTokens;
  const savedPercentage = Math.round((savedTokens / preTokens) * 100);

  console.log('📊 Compaction Results:');
  console.log(`  Before: ${preTokens.toLocaleString()} tokens (${instructorMessages.length} messages)`);
  console.log(`  After:  ${postTokens.toLocaleString()} tokens (1 message)`);
  console.log(`  Saved:  ${savedTokens.toLocaleString()} tokens (${savedPercentage}%)`);
  console.log('');

  // Create boundary marker
  const boundaryMessage = {
    type: 'system',
    subtype: 'compact_boundary',
    content: `--- Conversation compacted here ---
Trigger: manual
Original: ${instructorMessages.length} messages, ${preTokens.toLocaleString()} tokens
Compacted: 1 message, ${postTokens.toLocaleString()} tokens
Saved: ${savedTokens.toLocaleString()} tokens (${savedPercentage}%)
Timestamp: ${new Date().toISOString()}`,
    timestamp: new Date().toISOString(),
    metadata: {
      trigger: 'manual',
      preTokens,
      postTokens,
    },
  };

  // Save compacted session
  console.log('💾 Saving compacted session to:', outputPath);

  const outputLines = [];

  // Write compacted instructor message
  outputLines.push(JSON.stringify({
    type: 'instructor-message',
    message: summaryMessage,
    timestamp: new Date().toISOString(),
  }));

  // Write boundary marker
  outputLines.push(JSON.stringify({
    type: 'system-message',
    message: boundaryMessage,
    timestamp: new Date().toISOString(),
  }));

  // Write updated metadata
  if (metadata) {
    metadata.lastUpdatedAt = new Date().toISOString();
    metadata.compacted = true;
    metadata.compactedAt = new Date().toISOString();
    metadata.originalMessageCount = instructorMessages.length;
    metadata.originalTokens = preTokens;
    metadata.compactedTokens = postTokens;
    outputLines.push(JSON.stringify({
      type: 'session-metadata',
      ...metadata,
    }));
  }

  fs.writeFileSync(outputPath, outputLines.join('\n') + '\n', 'utf-8');

  console.log('✅ Compacted session saved successfully!');
  console.log('');
  console.log('📄 Summary Preview (first 500 chars):');
  console.log(summaryText.substring(0, 500) + '...');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
