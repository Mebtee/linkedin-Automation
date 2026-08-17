import type {
  TextGenerationProvider,
  PostGenerationInput,
  ProviderResult,
  GeneratedPost,
  ImageMetadata,
  PostFormat,
} from "@/types/ai";

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
    const { curriculum, journal, format } = input;
    const opening = this.buildOpening(format, curriculum.topic, curriculum.dayNumber, journal);
    const body = this.buildBody(format, curriculum, journal);
    const takeaway = this.buildTakeaway(journal);
    const nextStep = this.buildNextStep(journal);
    const hashtags = this.buildHashtags(curriculum.topic, curriculum.moduleTitle);

    return { opening, body, takeaway, nextStep, hashtags };
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
    const { curriculum, journal } = input;
    const headline = this.firstSentence(journal.whatILearned ?? curriculum.topic);
    const subheadline = curriculum.topic;
    const keywords = curriculum.subtopics.slice(0, 5);
    const visualConcept = `Learning ${curriculum.topic} — Module ${curriculum.moduleNumber}`;
    const template = "learner-progress";

    return { headline, subheadline, keywords, visualConcept, template };
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
