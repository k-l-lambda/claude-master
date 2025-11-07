import { Config, InstanceType } from './types.js';
import { InstructorManager } from './instructor.js';
import { WorkerManager } from './worker.js';
import { Display } from './display.js';
import * as readline from 'readline';

export class Orchestrator {
  private instructor: InstructorManager;
  private worker: WorkerManager;
  private config: Config;
  private currentRound: number = 0;
  private paused: boolean = false;
  private interrupted: boolean = false;
  private currentAbortController: AbortController | null = null;
  private rl: readline.Interface;

  constructor(config: Config, workDir: string) {
    this.config = config;
    this.instructor = new InstructorManager(config, '', workDir);
    this.worker = new WorkerManager(config, workDir);
    this.instructor.setWorkerToolExecutor(this.worker.getToolExecutor());

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

    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch (error) {
        // Ignore
      }
    }

    const userInput = await new Promise<string>((resolve) => {
      this.rl.question('Input your instruction:\n> ', (answer) => {
        resolve(answer);
      });
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
        response.workerModel || this.config.workerModel,
        response.shouldContinue,
        response.needsCorrection || false
      );

      if (this.interrupted) {
        this.paused = false;
        return null;
      }

      return response;
    } catch (error: any) {
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

    Display.warning('⚠️  Instructor did not use the correct communication format.');
    Display.system('   To communicate with Worker, use: "Tell worker: [instruction]"');
    Display.system('   To finish the task, respond with: "DONE"');
    Display.newline();

    this.currentRound++;
    Display.round(this.currentRound, this.config.maxRounds);
    Display.header(InstanceType.INSTRUCTOR, 'Please provide instruction or DONE');

    const correctedResponse = await this.callInstructor(
      'Please continue. Remember to use "Tell worker: [instruction]" to instruct the Worker, or "DONE" to finish.',
      'correction'
    );

    if (!correctedResponse) {
      return null;
    }

    if (correctedResponse.needsCorrection) {
      Display.warning('⚠️  Still no valid instruction or DONE. Returning to user input...');
      Display.newline();
      return null;
    }

    if (correctedResponse.instruction.length === 0 && correctedResponse.shouldContinue) {
      Display.warning('⚠️  No instruction to send to Worker. Returning to user input...');
      Display.newline();
      return null;
    }

    return correctedResponse;
  }

  private async callWorker(instruction: string, model: string): Promise<string> {
    Display.header(InstanceType.WORKER, `Processing Instruction (Model: ${model})`);
    Display.system('Instruction from Instructor:');
    Display.system(Display.truncate(instruction));
    Display.newline();

    let workerTextBuffer = '';
    let lastTokenTime = Date.now();
    const TIMEOUT_MS = 60000;
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

    try {
      const workerResponse = await this.worker.processInstruction(
        instruction,
        model,
        (chunk) => {
          if (this.interrupted) return;
          lastTokenTime = Date.now();
          if (workerTextBuffer === '') {
            Display.system('Response:');
          }
          workerTextBuffer += chunk;
          Display.text(InstanceType.WORKER, chunk);
        },
        this.currentAbortController.signal
      );

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
        Display.system('⏱️  Worker response timed out after 60s of inactivity');
        Display.newline();
        return workerTextBuffer ? `${workerTextBuffer} [TIMEOUT after 60s]` : '[No response received - TIMEOUT after 60s]';
      }

      throw error;
    } finally {
      this.currentAbortController = null;
    }
  }

  async run(initialInstruction?: string): Promise<void> {
    Display.info(`Starting dual-AI orchestration system`);
    Display.info(`Instructor Model: ${this.config.instructorModel}`);
    Display.info(`Worker Default Model: ${this.config.workerModel}`);
    if (this.config.maxRounds) {
      Display.info(`Max Rounds: ${this.config.maxRounds}`);
    }
    Display.info(`Press ESC to pause and give instructions`);
    Display.newline();

    try {
      let instructorResponse: any = null;
      let isFirstRun = true;

      // Main session loop
      while (true) {
        // Step 1: Get user instruction if needed
        if (!instructorResponse?.shouldContinue) {
          if (instructorResponse) {
            Display.success('Instructor has completed the current task');
          }

          const userInstruction = isFirstRun && initialInstruction
            ? initialInstruction
            : await this.waitForUserInput();

          isFirstRun = false;

          if (!userInstruction) {
            Display.info('Session ended by user');
            break;
          }

          // Step 2: Process user instruction with Instructor
          this.currentRound++;
          Display.round(this.currentRound, this.config.maxRounds);
          Display.header(InstanceType.INSTRUCTOR, 'Processing User Instruction');
          Display.system('User Instruction: ' + userInstruction);

          instructorResponse = await this.callInstructor(userInstruction, 'user-input');
          if (!instructorResponse) continue;

          // Step 3: Handle correction if needed
          instructorResponse = await this.handleNeedsCorrection(instructorResponse);
          if (!instructorResponse) continue;

          // Check if done after correction
          if (!instructorResponse.shouldContinue) continue;
        }

        // Step 4: Worker-Instructor conversation loop
        while (instructorResponse?.shouldContinue && instructorResponse?.instruction) {
          // Check round limit
          if (this.config.maxRounds && this.currentRound > this.config.maxRounds) {
            Display.error(`Maximum rounds (${this.config.maxRounds}) reached. Stopping.`);
            instructorResponse.shouldContinue = false;
            break;
          }

          // Call Worker
          let workerResponse: string;
          try {
            workerResponse = await this.callWorker(
              instructorResponse.instruction,
              instructorResponse.workerModel || this.config.workerModel
            );
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
          Display.round(this.currentRound, this.config.maxRounds);
          Display.header(InstanceType.INSTRUCTOR, 'Reviewing Worker Response');

          instructorResponse = await this.callInstructor(workerResponse, 'worker-response');
          if (!instructorResponse) break;
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
}
