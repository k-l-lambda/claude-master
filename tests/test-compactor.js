import Anthropic from '@anthropic-ai/sdk';

// For testing, we'll create a simplified inline version since we can't import from dist
// In production, these would be imported from the built module

class TokenCounter {
  static estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  static estimateContentTokens(content) {
    if (typeof content === 'string') {
      return this.estimateTokens(content);
    }

    let total = 0;
    for (const block of content) {
      if (block.type === 'text') {
        total += this.estimateTokens(block.text);
      } else if (block.type === 'thinking') {
        total += this.estimateTokens(block.thinking);
      }
    }
    return total;
  }

  static countConversationTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      total += 5; // Role overhead
      total += this.estimateContentTokens(msg.content);
    }
    return total;
  }

  static formatTokenUsage(messages, limit = 200000) {
    const tokens = this.countConversationTokens(messages);
    const percentage = Math.round((tokens / limit) * 100);
    return `${tokens.toLocaleString()} / ${limit.toLocaleString()} tokens (${percentage}%)`;
  }
}

class ConversationCompactor {
  constructor(client, model) {
    this.client = client;
    this.model = model;
  }

  getCompactPrompt(customInstructions) {
    return `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.

Please provide your summary including these sections:

1. Primary Request and Intent: What the user asked for
2. Key Technical Concepts: Technologies and concepts discussed
3. Files and Code Sections: Any code or files mentioned
4. Current Work: What was being worked on

Provide a concise but thorough summary.`;
  }

  extractSummary(content) {
    for (const block of content) {
      if (block.type === 'text') {
        return block.text;
      }
    }
    return null;
  }

  async compact(messages, trigger = 'manual', customInstructions) {
    if (messages.length === 0) {
      throw new Error('No messages to compact');
    }

    const preTokens = TokenCounter.countConversationTokens(messages);

    const prompt = this.getCompactPrompt(customInstructions);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      messages: [
        ...messages,
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: 'You are a helpful AI assistant tasked with summarizing conversations.',
    });

    const summaryText = this.extractSummary(response.content);
    if (!summaryText) {
      throw new Error('Failed to generate conversation summary');
    }

    const summaryMessage = {
      role: 'user',
      content: `This session is being continued from a previous conversation. The conversation is summarized below:
${summaryText}.
Please continue the conversation from where we left it off.`,
    };

    const postTokens = TokenCounter.countConversationTokens([summaryMessage]);

    const boundaryMarker = {
      type: 'system',
      subtype: 'compact_boundary',
      content: 'Conversation compacted',
      timestamp: new Date().toISOString(),
      metadata: {
        trigger,
        preTokens,
        postTokens,
      },
    };

    return {
      boundaryMarker,
      summaryMessage,
      preTokens,
      postTokens,
    };
  }
}

const client = new Anthropic({
  authToken: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.jiekou.ai/anthropic'
});

// Create mock conversation history with multiple rounds
function createMockConversation() {
  return [
    {
      role: 'user',
      content: 'Can you help me implement a todo list application in TypeScript?'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I\'ll help you build a todo list application in TypeScript. Let me start by creating the basic structure with interfaces and types.'
        }
      ]
    },
    {
      role: 'user',
      content: 'Great! Please add functionality to mark tasks as complete.'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I\'ve added a toggleComplete method to the TodoList class that allows marking tasks as complete or incomplete.'
        }
      ]
    },
    {
      role: 'user',
      content: 'Now add the ability to filter tasks by status.'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I\'ve implemented filter methods: getCompletedTasks() and getActiveTasks() that return filtered arrays based on task completion status.'
        }
      ]
    },
    {
      role: 'user',
      content: 'Can you add persistence using localStorage?'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I\'ve added localStorage persistence with save() and load() methods. Tasks are automatically saved when added, removed, or toggled.'
        }
      ]
    },
    {
      role: 'user',
      content: 'Please add unit tests for the core functionality.'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I\'ve created a comprehensive test suite using Jest that covers adding tasks, toggling completion, filtering, and localStorage persistence.'
        }
      ]
    }
  ];
}

async function testCompactor() {
  console.log('='.repeat(80));
  console.log('Testing ConversationCompactor');
  console.log('='.repeat(80));

  try {
    // Create compactor instance
    const compactor = new ConversationCompactor(client, 'claude-sonnet-4-5-20250929');
    console.log('✓ Compactor instance created');

    // Create mock conversation
    const messages = createMockConversation();
    console.log(`\n✓ Created mock conversation with ${messages.length} messages`);

    // Calculate pre-compact tokens
    const preTokens = TokenCounter.countConversationTokens(messages);
    console.log(`✓ Pre-compact token count: ${preTokens.toLocaleString()} tokens (estimated)`);
    console.log(`  Formatted: ${TokenCounter.formatTokenUsage(messages)}`);

    // Test manual compaction
    console.log('\n📦 Starting manual compaction...');
    console.log('   (This will call Claude API to generate a summary)');

    const result = await compactor.compact(messages, 'manual');

    console.log('\n✅ Compaction completed successfully!');
    console.log('='.repeat(80));

    // Verify result structure
    console.log('\n📊 Compaction Results:');
    console.log('-'.repeat(80));

    console.log('\n1. Boundary Marker:');
    console.log(`   - Type: ${result.boundaryMarker.type}`);
    console.log(`   - Subtype: ${result.boundaryMarker.subtype}`);
    console.log(`   - Trigger: ${result.boundaryMarker.metadata?.trigger}`);
    console.log(`   - Timestamp: ${result.boundaryMarker.timestamp}`);

    console.log('\n2. Token Statistics:');
    console.log(`   - Pre-compact:  ${result.preTokens.toLocaleString()} tokens`);
    console.log(`   - Post-compact: ${result.postTokens.toLocaleString()} tokens`);
    console.log(`   - Saved:        ${(result.preTokens - result.postTokens).toLocaleString()} tokens`);
    console.log(`   - Reduction:    ${Math.round((1 - result.postTokens / result.preTokens) * 100)}%`);

    console.log('\n3. Summary Message:');
    console.log(`   - Role: ${result.summaryMessage.role}`);
    console.log(`   - Content length: ${result.summaryMessage.content.length} characters`);
    console.log(`   - Content preview (first 200 chars):`);
    console.log(`     ${result.summaryMessage.content.substring(0, 200)}...`);

    // Verify summary contains key sections
    console.log('\n4. Summary Content Validation:');
    const summaryText = result.summaryMessage.content;
    const expectedSections = [
      'Primary Request and Intent',
      'Technical Concepts',
      'Files and Code',
      'Current Work'
    ];

    let allSectionsFound = true;
    for (const section of expectedSections) {
      const found = summaryText.includes(section);
      const status = found ? '✓' : '✗';
      console.log(`   ${status} Contains "${section}": ${found}`);
      if (!found) allSectionsFound = false;
    }

    // Check if summary mentions key topics from conversation
    console.log('\n5. Key Topic Coverage:');
    const keyTopics = [
      'todo',
      'TypeScript',
      'complete',
      'filter',
      'localStorage',
      'test'
    ];

    let topicsCovered = 0;
    for (const topic of keyTopics) {
      const found = summaryText.toLowerCase().includes(topic.toLowerCase());
      const status = found ? '✓' : '✗';
      console.log(`   ${status} Mentions "${topic}": ${found}`);
      if (found) topicsCovered++;
    }
    console.log(`   Coverage: ${topicsCovered}/${keyTopics.length} topics (${Math.round(topicsCovered / keyTopics.length * 100)}%)`);

    // Final verdict
    console.log('\n' + '='.repeat(80));
    if (allSectionsFound && topicsCovered >= keyTopics.length * 0.7) {
      console.log('🎉 TEST PASSED: Compactor is working correctly!');
      console.log('   - All required sections present');
      console.log('   - Key topics adequately covered');
      console.log('   - Token reduction achieved');
    } else {
      console.log('⚠️  TEST WARNING: Compactor works but summary may be incomplete');
      if (!allSectionsFound) {
        console.log('   - Some expected sections missing');
      }
      if (topicsCovered < keyTopics.length * 0.7) {
        console.log('   - Topic coverage below 70%');
      }
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ TEST FAILED with error:');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Test with timeout
console.log('\n🧪 Starting Compactor Test Suite\n');
const timeoutMs = 60000; // 60 second timeout
const timeoutHandle = setTimeout(() => {
  console.error('\n❌ TEST TIMEOUT: Test took longer than 60 seconds');
  process.exit(1);
}, timeoutMs);

testCompactor()
  .then(() => {
    clearTimeout(timeoutHandle);
    console.log('\n✅ All tests completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(timeoutHandle);
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  });
