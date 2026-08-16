import { AppError } from "@/lib/utils/errors";

/**
 * Returns `value` when it is defined, otherwise throws an `AppError`.
 * Used by configuration and service boundaries to fail fast on missing inputs.
 */
export function assertDefined<T>(value: T | undefined, message: string, code = "INVALID_VALUE"): T {
  if (value === undefined) {
    throw new AppError(message, { code });
  }
  return value;
}

/**
 * Returns `value` when it is a non-empty string (after trimming), otherwise
 * throws an `AppError`. Prevents empty strings from being treated as valid.
 */
export function assertNonEmptyString(value: string | undefined, message: string, code = "INVALID_VALUE"): string {
  if (value === undefined || value.trim() === "") {
    throw new AppError(message, { code });
  }
  return value;
}
