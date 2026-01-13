/**
 * Path Validator for CloudClaude
 * Ensures file access is limited to allowed directories
 */

import * as path from 'path';
import { Logger } from '../utils/logger';

const logger = new Logger('PathValidator');

export class PathValidator {
    private workingDir: string;
    private allowedPaths: string[];

    constructor(workingDir: string, allowedPaths: string[] = []) {
        this.workingDir = path.resolve(workingDir);
        this.allowedPaths = allowedPaths.map(p => path.resolve(p));
    }

    /**
     * Validate if path is allowed for access
     */
    isAllowed(targetPath: string): boolean {
        const resolved = path.resolve(targetPath);

        // Check if within working directory
        if (resolved.startsWith(this.workingDir + path.sep) || resolved === this.workingDir) {
            return true;
        }

        // Check if in allowed paths list
        for (const allowed of this.allowedPaths) {
            if (resolved.startsWith(allowed + path.sep) || resolved === allowed) {
                return true;
            }
        }

        logger.warn(`Path access denied: ${resolved}`);
        return false;
    }

    /**
     * Validate path and throw if not allowed
     */
    validate(targetPath: string): void {
        if (!this.isAllowed(targetPath)) {
            throw new Error(`Access denied: ${targetPath} is outside allowed directories`);
        }
    }

    /**
     * Resolve path relative to working directory
     */
    resolvePath(targetPath: string): string {
        if (path.isAbsolute(targetPath)) {
            return targetPath;
        }
        return path.join(this.workingDir, targetPath);
    }

    /**
     * Add allowed path
     */
    addAllowedPath(allowedPath: string): void {
        const resolved = path.resolve(allowedPath);
        if (!this.allowedPaths.includes(resolved)) {
            this.allowedPaths.push(resolved);
            logger.info(`Added allowed path: ${resolved}`);
        }
    }

    /**
     * Get working directory
     */
    getWorkingDir(): string {
        return this.workingDir;
    }

    /**
     * Update working directory
     */
    setWorkingDir(newWorkingDir: string): void {
        this.workingDir = path.resolve(newWorkingDir);
        logger.info(`Working directory changed to: ${this.workingDir}`);
    }
}
