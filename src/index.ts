#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { Command } from 'commander';
import { Orchestrator } from './orchestrator.js';
import { SessionManager } from './session-manager.js';
import { Config } from './types.js';
import { Display } from './display.js';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

// Load .env.local file if it exists
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath });
}

const program = new Command();

program
  .name('claude-master')
  .description('CLI tool to orchestrate Instructor and Worker AI instances (supports Claude and Qwen)')
  .version(version)
  .argument('[instruction]', 'Optional initial instruction for Instructor (can be provided later interactively)')
  .option('-d, --work-dir <path>', 'Working directory for the project', process.cwd())
  .option('-r, --max-rounds <number>', 'Maximum number of conversation rounds', parseInt)
  .option('-i, --instructor-model <model>', 'Model for Instructor (e.g., sonnet, qwen, qwen-max)', 'claude-sonnet-4-5-20250929')
  .option('-w, --worker-model <model>', 'Model for Worker (e.g., sonnet, qwen, qwen-max)', 'claude-sonnet-4-5-20250929')
  .option('-k, --api-key <key>', 'API key (works for both Claude and Qwen, or use ANTHROPIC_API_KEY/QWEN_API_KEY env vars)')
  .option('-u, --base-url <url>', 'API base URL (works for both providers, or use ANTHROPIC_BASE_URL/QWEN_BASE_URL env vars)')
  .option('--no-thinking', 'Disable thinking feature for Instructor (use this if your API/proxy does not support thinking)')
  .option('--debug', 'Enable debug mode with mock API responses (for testing orchestrator logic)')
  .option('-c, --continue', 'Continue the most recent session in current working directory')
  .option('--resume [sessionId]', 'Resume a previous session by session ID (or latest if not specified)')
  // Qwen-specific overrides (optional)
  .option('--qwen-api-key <key>', 'Qwen-specific API key (overrides --api-key for Qwen models)')
  .option('--qwen-base-url <url>', 'Qwen-specific base URL (overrides --base-url for Qwen models)')
  .option('--qwen-model <model>', 'Qwen model name (used when model shorthand is "qwen")')
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

      // Get auth token from environment (use undefined instead of empty string)
      const authToken = process.env.ANTHROPIC_AUTH_TOKEN || undefined;

      // Get API key from options or environment
      const apiKey = options.apiKey
        || process.env.ANTHROPIC_API_KEY
        || undefined;

      // In debug mode, API key is not required
      if (!options.debug && !authToken && !apiKey) {
        Display.error('Auth token or API key is required. Set ANTHROPIC_AUTH_TOKEN in .env.local, environment variable, or use --api-key option');
        Display.info('Or use --debug flag to run in debug mode without API calls');
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
        useThinking: options.thinking !== false, // Default to true, but can be disabled with --no-thinking
        debugMode: options.debug || false, // Enable debug mode if --debug flag is present

        // Qwen-specific configuration (optional overrides)
        qwenApiKey: options.qwenApiKey || process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY,
        qwenBaseUrl: options.qwenBaseUrl || process.env.QWEN_BASE_URL || process.env.OPENAI_BASE_URL,
        qwenModel: options.qwenModel || process.env.QWEN_MODEL || process.env.OPENAI_MODEL,
      };

      // Show debug mode warning
      if (config.debugMode) {
        Display.warning('⚙️  DEBUG MODE ENABLED');
        Display.system('   Using mock API responses instead of real Claude API');
        Display.system('   This is for testing orchestrator logic only');
        Display.newline();
      }

      // Handle --continue and --resume options
      let sessionId: string | undefined;

      // Check for conflicting options
      if (options.continue && options.resume) {
        Display.error('Cannot use both --continue and --resume options');
        Display.system('  --continue: Resume latest session in current directory');
        Display.system('  --resume: Resume a specific session by ID');
        process.exit(1);
      }

      const sessionManager = new SessionManager();

      if (options.continue) {
        // --continue: Find the latest session for current workDir
        const latestSession = await sessionManager.getLatestSessionByWorkDir(workDir);

        if (!latestSession) {
          Display.info('No previous session found in this directory');
          Display.system('  Starting a new session...');
          Display.newline();
        } else {
          sessionId = latestSession.sessionId;
          Display.info(`Continuing session in current directory`);
          Display.system(`  Session ID: ${sessionId}`);
          Display.system(`  Last updated: ${latestSession.lastUpdatedAt}`);
          Display.newline();
        }
      } else if (options.resume) {
        // --resume: Resume by session ID or latest overall
        if (options.resume === true) {
          const sessions = await sessionManager.listSessions();

          if (sessions.length === 0) {
            Display.error('No sessions found to resume');
            process.exit(1);
          }

          // Use the most recent session (globally)
          sessionId = sessions[0].sessionId;
          Display.info(`Resuming most recent session (any directory)`);
          Display.system(`  Session ID: ${sessionId}`);
          Display.system(`  Last updated: ${sessions[0].lastUpdatedAt}`);
          Display.newline();
        } else {
          // Resume specific session ID
          sessionId = options.resume as string;

          if (!sessionManager.sessionExists(sessionId)) {
            Display.error(`Session not found: ${sessionId}`);
            process.exit(1);
          }

          Display.info(`Resuming session: ${sessionId}`);
          Display.newline();
        }
      }

      // Create orchestrator (with sessionId if resuming/continuing)
      const orchestrator = new Orchestrator(config, workDir, sessionId);

      // If resuming or continuing, restore the session state
      if (sessionId) {
        const restored = await orchestrator.restoreSession(sessionId);

        if (!restored) {
          Display.error(`Failed to restore session: ${sessionId}`);
          process.exit(1);
        }

        Display.success('✓ Session restored successfully');
        Display.system(`  Session ID: ${orchestrator.getSessionId()}`);
        Display.system(`  Current round: ${orchestrator.getCurrentRound()}`);
        Display.newline();
      }

      // Run with optional initial instruction
      await orchestrator.run(instruction);

      Display.newline();
      Display.success('Session ended');
      process.exit(0);

    } catch (error) {
      Display.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
