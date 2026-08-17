import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  PostGenerationInput,
  CurriculumContext,
  JournalContext,
  PostFormat,
} from "@/types/ai";
import { POST_FORMATS } from "@/types/ai";
import { TemplateFallbackProvider } from "./providers/fallback";
import {
  validatePostGenerationInput,
  validateGeneratedPostPayload,
} from "./validation";
import { getTextGenerationProvider, getActiveProviderName, getAvailableProviders } from "./index";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const curriculum: CurriculumContext = {
  dayNumber: 1,
  topic: "Git and Terminal Basics",
  moduleNumber: 1,
  moduleTitle: "Foundation: Git, Terminal, Python, OOP & DSA",
  content: "Learn to use Git for version control and the terminal for navigation.",
  subtopics: ["git init", "git add", "git commit", "terminal commands"],
  projectInformation: null,
  assessmentInformation: null,
};

const journal: JournalContext = {
  whatILearned: "I learned how to use git init, git add, and git commit to track changes in my code.",
  whatIPracticed: "I practiced creating a repository and making my first commit.",
  whatIBuilt: null,
  challenge: "I kept forgetting the difference between git add and git commit.",
  howISolvedIt: "I made a simple rule: git add stages, git commit saves.",
  keyTakeaway: "Git is like a save button that remembers every version.",
  tomorrowFocus: "Learn about git branches and merging.",
  projectName: null,
  projectDescription: null,
  codeReference: null,
  resourcesUsed: "FreeCodeCamp Git tutorial",
  confidenceLevel: 3,
  additionalNotes: null,
};

function makeInput(overrides?: Partial<PostGenerationInput>): PostGenerationInput {
  return {
    curriculum,
    journal,
    brandVoice: {
      tone: ["authentic", "beginner-friendly"],
      avoid: ["mastered", "game-changing"],
      style: ["short sentences", "conversational"],
    },
    format: "what-i-learned",
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
    },
    ...overrides,
  };
}

// ─── 1. Provider Interface via Factory ──────────────────────────────────────

describe("Provider Factory", () => {
  const originalEnv = process.env.AI_TEXT_PROVIDER;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AI_TEXT_PROVIDER;
    } else {
      process.env.AI_TEXT_PROVIDER = originalEnv;
    }
  });

  it("returns fallback provider by default", () => {
    delete process.env.AI_TEXT_PROVIDER;
    const provider = getTextGenerationProvider();
    expect(provider).toBeInstanceOf(TemplateFallbackProvider);
  });

  it("returns fallback provider when AI_TEXT_PROVIDER=fallback", () => {
    process.env.AI_TEXT_PROVIDER = "fallback";
    const provider = getTextGenerationProvider();
    expect(provider).toBeInstanceOf(TemplateFallbackProvider);
  });

  it("returns the active provider name", () => {
    delete process.env.AI_TEXT_PROVIDER;
    expect(getActiveProviderName()).toBe("fallback");
  });

  it("lists available providers", () => {
    const providers = getAvailableProviders();
    expect(providers).toContain("fallback");
    expect(providers.length).toBeGreaterThanOrEqual(1);
  });

  it("throws for unknown provider", () => {
    process.env.AI_TEXT_PROVIDER = "nonexistent";
    expect(() => getTextGenerationProvider()).toThrow("Unknown AI provider");
  });

  it("throws for unknown provider with helpful message", () => {
    process.env.AI_TEXT_PROVIDER = "nonexistent";
    try {
      getTextGenerationProvider();
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("Available providers");
    }
  });
});

// ─── 2. Fallback Provider Returns Valid Output ──────────────────────────────

describe("TemplateFallbackProvider", () => {
  const provider = new TemplateFallbackProvider();

  it("returns a valid ProviderResult", async () => {
    const result = await provider.generatePost(makeInput());
    expect(result).toHaveProperty("payload");
    expect(result).toHaveProperty("metadata");
  });

  it("returns valid post structure", async () => {
    const { post } = (await provider.generatePost(makeInput())).payload;
    expect(typeof post.opening).toBe("string");
    expect(typeof post.body).toBe("string");
    expect(typeof post.takeaway).toBe("string");
    expect(typeof post.nextStep).toBe("string");
    expect(Array.isArray(post.hashtags)).toBe(true);
  });

  it("returns valid image metadata", async () => {
    const { image } = (await provider.generatePost(makeInput())).payload;
    expect(typeof image.headline).toBe("string");
    expect(typeof image.subheadline).toBe("string");
    expect(Array.isArray(image.keywords)).toBe(true);
    expect(typeof image.visualConcept).toBe("string");
    expect(typeof image.template).toBe("string");
  });

  it("returns valid metadata", async () => {
    const { metadata } = await provider.generatePost(makeInput());
    expect(metadata.provider).toBe("fallback");
    expect(metadata.model).toBe("template-v1");
    expect(typeof metadata.generatedAt).toBe("string");
    expect(new Date(metadata.generatedAt).toISOString()).toBe(metadata.generatedAt);
  });

  it("post fields are non-empty", async () => {
    const { post } = (await provider.generatePost(makeInput())).payload;
    expect(post.opening.trim().length).toBeGreaterThan(0);
    expect(post.body.trim().length).toBeGreaterThan(0);
    expect(post.takeaway.trim().length).toBeGreaterThan(0);
    expect(post.nextStep.trim().length).toBeGreaterThan(0);
  });
});

// ─── 3. Deterministic Output ────────────────────────────────────────────────

describe("Deterministic output", () => {
  const provider = new TemplateFallbackProvider();

  it("same input produces same opening", async () => {
    const input = makeInput();
    const r1 = await provider.generatePost(input);
    const r2 = await provider.generatePost(input);
    expect(r1.payload.post.opening).toBe(r2.payload.post.opening);
  });

  it("same input produces same body", async () => {
    const input = makeInput();
    const r1 = await provider.generatePost(input);
    const r2 = await provider.generatePost(input);
    expect(r1.payload.post.body).toBe(r2.payload.post.body);
  });

  it("same input produces same takeaway", async () => {
    const input = makeInput();
    const r1 = await provider.generatePost(input);
    const r2 = await provider.generatePost(input);
    expect(r1.payload.post.takeaway).toBe(r2.payload.post.takeaway);
  });

  it("same input produces same hashtags", async () => {
    const input = makeInput();
    const r1 = await provider.generatePost(input);
    const r2 = await provider.generatePost(input);
    expect(r1.payload.post.hashtags).toEqual(r2.payload.post.hashtags);
  });

  it("different formats produce different openings", async () => {
    const r1 = await provider.generatePost(makeInput({ format: "what-i-learned" }));
    const r2 = await provider.generatePost(makeInput({ format: "challenge" }));
    expect(r1.payload.post.opening).not.toBe(r2.payload.post.opening);
  });
});

// ─── 4. Never Invents Journal Information ───────────────────────────────────

describe("Never invents journal information", () => {
  const provider = new TemplateFallbackProvider();

  it("uses actual journal data when provided", async () => {
    const input = makeInput();
    const { post } = (await provider.generatePost(input)).payload;
    expect(post.opening).toContain("Git and Terminal Basics");
    expect(post.body).toContain("git init");
    expect(post.takeaway).toBe("Git is like a save button that remembers every version.");
    expect(post.nextStep).toBe("Learn about git branches and merging.");
  });

  it("handles null journal fields gracefully", async () => {
    const input = makeInput({
      journal: {
        ...journal,
        whatILearned: null,
        whatIPracticed: null,
        whatIBuilt: null,
        challenge: null,
        howISolvedIt: null,
        keyTakeaway: null,
        tomorrowFocus: null,
      },
    });
    const { post } = (await provider.generatePost(input)).payload;
    expect(post.opening.trim().length).toBeGreaterThan(0);
    expect(post.body.trim().length).toBeGreaterThan(0);
    expect(post.takeaway).toBe("Every day builds on the last one.");
    expect(post.nextStep).toBe("Keep learning, keep building.");
  });

  it("does not include invented achievements", async () => {
    const input = makeInput();
    const { post } = (await provider.generatePost(input)).payload;
    const lower = (post.opening + " " + post.body).toLowerCase();
    expect(lower).not.toContain("mastered");
    expect(lower).not.toContain("game-changing");
    expect(lower).not.toContain("revolutionary");
    expect(lower).not.toContain("expert-level");
  });
});

// ─── 5. All Required Post Fields ────────────────────────────────────────────

describe("Required post fields", () => {
  const provider = new TemplateFallbackProvider();

  for (const format of POST_FORMATS) {
    it(`format "${format}" produces all required fields`, async () => {
      const { post, image } = (await provider.generatePost(makeInput({ format }))).payload;
      expect(post.opening).toBeDefined();
      expect(post.body).toBeDefined();
      expect(post.takeaway).toBeDefined();
      expect(post.nextStep).toBeDefined();
      expect(post.hashtags).toBeDefined();
      expect(image.headline).toBeDefined();
      expect(image.subheadline).toBeDefined();
      expect(image.keywords).toBeDefined();
      expect(image.visualConcept).toBeDefined();
      expect(image.template).toBeDefined();
    });
  }
});

// ─── 6. Hashtags ────────────────────────────────────────────────────────────

describe("Hashtags", () => {
  const provider = new TemplateFallbackProvider();

  it("always includes #105DaysOfCode", async () => {
    const { post } = (await provider.generatePost(makeInput())).payload;
    expect(post.hashtags).toContain("#105DaysOfCode");
  });

  it("always includes #FullStackDevelopment", async () => {
    const { post } = (await provider.generatePost(makeInput())).payload;
    expect(post.hashtags).toContain("#FullStackDevelopment");
  });

  it("never exceeds 5 hashtags", async () => {
    const { post } = (await provider.generatePost(makeInput())).payload;
    expect(post.hashtags.length).toBeLessThanOrEqual(5);
  });

  it("all hashtags start with #", async () => {
    const { post } = (await provider.generatePost(makeInput())).payload;
    for (const tag of post.hashtags) {
      expect(tag.startsWith("#")).toBe(true);
    }
  });
});

// ─── 7. Image Metadata Structure ────────────────────────────────────────────

describe("Image metadata", () => {
  const provider = new TemplateFallbackProvider();

  it("headline uses journal or curriculum topic", async () => {
    const { image } = (await provider.generatePost(makeInput())).payload;
    expect(image.headline.length).toBeGreaterThan(0);
  });

  it("subheadline uses curriculum topic", async () => {
    const { image } = (await provider.generatePost(makeInput())).payload;
    expect(image.subheadline).toBe("Git and Terminal Basics");
  });

  it("keywords come from curriculum subtopics", async () => {
    const { image } = (await provider.generatePost(makeInput())).payload;
    expect(image.keywords.length).toBeGreaterThan(0);
    expect(image.keywords.length).toBeLessThanOrEqual(5);
  });

  it("template is set", async () => {
    const { image } = (await provider.generatePost(makeInput())).payload;
    expect(image.template).toBe("learner-progress");
  });
});

// ─── 8. Input Validation ────────────────────────────────────────────────────

describe("validatePostGenerationInput", () => {
  it("accepts valid input", () => {
    const input = makeInput();
    expect(validatePostGenerationInput(input)).toBe(input);
  });

  it("rejects null input", () => {
    expect(() => validatePostGenerationInput(null)).toThrow("non-null object");
  });

  it("rejects undefined input", () => {
    expect(() => validatePostGenerationInput(undefined)).toThrow("non-null object");
  });

  it("rejects input without curriculum", () => {
    const input = makeInput();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { curriculum, ...rest } = input;
    expect(() => validatePostGenerationInput({ ...rest })).toThrow("curriculum object");
  });

  it("rejects input without journal", () => {
    const input = makeInput();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { journal, ...rest } = input;
    expect(() => validatePostGenerationInput({ ...rest })).toThrow("journal object");
  });

  it("rejects input without format", () => {
    const input = makeInput();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { format, ...rest } = input;
    expect(() => validatePostGenerationInput({ ...rest })).toThrow("Invalid format");
  });

  it("rejects invalid format", () => {
    expect(() => validatePostGenerationInput(makeInput({ format: "invalid" as PostFormat }))).toThrow(
      "Invalid format",
    );
  });

  it("rejects curriculum with dayNumber < 1", () => {
    expect(() =>
      validatePostGenerationInput(
        makeInput({ curriculum: { ...curriculum, dayNumber: 0 } }),
      ),
    ).toThrow("dayNumber must be a positive number");
  });

  it("rejects curriculum with empty topic", () => {
    expect(() =>
      validatePostGenerationInput(
        makeInput({ curriculum: { ...curriculum, topic: "" } }),
      ),
    ).toThrow("topic must be a non-empty string");
  });
});

// ─── 9. Output Validation ──────────────────────────────────────────────────

describe("validateGeneratedPostPayload", () => {
  const provider = new TemplateFallbackProvider();

  it("accepts valid output from fallback", async () => {
    const result = await provider.generatePost(makeInput());
    expect(validateGeneratedPostPayload(result.payload)).toBe(result.payload);
  });

  it("rejects null output", () => {
    expect(() => validateGeneratedPostPayload(null)).toThrow("non-null object");
  });

  it("rejects output without post", () => {
    expect(() => validateGeneratedPostPayload({ image: {} })).toThrow("post object");
  });

  it("rejects output without image", () => {
    expect(() => validateGeneratedPostPayload({ post: {} })).toThrow("image object");
  });

  it("rejects post with empty opening", () => {
    const payload = {
      post: { opening: "", body: "b", takeaway: "t", nextStep: "n", hashtags: [] },
      image: { headline: "h", subheadline: "s", keywords: [], visualConcept: "v", template: "t" },
    };
    expect(() => validateGeneratedPostPayload(payload)).toThrow("post.opening must be a non-empty string");
  });

  it("rejects post with missing hashtags array", () => {
    const payload = {
      post: { opening: "o", body: "b", takeaway: "t", nextStep: "n", hashtags: "not-array" },
      image: { headline: "h", subheadline: "s", keywords: [], visualConcept: "v", template: "t" },
    };
    expect(() => validateGeneratedPostPayload(payload)).toThrow("post.hashtags must be an array");
  });
});

// ─── 10. No External Network Requests ──────────────────────────────────────

describe("No external network requests", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("fallback provider does not make any fetch calls", async () => {
    const provider = new TemplateFallbackProvider();
    await provider.generatePost(makeInput());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
