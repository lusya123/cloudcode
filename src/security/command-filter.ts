/**
 * Command Filter for CloudClaude
 * Intercepts dangerous shell commands
 */

import { Logger } from '../utils/logger';

const logger = new Logger('CommandFilter');

export interface CommandCheckResult {
    safe: boolean;
    reason?: string;
}

export class CommandFilter {
    private dangerousPatterns: RegExp[] = [
        // System destruction
        /rm\s+(-rf?|--recursive)\s+[\/~]/,
        /dd\s+if=/,
        /mkfs\./,
        /fdisk/,
        /parted/,

        // Privilege escalation
        /sudo\s+su/,
        /chmod\s+777/,
        /chown\s+root/,

        // Network attacks
        /nmap/,
        /netcat|nc\s+-/,

        // System control
        /shutdown/,
        /reboot/,
        /init\s+0/,
        /systemctl\s+(stop|disable)\s+(ssh|sshd|network)/,

        // Fork bomb
        /:\(\)\s*{\s*:\|:&\s*}\s*;/,

        // Sensitive file access
        /cat\s+\/etc\/(shadow|passwd)/,
        /base64.*\/etc/,

        // Disk operations
        />(\/dev\/sd|\/dev\/hd)/,

        // Process killing (system processes)
        /kill\s+-9\s+1$/,
        /killall\s+init/,
    ];

    // Additional blocked command prefixes
    private blockedPrefixes: string[] = [
        'rm -rf /',
        'rm -rf ~',
        'rm -rf /*',
        ':(){',
        '> /dev/sda',
        'dd if=/dev/zero',
        'wget -O- | sh',
        'curl | sh',
        'curl | bash',
    ];

    /**
     * Check if command is safe to execute
     */
    isSafe(command: string): CommandCheckResult {
        const trimmedCommand = command.trim();

        // Check blocked prefixes
        for (const prefix of this.blockedPrefixes) {
            if (trimmedCommand.startsWith(prefix)) {
                logger.warn(`Blocked command prefix: ${prefix}`);
                return {
                    safe: false,
                    reason: `Command starts with blocked prefix: ${prefix}`
                };
            }
        }

        // Check dangerous patterns
        for (const pattern of this.dangerousPatterns) {
            if (pattern.test(command)) {
                logger.warn(`Dangerous pattern detected: ${pattern}`);
                return {
                    safe: false,
                    reason: `Command matches dangerous pattern: ${pattern}`
                };
            }
        }

        return { safe: true };
    }

    /**
     * Add custom dangerous pattern
     */
    addPattern(pattern: RegExp): void {
        this.dangerousPatterns.push(pattern);
        logger.info(`Added dangerous pattern: ${pattern}`);
    }

    /**
     * Add blocked prefix
     */
    addBlockedPrefix(prefix: string): void {
        this.blockedPrefixes.push(prefix);
        logger.info(`Added blocked prefix: ${prefix}`);
    }
}

// Default instance
export const commandFilter = new CommandFilter();
