import fs from 'fs/promises';
import path from 'path';
import type { SessionCheckpoint } from '../types/session';

export class FileCheckpointer {
  private checkpointsDir: string;
  private checkpoints: Map<string, SessionCheckpoint> = new Map();

  constructor(sessionDir: string) {
    this.checkpointsDir = path.join(sessionDir, 'checkpoints');
  }

  async createCheckpoint(files: Array<{ path: string; content: string; operation: string }>): Promise<string> {
    const checkpointId = `cp_${Date.now()}`;
    const checkpoint: SessionCheckpoint = {
      id: checkpointId,
      timestamp: new Date().toISOString(),
      files: files.map(file => ({
        path: file.path,
        content: file.content,
        operation: file.operation as 'create' | 'modify' | 'delete'
      }))
    };

    await fs.mkdir(this.checkpointsDir, { recursive: true });
    await fs.writeFile(
      path.join(this.checkpointsDir, `${checkpointId}.json`),
      JSON.stringify(checkpoint, null, 2)
    );

    this.checkpoints.set(checkpointId, checkpoint);
    return checkpointId;
  }

  async rewind(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    for (const file of checkpoint.files) {
      if (file.operation === 'delete') {
        await fs.writeFile(file.path, file.content);
      } else if (file.operation === 'create') {
        await fs.unlink(file.path).catch(() => {});
      } else {
        await fs.writeFile(file.path, file.content);
      }
    }
  }
}
