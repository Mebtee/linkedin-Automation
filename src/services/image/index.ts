import type { ImageGenerationProvider } from "@/types/image";
import { BrandedSvgProvider } from "./providers/branded-svg";

export type { ImageGenerationProvider } from "@/types/image";

// ─── Provider Registry ──────────────────────────────────────────────────────

const providers = new Map<string, () => ImageGenerationProvider>([
  ["branded-svg", () => new BrandedSvgProvider()],
]);

// ─── Provider Factory ───────────────────────────────────────────────────────

/**
 * Returns an ImageGenerationProvider based on the AI_IMAGE_PROVIDER environment
 * variable. Defaults to "branded-svg" if the variable is unset or invalid.
 */
export function getImageGenerationProvider(): ImageGenerationProvider {
  const providerName = getProviderName();
  const factory = providers.get(providerName);

  if (!factory) {
    throw new Error(
      `Unknown image provider "${providerName}". ` +
        `Available providers: ${Array.from(providers.keys()).join(", ")}. ` +
        `Set AI_IMAGE_PROVIDER to a valid provider name.`,
    );
  }

  return factory();
}

/**
 * Returns the name of the currently configured image provider.
 */
export function getActiveImageProviderName(): string {
  return getProviderName();
}

/**
 * Returns the list of available image provider names.
 */
export function getAvailableImageProviders(): string[] {
  return Array.from(providers.keys());
}

// ─── Internal ───────────────────────────────────────────────────────────────

function getProviderName(): string {
  const env = process.env.AI_IMAGE_PROVIDER;
  return env && env.trim() !== "" ? env.trim().toLowerCase() : "branded-svg";
}
