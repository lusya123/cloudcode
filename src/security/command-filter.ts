export class CommandFilter {
  private dangerousPatterns = [
    /rm\s+(-rf?|--recursive)\s+[\/~]/,
    /dd\s+if=/,
    /mkfs\./,
    /fdisk/,
    /parted/,
    /sudo\s+su/,
    /chmod\s+777/,
    /chown\s+root/,
    /nmap/,
    /netcat|nc\s+-/,
    /shutdown/,
    /reboot/,
    /init\s+0/,
    /systemctl\s+(stop|disable)\s+(ssh|sshd|network)/,
    /:\(\)\s*{\s*:\|:&\s*}\s*;/,
    /cat\s+\/etc\/(shadow|passwd)/,
    /base64.*\/etc/
  ];

  isSafe(command: string): { safe: boolean; reason?: string } {
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          safe: false,
          reason: `Command matches dangerous pattern: ${pattern}`
        };
      }
    }
    return { safe: true };
  }
}
