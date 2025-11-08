import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { SessionState, Message } from './types.js';
import { randomUUID } from 'crypto';

// Track last saved message counts to implement incremental saves
const lastSavedCounts = new Map<string, { instructor: number; worker: number }>();

export class SessionManager {
  private sessionDir: string;

  constructor(baseDir: string = '.claude-master/sessions') {
    this.sessionDir = baseDir;
  }

  async ensureSessionDir(): Promise<void> {
    try {
      await fs.mkdir(this.sessionDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      // Directory might already exist
    }
  }

  generateSessionId(): string {
    return randomUUID();
  }

  /**
   * Save session state incrementally (append-only JSONL)
   * Only appends NEW messages since last save
   */
  async saveSession(state: SessionState): Promise<string> {
    await this.ensureSessionDir();

    const filename = `session-${state.sessionId}.jsonl`;
    const filepath = path.join(this.sessionDir, filename);

    // Get last saved counts for this session
    const lastCounts = lastSavedCounts.get(state.sessionId) || { instructor: 0, worker: 0 };

    // Determine which messages are new
    const newInstructorMessages = state.instructorMessages.slice(lastCounts.instructor);
    const newWorkerMessages = state.workerMessages.slice(lastCounts.worker);

    // Prepare entries to append
    const entries: string[] = [];

    // Append new instructor messages
    for (const msg of newInstructorMessages) {
      entries.push(JSON.stringify({
        type: 'instructor-message',
        timestamp: new Date().toISOString(),
        message: msg,
      }));
    }

    // Append new worker messages
    for (const msg of newWorkerMessages) {
      entries.push(JSON.stringify({
        type: 'worker-message',
        timestamp: new Date().toISOString(),
        message: msg,
      }));
    }

    // Append session metadata (always save current state)
    entries.push(JSON.stringify({
      type: 'session-metadata',
      timestamp: new Date().toISOString(),
      sessionId: state.sessionId,
      createdAt: state.createdAt,
      lastUpdatedAt: state.lastUpdatedAt,
      currentRound: state.currentRound,
      remainingRounds: state.remainingRounds,
      workDir: state.workDir,
      config: state.config,
    }));

    // Append all entries to file
    if (entries.length > 0) {
      await fs.appendFile(filepath, entries.join('\n') + '\n', { mode: 0o600 });
    }

    // Update last saved counts
    lastSavedCounts.set(state.sessionId, {
      instructor: state.instructorMessages.length,
      worker: state.workerMessages.length,
    });

    // Update current.json to point to latest session
    const currentPath = path.join(this.sessionDir, 'current.json');
    await fs.writeFile(currentPath, JSON.stringify({ sessionId: state.sessionId }, null, 2), { mode: 0o600 });

    return filepath;
  }

  /**
   * Load session from JSONL file (reconstruct state from incremental entries)
   */
  async loadSession(sessionId?: string): Promise<SessionState | null> {
    try {
      let filepath: string;

      if (!sessionId) {
        // Load from current.json
        const currentPath = path.join(this.sessionDir, 'current.json');
        const currentContent = await fs.readFile(currentPath, 'utf-8');
        const current = JSON.parse(currentContent);
        sessionId = current.sessionId;
        filepath = path.join(this.sessionDir, `session-${sessionId}.jsonl`);
      } else {
        filepath = path.join(this.sessionDir, `session-${sessionId}.jsonl`);
      }

      const content = await fs.readFile(filepath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      // Reconstruct state from entries
      const instructorMessages: Message[] = [];
      const workerMessages: Message[] = [];
      let metadata: any = null;

      for (const line of lines) {
        const entry = JSON.parse(line);

        if (entry.type === 'instructor-message') {
          instructorMessages.push(entry.message);
        } else if (entry.type === 'worker-message') {
          workerMessages.push(entry.message);
        } else if (entry.type === 'session-metadata') {
          // Keep updating with latest metadata
          metadata = entry;
        }
      }

      if (!metadata) {
        return null;
      }

      // Reconstruct SessionState
      const state: SessionState = {
        sessionId: metadata.sessionId,
        createdAt: metadata.createdAt,
        lastUpdatedAt: metadata.lastUpdatedAt,
        currentRound: metadata.currentRound,
        remainingRounds: metadata.remainingRounds,
        instructorMessages,
        workerMessages,
        workDir: metadata.workDir,
        config: metadata.config,
      };

      // Update last saved counts after loading
      lastSavedCounts.set(state.sessionId, {
        instructor: instructorMessages.length,
        worker: workerMessages.length,
      });

      return state;
    } catch (error) {
      return null;
    }
  }

  /**
   * List all sessions with metadata
   */
  async listSessions(): Promise<Array<{ sessionId: string; lastUpdatedAt: string; createdAt: string }>> {
    try {
      await this.ensureSessionDir();
      const files = await fs.readdir(this.sessionDir);
      const sessions: Array<{ sessionId: string; lastUpdatedAt: string; createdAt: string }> = [];

      for (const file of files) {
        if (file.startsWith('session-') && file.endsWith('.jsonl')) {
          try {
            const sessionId = file.replace('session-', '').replace('.jsonl', '');
            const filepath = path.join(this.sessionDir, file);
            const content = await fs.readFile(filepath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim().length > 0);

            // Find first and last metadata entries
            let firstMetadata: any = null;
            let lastMetadata: any = null;

            for (const line of lines) {
              const entry = JSON.parse(line);
              if (entry.type === 'session-metadata') {
                if (!firstMetadata) firstMetadata = entry;
                lastMetadata = entry;
              }
            }

            if (lastMetadata) {
              sessions.push({
                sessionId,
                createdAt: firstMetadata?.createdAt || lastMetadata.createdAt,
                lastUpdatedAt: lastMetadata.lastUpdatedAt,
              });
            }
          } catch (error) {
            // Skip invalid files
          }
        }
      }

      // Sort by last updated time (newest first)
      return sessions.sort((a, b) =>
        new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get the most recent session for a specific working directory
   */
  async getLatestSessionByWorkDir(workDir: string): Promise<{ sessionId: string; lastUpdatedAt: string } | null> {
    try {
      await this.ensureSessionDir();
      const files = await fs.readdir(this.sessionDir);

      let latestSession: { sessionId: string; lastUpdatedAt: string } | null = null;
      let latestTime = 0;

      for (const file of files) {
        if (file.startsWith('session-') && file.endsWith('.jsonl')) {
          try {
            const sessionId = file.replace('session-', '').replace('.jsonl', '');
            const filepath = path.join(this.sessionDir, file);
            const content = await fs.readFile(filepath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim().length > 0);

            // Find last metadata entry
            let lastMetadata: any = null;
            for (const line of lines) {
              const entry = JSON.parse(line);
              if (entry.type === 'session-metadata') {
                lastMetadata = entry;
              }
            }

            // Check if this session belongs to the target workDir
            if (lastMetadata && lastMetadata.workDir === workDir) {
              const lastUpdatedTime = new Date(lastMetadata.lastUpdatedAt).getTime();

              if (lastUpdatedTime > latestTime) {
                latestTime = lastUpdatedTime;
                latestSession = {
                  sessionId,
                  lastUpdatedAt: lastMetadata.lastUpdatedAt,
                };
              }
            }
          } catch (error) {
            // Skip invalid files
          }
        }
      }

      return latestSession;
    } catch (error) {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const filepath = path.join(this.sessionDir, `session-${sessionId}.jsonl`);
      await fs.unlink(filepath);

      // Clear cached counts
      lastSavedCounts.delete(sessionId);

      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanOldSessions(days: number = 30): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const sessions = await this.listSessions();
    let deleted = 0;

    for (const session of sessions) {
      if (new Date(session.lastUpdatedAt).getTime() < cutoff) {
        const success = await this.deleteSession(session.sessionId);
        if (success) deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if a session ID already exists
   */
  sessionExists(sessionId: string): boolean {
    const filepath = path.join(this.sessionDir, `session-${sessionId}.jsonl`);
    try {
      fsSync.statSync(filepath);
      return true;
    } catch {
      return false;
    }
  }
}
