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

  /**
   * Get emoji for model type
   */
  private static getModelEmoji(model: string): string {
    if (model.includes('opus')) return '🧠'; // Opus - powerful brain
    if (model.includes('haiku')) return '⚡'; // Haiku - fast lightning
    if (model.includes('sonnet')) return '🚀'; // Sonnet - balanced rocket
    return '🤖'; // Default
  }

  /**
   * Get emoji for display mode
   */
  private static getModeEmoji(mode: string): string {
    if (mode.includes('reset') || mode.includes('call_worker')) return '🔄'; // Reset/fresh start
    if (mode.includes('continue') || mode.includes('tell_worker')) return '💬'; // Continue conversation
    return '🔧'; // Default tool
  }

  /**
   * Display Worker header with model and mode emojis
   */
  static workerHeader(label: string, model: string, mode: string): void {
    const color = this.WORKER_COLOR;
    const modelEmoji = this.getModelEmoji(model);
    const modeEmoji = this.getModeEmoji(mode);

    console.log('\n' + color(this.SEPARATOR));
    console.log(color.bold(`[WORKER] ${modeEmoji} ${label} ${modelEmoji}`));
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
  static instructorStatus(shouldContinue: boolean, needsCorrection: boolean, tokenCount?: number): void {
    // Continue emoji
    const continueEmoji = shouldContinue ? '▶️ ' : '⏹️ ';

    // Correction emoji
    const correctionEmoji = needsCorrection ? '⚠️ ' : '✅';

    // Token info
    const tokenInfo = tokenCount !== undefined
      ? ` | 📊 ${tokenCount.toLocaleString()} tokens`
      : '';

    console.log(chalk.dim(`[Status] ${continueEmoji} ${shouldContinue ? 'Continue' : 'Stop'} | ${correctionEmoji} ${needsCorrection ? 'Needs correction' : 'OK'}${tokenInfo}`));
  }
}
