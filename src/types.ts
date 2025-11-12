import Anthropic from '@anthropic-ai/sdk';

export interface Config {
  authToken?: string;
  apiKey?: string;
  baseURL?: string;
  instructorModel: string;
  workerModel: string;
  maxRounds?: number;
  useThinking?: boolean;  // Control whether to use thinking feature
  debugMode?: boolean;    // Enable mock responses for testing

  // Provider configuration
  provider?: 'claude' | 'qwen';  // Default provider for both Instructor and Worker
  instructorProvider?: 'claude' | 'qwen';  // Override provider for Instructor
  workerProvider?: 'claude' | 'qwen';  // Override provider for Worker

  // Qwen-specific configuration
  qwenApiKey?: string;
  qwenBaseUrl?: string;
  qwenModel?: string;

  // Provider-specific configs
  claudeConfig?: ClaudeConfig;
  qwenConfig?: QwenConfig;
}

/**
 * Claude-specific configuration
 */
export interface ClaudeConfig {
  authToken?: string;
  apiKey?: string;
  baseURL?: string;
  defaultModel: string;
}

/**
 * Qwen-specific configuration
 */
export interface QwenConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeout?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
}

export interface SystemMessage {
  type: 'system';
  subtype: 'compact_boundary' | 'compact_summary';
  content: string;
  timestamp: string;
  metadata?: {
    trigger: 'manual' | 'auto';
    preTokens: number;
    postTokens: number;
  };
}

export interface ConversationContext {
  messages: Message[];
  round: number;
}

export interface CallWorkerParams {
  tool_name: 'call_worker' | 'call_worker_with_file' | 'tell_worker';
  system_prompt?: string;  // For call_worker
  system_prompt_file?: string;  // For call_worker_with_file
  instruction?: string;  // For call_worker and call_worker_with_file
  message?: string;  // For tell_worker
  model?: string;
}

export interface InstructorResponse {
  thinking?: string;
  callWorker?: CallWorkerParams;  // New: structured call to Worker (replaces instruction field)
  shouldContinue: boolean;
  needsCorrection?: boolean;  // True if Instructor needs to be prompted about correct communication
}

export enum InstanceType {
  INSTRUCTOR = 'INSTRUCTOR',
  WORKER = 'WORKER'
}

export interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

export interface SessionState {
  sessionId: string;
  createdAt: string;
  lastUpdatedAt: string;
  currentRound: number;
  remainingRounds: number;
  instructorMessages: Message[];
  // Worker messages are NOT persisted - Worker starts fresh on session resume
  workDir: string;
  config: Config;
}
