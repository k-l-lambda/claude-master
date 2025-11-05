import Anthropic from '@anthropic-ai/sdk';

export interface Config {
  apiKey: string;
  baseURL?: string;
  instructorModel: string;
  workerModel: string;
  maxRounds?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
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
