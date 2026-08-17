import type { GeneratedPostRow } from "@/types/generated-post";
import { brand } from "@/config/brand";
import { content } from "@/config/content";

type PostMetadataProps = {
  post: GeneratedPostRow;
};

function getFormatLabel(format: string): string {
  const entry = Object.entries(content.formats).find(([key]) => key === format);
  return entry ? entry[1].name : format;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostMetadata({ post }: PostMetadataProps) {
  return (
    <div className="space-y-4">
      {/* Post info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Post Information
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Day</dt>
            <dd className="font-medium text-[#111827] dark:text-zinc-50">
              {post.day_number} / {brand.totalDays}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Format</dt>
            <dd className="font-medium text-[#111827] dark:text-zinc-50">
              {getFormatLabel(post.format)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Provider</dt>
            <dd className="font-medium text-[#111827] dark:text-zinc-50">
              {post.provider}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
            <dd className="font-medium text-[#111827] dark:text-zinc-50">
              {formatDate(post.created_at)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Image metadata */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Image Metadata
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          {post.image_headline && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">Headline</dt>
              <dd className="text-right font-medium text-[#111827] dark:text-zinc-50">
                {post.image_headline}
              </dd>
            </div>
          )}
          {post.image_subheadline && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">Subheadline</dt>
              <dd className="text-right font-medium text-[#111827] dark:text-zinc-50">
                {post.image_subheadline}
              </dd>
            </div>
          )}
          {post.image_keywords && post.image_keywords.length > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">Keywords</dt>
              <dd className="text-right font-medium text-[#111827] dark:text-zinc-50">
                {post.image_keywords.join(", ")}
              </dd>
            </div>
          )}
          {post.image_visual_concept && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">Concept</dt>
              <dd className="text-right font-medium text-[#111827] dark:text-zinc-50">
                {post.image_visual_concept}
              </dd>
            </div>
          )}
          {post.image_template && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">Template</dt>
              <dd className="text-right font-medium text-[#111827] dark:text-zinc-50">
                {post.image_template}
              </dd>
            </div>
          )}
          {!post.image_headline &&
            !post.image_subheadline &&
            (!post.image_keywords || post.image_keywords.length === 0) &&
            !post.image_visual_concept &&
            !post.image_template && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                No image metadata available.
              </p>
            )}
        </dl>
      </div>
    </div>
  );
}
