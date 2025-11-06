import { ToolExecutor } from '../dist/tool-executor.js';

async function testWebSearch() {
  console.log('Testing web_search tool...\n');

  const executor = new ToolExecutor('/tmp');

  // Test 1: Search for TypeScript
  console.log('Test 1: Searching for "TypeScript programming language"');
  console.log('='.repeat(80));
  try {
    const result1 = await executor.executeTool({
      type: 'tool_use',
      id: 'test-1',
      name: 'web_search',
      input: {
        query: 'TypeScript programming language',
        max_results: 3
      }
    });

    if (result1.is_error) {
      console.error('ERROR:', result1.content);
    } else {
      console.log(result1.content);
    }
  } catch (error) {
    console.error('Exception:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\nTest 2: Searching for "Claude AI assistant"');
  console.log('='.repeat(80));

  // Test 2: Search for Claude AI
  try {
    const result2 = await executor.executeTool({
      type: 'tool_use',
      id: 'test-2',
      name: 'web_search',
      input: {
        query: 'Claude AI assistant',
        max_results: 3
      }
    });

    if (result2.is_error) {
      console.error('ERROR:', result2.content);
    } else {
      console.log(result2.content);
    }
  } catch (error) {
    console.error('Exception:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Web search tool test completed!');
}

testWebSearch().catch(console.error);
