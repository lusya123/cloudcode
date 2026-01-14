import * as path from 'path';
import * as fs from 'fs/promises';

export class FileCheckpointer {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async snapshotIfExists(sessionId: string | undefined, filePath: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    try {
      await fs.access(filePath);
    } catch {
      return;
    }

    const checkpointsDir = path.join(this.dataDir, 'sessions', sessionId, 'checkpoints');
    await fs.mkdir(checkpointsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const snapshotPath = path.join(checkpointsDir, `${timestamp}-${fileName}`);

    await fs.copyFile(filePath, snapshotPath);
  }
}
