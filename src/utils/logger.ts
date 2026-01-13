/**
 * Winston Logger for CloudClaude
 */

import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, context }) => {
    const contextStr = context ? ` [${context}]` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} ${level}${contextStr}: ${message}${stackStr}`;
});

// Create logger instance
const createLogger = (logDir: string = 'logs') => {
    return winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: combine(
            errors({ stack: true }),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            logFormat
        ),
        defaultMeta: { service: 'cloud-claude' },
        transports: [
            // Console transport with colors
            new winston.transports.Console({
                format: combine(
                    colorize(),
                    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                    logFormat
                )
            }),
            // File transport for all logs
            new winston.transports.File({
                filename: path.join(logDir, 'combined.log'),
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5
            }),
            // File transport for errors only
            new winston.transports.File({
                filename: path.join(logDir, 'error.log'),
                level: 'error',
                maxsize: 10 * 1024 * 1024,
                maxFiles: 5
            })
        ]
    });
};

// Default logger instance
const defaultLogger = createLogger();

/**
 * Logger class with context support
 */
export class Logger {
    private context: string;
    private logger: winston.Logger;

    constructor(context: string, logger?: winston.Logger) {
        this.context = context;
        this.logger = logger || defaultLogger;
    }

    info(message: string, meta?: object): void {
        this.logger.info(message, { context: this.context, ...meta });
    }

    warn(message: string, meta?: object): void {
        this.logger.warn(message, { context: this.context, ...meta });
    }

    error(message: string, error?: Error | object): void {
        if (error instanceof Error) {
            this.logger.error(message, { context: this.context, stack: error.stack });
        } else {
            this.logger.error(message, { context: this.context, ...error });
        }
    }

    debug(message: string, meta?: object): void {
        this.logger.debug(message, { context: this.context, ...meta });
    }

    verbose(message: string, meta?: object): void {
        this.logger.verbose(message, { context: this.context, ...meta });
    }
}

// Export default logger and factory
export { createLogger, defaultLogger };
export default defaultLogger;
