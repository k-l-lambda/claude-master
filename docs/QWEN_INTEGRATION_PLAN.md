# Qwen Integration Implementation Plan

## Overview

**Approach:** Parallel Implementation (并行实现)
**Goal:** Add Qwen API support alongside existing Claude API
**Strategy:** Unified AIClient interface with provider-specific implementations

---

## Phase 0: API Validation (Current Phase)

**Duration:** 1-2 days
**Status:** 🔄 In Progress

### Objectives
- Validate Qwen API accessibility
- Test basic chat completion
- Verify tool calling support
- Test streaming capabilities
- Validate token counting

### Tasks

#### Task 0.1: Environment Setup ✅
- [x] Create environment variable configuration
- [ ] Set up `.env.local` for Qwen credentials
- [ ] Document required variables

**Environment Variables:**
```bash
QWEN_API_KEY=sk-xxx
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-max
```

#### Task 0.2: Basic API Test
- [ ] Create test script `tests/qwen-api-test.ts`
- [ ] Test basic chat completion
- [ ] Test with system prompt
- [ ] Test multi-turn conversation
- [ ] Verify response format

#### Task 0.3: Tool Calling Test
- [ ] Test function calling definition
- [ ] Test tool use execution
- [ ] Test tool result handling
- [ ] Verify tool calling format compatibility

#### Task 0.4: Streaming Test
- [ ] Test streaming response
- [ ] Verify chunk format
- [ ] Test abort signal
- [ ] Measure latency

#### Task 0.5: Error Handling Test
- [ ] Test invalid API key
- [ ] Test rate limiting
- [ ] Test timeout
- [ ] Test malformed requests

### Success Criteria
- ✅ Can successfully call Qwen API
- ✅ Responses match expected format
- ✅ Tool calling works correctly
- ✅ Streaming is functional
- ✅ Error handling is robust

---

## Phase 1: Interface Design

**Duration:** 2-3 days
**Status:** ⏳ Pending

### Objectives
- Define unified `AIClient` interface
- Define unified message types
- Define tool conversion interfaces
- Design configuration structure

### Tasks

#### Task 1.1: Core Interface Definition
Create `src/ai-client/types.ts`:

```typescript
export interface AIClient {
  sendMessage(params: SendMessageParams): Promise<AIMessage>
  streamMessage(params: StreamMessageParams): Promise<AIMessage>
  getProviderInfo(): ProviderInfo
}

export interface SendMessageParams {
  messages: Message[];
  model: string;
  systemPrompt: string;
  tools?: Tool[];
  options?: MessageOptions;
}

export interface StreamMessageParams extends SendMessageParams {
  onChunk?: (chunk: string, type: ChunkType) => void;
  abortSignal?: AbortSignal;
  context?: 'instructor' | 'worker';
}

export interface MessageOptions {
  useThinking?: boolean;
  thinkingBudget?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface AIMessage {
  id: string;
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stopReason: string | null;
  usage: TokenUsage;
  metadata?: Record<string, any>;
}

export interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  thinking?: string;
  toolUse?: ToolUse;
  toolResult?: ToolResult;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ProviderInfo {
  name: string;
  version: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderCapabilities {
  supportsThinking: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxTokens: number;
  contextWindow: number;
}

export type ChunkType = 'thinking' | 'text' | 'tool_use';
```

#### Task 1.2: Tool Conversion Interface
Create `src/ai-client/tool-converter.ts`:

```typescript
export interface ToolConverter {
  toProviderFormat(tools: Tool[]): any[];
  fromProviderFormat(tools: any[]): Tool[];
}

export interface MessageConverter {
  toProviderFormat(messages: Message[]): any[];
  fromProviderFormat(messages: any[]): Message[];
}
```

#### Task 1.3: Configuration Structure
Update `src/types.ts`:

```typescript
export interface Config {
  // Existing fields...

  // New fields
  provider?: 'claude' | 'qwen';
  qwenApiKey?: string;
  qwenBaseUrl?: string;
  qwenModel?: string;

  // Provider-specific configs
  claudeConfig?: ClaudeConfig;
  qwenConfig?: QwenConfig;
}

export interface ClaudeConfig {
  authToken: string;
  apiKey?: string;
  baseURL?: string;
  defaultModel: string;
}

export interface QwenConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeout?: number;
}
```

### Deliverables
- [ ] `src/ai-client/types.ts` - Core interfaces
- [ ] `src/ai-client/tool-converter.ts` - Conversion interfaces
- [ ] Updated `src/types.ts` - Configuration
- [ ] Documentation for interface design

---

## Phase 2: ClaudeClient Adaptation

**Duration:** 1-2 days
**Status:** ⏳ Pending

### Objectives
- Adapt ClaudeClient to implement AIClient interface
- Create Claude-to-unified converters
- Maintain backward compatibility
- Add provider info

### Tasks

#### Task 2.1: Implement AIClient Interface
Update `src/client.ts`:

```typescript
import { AIClient, AIMessage, SendMessageParams, StreamMessageParams } from './ai-client/types.js';

export class ClaudeClient implements AIClient {
  private client: Anthropic;
  private config: Config;

  // Implement interface methods
  async sendMessage(params: SendMessageParams): Promise<AIMessage> {
    const response = await this.sendMessageOriginal(
      params.messages,
      params.model,
      params.systemPrompt,
      params.tools,
      params.options?.useThinking
    );
    return this.toAIMessage(response);
  }

  async streamMessage(params: StreamMessageParams): Promise<AIMessage> {
    const response = await this.streamMessageOriginal(
      params.messages,
      params.model,
      params.systemPrompt,
      params.tools,
      params.options?.useThinking,
      params.onChunk,
      params.abortSignal,
      params.context
    );
    return this.toAIMessage(response);
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'claude',
      version: '1.0.0',
      capabilities: {
        supportsThinking: true,
        supportsToolCalling: true,
        supportsStreaming: true,
        supportsVision: true,
        maxTokens: 8192,
        contextWindow: 200000,
      },
    };
  }

  // Keep original methods for backward compatibility
  private async sendMessageOriginal(...) { /* existing implementation */ }
  private async streamMessageOriginal(...) { /* existing implementation */ }

  // Converter methods
  private toAIMessage(anthropicMsg: Anthropic.Message): AIMessage {
    return {
      id: anthropicMsg.id,
      role: 'assistant',
      content: this.convertContent(anthropicMsg.content),
      model: anthropicMsg.model,
      stopReason: anthropicMsg.stop_reason,
      usage: {
        inputTokens: anthropicMsg.usage.input_tokens,
        outputTokens: anthropicMsg.usage.output_tokens,
        totalTokens: anthropicMsg.usage.input_tokens + anthropicMsg.usage.output_tokens,
      },
    };
  }

  private convertContent(content: Anthropic.ContentBlock[]): ContentBlock[] {
    return content.map(block => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };
        case 'thinking':
          return { type: 'thinking', thinking: block.thinking };
        case 'tool_use':
          return {
            type: 'tool_use',
            toolUse: {
              id: block.id,
              name: block.name,
              input: block.input,
            },
          };
        default:
          return { type: 'text', text: '' };
      }
    });
  }
}
```

#### Task 2.2: Create Tool Converter
Create `src/ai-client/claude-tool-converter.ts`:

```typescript
export class ClaudeToolConverter implements ToolConverter {
  toProviderFormat(tools: Tool[]): Anthropic.Tool[] {
    return tools; // Already in Anthropic format
  }

  fromProviderFormat(tools: Anthropic.Tool[]): Tool[] {
    return tools; // Already in unified format
  }
}
```

#### Task 2.3: Testing
- [ ] Unit tests for ClaudeClient adapter
- [ ] Test conversion methods
- [ ] Verify backward compatibility
- [ ] Test provider info

### Deliverables
- [ ] Updated `src/client.ts`
- [ ] `src/ai-client/claude-tool-converter.ts`
- [ ] Unit tests
- [ ] Migration documentation

---

## Phase 3: QwenClient Implementation

**Duration:** 3-4 days
**Status:** ⏳ Pending

### Objectives
- Implement QwenClient with AIClient interface
- Create Qwen-to-unified converters
- Handle OpenAI-compatible API
- Support tool calling

### Tasks

#### Task 3.1: Core QwenClient Implementation
Create `src/qwen-client.ts`:

```typescript
import OpenAI from 'openai';
import { AIClient, AIMessage, SendMessageParams, StreamMessageParams } from './ai-client/types.js';

export class QwenClient implements AIClient {
  private client: OpenAI;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.qwenApiKey || process.env.QWEN_API_KEY,
      baseURL: config.qwenBaseUrl || process.env.QWEN_BASE_URL,
    });
  }

  async sendMessage(params: SendMessageParams): Promise<AIMessage> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: this.convertMessages(params.messages, params.systemPrompt),
      tools: params.tools ? this.convertTools(params.tools) : undefined,
      temperature: params.options?.temperature || 0,
      max_tokens: params.options?.maxTokens || 8192,
    });

    return this.toAIMessage(response);
  }

  async streamMessage(params: StreamMessageParams): Promise<AIMessage> {
    const stream = await this.client.chat.completions.create({
      model: params.model,
      messages: this.convertMessages(params.messages, params.systemPrompt),
      tools: params.tools ? this.convertTools(params.tools) : undefined,
      temperature: params.options?.temperature || 0,
      max_tokens: params.options?.maxTokens || 8192,
      stream: true,
    });

    const contentBlocks: ContentBlock[] = [];
    let currentText = '';

    for await (const chunk of stream) {
      if (params.abortSignal?.aborted) {
        break;
      }

      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        currentText += delta.content;
        params.onChunk?.(delta.content, 'text');
      }

      if (delta?.tool_calls) {
        // Handle tool calls in stream
      }
    }

    if (currentText) {
      contentBlocks.push({
        type: 'text',
        text: currentText,
      });
    }

    return {
      id: 'qwen-' + Date.now(),
      role: 'assistant',
      content: contentBlocks,
      model: params.model,
      stopReason: 'end_turn',
      usage: {
        inputTokens: 0, // Will be updated
        outputTokens: 0,
        totalTokens: 0,
      },
    };
  }

  getProviderInfo(): ProviderInfo {
    return {
      name: 'qwen',
      version: '1.0.0',
      capabilities: {
        supportsThinking: false,
        supportsToolCalling: true,
        supportsStreaming: true,
        supportsVision: true,
        maxTokens: 8192,
        contextWindow: 32000,
      },
    };
  }

  private convertMessages(messages: Message[], systemPrompt: string): OpenAI.Chat.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // Add system prompt as first message
    if (systemPrompt) {
      result.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Convert messages
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({
          role: msg.role,
          content: msg.content,
        });
      } else {
        // Handle complex content (tool results, etc.)
        const textParts = msg.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n');

        result.push({
          role: msg.role,
          content: textParts || '',
        });

        // Handle tool results separately
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            result.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: block.content,
            });
          }
        }
      }
    }

    return result;
  }

  private convertTools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  private toAIMessage(response: OpenAI.Chat.ChatCompletion): AIMessage {
    const choice = response.choices[0];
    const content: ContentBlock[] = [];

    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content,
      });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          toolUse: {
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          },
        });
      }
    }

    return {
      id: response.id,
      role: 'assistant',
      content,
      model: response.model,
      stopReason: choice.finish_reason,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }
}
```

#### Task 3.2: Tool Converter
Create `src/ai-client/qwen-tool-converter.ts`:

```typescript
export class QwenToolConverter implements ToolConverter {
  toProviderFormat(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  fromProviderFormat(tools: OpenAI.Chat.ChatCompletionTool[]): Tool[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
  }
}
```

#### Task 3.3: Error Handling
- [ ] Implement retry logic
- [ ] Handle rate limiting
- [ ] Handle timeout
- [ ] Handle authentication errors

#### Task 3.4: Testing
- [ ] Unit tests for QwenClient
- [ ] Integration tests with real API
- [ ] Test tool calling
- [ ] Test streaming
- [ ] Test error handling

### Deliverables
- [ ] `src/qwen-client.ts`
- [ ] `src/ai-client/qwen-tool-converter.ts`
- [ ] Unit tests
- [ ] Integration tests
- [ ] API documentation

---

## Phase 4: Orchestrator Integration

**Duration:** 2-3 days
**Status:** ⏳ Pending

### Objectives
- Update Orchestrator to use AIClient interface
- Support provider selection
- Handle provider switching
- Maintain backward compatibility

### Tasks

#### Task 4.1: Update Orchestrator
Update `src/orchestrator.ts`:

```typescript
import { AIClient } from './ai-client/types.js';
import { ClaudeClient } from './client.js';
import { QwenClient } from './qwen-client.js';

export class Orchestrator {
  private instructorClient: AIClient;
  private workerClient: AIClient;

  constructor(config: Config) {
    this.instructorClient = this.createClient(config, 'instructor');
    this.workerClient = this.createClient(config, 'worker');
  }

  private createClient(config: Config, role: 'instructor' | 'worker'): AIClient {
    const provider = config.provider || 'claude';

    switch (provider) {
      case 'claude':
        return new ClaudeClient(config);
      case 'qwen':
        return new QwenClient(config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async processInstructorInput(input: string): Promise<void> {
    const response = await this.instructorClient.streamMessage({
      messages: this.instructor.getConversationHistory(),
      model: this.config.instructorModel,
      systemPrompt: this.instructor.getSystemPrompt(),
      tools: instructorTools,
      options: { useThinking: this.config.useThinking },
      onChunk: (chunk, type) => {
        if (type === 'thinking') {
          Display.thinking(chunk);
        } else {
          Display.text(chunk);
        }
      },
    });

    // Process response...
  }
}
```

#### Task 4.2: Configuration Support
Update `src/index.ts`:

```typescript
program
  .option('-p, --provider <provider>', 'AI provider (claude, qwen)', 'claude')
  .option('--qwen-api-key <key>', 'Qwen API key')
  .option('--qwen-base-url <url>', 'Qwen base URL')
  .option('--qwen-model <model>', 'Qwen model');

const config: Config = {
  // ...existing config
  provider: options.provider,
  qwenApiKey: options.qwenApiKey || process.env.QWEN_API_KEY,
  qwenBaseUrl: options.qwenBaseUrl || process.env.QWEN_BASE_URL,
  qwenModel: options.qwenModel || process.env.QWEN_MODEL || 'qwen-max',
};
```

#### Task 4.3: Display Updates
Update `src/display.ts` to handle provider-specific display:

```typescript
static providerInfo(client: AIClient): void {
  const info = client.getProviderInfo();
  console.log(chalk.blue(`Provider: ${info.name} v${info.version}`));
  console.log(chalk.dim(`Capabilities:`));
  console.log(chalk.dim(`  - Thinking: ${info.capabilities.supportsThinking ? '✓' : '✗'}`));
  console.log(chalk.dim(`  - Tools: ${info.capabilities.supportsToolCalling ? '✓' : '✗'}`));
  console.log(chalk.dim(`  - Streaming: ${info.capabilities.supportsStreaming ? '✓' : '✗'}`));
}
```

#### Task 4.4: Testing
- [ ] Test with Claude provider
- [ ] Test with Qwen provider
- [ ] Test provider switching
- [ ] Test mixed provider (Instructor=Claude, Worker=Qwen)
- [ ] Test error cases

### Deliverables
- [ ] Updated `src/orchestrator.ts`
- [ ] Updated `src/index.ts`
- [ ] Updated `src/display.ts`
- [ ] Integration tests
- [ ] User documentation

---

## Phase 5: Testing & Documentation

**Duration:** 3-4 days
**Status:** ⏳ Pending

### Objectives
- Comprehensive testing
- Performance comparison
- User documentation
- Migration guide

### Tasks

#### Task 5.1: Testing
- [ ] Unit tests for all new components
- [ ] Integration tests with both providers
- [ ] End-to-end tests with test cases
- [ ] Performance benchmarks
- [ ] Load testing

#### Task 5.2: Documentation
- [ ] Update README.md
- [ ] Create Qwen setup guide
- [ ] Create provider comparison doc
- [ ] Create migration guide
- [ ] API reference

#### Task 5.3: Examples
- [ ] Example: Using Qwen for Worker
- [ ] Example: Mixed providers
- [ ] Example: Switching providers
- [ ] Example: Custom configuration

### Deliverables
- [ ] Test suite
- [ ] Documentation
- [ ] Examples
- [ ] Performance report

---

## Configuration Examples

### Using Claude (Default)
```bash
export ANTHROPIC_AUTH_TOKEN=sk-xxx
./dist/index.js "task description"
```

### Using Qwen
```bash
export QWEN_API_KEY=sk-xxx
export QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
export QWEN_MODEL=qwen-max
./dist/index.js "task description" --provider qwen
```

### Mixed Providers
```bash
# Instructor uses Claude (better thinking)
# Worker uses Qwen (cheaper)
export ANTHROPIC_AUTH_TOKEN=sk-xxx
export QWEN_API_KEY=sk-xxx
./dist/index.js "task description" \
  --instructor-provider claude \
  --worker-provider qwen
```

### Configuration File (.env.local)
```bash
# Provider selection
AI_PROVIDER=qwen

# Claude configuration
ANTHROPIC_AUTH_TOKEN=sk-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Qwen configuration
QWEN_API_KEY=sk-xxx
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-max

# Mixed providers
INSTRUCTOR_PROVIDER=claude
WORKER_PROVIDER=qwen
```

---

## Success Metrics

### Phase 0 (API Validation)
- ✅ Qwen API responds successfully
- ✅ Basic chat works
- ✅ Tool calling works
- ✅ Streaming works

### Phase 1-4 (Implementation)
- ✅ All tests pass
- ✅ Both providers work independently
- ✅ Mixed provider setup works
- ✅ No regression in existing functionality

### Phase 5 (Production Ready)
- ✅ Performance acceptable (< 10% overhead)
- ✅ Documentation complete
- ✅ Examples working
- ✅ User feedback positive

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Qwen API incompatibility | Medium | High | Phase 0 validation |
| Tool calling format mismatch | Medium | High | Comprehensive testing |
| Performance degradation | Low | Medium | Benchmarking |
| Breaking changes | Low | High | Backward compatibility |

### Timeline Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API changes during development | Low | Medium | Lock API version |
| Unexpected complexity | Medium | Medium | Iterative approach |
| Testing takes longer | Medium | Low | Parallel testing |

---

## Next Steps

1. ✅ Create this plan document
2. 🔄 **[Current]** Create Qwen API test script
3. ⏳ Validate API in Phase 0
4. ⏳ Proceed to Phase 1 if validation successful

---

## Notes

- Keep Claude as default provider for stability
- Qwen integration is additive, not replacing Claude
- Focus on clean interfaces for future provider additions
- Document any Qwen-specific quirks or limitations
- Consider creating provider adapter plugins for future extensibility

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** Phase 0 - API Validation In Progress
