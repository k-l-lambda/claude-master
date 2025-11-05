import { Config, InstanceType } from './types.js';
import { InstructorManager } from './instructor.js';
import { WorkerManager } from './worker.js';
import { Display } from './display.js';

export class Orchestrator {
  private instructor: InstructorManager;
  private worker: WorkerManager;
  private config: Config;
  private currentRound: number = 0;
  private userInstruction: string;

  constructor(config: Config, userInstruction: string) {
    this.config = config;
    this.userInstruction = userInstruction;
    this.instructor = new InstructorManager(config, userInstruction);
    this.worker = new WorkerManager(config);
  }

  async run(): Promise<void> {
    Display.info(`Starting dual-AI orchestration system`);
    Display.info(`Instructor Model: ${this.config.instructorModel}`);
    Display.info(`Worker Default Model: ${this.config.workerModel}`);
    if (this.config.maxRounds) {
      Display.info(`Max Rounds: ${this.config.maxRounds}`);
    }
    Display.newline();

    try {
      // Initial instruction to Instructor
      this.currentRound = 1;
      Display.round(this.currentRound, this.config.maxRounds);

      Display.header(InstanceType.INSTRUCTOR, 'Processing Initial Instruction');
      Display.system('User Instruction: ' + this.userInstruction);

      let thinkingBuffer = '';
      let textBuffer = '';

      // Send a simple prompt to start the Instructor thinking
      const instructorResponse = await this.instructor.processUserInput(
        "Start working on the task.",
        (chunk) => {
          if (thinkingBuffer === '') {
            Display.newline();
            Display.system('Thinking...');
          }
          thinkingBuffer += chunk;
          Display.thinking(chunk);
        },
        (chunk) => {
          if (thinkingBuffer && textBuffer === '') {
            Display.newline();
            Display.system('Response:');
          }
          textBuffer += chunk;
          Display.text(InstanceType.INSTRUCTOR, chunk);
        }
      );

      Display.newline();

      if (!instructorResponse.shouldContinue) {
        Display.success('Instructor has finished the task');
        return;
      }

      // Main conversation loop
      let continueConversation = true;
      let currentWorkerModel = instructorResponse.workerModel || this.config.workerModel;

      while (continueConversation) {
        // Check round limit
        if (this.config.maxRounds && this.currentRound > this.config.maxRounds) {
          Display.error(`Maximum rounds (${this.config.maxRounds}) reached. Stopping.`);
          break;
        }

        // Worker processes instruction
        Display.header(InstanceType.WORKER, `Processing Instruction (Model: ${currentWorkerModel})`);
        Display.system('Instruction from Instructor:');
        console.log(instructorResponse.instruction);
        Display.newline();

        let workerTextBuffer = '';
        const workerResponse = await this.worker.processInstruction(
          instructorResponse.instruction,
          currentWorkerModel,
          (chunk) => {
            if (workerTextBuffer === '') {
              Display.system('Response:');
            }
            workerTextBuffer += chunk;
            Display.text(InstanceType.WORKER, chunk);
          }
        );

        Display.newline();

        // Instructor reviews worker response
        this.currentRound++;
        Display.round(this.currentRound, this.config.maxRounds);
        Display.header(InstanceType.INSTRUCTOR, 'Reviewing Worker Response');

        thinkingBuffer = '';
        textBuffer = '';

        const nextInstructorResponse = await this.instructor.processWorkerResponse(
          workerResponse,
          (chunk) => {
            if (thinkingBuffer === '') {
              Display.newline();
              Display.system('Thinking...');
            }
            thinkingBuffer += chunk;
            Display.thinking(chunk);
          },
          (chunk) => {
            if (thinkingBuffer && textBuffer === '') {
              Display.newline();
              Display.system('Response:');
            }
            textBuffer += chunk;
            Display.text(InstanceType.INSTRUCTOR, chunk);
          }
        );

        Display.newline();

        continueConversation = nextInstructorResponse.shouldContinue;
        instructorResponse.instruction = nextInstructorResponse.instruction;
        instructorResponse.workerModel = nextInstructorResponse.workerModel;
        instructorResponse.shouldContinue = nextInstructorResponse.shouldContinue;
        currentWorkerModel = nextInstructorResponse.workerModel || this.config.workerModel;

        if (!continueConversation) {
          Display.success('Instructor has completed the task');
          break;
        }
      }

    } catch (error) {
      Display.error(`Orchestration failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  getCurrentRound(): number {
    return this.currentRound;
  }
}
