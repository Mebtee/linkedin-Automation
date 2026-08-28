// ─── Recruiter Content — Configuration ───────────────────────────────────────
// Phase 5A — post-type taxonomy metadata, deterministic scoring weights,
// content-goal multipliers, and hashtag rules.
//
// Scoring is deterministic: weighs evidence-backed signals only. Unsupported
// claims (MISSING / INFERRED personal experience) contribute 0 and make a
// personal-experience post ineligible.

import type {
  ContentGoal,
  PostType,
  PostTypeCategory,
  RecruiterDimension,
} from "@/types/content-opportunity";

// ─── Post Type Taxonomy ──────────────────────────────────────────────────────

export type PostTypeMeta = {
  readonly label: string;
  readonly description: string;
  readonly category: PostTypeCategory;
  /**
   * True when the post claims first-person engineering work (building,
   * debugging, deploying, solving, securing). Such posts may only be generated
   * from `USER_CONFIRMED` evidence.
   */
  readonly personalExperience: boolean;
  /** Post structure steps (Phase 5 spec §6). */
  readonly structure: readonly string[];
  /** Suggested topic hashtags (Phase 5 spec §7). Optional; never forced. */
  readonly hashtagFocus: readonly string[];
};

export const POST_TYPE_META: Record<PostType, PostTypeMeta> = {
  PROJECT_SHOWCASE: {
    label: "Project Showcase",
    description: "Something you actually built, what it does, and how.",
    category: "build",
    personalExperience: true,
    structure: [
      "Hook",
      "What I built",
      "What it does",
      "Technologies",
      "Interesting implementation detail",
      "What I learned",
      "Optional project/demo/GitHub CTA",
    ],
    hashtagFocus: ["#NextJS", "#Supabase", "#TypeScript"],
  },
  PROBLEM_SOLUTION: {
    label: "Problem Solution",
    description: "A real technical problem, how you investigated it, and the fix.",
    category: "solve",
    personalExperience: true,
    structure: [
      "Problem",
      "Investigation",
      "Root cause",
      "Solution",
      "Lesson",
    ],
    hashtagFocus: ["#SoftwareDevelopment", "#Debugging", "#WebDevelopment"],
  },
  DEBUGGING_STORY: {
    label: "Debugging Story",
    description: "A real bug, the symptoms, the investigation, and the fix.",
    category: "solve",
    personalExperience: true,
    structure: [
      "Symptom",
      "What I initially thought",
      "What I discovered",
      "Fix",
      "Lesson",
    ],
    hashtagFocus: ["#Debugging", "#TypeScript", "#WebDevelopment"],
  },
  TECHNICAL_LESSON: {
    label: "Technical Lesson",
    description: "A technical concept learned, explained simply with how it was applied.",
    category: "learn",
    personalExperience: false,
    structure: [
      "Concept",
      "Simple explanation",
      "How I applied it",
      "Practical takeaway",
    ],
    hashtagFocus: ["#WebDevelopment", "#LearningInPublic"],
  },
  SECURITY_LESSON: {
    label: "Security Lesson",
    description: "Verified security work: auth, RLS, secrets, storage, API security.",
    category: "solve",
    personalExperience: true,
    structure: [
      "Risk",
      "What caused it",
      "Fix",
      "Security lesson",
    ],
    hashtagFocus: ["#Security", "#RLS", "#Auth"],
  },
  DEPLOYMENT_STORY: {
    label: "Deployment Story",
    description: "Deployment, environment config, CI/CD, production debugging.",
    category: "build",
    personalExperience: true,
    structure: [
      "What worked locally",
      "What failed in production",
      "Investigation",
      "Fix",
      "Lesson",
    ],
    hashtagFocus: ["#DevOps", "#Vercel", "#GitHubActions"],
  },
  API_INTEGRATION: {
    label: "API Integration",
    description: "A real external API integration: auth, error handling, challenges.",
    category: "build",
    personalExperience: true,
    structure: [
      "What I integrated",
      "Authentication",
      "Challenge",
      "Fix",
      "Lesson",
    ],
    hashtagFocus: ["#APIs", "#OAuth", "#WebDevelopment"],
  },
  DATABASE_ENGINEERING: {
    label: "Database Engineering",
    description: "Schema design, migrations, RLS, indexes, data modeling.",
    category: "build",
    personalExperience: true,
    structure: [
      "Problem",
      "Schema/design",
      "Why it works",
      "Tradeoff",
      "Lesson",
    ],
    hashtagFocus: ["#PostgreSQL", "#Supabase", "#SQL"],
  },
  AI_ENGINEERING: {
    label: "AI Engineering",
    description: "AI integration, provider architecture, fallbacks, validation.",
    category: "build",
    personalExperience: true,
    structure: [
      "What I integrated",
      "How it's architected",
      "Fallback/validation",
      "Lesson",
    ],
    hashtagFocus: ["#AI", "#APIs", "#NextJS"],
  },
  LEARNING_MILESTONE: {
    label: "Learning Milestone",
    description: "Meaningful progress: a major milestone or module completion.",
    category: "learn",
    personalExperience: false,
    structure: [
      "Milestone",
      "What I accomplished",
      "What I learned",
      "What's next",
    ],
    hashtagFocus: ["#LearningInPublic", "#WebDevelopment"],
  },
  ENGINEERING_DECISION: {
    label: "Engineering Decision",
    description: "Why a technology or architecture choice was made, with tradeoffs.",
    category: "build",
    personalExperience: true,
    structure: [
      "Problem",
      "Options",
      "Choice",
      "Reason",
      "Tradeoff",
      "Result",
    ],
    hashtagFocus: ["#SoftwareDevelopment", "#Architecture", "#FullStackDevelopment"],
  },
  CAREER_PROGRESS: {
    label: "Career Progress",
    description: "Career transition, portfolio progress, or job-search milestone.",
    category: "career",
    personalExperience: false,
    structure: [
      "Context",
      "What I accomplished",
      "What I learned",
      "What I am working toward",
    ],
    hashtagFocus: ["#CareerGrowth", "#FullStackDevelopment"],
  },
};

// ─── Content Goals ───────────────────────────────────────────────────────────

export const CONTENT_GOAL_LABELS: Record<ContentGoal, string> = {
  GET_RECRUITER_ATTENTION: "Get recruiter attention",
  BUILD_TECHNICAL_CREDIBILITY: "Build technical credibility",
  SHOW_PROJECTS: "Show projects",
  SHOW_PROBLEM_SOLVING: "Show problem solving",
  DOCUMENT_LEARNING: "Document learning",
  BALANCED: "Balanced",
};

// ─── Deterministic Scoring ───────────────────────────────────────────────────
// Weights follow the Phase 5 spec (implementation 25, problem solving 20,
// technical depth 15, production 10, security 10, multiple skills 10,
// communication 5, uniqueness 5). Goal multipliers nudge weights without
// letting any single dimension dominate unrealistically; the total is capped
// at 100.

export const recruiter = {
  weights: {
    realImplementationEvidence: 25,
    problemSolvingEvidence: 20,
    technicalDepth: 15,
    productionDeploymentRelevance: 10,
    securityEngineeringQuality: 10,
    multipleSkills: 10,
    communicationTeachingValue: 5,
    uniqueness: 5,
  } as const satisfies Record<RecruiterDimension, number>,

  goalWeightMultipliers: {
    GET_RECRUITER_ATTENTION: {
      realImplementationEvidence: 1.15,
      problemSolvingEvidence: 1.15,
      technicalDepth: 1.0,
      productionDeploymentRelevance: 1.1,
      securityEngineeringQuality: 1.05,
      multipleSkills: 1.0,
      communicationTeachingValue: 1.0,
      uniqueness: 1.0,
    },
    BUILD_TECHNICAL_CREDIBILITY: {
      realImplementationEvidence: 1.1,
      problemSolvingEvidence: 1.0,
      technicalDepth: 1.15,
      productionDeploymentRelevance: 1.0,
      securityEngineeringQuality: 1.1,
      multipleSkills: 1.05,
      communicationTeachingValue: 1.0,
      uniqueness: 1.0,
    },
    SHOW_PROJECTS: {
      realImplementationEvidence: 1.2,
      problemSolvingEvidence: 1.05,
      technicalDepth: 1.05,
      productionDeploymentRelevance: 1.0,
      securityEngineeringQuality: 1.0,
      multipleSkills: 1.05,
      communicationTeachingValue: 1.1,
      uniqueness: 1.0,
    },
    SHOW_PROBLEM_SOLVING: {
      realImplementationEvidence: 1.05,
      problemSolvingEvidence: 1.2,
      technicalDepth: 1.0,
      productionDeploymentRelevance: 1.0,
      securityEngineeringQuality: 1.0,
      multipleSkills: 1.05,
      communicationTeachingValue: 1.0,
      uniqueness: 1.0,
    },
    DOCUMENT_LEARNING: {
      realImplementationEvidence: 1.0,
      problemSolvingEvidence: 1.0,
      technicalDepth: 1.15,
      productionDeploymentRelevance: 0.9,
      securityEngineeringQuality: 0.9,
      multipleSkills: 1.0,
      communicationTeachingValue: 1.05,
      uniqueness: 1.0,
    },
    BALANCED: {
      realImplementationEvidence: 1.0,
      problemSolvingEvidence: 1.0,
      technicalDepth: 1.0,
      productionDeploymentRelevance: 1.0,
      securityEngineeringQuality: 1.0,
      multipleSkills: 1.0,
      communicationTeachingValue: 1.0,
      uniqueness: 1.0,
    },
  } as const satisfies Record<ContentGoal, Record<RecruiterDimension, number>>,

  /** Below this score an opportunity is not recommended. */
  minRecommendScore: 55,

  hashtags: {
    /** Always included on recruiter-focused posts (Phase 5 spec §7). */
    platform: ["#FullStackDevelopment"] as const,
    /** Only used when the post genuinely relates to the 105-day journey. */
    journey: "#105DaysOfCode",
    min: 3,
    max: 5,
  },
} as const;

export type RecruiterConfig = typeof recruiter;