"use client";

import { useId } from "react";

type TextareaFieldProps = {
  id: string;
  label: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
};

const MAX_LENGTH = 5000;

export function TextareaField({
  id,
  label,
  helperText,
  value,
  onChange,
  placeholder,
  maxLength = MAX_LENGTH,
  rows = 4,
  required,
  disabled,
}: TextareaFieldProps) {
  const reactId = useId();
  const helperId = helperText ? `${id}-helper-${reactId}` : undefined;
  const countId = `${id}-count-${reactId}`;

  const count = value.length;
  const describedBy = [helperId, count > 0 ? countId : undefined]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {helperText && (
        <p id={helperId} className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {helperText}
        </p>
      )}
      <div className="relative mt-1.5">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          disabled={disabled}
          aria-describedby={describedBy}
          className="block w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
        {count > 0 && (
          <span
            id={countId}
            className={`absolute bottom-2 right-2 text-xs tabular-nums ${
              count > maxLength * 0.9
                ? "text-amber-600 dark:text-amber-400"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
            aria-live="polite"
          >
            {count.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
