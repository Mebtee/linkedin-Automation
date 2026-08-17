type TopicCardProps = {
  dayNumber: number;
  topic: string;
  content: string | null;
  subtopics: string[] | null;
  label: string;
  muted?: boolean;
};

export function TopicCard({ dayNumber, topic, content, subtopics, label, muted }: TopicCardProps) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        muted
          ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
          : "border-[#2563EB]/20 bg-[#2563EB]/5 dark:border-[#2563EB]/30 dark:bg-[#2563EB]/10"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            muted
              ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              : "bg-[#2563EB] text-white"
          }`}
        >
          Day {dayNumber}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
      <h3 className="text-lg font-semibold text-[#111827] dark:text-zinc-50">{topic}</h3>
      {content && (
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {content}
        </p>
      )}
      {subtopics && subtopics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {subtopics.map((sub) => (
            <span
              key={sub}
              className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {sub}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
