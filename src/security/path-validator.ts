import * as path from 'path';
import * as fs from 'fs';

export class PathValidator {
  private allowedRoots: string[];

  constructor(workingDir: string, extraRoots: string[] = []) {
    this.allowedRoots = [workingDir, ...extraRoots].map((root) => path.resolve(root));
  }

  isPathAllowed(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const existingPath = this.resolveExistingPath(resolvedPath);

    return this.allowedRoots.some((root) => existingPath.startsWith(root + path.sep) || existingPath === root);
  }

  private resolveExistingPath(candidate: string): string {
    try {
      return fs.realpathSync(candidate);
    } catch {
      return candidate;
    }
  }
}
