import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { SessionState } from './types.js';
import { randomUUID } from 'crypto';

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
   * Save session state incrementally (append-only)
   * Uses JSONL format inspired by claude-code-cli
   */
  async saveSession(state: SessionState): Promise<string> {
    await this.ensureSessionDir();

    const filename = `session-${state.sessionId}.jsonl`;
    const filepath = path.join(this.sessionDir, filename);

    // Append session state as a single JSON line
    const entry = {
      type: 'session-state',
      timestamp: new Date().toISOString(),
      ...state,
    };

    // Append to JSONL file (create if doesn't exist)
    await fs.appendFile(filepath, JSON.stringify(entry) + '\n', { mode: 0o600 });

    // Update current.json to point to latest session
    const currentPath = path.join(this.sessionDir, 'current.json');
    await fs.writeFile(currentPath, JSON.stringify({ sessionId: state.sessionId }, null, 2), { mode: 0o600 });

    return filepath;
  }

  /**
   * Load session from JSONL file
   * Reads all lines and uses the last session-state entry
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

      // Read JSONL file and get the last session-state entry
      const content = await fs.readFile(filepath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim().length > 0);

      let lastState: SessionState | null = null;
      for (const line of lines) {
        const entry = JSON.parse(line);
        if (entry.type === 'session-state') {
          // Remove the type field before casting to SessionState
          const { type, timestamp, ...stateData } = entry;
          lastState = stateData as SessionState;
        }
      }

      return lastState;
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

            if (lines.length > 0) {
              const firstEntry = JSON.parse(lines[0]);
              const lastEntry = JSON.parse(lines[lines.length - 1]);

              sessions.push({
                sessionId,
                createdAt: firstEntry.createdAt || firstEntry.timestamp,
                lastUpdatedAt: lastEntry.lastUpdatedAt || lastEntry.timestamp,
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

      let latestSession: { sessionId: string; lastUpdatedAt: string; workDir: string } | null = null;
      let latestTime = 0;

      for (const file of files) {
        if (file.startsWith('session-') && file.endsWith('.jsonl')) {
          try {
            const sessionId = file.replace('session-', '').replace('.jsonl', '');
            const filepath = path.join(this.sessionDir, file);
            const content = await fs.readFile(filepath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim().length > 0);

            if (lines.length > 0) {
              const lastEntry = JSON.parse(lines[lines.length - 1]);

              // Check if this session belongs to the target workDir
              if (lastEntry.workDir === workDir) {
                const lastUpdatedTime = new Date(lastEntry.lastUpdatedAt || lastEntry.timestamp).getTime();

                if (lastUpdatedTime > latestTime) {
                  latestTime = lastUpdatedTime;
                  latestSession = {
                    sessionId,
                    lastUpdatedAt: lastEntry.lastUpdatedAt || lastEntry.timestamp,
                    workDir: lastEntry.workDir,
                  };
                }
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
