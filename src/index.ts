#!/usr/bin/env node

import { Command } from 'commander';
import { Orchestrator } from './orchestrator.js';
import { Config } from './types.js';
import { Display } from './display.js';

const program = new Command();

program
  .name('claude-master')
  .description('CLI tool to orchestrate Instructor and Worker Claude instances')
  .version('1.0.0')
  .argument('<task>', 'The task to execute')
  .option('-s, --system-prompt <prompt>', 'Custom system prompt for Instructor', '')
  .option('-r, --max-rounds <number>', 'Maximum number of conversation rounds', parseInt)
  .option('-i, --instructor-model <model>', 'Model for Instructor', 'claude-sonnet-4-5-20250929')
  .option('-w, --worker-model <model>', 'Default model for Worker', 'claude-sonnet-4-5-20250929')
  .option('-k, --api-key <key>', 'Anthropic API key (or use ANTHROPIC_AUTH_TOKEN env var)')
  .option('-u, --base-url <url>', 'API base URL (or use ANTHROPIC_BASE_URL env var)')
  .action(async (task, options) => {
    try {
      // Get API key from options or environment
      const apiKey = options.apiKey
        || process.env.ANTHROPIC_AUTH_TOKEN
        || process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        Display.error('API key is required. Set ANTHROPIC_AUTH_TOKEN environment variable or use --api-key option');
        process.exit(1);
      }

      // Get base URL from options or environment
      const baseURL = options.baseUrl || process.env.ANTHROPIC_BASE_URL;

      // Build config
      const config: Config = {
        apiKey,
        baseURL,
        instructorModel: options.instructorModel,
        workerModel: options.workerModel,
        maxRounds: options.maxRounds,
      };

      // Create and run orchestrator
      const orchestrator = new Orchestrator(config, options.systemPrompt);
      await orchestrator.run(task);

      Display.newline();
      Display.success('Task completed successfully');
      process.exit(0);

    } catch (error) {
      Display.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
