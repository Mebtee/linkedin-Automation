export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-80 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
