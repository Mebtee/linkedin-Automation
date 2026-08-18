import type { TextGenerationProvider } from "@/types/ai";
import { TemplateFallbackProvider } from "./providers/fallback";
import { GeminiTextProvider } from "./providers/gemini";

export type { TextGenerationProvider } from "@/types/ai";

// ─── Provider Registry ──────────────────────────────────────────────────────

const providers = new Map<string, () => TextGenerationProvider>([
  ["fallback", () => new TemplateFallbackProvider()],
  ["gemini", () => new GeminiTextProvider()],
]);

// ─── Provider Factory ───────────────────────────────────────────────────────

/**
 * Returns a TextGenerationProvider based on the AI_TEXT_PROVIDER environment
 * variable. Defaults to "fallback" if the variable is unset or invalid.
 *
 * Usage:
 *   const provider = getTextGenerationProvider();
 *   const result = await provider.generatePost(input);
 */
export function getTextGenerationProvider(): TextGenerationProvider {
  const providerName = getProviderName();
  const factory = providers.get(providerName);

  if (!factory) {
    throw new Error(
      `Unknown AI provider "${providerName}". ` +
        `Available providers: ${Array.from(providers.keys()).join(", ")}. ` +
        `Set AI_TEXT_PROVIDER to a valid provider name.`,
    );
  }

  return factory();
}

/**
 * Returns the name of the currently configured provider.
 */
export function getActiveProviderName(): string {
  return getProviderName();
}

/**
 * Returns the list of available provider names.
 */
export function getAvailableProviders(): string[] {
  return Array.from(providers.keys());
}

// ─── Internal ───────────────────────────────────────────────────────────────

function getProviderName(): string {
  const env = process.env.AI_TEXT_PROVIDER;
  return env && env.trim() !== "" ? env.trim().toLowerCase() : "fallback";
}
