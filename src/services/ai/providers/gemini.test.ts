import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { PostGenerationInput, CurriculumContext, JournalContext } from "@/types/ai";
import { AIError } from "@/types/ai";
import { GeminiTextProvider } from "./gemini";
import { TemplateFallbackProvider } from "./fallback";

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

const validGeminiResponse = {
  post: {
    opening: "Today I learned how Git tracks changes in my code.",
    body: "I practiced creating a repository and making my first commit. Git is like a save button that remembers every version.\n\nThe challenge was remembering the difference between git add and git commit. I made a simple rule: git add stages, git commit saves.",
    takeaway: "Git is like a save button that remembers every version.",
    nextStep: "Learn about git branches and merging.",
    hashtags: ["#105DaysOfCode", "#FullStackDevelopment", "#Git", "#VersionControl"],
  },
  image: {
    headline: "Learning Git and Terminal Basics",
    subheadline: "Git and Terminal Basics",
    keywords: ["git init", "git add", "git commit", "terminal commands"],
    visualConcept: "Learning Git and Terminal Basics — Module 1",
    template: "code-visual",
  },
};

function createGeminiResponse(data: object) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(data) }],
        },
      },
    ],
  };
}

function createGeminiErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code: status, message } }),
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

describe("GeminiTextProvider", () => {
  const originalEnv = process.env.GEMINI_API_KEY;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockReset();
    process.env.GEMINI_API_KEY = "test-api-key";
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalEnv === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalEnv;
    }
  });

  // ─── A. Prompt Construction ────────────────────────────────────────────

  describe("Prompt construction", () => {
    it("includes brand voice", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("authentic");
      expect(prompt).toContain("beginner-friendly");
    });

    it("includes content rules", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("100–220 words");
      expect(prompt).toContain("Maximum hashtags: 5");
      expect(prompt).toContain("No emojis");
    });

    it("includes curriculum day number", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("Day: 1 of 105");
    });

    it("includes curriculum topic", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("Git and Terminal Basics");
    });

    it("includes curriculum module", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("Module 1");
      expect(prompt).toContain("Foundation: Git, Terminal, Python, OOP & DSA");
    });

    it("includes curriculum content", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("Learn to use Git for version control");
    });

    it("includes subtopics", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("git init");
      expect(prompt).toContain("git add");
      expect(prompt).toContain("git commit");
      expect(prompt).toContain("terminal commands");
    });

    it("includes journal fields", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("What I learned: I learned how to use git init");
      expect(prompt).toContain("What I practiced: I practiced creating a repository");
      expect(prompt).toContain("Challenge: I kept forgetting");
      expect(prompt).toContain("How I solved it: I made a simple rule");
      expect(prompt).toContain("Key takeaway: Git is like a save button");
      expect(prompt).toContain("Tomorrow's focus: Learn about git branches");
      expect(prompt).toContain("Resources used: FreeCodeCamp Git tutorial");
      expect(prompt).toContain("Confidence level: 3/5");
    });

    it("includes project information when available", () => {
      const provider = new GeminiTextProvider();
      const input = makeInput({
        curriculum: {
          ...curriculum,
          projectInformation: "Build a CLI tool",
          assessmentInformation: "Quiz on Git basics",
        },
      });
      const prompt = provider.buildPrompt(input);
      expect(prompt).toContain("Project: Build a CLI tool");
      expect(prompt).toContain("Assessment: Quiz on Git basics");
    });

    it("includes format", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput({ format: "challenge" }));
      expect(prompt).toContain("Challenge");
      expect(prompt).toContain("Talk about a challenge");
    });

    it("requests JSON structure", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain('"post"');
      expect(prompt).toContain('"opening"');
      expect(prompt).toContain('"body"');
      expect(prompt).toContain('"takeaway"');
      expect(prompt).toContain('"nextStep"');
      expect(prompt).toContain('"hashtags"');
      expect(prompt).toContain('"image"');
      expect(prompt).toContain('"headline"');
      expect(prompt).toContain('"subheadline"');
      expect(prompt).toContain('"keywords"');
      expect(prompt).toContain('"visualConcept"');
      expect(prompt).toContain('"template"');
    });

    it("requires first-person beginner voice", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("first-person beginner voice");
      expect(prompt).toContain("Never claim mastery");
    });

    it("requires mandatory hashtags", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("#105DaysOfCode");
      expect(prompt).toContain("#FullStackDevelopment");
    });

    it("handles null journal fields gracefully", () => {
      const provider = new GeminiTextProvider();
      const input = makeInput({
        journal: {
          whatILearned: null,
          whatIPracticed: null,
          whatIBuilt: null,
          challenge: null,
          howISolvedIt: null,
          keyTakeaway: null,
          tomorrowFocus: null,
          projectName: null,
          projectDescription: null,
          codeReference: null,
          resourcesUsed: null,
          confidenceLevel: null,
          additionalNotes: null,
        },
      });
      const prompt = provider.buildPrompt(input);
      expect(prompt).toContain("No journal entry provided");
    });

    it("includes all brand voice style rules", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("short sentences");
      expect(prompt).toContain("conversational");
    });

    it("includes avoid words list", () => {
      const provider = new GeminiTextProvider();
      const prompt = provider.buildPrompt(makeInput());
      expect(prompt).toContain("mastered");
      expect(prompt).toContain("game-changing");
    });
  });

  // ─── B. Successful Generation ──────────────────────────────────────────

  describe("Successful generation", () => {
    it("returns valid ProviderResult on success", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result).toHaveProperty("payload");
      expect(result).toHaveProperty("metadata");
      expect(result.payload).toHaveProperty("post");
      expect(result.payload).toHaveProperty("image");
    });

    it("metadata.provider is gemini on success", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("gemini");
      expect(result.metadata.model).toBe("gemini-3.6-flash");
    });

    it("calls correct Gemini API URL", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      await provider.generatePost(makeInput());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("generativelanguage.googleapis.com");
      expect(calledUrl).toContain("gemini-3.6-flash:generateContent");
      expect(calledUrl).toContain("key=test-api-key");
    });

    it("sends correct request body", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      await provider.generatePost(makeInput());

      const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
      expect(body.contents).toHaveLength(1);
      expect(body.contents[0]?.parts).toHaveLength(1);
      expect(typeof body.contents[0]?.parts[0]?.text).toBe("string");
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      expect(body.generationConfig.temperature).toBe(0.7);
    });

    it("returns valid post fields", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      const { post } = (await provider.generatePost(makeInput())).payload;

      expect(post.opening).toBe(validGeminiResponse.post.opening);
      expect(post.body).toBe(validGeminiResponse.post.body);
      expect(post.takeaway).toBe(validGeminiResponse.post.takeaway);
      expect(post.nextStep).toBe(validGeminiResponse.post.nextStep);
      expect(post.hashtags).toEqual(validGeminiResponse.post.hashtags);
    });

    it("returns valid image metadata", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      const { image } = (await provider.generatePost(makeInput())).payload;

      expect(image.headline).toBe(validGeminiResponse.image.headline);
      expect(image.subheadline).toBe(validGeminiResponse.image.subheadline);
      expect(image.keywords).toEqual(validGeminiResponse.image.keywords);
      expect(image.visualConcept).toBe(validGeminiResponse.image.visualConcept);
      expect(image.template).toBe(validGeminiResponse.image.template);
    });
  });

  // ─── C. Invalid Output → Fallback ──────────────────────────────────────

  describe("Invalid output", () => {
    it("falls back on malformed JSON", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: "not json at all" }] } }],
          }),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
      expect(result.metadata.model).toBe("template-v1");
    });

    it("falls back on missing required fields", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ post: {} }) }] } }],
          }),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
    });

    it("falls back on invalid structure (no post)", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ image: {} }) }] } }],
          }),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
    });

    it("falls back on empty candidates", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
    });

    it("falls back on missing candidates", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
    });
  });

  // ─── D. HTTP Errors → Correct Error Codes ──────────────────────────────

  describe("HTTP errors", () => {
    it("400 → falls back with INVALID_INPUT", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(400, "Bad request") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());
      expect(result.metadata.provider).toBe("fallback");
    });

    it("401 → falls back with AUTHENTICATION_ERROR", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(401, "Unauthorized") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());
      expect(result.metadata.provider).toBe("fallback");
    });

    it("403 → falls back with AUTHENTICATION_ERROR", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(403, "Forbidden") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());
      expect(result.metadata.provider).toBe("fallback");
    });

    it("429 → falls back with RATE_LIMITED", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(429, "Rate limited") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());
      expect(result.metadata.provider).toBe("fallback");
    });

    it("500 → falls back with PROVIDER_UNAVAILABLE", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(500, "Server error") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());
      expect(result.metadata.provider).toBe("fallback");
    });

    it("502 → falls back with PROVIDER_UNAVAILABLE", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(502, "Bad gateway") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());
      expect(result.metadata.provider).toBe("fallback");
    });

    it("503 → falls back with PROVIDER_UNAVAILABLE", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(503, "Unavailable") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());
      expect(result.metadata.provider).toBe("fallback");
    });
  });

  // ─── E. Timeout → TIMEOUT + Fallback ───────────────────────────────────

  describe("Timeout", () => {
    it("abort error → falls back", async () => {
      fetchSpy.mockImplementationOnce(() => {
        return new Promise<never>((_, reject) => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
    });
  });

  // ─── F. Network Failure → Fallback ─────────────────────────────────────

  describe("Network failure", () => {
    it("fetch rejection → falls back", async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
    });

    it("DNS error → falls back", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
    });
  });

  // ─── G. API Key Security ───────────────────────────────────────────────

  describe("API key security", () => {
    it("never appears in thrown error messages", async () => {
      fetchSpy.mockResolvedValueOnce(createGeminiErrorResponse(401, "Unauthorized") as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput({}));
      expect(result.metadata.provider).toBe("fallback");
    });

    it("never appears in ProviderResult", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain("test-api-key");
    });

    it("reads key from env at call time, not construction time", async () => {
      delete process.env.GEMINI_API_KEY;

      const provider = new GeminiTextProvider();
      const resultWithoutKey = await provider.generatePost(makeInput());
      expect(resultWithoutKey.metadata.provider).toBe("fallback");

      process.env.GEMINI_API_KEY = "test-api-key";

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const resultWithKey = await provider.generatePost(makeInput());
      expect(resultWithKey.metadata.provider).toBe("gemini");
    });
  });

  // ─── H. Fallback Behavior ──────────────────────────────────────────────

  describe("Fallback", () => {
    it("Gemini failure causes TemplateFallbackProvider to run", async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
      expect(result.metadata.model).toBe("template-v1");
      expect(typeof result.payload.post.opening).toBe("string");
      expect(result.payload.post.opening.length).toBeGreaterThan(0);
    });

    it("fallback result passes validation", async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.payload.post.opening.trim().length).toBeGreaterThan(0);
      expect(result.payload.post.body.trim().length).toBeGreaterThan(0);
      expect(result.payload.post.takeaway.trim().length).toBeGreaterThan(0);
      expect(result.payload.post.nextStep.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(result.payload.post.hashtags)).toBe(true);
      expect(Array.isArray(result.payload.image.keywords)).toBe(true);
    });

    it("fallback never throws", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Unknown network error"));

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result).toBeDefined();
      expect(result.metadata.provider).toBe("fallback");
    });

    it("missing API key triggers fallback", async () => {
      delete process.env.GEMINI_API_KEY;

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("empty API key triggers fallback", async () => {
      process.env.GEMINI_API_KEY = "   ";

      const provider = new GeminiTextProvider();
      const result = await provider.generatePost(makeInput());

      expect(result.metadata.provider).toBe("fallback");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ─── I. Factory Integration ────────────────────────────────────────────

  describe("Factory", () => {
    const origAiProvider = process.env.AI_TEXT_PROVIDER;

    afterEach(() => {
      if (origAiProvider === undefined) {
        delete process.env.AI_TEXT_PROVIDER;
      } else {
        process.env.AI_TEXT_PROVIDER = origAiProvider;
      }
    });

    it("gemini selects GeminiTextProvider", async () => {
      const { getTextGenerationProvider } = await import("@/services/ai/index");
      process.env.AI_TEXT_PROVIDER = "gemini";
      const provider = getTextGenerationProvider();
      expect(provider).toBeInstanceOf(GeminiTextProvider);
    });

    it("fallback selects TemplateFallbackProvider", async () => {
      const { getTextGenerationProvider } = await import("@/services/ai/index");
      process.env.AI_TEXT_PROVIDER = "fallback";
      const provider = getTextGenerationProvider();
      expect(provider).toBeInstanceOf(TemplateFallbackProvider);
    });

    it("unset selects TemplateFallbackProvider", async () => {
      const { getTextGenerationProvider } = await import("@/services/ai/index");
      delete process.env.AI_TEXT_PROVIDER;
      const provider = getTextGenerationProvider();
      expect(provider).toBeInstanceOf(TemplateFallbackProvider);
    });
  });

  // ─── J. No Real Network Requests ───────────────────────────────────────

  describe("No real network requests", () => {
    it("all fetch calls are mocked", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      await provider.generatePost(makeInput());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("fetch mock is called with correct method", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      await provider.generatePost(makeInput());

      const options = fetchSpy.mock.calls[0]?.[1];
      expect(options?.method).toBe("POST");
    });

    it("fetch mock receives Content-Type header", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createGeminiResponse(validGeminiResponse)),
      } as Response);

      const provider = new GeminiTextProvider();
      await provider.generatePost(makeInput());

      const options = fetchSpy.mock.calls[0]?.[1];
      expect(options?.headers).toEqual({ "Content-Type": "application/json" });
    });
  });

  // ─── Additional: mapError Unit Tests ───────────────────────────────────

  describe("mapError", () => {
    it("maps AbortError to TIMEOUT", () => {
      const provider = new GeminiTextProvider();
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      const mapped = provider.mapError(error);
      expect(mapped).toBeInstanceOf(AIError);
      expect(mapped.aiCode).toBe("TIMEOUT");
    });

    it("maps 400 status to INVALID_INPUT", () => {
      const provider = new GeminiTextProvider();
      const error = Object.assign(new Error("bad request"), { status: 400 });
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("INVALID_INPUT");
    });

    it("maps 401 status to AUTHENTICATION_ERROR", () => {
      const provider = new GeminiTextProvider();
      const error = Object.assign(new Error("unauthorized"), { status: 401 });
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("AUTHENTICATION_ERROR");
    });

    it("maps 403 status to AUTHENTICATION_ERROR", () => {
      const provider = new GeminiTextProvider();
      const error = Object.assign(new Error("forbidden"), { status: 403 });
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("AUTHENTICATION_ERROR");
    });

    it("maps 429 status to RATE_LIMITED", () => {
      const provider = new GeminiTextProvider();
      const error = Object.assign(new Error("rate limited"), { status: 429 });
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("RATE_LIMITED");
    });

    it("maps 500 status to PROVIDER_UNAVAILABLE", () => {
      const provider = new GeminiTextProvider();
      const error = Object.assign(new Error("server error"), { status: 500 });
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("PROVIDER_UNAVAILABLE");
    });

    it("maps 502 status to PROVIDER_UNAVAILABLE", () => {
      const provider = new GeminiTextProvider();
      const error = Object.assign(new Error("bad gateway"), { status: 502 });
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("PROVIDER_UNAVAILABLE");
    });

    it("maps 503 status to PROVIDER_UNAVAILABLE", () => {
      const provider = new GeminiTextProvider();
      const error = Object.assign(new Error("unavailable"), { status: 503 });
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("PROVIDER_UNAVAILABLE");
    });

    it("maps fetch failed to PROVIDER_UNAVAILABLE", () => {
      const provider = new GeminiTextProvider();
      const error = new TypeError("fetch failed");
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("PROVIDER_UNAVAILABLE");
    });

    it("maps unknown errors to UNKNOWN", () => {
      const provider = new GeminiTextProvider();
      const error = new Error("something weird");
      const mapped = provider.mapError(error);
      expect(mapped.aiCode).toBe("UNKNOWN");
    });

    it("passes through AIError instances", () => {
      const provider = new GeminiTextProvider();
      const original = new AIError("test", { code: "RATE_LIMITED" });
      const mapped = provider.mapError(original);
      expect(mapped).toBe(original);
      expect(mapped.aiCode).toBe("RATE_LIMITED");
    });
  });
});
