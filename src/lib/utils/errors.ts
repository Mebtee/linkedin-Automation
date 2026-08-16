export type AppErrorOptions = {
  code?: string;
  cause?: unknown;
};

/**
 * Application-level error with an optional machine-readable code.
 * Used across the service layer for consistent error handling.
 */
export class AppError extends Error {
  readonly code?: string;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = options.code;
  }
}
