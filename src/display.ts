import chalk from 'chalk';
import { InstanceType } from './types.js';

export class Display {
  private static readonly SEPARATOR = '─'.repeat(80);
  private static readonly INSTRUCTOR_COLOR = chalk.blue;
  private static readonly WORKER_COLOR = chalk.green;
  private static readonly THINKING_COLOR = chalk.gray;
  private static readonly SYSTEM_COLOR = chalk.yellow;

  static header(instance: InstanceType, label: string): void {
    const color = instance === InstanceType.INSTRUCTOR
      ? this.INSTRUCTOR_COLOR
      : this.WORKER_COLOR;

    console.log('\n' + color(this.SEPARATOR));
    console.log(color.bold(`[${instance}] ${label}`));
    console.log(color(this.SEPARATOR));
  }

  static thinking(text: string): void {
    process.stdout.write(this.THINKING_COLOR(text));
  }

  static text(instance: InstanceType, text: string): void {
    const color = instance === InstanceType.INSTRUCTOR
      ? this.INSTRUCTOR_COLOR
      : this.WORKER_COLOR;
    process.stdout.write(color(text));
  }

  static system(message: string): void {
    console.log('\n' + this.SYSTEM_COLOR('│ ' + message));
  }

  static round(current: number, remainingOrMax?: number | string): void {
    let suffix = '';
    if (typeof remainingOrMax === 'number') {
      suffix = ` (${remainingOrMax} left)`;
    } else if (typeof remainingOrMax === 'string') {
      suffix = ` ${remainingOrMax}`;
    }
    console.log('\n' + this.SYSTEM_COLOR(`╭─ Round ${current}${suffix} ─╮`));
  }

  static error(message: string): void {
    console.error('\n' + chalk.red.bold('ERROR: ') + chalk.red(message));
  }

  static warning(message: string): void {
    console.log('\n' + chalk.yellow.bold('⚠ ') + chalk.yellow(message));
  }

  static success(message: string): void {
    console.log('\n' + chalk.green.bold('✓ ') + chalk.green(message));
  }

  static info(message: string): void {
    console.log('\n' + chalk.cyan('ℹ ') + message);
  }

  static divider(): void {
    console.log(chalk.dim('─'.repeat(80)));
  }

  static newline(): void {
    console.log();
  }

  static truncate(text: string, maxLength: number = 300): string {
    if (text.length <= maxLength) {
      return text;
    }

    const headLength = Math.floor(maxLength * 0.4);
    const tailLength = Math.floor(maxLength * 0.4);
    const head = text.substring(0, headLength);
    const tail = text.substring(text.length - tailLength);

    return `${head}\n... [${text.length - headLength - tailLength} characters omitted] ...\n${tail}`;
  }

  // ===== Debug Status Display =====

  /**
   * Print Instructor response status for debugging
   */
  static instructorStatus(workerModel: string, shouldContinue: boolean, needsCorrection: boolean): void {
    // Model emoji
    let modelEmoji = '🚀'; // default sonnet
    if (workerModel.includes('opus')) {
      modelEmoji = '🧠'; // Opus - powerful brain
    } else if (workerModel.includes('haiku')) {
      modelEmoji = '⚡'; // Haiku - fast lightning
    } else if (workerModel.includes('sonnet')) {
      modelEmoji = '🚀'; // Sonnet - balanced rocket
    }

    // Continue emoji
    const continueEmoji = shouldContinue ? '▶️ ' : '⏹️ ';

    // Correction emoji
    const correctionEmoji = needsCorrection ? '⚠️ ' : '✅';

    // Model short name
    const modelName = this.getModelShortName(workerModel);

    console.log(chalk.dim(`[Status] ${modelEmoji} ${modelName} | ${continueEmoji} ${shouldContinue ? 'Continue' : 'Stop'} | ${correctionEmoji} ${needsCorrection ? 'Needs correction' : 'OK'}`));
  }

  private static getModelShortName(model: string): string {
    if (model.includes('opus')) return 'Opus';
    if (model.includes('haiku')) return 'Haiku';
    if (model.includes('sonnet')) return 'Sonnet';
    return model;
  }
}
