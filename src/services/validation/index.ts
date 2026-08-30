import { AppError } from "@/lib/utils/errors";

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
