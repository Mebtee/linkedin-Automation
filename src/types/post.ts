export type PostStatus =
  | "draft"
  | "ready-for-review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed";

export type Post = {
  id: string;
  title?: string;
  content: string;
  status: PostStatus;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp. */
  updatedAt: string;
  /** ISO 8601 timestamp. */
  scheduledFor?: string;
  /** ISO 8601 timestamp. */
  publishedAt?: string;
};
