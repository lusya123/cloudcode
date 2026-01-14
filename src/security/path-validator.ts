import path from 'path';

export class PathValidator {
  private workingDir: string;
  private allowedPaths: string[];

  constructor(workingDir: string, allowedPaths: string[] = []) {
    this.workingDir = path.resolve(workingDir);
    this.allowedPaths = allowedPaths.map(p => path.resolve(p));
  }

  isAllowed(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);

    if (resolved.startsWith(this.workingDir)) {
      return true;
    }

    for (const allowed of this.allowedPaths) {
      if (resolved.startsWith(allowed)) {
        return true;
      }
    }

    return false;
  }
}
