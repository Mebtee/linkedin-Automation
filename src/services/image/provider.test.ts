import { describe, it, expect } from "vitest";
import {
  getImageGenerationProvider,
  getActiveImageProviderName,
  getAvailableImageProviders,
} from "./index";

describe("Image Provider Factory", () => {
  it("returns a provider by default", () => {
    const provider = getImageGenerationProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.generateImage).toBe("function");
  });

  it("returns branded-svg as default provider name", () => {
    const name = getActiveImageProviderName();
    expect(name).toBe("branded-svg");
  });

  it("lists branded-svg as available", () => {
    const providers = getAvailableImageProviders();
    expect(providers).toContain("branded-svg");
  });

  it("throws for unknown provider name", () => {
    process.env.AI_IMAGE_PROVIDER = "nonexistent";
    try {
      expect(() => getImageGenerationProvider()).toThrow("Unknown image provider");
    } finally {
      delete process.env.AI_IMAGE_PROVIDER;
    }
  });
});
