import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level}] ${message}${metaString}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    new winston.transports.Console()
  ]
});

export class Logger {
  private scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    baseLogger.info(`[${this.scope}] ${message}`, meta || {});
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    baseLogger.warn(`[${this.scope}] ${message}`, meta || {});
  }

  error(message: string, meta?: Record<string, unknown>): void {
    baseLogger.error(`[${this.scope}] ${message}`, meta || {});
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    baseLogger.debug(`[${this.scope}] ${message}`, meta || {});
  }
}
