import type {
  BrandVoice,
  ContentRules,
} from "@/types/ai";

/**
 * Content rules shared by future services (post generation, publishing).
 *
 * Brand voice ensures posts sound like a real learner documenting progress.
 * Simplicity rules keep posts accessible for readers using English as a second
 * language. Post formats define the seven content types the app will support.
 */
export const content = {
  post: {
    // LinkedIn's hard character limit for a single post.
    maxCharacters: 3000,
    minCharacters: 1,
    maxHashtags: 5,
  },

  /**
   * Brand voice — the tone and style the AI must follow when generating posts.
   * Posts should sound like a real learner, not a marketing department.
   */
  brandVoice: {
    tone: [
      "authentic",
      "beginner-friendly",
      "professional but not corporate",
      "natural",
      "simple",
      "honest",
    ],
    avoid: [
      "mastered",
      "game-changing",
      "revolutionary",
      "expert-level",
      "cutting-edge",
      "synergy",
      "leverage",
      "utilize",
      "paradigm",
      "world-class",
      "disrupt",
      "unicorn",
      "ninja",
      "rockstar",
      "guru",
    ],
    style: [
      "short sentences",
      "short paragraphs (1–3 sentences)",
      "conversational tone",
      "use 'I' not 'we'",
      "specific over vague",
      "no unnecessary jargon",
      "no corporate buzzwords",
      "sounds like a real person learning",
    ],
  } as const satisfies BrandVoice,

  /**
   * Simplicity rules — structural constraints for generated posts.
   * These keep posts accessible and honest.
   */
  rules: {
    targetWordCount: { min: 100, max: 220 },
    maxHashtags: 5,
    shortParagraphs: true,
    avoidEmojis: true,
    avoidComplexVocabulary: true,
    noUnsupportedClaims: true,
    noInventedProjectResults: true,
    noInventedTechnologies: true,
    noInventedProblems: true,
    noInventedAchievements: true,
  } as const satisfies ContentRules,

  /**
   * Post format definitions — the seven content types supported by the app.
   * Each format has a name, description, and the primary journal fields it uses.
   */
  formats: {
    "what-i-learned": {
      name: "What I Learned",
      description: "Share the main thing you learned today.",
      primaryFields: ["whatILearned", "keyTakeaway"] as const,
    },
    challenge: {
      name: "Challenge",
      description: "Talk about a challenge you faced and how you solved it.",
      primaryFields: ["challenge", "howISolvedIt"] as const,
    },
    "small-win": {
      name: "Small Win",
      description: "Celebrate a small but meaningful progress.",
      primaryFields: ["whatILearned", "whatIBuilt"] as const,
    },
    project: {
      name: "Project",
      description: "Show what you built or worked on.",
      primaryFields: ["whatIBuilt", "projectName", "projectDescription"] as const,
    },
    concept: {
      name: "Concept",
      description: "Explain a concept you studied today.",
      primaryFields: ["whatILearned", "whatIPracticed"] as const,
    },
    reflection: {
      name: "Reflection",
      description: "Reflect on your learning journey so far.",
      primaryFields: ["keyTakeaway", "tomorrowFocus", "confidenceLevel"] as const,
    },
    "practical-lesson": {
      name: "Practical Lesson",
      description: "Share a practical lesson or tip you discovered.",
      primaryFields: ["whatIPracticed", "howISolvedIt", "resourcesUsed"] as const,
    },
  } as const,
} as const;

export type ContentConfig = typeof content;
