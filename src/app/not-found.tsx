import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-zinc-200 px-6 py-12 text-center dark:border-zinc-800">
      <p className="text-sm font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        404
      </p>
      <h2 className="mt-2 text-base font-medium text-zinc-900 dark:text-zinc-50">
        Page not found
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/opportunities"
        className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Back to workspace
      </Link>
    </div>
  );
}
