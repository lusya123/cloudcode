export class CommandFilter {
  private readonly dangerousPatterns: RegExp[] = [
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
    /:(){:|:&};:/,
    /curl\s+.*\|\s*sh/,
    /wget\s+.*\|\s*sh/
  ];

  isDangerous(command: string): boolean {
    return this.dangerousPatterns.some((pattern) => pattern.test(command));
  }
}
