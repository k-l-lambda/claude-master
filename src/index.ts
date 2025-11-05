#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { Command } from 'commander';
import { Orchestrator } from './orchestrator.js';
import { Config } from './types.js';
import { Display } from './display.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env.local file if it exists
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath });
}

const program = new Command();

program
  .name('claude-master')
  .description('CLI tool to orchestrate Instructor and Worker Claude instances')
  .version('1.0.0')
  .argument('<instruction>', 'Instruction for Instructor (e.g., "Read the README.md to be aware about our task")')
  .option('-d, --work-dir <path>', 'Working directory for the project', process.cwd())
  .option('-r, --max-rounds <number>', 'Maximum number of conversation rounds', parseInt)
  .option('-i, --instructor-model <model>', 'Model for Instructor', 'claude-sonnet-4-5-20250929')
  .option('-w, --worker-model <model>', 'Default model for Worker', 'claude-sonnet-4-5-20250929')
  .option('-k, --api-key <key>', 'Anthropic API key (or use ANTHROPIC_AUTH_TOKEN env var or .env.local)')
  .option('-u, --base-url <url>', 'API base URL (or use ANTHROPIC_BASE_URL env var or .env.local)')
  .action(async (instruction, options) => {
    try {
      // Change to work directory if specified
      const workDir = resolve(options.workDir);
      if (!existsSync(workDir)) {
        Display.error(`Work directory does not exist: ${workDir}`);
        process.exit(1);
      }

      process.chdir(workDir);
      Display.info(`Working directory: ${workDir}`);

      // Get auth token from environment
      const authToken = process.env.ANTHROPIC_AUTH_TOKEN || '';

      // Get API key from options or environment
      const apiKey = options.apiKey
        || process.env.ANTHROPIC_API_KEY
        || undefined;

      // Validate that at least one is provided
      if (!authToken && !apiKey) {
        Display.error('Auth token or API key is required. Set ANTHROPIC_AUTH_TOKEN in .env.local, environment variable, or use --api-key option');
        process.exit(1);
      }

      // Get base URL from options or environment
      const baseURL = options.baseUrl || process.env.ANTHROPIC_BASE_URL;

      // Build config
      const config: Config = {
        authToken,
        apiKey,
        baseURL,
        instructorModel: options.instructorModel,
        workerModel: options.workerModel,
        maxRounds: options.maxRounds,
      };

      // Create and run orchestrator
      const orchestrator = new Orchestrator(config, instruction);
      await orchestrator.run();

      Display.newline();
      Display.success('Task completed successfully');
      process.exit(0);

    } catch (error) {
      Display.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
