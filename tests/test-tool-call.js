import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  authToken: process.env.ANTHROPIC_AUTH_TOKEN,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.jiekou.ai/anthropic'
});

const tools = [
  {
    name: 'read_file',
    description: 'Read contents of a file from the filesystem',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
      },
      required: ['file_path'],
    },
  },
];

async function test() {
  console.log('Testing tool call with proxy...');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: 'Please read the file README.md using the read_file tool.'
      }],
      tools: tools
    });

    console.log('\nResponse:');
    console.log(JSON.stringify(response, null, 2));

    console.log('\nContent blocks:');
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`\nTool: ${block.name}`);
        console.log(`Input:`, JSON.stringify(block.input, null, 2));
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
