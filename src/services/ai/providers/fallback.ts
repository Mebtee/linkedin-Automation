import type {
  TextGenerationProvider,
  PostGenerationInput,
  ProviderResult,
  GeneratedPost,
  ImageMetadata,
  PostFormat,
} from "@/types/ai";
import type { RecruiterPostGenerationContext } from "@/types/content-opportunity";
import { POST_TYPE_META, recruiter } from "@/config/recruiter";

/**
 * TemplateFallbackProvider — a deterministic, offline fallback that generates
 * structured posts from journal and curriculum data without any external AI.
 *
 * This provider:
 *   - Never invents information not present in the input
 *   - Produces the same output for the same input (deterministic)
 *   - Requires zero API keys, network access, or external services
 *   - Proves the provider interface works end-to-end
 *
 * The fallback is intentionally simple. Real AI providers in later phases
 * will produce more natural, engaging content.
 */
export class TemplateFallbackProvider implements TextGenerationProvider {
  readonly name = "fallback" as const;

  async generatePost(input: PostGenerationInput): Promise<ProviderResult> {
    const post = this.buildPost(input);
    const image = this.buildImage(input);

    return {
      payload: { post, image },
      metadata: {
        provider: "fallback",
        model: "template-v1",
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // ─── Post Generation ────────────────────────────────────────────────────

  private buildPost(input: PostGenerationInput): GeneratedPost {
    if (input.recruiter) {
      return this.buildOpportunityPost(input);
    }
    const { curriculum, journal, format } = input;
    const opening = this.buildOpening(format, curriculum.topic, curriculum.dayNumber, journal);
    const body = this.buildBody(format, curriculum, journal);
    const takeaway = this.buildTakeaway(journal);
    const nextStep = this.buildNextStep(journal);
    const hashtags = this.buildHashtags(curriculum.topic, curriculum.moduleTitle);

    return { opening, body, takeaway, nextStep, hashtags };
  }

  // ─── Recruiter Opportunity Post (Phase 5C) ────────────────────────────
  // Deterministic, evidence-safe post for a selected ContentOpportunity.
  // Never invents anything: it composes from the opportunity title, summary,
  // and only the evidence fields actually present. First-person "I ..."
  // language is only used in the capture/lesson scaffolding, never to claim
  // unsupported personal work.

  private buildOpportunityPost(input: PostGenerationInput): GeneratedPost {
    const context = input.recruiter!;
    const journal = context.journal;

    const opening = this.buildOpportunityOpening(context);
    const body = this.buildOpportunityBody(context);
    const takeaway =
      journal.keyTakeaway ??
      context.summary ??
      `Learning ${context.topic} kept building on what came before.`;
    const nextStep =
      journal.tomorrowFocus ?? "Keep applying this in the next small build.";
    const hashtags = this.buildOpportunityHashtags(context);

    return { opening, body, takeaway, nextStep, hashtags };
  }

  private buildOpportunityOpening(context: RecruiterPostGenerationContext): string {
    const confirmedProject = this.confirmedField(context, "whatIBuilt");
    const confirmedProjectName = this.confirmedField(context, "projectName");

    switch (context.postType) {
      case "PROJECT_SHOWCASE":
        if (confirmedProjectName) {
          return `Continuing work on ${confirmedProjectName}.`;
        }
        return confirmedProject
          ? `Worked on a real project: ${confirmedProject}`
          : `Project work: ${context.title}`;
      case "PROBLEM_SOLUTION":
      case "DEBUGGING_STORY":
      case "SECURITY_LESSON":
      case "DEPLOYMENT_STORY":
        return `${context.title}.`;
      case "LEARNING_MILESTONE":
        return `A learning milestone on ${context.topic}.`;
      case "CAREER_PROGRESS":
        return `Progress update: ${context.title}.`;
      default:
        return `Learning ${context.topic}: ${context.title}.`;
    }
  }

  private buildOpportunityBody(context: RecruiterPostGenerationContext): string {
    const parts: string[] = [];

    if (context.summary) parts.push(context.summary.trim());

    const evidenceLines: string[] = [];
    for (const entry of context.evidence) {
      if (!entry.value) continue;
      const claimable = entry.confidence === "USER_CONFIRMED";
      if (claimable) {
        evidenceLines.push(entry.value.trim());
      } else {
        evidenceLines.push(this.learningFraming(entry.value));
      }
    }
    if (evidenceLines.length === 0) {
      const learned = context.journal.whatILearned;
      if (learned) evidenceLines.push(learned.trim());
    }

    const uniqueLines = Array.from(new Set(evidenceLines)).slice(0, 3);
    parts.push(...uniqueLines);

    if (context.journal.keyTakeaway) {
      parts.push(`Key takeaway: ${context.journal.keyTakeaway.trim()}.`);
    }

    if (parts.length === 0) {
      parts.push(
        `This is part of my 105-day full-stack development journey — working through ${context.topic}.`,
      );
    }

    return parts.join("\n\n");
  }

  /** Rewrites non-confirmed evidence into a learning statement, never a claim. */
  private learningFraming(value: string): string {
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    if (/^(i |my |we )/.test(lower)) {
      return `What I am learning about this: ${this.stripFirstPerson(trimmed)}`;
    }
    return `The course material covered: ${this.firstSentence(trimmed)}`;
  }

  private stripFirstPerson(value: string): string {
    const lower = value.toLowerCase();
    if (lower.startsWith("i ")) return value.slice(2).trim();
    if (lower.startsWith("my ")) return value.slice(3).trim();
    if (lower.startsWith("we ")) return value.slice(3).trim();
    return value;
  }

  private confirmedField(
    context: RecruiterPostGenerationContext,
    field: string,
  ): string | null {
    const entry = context.evidence.find(
      (e) => e.field === field && e.confidence === "USER_CONFIRMED",
    );
    return entry?.value?.trim() || null;
  }

  private buildOpportunityHashtags(context: RecruiterPostGenerationContext): string[] {
    const tags: string[] = [...recruiter.hashtags.platform];
    const meta = POST_TYPE_META[context.postType];

    // The opportunity genuinely belongs to the 105-day journey (it is derived
    // from a journal day / curriculum day) → journey hashtag is safe.
    tags.push(recruiter.hashtags.journey);

    for (const focus of meta.hashtagFocus) {
      if (tags.length >= recruiter.hashtags.max) break;
      if (!tags.includes(focus)) tags.push(focus);
    }

    const topicTag = this.toHashtag(context.topic);
    if (topicTag && tags.length < recruiter.hashtags.max && !tags.includes(topicTag)) {
      tags.push(topicTag);
    }

    return tags.slice(0, recruiter.hashtags.max);
  }

  private buildOpening(
    format: PostFormat,
    topic: string,
    dayNumber: number,
    journal: PostGenerationInput["journal"],
  ): string {
    const learned = journal.whatILearned;

    switch (format) {
      case "what-i-learned":
        return learned
          ? `Today I learned about ${topic}. ${this.firstSentence(learned)}`
          : `Today I studied ${topic}.`;

      case "challenge":
        return journal.challenge
          ? `Today I faced a challenge with ${topic}: ${this.firstSentence(journal.challenge)}`
          : `Today I worked on ${topic} and ran into something tricky.`;

      case "small-win":
        return learned
          ? `Small win today! ${this.firstSentence(learned)}`
          : `Made some progress on ${topic} today.`;

      case "project":
        return journal.projectName
          ? `Working on ${journal.projectName}: ${this.firstSentence(topic)}`
          : `Today I built something with ${topic}.`;

      case "concept":
        return learned
          ? `Here's what I understand about ${topic}: ${this.firstSentence(learned)}`
          : `Today I studied the concept of ${topic}.`;

      case "reflection":
        return learned
          ? `Day ${dayNumber} reflection: ${this.firstSentence(learned)}`
          : `Reflecting on day ${dayNumber} of my learning journey.`;

      case "practical-lesson":
        return learned
          ? `Practical lesson from ${topic}: ${this.firstSentence(learned)}`
          : `Something practical I learned about ${topic}.`;

      default:
        return `Today I worked on ${topic}.`;
    }
  }

  private buildBody(
    format: PostFormat,
    curriculum: PostGenerationInput["curriculum"],
    journal: PostGenerationInput["journal"],
  ): string {
    const parts: string[] = [];

    switch (format) {
      case "what-i-learned":
        if (journal.whatILearned) parts.push(journal.whatILearned);
        if (journal.whatIPracticed) parts.push(`I also practiced: ${journal.whatIPracticed}.`);
        if (journal.keyTakeaway) parts.push(`Key takeaway: ${journal.keyTakeaway}.`);
        break;

      case "challenge":
        if (journal.challenge) parts.push(`The challenge: ${journal.challenge}.`);
        if (journal.howISolvedIt) parts.push(`How I solved it: ${journal.howISolvedIt}.`);
        if (journal.keyTakeaway) parts.push(`What I learned: ${journal.keyTakeaway}.`);
        break;

      case "small-win":
        if (journal.whatIBuilt) parts.push(`I built: ${journal.whatIBuilt}.`);
        if (journal.whatILearned) parts.push(`I learned: ${journal.whatILearned}.`);
        break;

      case "project":
        if (journal.projectDescription) parts.push(journal.projectDescription);
        if (journal.whatIBuilt) parts.push(`What I built: ${journal.whatIBuilt}.`);
        if (journal.codeReference) parts.push(`Code: ${journal.codeReference}.`);
        break;

      case "concept":
        if (journal.whatILearned) parts.push(journal.whatILearned);
        if (journal.whatIPracticed) parts.push(`Practice: ${journal.whatIPracticed}.`);
        break;

      case "reflection":
        if (journal.whatILearned) parts.push(`What I learned: ${journal.whatILearned}.`);
        if (journal.keyTakeaway) parts.push(`Key takeaway: ${journal.keyTakeaway}.`);
        if (journal.tomorrowFocus) parts.push(`Tomorrow I'll focus on: ${journal.tomorrowFocus}.`);
        break;

      case "practical-lesson":
        if (journal.howISolvedIt) parts.push(`How I solved it: ${journal.howISolvedIt}.`);
        if (journal.resourcesUsed) parts.push(`Resources: ${journal.resourcesUsed}.`);
        if (journal.keyTakeaway) parts.push(`Takeaway: ${journal.keyTakeaway}.`);
        break;
    }

    if (parts.length === 0) {
      parts.push(`This is part of my 105-day full-stack development journey.`);
      if (curriculum.subtopics.length > 0) {
        parts.push(`Today covered: ${curriculum.subtopics.join(", ")}.`);
      }
    }

    return parts.join("\n\n");
  }

  private buildTakeaway(journal: PostGenerationInput["journal"]): string {
    return journal.keyTakeaway ?? "Every day builds on the last one.";
  }

  private buildNextStep(journal: PostGenerationInput["journal"]): string {
    return journal.tomorrowFocus ?? "Keep learning, keep building.";
  }

  private buildHashtags(topic: string, moduleTitle: string): string[] {
    const tags: string[] = ["#105DaysOfCode", "#FullStackDevelopment"];
    const topicTag = this.toHashtag(topic);
    if (topicTag) tags.push(topicTag);
    const moduleTag = this.toHashtag(moduleTitle);
    if (moduleTag && moduleTag !== topicTag) tags.push(moduleTag);
    return tags.slice(0, 5);
  }

  // ─── Image Metadata ─────────────────────────────────────────────────────

  private buildImage(input: PostGenerationInput): ImageMetadata {
    if (input.recruiter) {
      return this.buildOpportunityImage(input.recruiter);
    }
    const { curriculum, journal } = input;
    const headline = this.firstSentence(journal.whatILearned ?? curriculum.topic);
    const subheadline = curriculum.topic;
    const keywords = curriculum.subtopics.slice(0, 5);
    const visualConcept = `Learning ${curriculum.topic} — Module ${curriculum.moduleNumber}`;
    const template = "learner-progress";

    return { headline, subheadline, keywords, visualConcept, template };
  }

  /** Image metadata derived from the selected opportunity — never implies work the evidence does not support. */
  private buildOpportunityImage(context: RecruiterPostGenerationContext): ImageMetadata {
    const headline = context.title;
    const subheadline = context.summary ? this.firstSentence(context.summary) : context.topic;
    const keywords = [
      context.topic,
      ...POST_TYPE_META[context.postType].hashtagFocus.map((h) => h.replace(/^#/, "")),
    ].filter(Boolean).slice(0, 5);
    const visualConcept = `${POST_TYPE_META[context.postType].label} — ${context.topic}`;
    const template = this.templateForPostType(context.postType);

    return { headline, subheadline, keywords, visualConcept, template };
  }

  private templateForPostType(postType: RecruiterPostGenerationContext["postType"]): string {
    switch (postType) {
      case "PROJECT_SHOWCASE":
      case "API_INTEGRATION":
      case "AI_ENGINEERING":
      case "ENGINEERING_DECISION":
        return "project-focused";
      case "TECHNICAL_LESSON":
      case "LEARNING_MILESTONE":
      case "CAREER_PROGRESS":
        return "concept-diagram";
      case "DEBUGGING_STORY":
      case "PROBLEM_SOLUTION":
      case "SECURITY_LESSON":
      case "DEPLOYMENT_STORY":
      case "DATABASE_ENGINEERING":
        return "code-visual";
      default:
        return "learner-progress";
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private firstSentence(text: string): string {
    const trimmed = text.trim();
    const periodIndex = trimmed.indexOf(".");
    if (periodIndex !== -1) {
      return trimmed.slice(0, periodIndex + 1);
    }
    return trimmed;
  }

  private toHashtag(text: string): string {
    const cleaned = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "");
    return cleaned ? `#${cleaned}` : "";
  }
}
