import { content } from "@/config/content";

type PostPreviewProps = {
  opening: string;
  body: string;
  takeaway: string;
  /** Projects the learner actually built (from the journal's "what I built"). */
  projects?: string;
  hashtags: string[];
  /** When provided and not "published", Preview shows the "Draft — Not Published" badge. */
  status?: string;
};

export function PostPreview({
  opening,
  body,
  takeaway,
  projects,
  hashtags,
  status,
}: PostPreviewProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Preview
        </h3>
        {status && status !== "published" && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Draft — Not Published
          </span>
        )}
      </div>
      <div className="mt-3 space-y-3 text-sm text-[#111827] dark:text-zinc-100">
        {opening && (
          <p className="font-medium">{opening}</p>
        )}
        {body && (
          <div className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {body}
          </div>
        )}
        {takeaway && (
          <p className="rounded-lg bg-[#06B6D4]/5 p-3 text-zinc-700 dark:bg-[#06B6D4]/10 dark:text-zinc-300">
            {takeaway}
          </p>
        )}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-medium text-[#2563EB]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {(projects || content.portfolio.url) && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Projects
          </h4>
          {projects && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
              {projects}
            </p>
          )}
          {content.portfolio.url && (
            <a
              href={content.portfolio.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:underline dark:text-[#3b82f6]"
            >
              {content.portfolio.url}
            </a>
          )}
        </div>
      )}

      <p className="mt-4 text-[10px] text-zinc-400 dark:text-zinc-500">
        Approximate LinkedIn preview
      </p>
    </div>
  );
}
