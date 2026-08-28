/**
 * Informational-only explanation of the recruiter content strategy.
 * Never fabricates profile information — it only restates the evidence rules
 * the pipeline already enforces.
 */
export function RecruiterStrategyPanel() {
  return (
    <section
      aria-label="Recruiter content strategy"
      className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Recruiter Content Strategy
      </h2>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        Your strongest content demonstrates work you actually did:
      </p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <li>• Projects you actually built</li>
        <li>• Problems you actually solved</li>
        <li>• Technical decisions you actually made</li>
        <li>• Security/authentication work you actually completed</li>
        <li>• Lessons backed by real evidence</li>
      </ul>
      <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Avoid:
      </p>
      <ul className="mt-1 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
        <li>• Generic motivational posts</li>
        <li>• Unsupported expertise claims</li>
        <li>• Fake project experience</li>
        <li>
          • “I mastered...” claims (flagged by the quality review)
        </li>
        <li>• Course descriptions presented as personal experience</li>
      </ul>
    </section>
  );
}