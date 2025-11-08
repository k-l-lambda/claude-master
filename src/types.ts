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

export interface InstructorResponse {
  thinking?: string;
  instruction: string;
  workerModel?: string;
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
