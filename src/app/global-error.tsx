"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 px-6 py-12 text-center dark:border-zinc-800">
            <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
              Something went wrong
            </h2>
            <p className="mx-auto mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
