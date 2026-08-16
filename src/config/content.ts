/**
 * Content rules shared by future services (post generation, publishing).
 *
 * Values here are structural defaults only. They are finalized during the
 * post-generation phase; nothing in this phase consumes them.
 */
export const content = {
  post: {
    // LinkedIn's hard character limit for a single post.
    maxCharacters: 3000,
    minCharacters: 1,
    // To be finalized during the post-generation phase.
    maxHashtags: 5,
  },
} as const;
