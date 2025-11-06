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
    this.instructor = new InstructorManager(config, '', workDir); // Empty initial instruction
    this.worker = new WorkerManager(config, workDir);

    // Setup readline for user interruption
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Setup ESC key handler
    this.setupKeyHandler();
  }

  private setupKeyHandler(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.on('data', (data) => {
        // ESC key is 0x1B
        if (data[0] === 0x1B && !this.paused) {
          this.interrupted = true;
          // Abort the current streaming operation
          if (this.currentAbortController) {
            this.currentAbortController.abort();
          }
          this.handleInterrupt();
        }
      });
    }
  }

  private async handleInterrupt(): Promise<void> {
    this.paused = true;

    // Wait a bit for the streaming to stop
    await new Promise(resolve => setTimeout(resolve, 100));

    Display.newline();
    Display.system('⏸️  Execution interrupted by user (ESC pressed)');
    Display.system('   Returning to instruction input...');
    Display.newline();

    // Reset interrupted flag after handling
    this.interrupted = false;
  }

  private async waitForUserInput(): Promise<string | null> {
    Display.newline();
    Display.system('💬 Instructor is waiting for your next instruction...');
    Display.system('   Type your instruction, or type "exit" to quit.');
    Display.newline();

    // Wait a bit to avoid console output conflicts from other threads
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Temporarily disable raw mode for input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    const userInput = await new Promise<string>((resolve) => {
      this.rl.question('Input your instruction:\n> ', (answer) => {
        resolve(answer);
      });
    });

    // Re-enable raw mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const trimmed = userInput.trim();
    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      return null;
    }

    return trimmed || null;
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    this.rl.close();
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
      let continueSession = true;
      let isFirstRun = true;

      // Outer loop: keep the session alive until user exits
      while (continueSession) {
        // If no active instruction, wait for user input
        if (!instructorResponse || !instructorResponse.shouldContinue) {
          if (instructorResponse) {
            Display.success('Instructor has completed the current task');
          }

          let userInstruction: string | null;

          // Use initial instruction on first run if provided
          if (isFirstRun && initialInstruction) {
            userInstruction = initialInstruction;
            isFirstRun = false;
          } else {
            userInstruction = await this.waitForUserInput();
          }

          if (!userInstruction) {
            Display.info('Session ended by user');
            break;
          }

          // Initial instruction to Instructor
          this.currentRound++;
          Display.round(this.currentRound, this.config.maxRounds);
          Display.header(InstanceType.INSTRUCTOR, 'Processing User Instruction');
          Display.system('User Instruction: ' + userInstruction);

          let thinkingBuffer = '';
          let textBuffer = '';

          // Create AbortController for this streaming operation
          this.currentAbortController = new AbortController();

          try {
            instructorResponse = await this.instructor.processUserInput(
              userInstruction,
              (chunk) => {
                if (this.interrupted) return; // Stop processing if interrupted
                if (thinkingBuffer === '') {
                  Display.newline();
                  Display.system('Thinking...');
                }
                thinkingBuffer += chunk;
                Display.thinking(chunk);
              },
              (chunk) => {
                if (this.interrupted) return; // Stop processing if interrupted
                if (thinkingBuffer && textBuffer === '') {
                  Display.newline();
                  Display.system('Response:');
                }
                textBuffer += chunk;
                Display.text(InstanceType.INSTRUCTOR, chunk);
              },
              this.currentAbortController.signal
            );
          } catch (error: any) {
            // If aborted, treat it as an interruption
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
              // Interruption already handled
            } else {
              throw error; // Re-throw other errors
            }
          } finally {
            this.currentAbortController = null;
          }

          Display.newline();

          // If interrupted, break out and wait for new instruction
          if (this.interrupted) {
            this.paused = false;
            continue;
          }

          // If Instructor needs correction (didn't use "tell worker" or "DONE")
          if (instructorResponse.needsCorrection) {
            Display.warning('⚠️  Instructor did not use the correct communication format.');
            Display.system('   To communicate with Worker, use: "Tell worker: [instruction]"');
            Display.system('   To finish the task, respond with: "DONE"');
            Display.newline();

            // Prompt Instructor to continue with correction
            this.currentRound++;
            Display.round(this.currentRound, this.config.maxRounds);
            Display.header(InstanceType.INSTRUCTOR, 'Please provide instruction or DONE');

            let thinkingBuffer = '';
            let textBuffer = '';

            this.currentAbortController = new AbortController();

            try {
              instructorResponse = await this.instructor.processUserInput(
                'Please continue. Remember to use "Tell worker: [instruction]" to instruct the Worker, or "DONE" to finish.',
                (chunk) => {
                  if (this.interrupted) return;
                  if (thinkingBuffer === '') {
                    Display.newline();
                    Display.system('Thinking...');
                  }
                  thinkingBuffer += chunk;
                  Display.thinking(chunk);
                },
                (chunk) => {
                  if (this.interrupted) return;
                  if (thinkingBuffer && textBuffer === '') {
                    Display.newline();
                    Display.system('Response:');
                  }
                  textBuffer += chunk;
                  Display.text(InstanceType.INSTRUCTOR, chunk);
                },
                this.currentAbortController.signal
              );
            } catch (error: any) {
              if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                // Interruption already handled
              } else {
                throw error;
              }
            } finally {
              this.currentAbortController = null;
            }

            Display.newline();

            // If interrupted after correction prompt, break out
            if (this.interrupted) {
              this.paused = false;
              continue;
            }

            // After correction, re-check if we should continue
            if (!instructorResponse.shouldContinue) {
              continue;
            }
          }

          // If Instructor doesn't want to continue, loop back to wait for next user input
          if (!instructorResponse.shouldContinue) {
            continue;
          }
        }

        // Main conversation loop between Instructor and Worker
        let continueConversation = true;
        let currentWorkerModel = instructorResponse.workerModel || this.config.workerModel;

        while (continueConversation && instructorResponse.shouldContinue) {
          // Check round limit
          if (this.config.maxRounds && this.currentRound > this.config.maxRounds) {
            Display.error(`Maximum rounds (${this.config.maxRounds}) reached. Stopping.`);
            instructorResponse.shouldContinue = false;
            break;
          }

          // Worker processes instruction
          Display.header(InstanceType.WORKER, `Processing Instruction (Model: ${currentWorkerModel})`);
          Display.system('Instruction from Instructor:');
          Display.system(Display.truncate(instructorResponse.instruction));
          Display.newline();

          let workerTextBuffer = '';

          // Create AbortController for this streaming operation
          this.currentAbortController = new AbortController();

          try {
            const workerResponse = await this.worker.processInstruction(
              instructorResponse.instruction,
              currentWorkerModel,
              (chunk) => {
                if (this.interrupted) return; // Stop processing if interrupted
                if (workerTextBuffer === '') {
                  Display.system('Response:');
                }
                workerTextBuffer += chunk;
                Display.text(InstanceType.WORKER, chunk);
              },
              this.currentAbortController.signal
            );

            Display.newline();

            // If interrupted, break out of conversation loop
            if (this.interrupted) {
              this.paused = false;
              instructorResponse.shouldContinue = false;
              break;
            }

            // Instructor reviews worker response
            this.currentRound++;
            Display.round(this.currentRound, this.config.maxRounds);
            Display.header(InstanceType.INSTRUCTOR, 'Reviewing Worker Response');

            let thinkingBuffer = '';
            let textBuffer = '';

            // Create new AbortController for instructor review
            this.currentAbortController = new AbortController();

            const nextInstructorResponse = await this.instructor.processWorkerResponse(
              workerResponse,
              (chunk) => {
                if (this.interrupted) return; // Stop processing if interrupted
                if (thinkingBuffer === '') {
                  Display.newline();
                  Display.system('Thinking...');
                }
                thinkingBuffer += chunk;
                Display.thinking(chunk);
              },
              (chunk) => {
                if (this.interrupted) return; // Stop processing if interrupted
                if (thinkingBuffer && textBuffer === '') {
                  Display.newline();
                  Display.system('Response:');
                }
                textBuffer += chunk;
                Display.text(InstanceType.INSTRUCTOR, chunk);
              },
              this.currentAbortController.signal
            );

            Display.newline();

            // If interrupted, break out of conversation loop
            if (this.interrupted) {
              this.paused = false;
              instructorResponse.shouldContinue = false;
              break;
            }

            instructorResponse = nextInstructorResponse;
            currentWorkerModel = nextInstructorResponse.workerModel || this.config.workerModel;
            continueConversation = nextInstructorResponse.shouldContinue;
          } catch (error: any) {
            // If aborted, treat it as an interruption
            if (error.name === 'AbortError' || error.message?.includes('aborted')) {
              this.paused = false;
              instructorResponse.shouldContinue = false;
              break;
            } else {
              throw error; // Re-throw other errors
            }
          } finally {
            this.currentAbortController = null;
          }
        }
      }

    } catch (error) {
      Display.error(`Orchestration failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  getCurrentRound(): number {
    return this.currentRound;
  }
}
