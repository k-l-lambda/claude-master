import { Config, InstanceType, SessionState } from './types.js';
import { InstructorManager } from './instructor.js';
import { WorkerManager } from './worker.js';
import { Display } from './display.js';
import { SessionManager } from './session-manager.js';
import { TokenCounter } from './token-counter.js';
import { ConversationCompactor } from './compactor.js';
import { ClaudeClient } from './client.js';
import { ModelManager } from './model-manager.js';
import * as readline from 'readline';

export class Orchestrator {
  private instructor: InstructorManager;
  private worker: WorkerManager;
  private config: Config;
  private currentRound: number = 0;
  private remainingRounds: number;
  private paused: boolean = false;
  private interrupted: boolean = false;
  private currentAbortController: AbortController | null = null;
  private rl: readline.Interface;
  private sessionManager: SessionManager;
  private sessionId: string;
  private workDir: string;
  private compactor: ConversationCompactor | null = null;
  private isRestoredSession: boolean = false;
  private workerTimeoutMs: number = 120000; // Default: 120 seconds
  private modelManager: ModelManager;

  constructor(config: Config, workDir: string, sessionId?: string) {
    this.config = config;
    this.workDir = workDir;
    this.remainingRounds = config.maxRounds || Infinity;
    this.sessionManager = new SessionManager();
    this.modelManager = new ModelManager();

    // Generate or use provided session ID
    this.sessionId = sessionId || this.sessionManager.generateSessionId();

    this.instructor = new InstructorManager(config, '', workDir);
    this.worker = new WorkerManager(config, workDir);
    // Connect Instructor's tool executor to Worker's tool executor and Worker itself
    this.instructor.setWorkerToolExecutor(this.worker.getToolExecutor(), this.worker);
    // Connect Instructor's ability to set Worker timeout
    this.instructor.setWorkerTimeoutSetter((timeoutMs: number) => {
      this.workerTimeoutMs = timeoutMs;
    });

    // Initialize compactor for Instructor
    if (config.apiKey || config.authToken) {
      const client = new ClaudeClient(config);
      this.compactor = new ConversationCompactor(client.getClient(), config.instructorModel);
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.setupKeyHandler();
  }

  private setupKeyHandler(): void {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(true);
        process.stdin.on('data', (data) => {
          if (data[0] === 0x1B && !this.paused) {
            this.interrupted = true;
            if (this.currentAbortController) {
              this.currentAbortController.abort();
            }
            this.handleInterrupt();
          }
        });
      } catch (error) {
        console.warn('⚠️  Raw mode unavailable - ESC key interrupt disabled');
      }
    }
  }

  private async handleInterrupt(): Promise<void> {
    this.paused = true;
    await new Promise(resolve => setTimeout(resolve, 100));
    Display.newline();
    Display.system('⏸️  Execution interrupted by user (ESC pressed)');
    Display.system('   Returning to instruction input...');
    Display.newline();
    this.interrupted = false;
  }

  private async waitForUserInput(): Promise<string | null> {
    Display.newline();
    Display.system('💬 Instructor is waiting for your next instruction...');
    Display.system('   Type your instruction, or type "exit" to quit.');
    Display.newline();

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Reset paused flag before accepting input (allow ESC to work again)
    this.paused = false;

    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch (error) {
        // Ignore
      }
    }

    try {
      const userInput = await new Promise<string>((resolve, reject) => {
        this.rl.question('Input your instruction:\n> ', (answer) => {
          resolve(answer);
        });

        // Handle close event
        const closeHandler = () => {
          reject(new Error('Input stream closed'));
        };
        this.rl.once('close', closeHandler);
      });

      if (process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(true);
        } catch (error) {
          // Ignore
        }
      }

      const trimmed = userInput.trim();
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        return null;
      }

      return trimmed || null;
    } catch (error: any) {
      // If readline was closed (e.g., piped input ended), treat as exit
      if (error.message?.includes('closed')) {
        Display.info('Input stream closed');
        return null;
      }
      throw error;
    }
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch (error) {
        // Ignore
      }
    }
    this.rl.close();
  }

  /**
   * Parse and handle round control commands in user input
   * Control commands MUST appear at the beginning of input
   * Supports: [r+n] to add n rounds, [r=n] to set remaining rounds to n
   * Returns the cleaned instruction without control commands
   */
  private parseRoundControl(input: string): string {
    let cleanedInput = input;
    let hasChanges = true;

    // Keep parsing until no more matches at the start
    while (hasChanges) {
      hasChanges = false;

      // Match [r+n] at the start (after optional whitespace)
      const addMatch = cleanedInput.match(/^\s*\[r\+(\d+)\]/i);
      if (addMatch) {
        const n = parseInt(addMatch[1], 10);
        this.remainingRounds = this.remainingRounds === Infinity ? n : this.remainingRounds + n;
        Display.system(`📊 Added ${n} rounds. Remaining: ${this.remainingRounds === Infinity ? '∞' : this.remainingRounds}`);
        cleanedInput = cleanedInput.replace(addMatch[0], '');
        hasChanges = true;
      }

      // Match [r=n] at the start (after optional whitespace)
      const setMatch = cleanedInput.match(/^\s*\[r=(\d+)\]/i);
      if (setMatch) {
        const n = parseInt(setMatch[1], 10);
        this.remainingRounds = n;
        Display.system(`📊 Set remaining rounds to: ${this.remainingRounds}`);
        cleanedInput = cleanedInput.replace(setMatch[0], '');
        hasChanges = true;
      }
    }

    return cleanedInput.trim();
  }

  /**
   * Check if user input contains compact command
   */
  private isCompactCommand(input: string): boolean {
    return /^\s*\[compact\]/i.test(input);
  }

  /**
   * Check and perform auto-compact if needed
   */
  private async checkAndAutoCompact(): Promise<boolean> {
    if (!this.compactor) return false;

    const messages = this.instructor.getConversationHistory();
    // Auto-compact at 50k tokens (25% of 200k limit)
    if (TokenCounter.shouldCompact(messages, 200000, 0.25)) {
      Display.newline();
      Display.warning('⚠️  Conversation approaching recommended limit');
      Display.system(` Current usage: ${TokenCounter.formatTokenUsage(messages)}`);
      Display.system('  Performing automatic compaction...');
      Display.newline();

      try {
        const result = await this.compactor.compact(messages, 'auto');

        // Replace conversation history with compacted version
        this.instructor.restoreConversationHistory([result.summaryMessage]);

        Display.success('✓ Conversation compacted automatically');
        Display.system(`  Reduced from ${result.preTokens.toLocaleString()} to ${result.postTokens.toLocaleString()} tokens`);
        Display.system(`  Saved ${(result.preTokens - result.postTokens).toLocaleString()} tokens (~${Math.round((1 - result.postTokens / result.preTokens) * 100)}%)`);
        Display.newline();

        // Save session after compaction
        await this.saveSession();
        return true;
      } catch (error: any) {
        Display.error(`Failed to compact conversation: ${error.message}`);
        Display.system('  Continuing with current history...');
        Display.newline();
        return false;
      }
    }

    return false;
  }

  /**
   * Perform manual compaction
   */
  private async performManualCompact(): Promise<void> {
    if (!this.compactor) {
      Display.error('Compaction not available - API key required');
      return;
    }

    const messages = this.instructor.getConversationHistory();
    if (messages.length === 0) {
      Display.warning('No conversation history to compact');
      return;
    }

    Display.newline();
    Display.info('📦 Compacting conversation...');
    Display.system(`  Current usage: ${TokenCounter.formatTokenUsage(messages)}`);
    Display.newline();

    try {
      const result = await this.compactor.compact(messages, 'manual');

      // Replace conversation history with compacted version
      this.instructor.restoreConversationHistory([result.summaryMessage]);

      Display.success('✓ Conversation compacted successfully');
      Display.system(`  Reduced from ${result.preTokens.toLocaleString()} to ${result.postTokens.toLocaleString()} tokens`);
      Display.system(`  Saved ${(result.preTokens - result.postTokens).toLocaleString()} tokens (~${Math.round((1 - result.postTokens / result.preTokens) * 100)}%)`);
      Display.newline();

      // Save session after compaction
      await this.saveSession();
    } catch (error: any) {
      Display.error(`Failed to compact conversation: ${error.message}`);
      Display.newline();
    }
  }

  private handleApiError(error: any): 'continue' | 'break' | 'throw' {
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      return 'continue';
    }

    if (error.status === 400 && error.message?.includes('Extra inputs are not permitted')) {
      Display.error('API Error: Invalid message format detected');
      Display.system('   This usually happens due to streaming artifacts in conversation history.');
      Display.system('   The conversation history has been sanitized. Please try again.');
      Display.newline();
      return 'break';
    }

    if (error.status === 400 && error.message?.includes('all messages must have non-empty content')) {
      Display.error('API Error: Cannot send empty message');
      Display.system('   This usually happens when a response contains no text or tools.');
      Display.system('   Please try again with a new instruction.');
      Display.newline();
      return 'break';
    }

    if (error.message?.includes('Cannot add message with empty content') || error.message?.includes('Cannot process empty')) {
      Display.error('Cannot process empty content');
      Display.system('   The AI response contained no valid content.');
      Display.system('   Please try again with a new instruction.');
      Display.newline();
      return 'break';
    }

    return 'throw';
  }

  private async callInstructor(
    message: string,
    context: 'user-input' | 'worker-response' | 'correction'
  ): Promise<any | null> {
    this.currentAbortController = new AbortController();

    let thinkingBuffer = '';
    let textBuffer = '';

    const onThinkingChunk = (chunk: string) => {
      if (this.interrupted) return;
      if (thinkingBuffer === '') {
        Display.newline();
        Display.system('Thinking...');
      }
      thinkingBuffer += chunk;
      Display.thinking(chunk);
    };

    const onTextChunk = (chunk: string) => {
      if (this.interrupted) return;
      if (thinkingBuffer && textBuffer === '') {
        Display.newline();
        Display.system('Response:');
      }
      textBuffer += chunk;
      Display.text(InstanceType.INSTRUCTOR, chunk);
    };

    try {
      let response;
      if (context === 'worker-response') {
        response = await this.instructor.processWorkerResponse(
          message,
          onThinkingChunk,
          onTextChunk,
          this.currentAbortController.signal
        );
      } else {
        response = await this.instructor.processUserInput(
          message,
          onThinkingChunk,
          onTextChunk,
          this.currentAbortController.signal
        );
      }

      Display.newline();
      Display.instructorStatus(
        response.shouldContinue,
        response.needsCorrection || false
      );

      if (this.interrupted) {
        this.paused = false;
        return null;
      }

      return response;
    } catch (error: any) {
      // Handle Instructor context too long - trigger automatic compaction
      if (error.message === 'INSTRUCTOR_CONTEXT_TOO_LONG') {
        Display.newline();
        Display.warning('⚠️  Instructor context is too long');
        Display.system(`   Current size: ${(error.tokenCount || 0).toLocaleString()} tokens`);
        Display.system('   Performing emergency compaction...');
        Display.newline();

        if (!this.compactor) {
          Display.error('Compactor not initialized - cannot compact');
          throw error;
        }

        try {
          const messages = this.instructor.getConversationHistory();
          const result = await this.compactor.compact(messages, 'auto');
          this.instructor.restoreConversationHistory([result.summaryMessage]);
          await this.saveSession();

          Display.success('✓ Compaction completed successfully');
          Display.system(`   Reduced: ${result.preTokens.toLocaleString()} → ${result.postTokens.toLocaleString()} tokens`);
          Display.newline();

          // Retry the same call after compaction
          Display.system('Retrying Instructor call after compaction...');
          return await this.callInstructor(message, context);
        } catch (compactError) {
          Display.error('Failed to compact Instructor context');
          throw compactError;
        }
      }

      const action = this.handleApiError(error);
      if (action === 'throw') throw error;
      return null;
    } finally {
      this.currentAbortController = null;
    }
  }

  private async handleNeedsCorrection(response: any): Promise<any | null> {
    if (!response?.needsCorrection) {
      return response;
    }

    Display.warning('⚠️  Instructor did not use worker tools.');
    Display.system('   To work with Worker, use one of these tools:');
    Display.system('   - call_worker(system_prompt, instruction, model?) - Reset Worker context');
    Display.system('   - call_worker_with_file(system_prompt_file, instruction, model?) - Reset with file');
    Display.system('   - tell_worker(message, model?) - Continue Worker conversation');
    Display.system('   To finish the task, respond with: "DONE"');
    Display.newline();

    // Try correction up to 3 times
    const maxCorrectionAttempts = 3;
    let correctedResponse: any = null;

    for (let attempt = 1; attempt <= maxCorrectionAttempts; attempt++) {
      this.currentRound++;
      Display.round(this.currentRound, this.remainingRounds !== Infinity ? this.remainingRounds : undefined);
      Display.header(InstanceType.INSTRUCTOR, `Correction Attempt ${attempt}/${maxCorrectionAttempts}`);

      correctedResponse = await this.callInstructor(
        'Please continue. You should work with Worker agent using the worker tools (call_worker, call_worker_with_file, or tell_worker). Remember to use these tools to delegate work to Worker, or respond with "DONE" to finish.',
        'correction'
      );

      if (!correctedResponse) {
        // Abort signal or error
        return null;
      }

      // Check if correction succeeded
      if (!correctedResponse.needsCorrection) {
        // Success! Check if we have valid worker call or done
        const callWorkerParams = this.instructor.getCallWorkerParams();
        if (callWorkerParams || !correctedResponse.shouldContinue) {
          Display.success(`✓ Correction successful on attempt ${attempt}`);
          Display.newline();
          return correctedResponse;
        }
      }

      // Still has issues, show warning and try again
      if (attempt < maxCorrectionAttempts) {
        Display.warning(`⚠️  Attempt ${attempt} failed. Trying again...`);
        Display.newline();
      }
    }

    // All correction attempts failed - force DONE to prevent infinite loop
    Display.warning('⚠️  All correction attempts failed. Marking task as complete.');
    Display.newline();

    return {
      thinking: '',
      shouldContinue: false, // Force stop
      needsCorrection: false,
    };
  }

  /**
   * Map shorthand model names to full model IDs using ModelManager
   */
  private mapModelName(model: string): string {
    return this.modelManager.resolve(model);
  }

  /**
   * Initialize ModelManager with API
   */
  private async initializeModelManager(): Promise<void> {
    if (this.modelManager.isInitialized()) {
      return;
    }

    try {
      const client = new ClaudeClient(this.config);
      await this.modelManager.initialize(client.getClient());
    } catch (error) {
      console.warn('[Orchestrator] Failed to initialize ModelManager:', error);
      // ModelManager will use fallback mapping
    }
  }

  /**
   * Call Worker with structured parameters from worker tools
   * Handles three tool types:
   * - call_worker: Reset context with inline system prompt
   * - call_worker_with_file: Reset context with system prompt from file
   * - tell_worker: Continue existing conversation
   */
  private async callWorkerWithParams(params: import('./types.js').CallWorkerParams): Promise<string> {
    const rawModel = params.model || this.config.workerModel;
    const model = this.mapModelName(rawModel); // Map shorthand to full ID
    const toolName = params.tool_name;

    if (rawModel !== model) {
      console.log(`[Orchestrator] Mapped model name: "${rawModel}" -> "${model}"`);
    }

    let displayMode: string;
    if (toolName === 'call_worker' || toolName === 'call_worker_with_file') {
      displayMode = 'call_worker (reset context)';
    } else {
      displayMode = 'tell_worker (continue)';
    }

    // Use new workerHeader with model and mode emojis
    Display.workerHeader(`Processing Instruction (Model: ${model})`, model, displayMode);
    Display.system('Instruction from Instructor:');

    if (toolName === 'call_worker' || toolName === 'call_worker_with_file') {
      let instruction = params.instruction || '';
      if (toolName === 'call_worker_with_file')
        instruction = Display.truncate(instruction)
      Display.system(instruction);
      Display.system('Mode: Resetting Worker context with new system prompt');
    } else {
      Display.system(params.message || '');
      const workerHistorySize = this.worker.getConversationHistory().length;
      Display.system(`Mode: Continuing Worker conversation (history: ${workerHistorySize} messages)`);
    }
    Display.newline();

    let workerTextBuffer = '';
    let lastTokenTime = Date.now();
    const TIMEOUT_MS = this.workerTimeoutMs;
    let workerTimedOut = false;

    this.currentAbortController = new AbortController();

    const timeoutCheckInterval = setInterval(() => {
      const timeSinceLastToken = Date.now() - lastTokenTime;
      if (timeSinceLastToken > TIMEOUT_MS) {
        workerTimedOut = true;
        console.log(`[Timeout] Worker inactive for ${Math.floor(timeSinceLastToken / 1000)}s, aborting...`);
        if (this.currentAbortController) {
          this.currentAbortController.abort();
        }
        clearInterval(timeoutCheckInterval);
      }
    }, 1000);

    const onTextChunk = (chunk: string) => {
      if (this.interrupted) return;
      lastTokenTime = Date.now();
      if (workerTextBuffer === '') {
        Display.system('Response:');
      }
      workerTextBuffer += chunk;
      Display.text(InstanceType.WORKER, chunk);
    };

    try {
      let workerResponse: string;

      // console.log('[DEBUG] About to call Worker, toolName:', toolName);
      // console.log('[DEBUG] Model:', model);
      // console.log('[DEBUG] System prompt:', params.system_prompt?.substring(0, 100) + '...');
      // console.log('[DEBUG] Instruction/Message:', (params.instruction || params.message || '').substring(0, 100));

      if (toolName === 'call_worker' || toolName === 'call_worker_with_file') {
        // Reset Worker context and call with fresh instruction
        // console.log('[DEBUG] Calling worker.resetAndCall...');
        workerResponse = await this.worker.resetAndCall(
          params.instruction || '',
          model,
          params.system_prompt,
          undefined,  // No context_messages in new API
          onTextChunk,
          this.currentAbortController.signal
        );
        // console.log('[DEBUG] Worker.resetAndCall completed, response length:', workerResponse.length);
      } else {
        // tell_worker mode: continue existing conversation
        // console.log('[DEBUG] Calling worker.processInstruction...');
        workerResponse = await this.worker.processInstruction(
          params.message || '',
          model,
          onTextChunk,
          this.currentAbortController.signal
        );
        // console.log('[DEBUG] Worker.processInstruction completed, response length:', workerResponse.length);
      }

      clearInterval(timeoutCheckInterval);
      Display.newline();

      if (this.interrupted) {
        this.paused = false;
        throw new Error('Interrupted');
      }

      return workerResponse;
    } catch (error: any) {
      clearInterval(timeoutCheckInterval);

      if (workerTimedOut && (error.name === 'AbortError' || error.message?.includes('aborted'))) {
        Display.newline();
        Display.system(`⏱️  Worker response timed out after ${this.workerTimeoutMs / 1000}s of inactivity`);
        Display.newline();
        return workerTextBuffer ? `${workerTextBuffer} [TIMEOUT after ${this.workerTimeoutMs / 1000}s]` : `[No response received - TIMEOUT after ${this.workerTimeoutMs / 1000}s]`;
      }

      throw error;
    } finally {
      this.currentAbortController = null;
    }
  }

  async run(initialInstruction?: string): Promise<void> {
    // Initialize ModelManager before starting
    await this.initializeModelManager();

    Display.info(`Starting dual-AI orchestration system`);
    Display.info(`Instructor Model: ${this.config.instructorModel}`);
    Display.info(`Worker Default Model: ${this.config.workerModel}`);
    if (this.config.maxRounds) {
      Display.info(`Max Rounds: ${this.config.maxRounds}`);
    }
    Display.info(`Press ESC to pause and give instructions`);
    Display.info(`Type [compact] to manually compact conversation history`);
    Display.newline();

    // Show session restored message if applicable
    if (this.isRestoredSession) {
      Display.warning('📋 Session Restored');
      Display.system('  Worker context was NOT persisted - you need to re-explain the task to Worker');
      Display.system('  Instructor context has been restored from session file');
      Display.newline();
    }

    try {
      let instructorResponse: any = null;
      let isFirstRun = true;

      // Main session loop
      while (true) {
        // Check for auto-compact before processing
        await this.checkAndAutoCompact();

        // Step 1: Get user instruction if needed (when no active response or done)
        if (!instructorResponse?.shouldContinue) {
          if (instructorResponse) {
            Display.success('Instructor has completed the current task');
          }

          let userInstruction = isFirstRun && initialInstruction
            ? initialInstruction
            : await this.waitForUserInput();

          isFirstRun = false;

          if (!userInstruction) {
            Display.info('Session ended by user');
            break;
          }

          // Check for compact command
          if (this.isCompactCommand(userInstruction)) {
            await this.performManualCompact();
            continue;
          }

          // Parse round control commands and get cleaned instruction
          userInstruction = this.parseRoundControl(userInstruction);

          // Check if there's still instruction after parsing controls
          if (!userInstruction || userInstruction.trim().length === 0) {
            Display.warning('⚠️  No instruction provided after parsing round controls');
            Display.newline();
            continue;
          }

          // Step 2: Process user instruction with Instructor
          this.currentRound++;
          Display.round(this.currentRound, this.remainingRounds !== Infinity ? this.remainingRounds : undefined);
          Display.header(InstanceType.INSTRUCTOR, 'Processing User Instruction');
          Display.system('User Instruction: ' + userInstruction);

          instructorResponse = await this.callInstructor(userInstruction, 'user-input');
          if (!instructorResponse) continue;

          // Save session after user instruction
          await this.saveSession();
        }

        // Handle correction if needed (check before proceeding to worker)
        if (instructorResponse?.needsCorrection) {
          instructorResponse = await this.handleNeedsCorrection(instructorResponse);
          if (!instructorResponse) continue;
        }

        // Check if done after correction
        if (!instructorResponse?.shouldContinue) {
          continue;
        }

        // Extract call_worker params from Instructor's conversation history
        const callWorkerParams = this.instructor.getCallWorkerParams();

        // Validate we have call_worker params before proceeding
        if (!callWorkerParams) {
          Display.warning('⚠️  Instructor did not use worker tools. Returning to user input...');
          Display.newline();
          instructorResponse = null;
          continue;
        }

        // Step 3: Worker-Instructor conversation loop
        while (instructorResponse?.shouldContinue) {
          // Extract call_worker params (check each iteration)
          const callWorkerParams = this.instructor.getCallWorkerParams();
          if (!callWorkerParams) {
            Display.warning('⚠️  No call_worker params found. Ending Worker-Instructor loop...');
            Display.newline();
            break;
          }

          // Check remaining rounds
          if (this.remainingRounds !== Infinity && this.remainingRounds <= 0) {
            Display.error(`No remaining rounds. Stopping.`);
            Display.system(`Use [r+n] to add more rounds or [r=n] to set remaining rounds`);
            Display.newline();
            instructorResponse.shouldContinue = false;
            break;
          }

          // Decrement remaining rounds before starting Worker round
          if (this.remainingRounds !== Infinity) {
            this.remainingRounds--;
          }

          // Call Worker with structured params
          let workerResponse: string;
          try {
            workerResponse = await this.callWorkerWithParams(callWorkerParams);
          } catch (error: any) {
            if (error.message === 'Interrupted') {
              instructorResponse = null;
              break;
            }
            const action = this.handleApiError(error);
            if (action === 'throw') throw error;
            instructorResponse.shouldContinue = false;
            break;
          }

          // Instructor reviews Worker response
          this.currentRound++;
          Display.round(this.currentRound, this.remainingRounds !== Infinity ? this.remainingRounds : undefined);
          Display.header(InstanceType.INSTRUCTOR, 'Reviewing Worker Response');

          instructorResponse = await this.callInstructor(workerResponse, 'worker-response');
          if (!instructorResponse) break;

          // Save session after Worker-Instructor exchange
          await this.saveSession();

          // Check for needsCorrection after Worker review
          if (instructorResponse.needsCorrection) {
            break; // Break inner loop to handle correction in outer loop
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message?.includes('EIO')) {
        Display.error(`Terminal I/O error: ${error.message}`);
        Display.system('   This usually happens when the terminal is disconnected or stdin is redirected.');
        Display.system('   The application will now exit.');
      } else {
        Display.error(`Orchestration failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    } finally {
      this.cleanup();
    }
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Save current session state
   * Only saves Instructor messages - Worker context is not persisted
   */
  async saveSession(): Promise<void> {
    const state: SessionState = {
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      currentRound: this.currentRound,
      remainingRounds: this.remainingRounds,
      instructorMessages: this.instructor.getConversationHistory(),
      // Worker messages are NOT saved
      workDir: this.workDir,
      config: this.config,
    };

    await this.sessionManager.saveSession(state);
  }

  /**
   * Restore session from saved state
   * Only restores Instructor messages - Worker starts fresh
   */
  async restoreSession(sessionId?: string): Promise<boolean> {
    const state = await this.sessionManager.loadSession(sessionId);

    if (!state) {
      return false;
    }

    // Restore state
    this.sessionId = state.sessionId;
    this.currentRound = state.currentRound;
    this.remainingRounds = state.remainingRounds;
    this.workDir = state.workDir;

    // Restore only Instructor conversation history
    this.instructor.restoreConversationHistory(state.instructorMessages);

    // Worker starts with empty history (not persisted)
    // Instructor will need to re-explain task context to Worker

    // Mark as restored session
    this.isRestoredSession = true;

    return true;
  }

  /**
   * List all available sessions
   */
  async listSessions() {
    return await this.sessionManager.listSessions();
  }
}
