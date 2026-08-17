import { describe, it, expect } from "vitest";
import { getTopicVisual } from "./topic-visuals";

describe("getTopicVisual", () => {
  it("returns exact match for known topic", () => {
    const result = getTopicVisual("Python");
    expect(result.label).toBe("Python");
    expect(result.icon).toBe("code");
  });

  it("returns match for OOP", () => {
    const result = getTopicVisual("Object-Oriented Programming");
    expect(result.icon).toBe("blocks");
  });

  it("returns match for SOLID", () => {
    const result = getTopicVisual("SOLID Principles");
    expect(result.icon).toBe("gears");
  });

  it("returns match for arrays", () => {
    const result = getTopicVisual("Arrays and Lists");
    expect(result.icon).toBe("blocks");
  });

  it("returns match for trees", () => {
    const result = getTopicVisual("Binary Trees");
    expect(result.icon).toBe("tree");
  });

  it("returns match for graphs", () => {
    const result = getTopicVisual("Graph Algorithms");
    expect(result.icon).toBe("nodes");
  });

  it("returns match for linked lists", () => {
    const result = getTopicVisual("Linked Lists");
    expect(result.icon).toBe("nodes");
  });

  it("returns match for recursion", () => {
    const result = getTopicVisual("Recursion");
    expect(result.icon).toBe("tree");
  });

  it("returns match for sorting", () => {
    const result = getTopicVisual("Sorting Algorithms");
    expect(result.icon).toBe("chart");
  });

  it("returns match for searching", () => {
    const result = getTopicVisual("Searching");
    expect(result.icon).toBe("chart");
  });

  it("returns default for unknown topic", () => {
    const result = getTopicVisual("Quantum Computing");
    expect(result.label).toBe("Quantum Computing");
    expect(result.icon).toBe("book");
  });

  it("handles case insensitive matching", () => {
    const result = getTopicVisual("PYTHON");
    expect(result.icon).toBe("code");
  });

  it("handles partial matches", () => {
    const result = getTopicVisual("React Hooks");
    expect(result.icon).toBe("blocks");
  });
});
