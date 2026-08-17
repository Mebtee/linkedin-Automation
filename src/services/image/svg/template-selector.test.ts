import { describe, it, expect } from "vitest";
import { selectTemplate } from "./template-selector";

describe("selectTemplate", () => {
  it("returns explicit template when valid", () => {
    const result = selectTemplate({
      explicitTemplate: "code-visual",
      dayNumber: 1,
      topic: "Introduction",
    });
    expect(result).toBe("code-visual");
  });

  it("ignores invalid explicit template", () => {
    const result = selectTemplate({
      explicitTemplate: "invalid-template",
      dayNumber: 1,
      topic: "Introduction",
    });
    expect(result).toBe("large-number");
  });

  it("ignores null explicit template", () => {
    const result = selectTemplate({
      explicitTemplate: null,
      dayNumber: 1,
      topic: "Introduction",
    });
    expect(result).toBe("large-number");
  });

  it("returns final-milestone for day 105", () => {
    const result = selectTemplate({
      dayNumber: 105,
      topic: "Final Assessment",
    });
    expect(result).toBe("final-milestone");
  });

  it("returns project-focused for project format", () => {
    const result = selectTemplate({
      dayNumber: 10,
      topic: "Building a Website",
      format: "project",
    });
    expect(result).toBe("project-focused");
  });

  it("returns project-focused when topic contains 'project'", () => {
    const result = selectTemplate({
      dayNumber: 10,
      topic: "Project Setup",
    });
    expect(result).toBe("project-focused");
  });

  it("returns concept-diagram for OOP topics", () => {
    const result = selectTemplate({
      dayNumber: 20,
      topic: "Object-Oriented Programming",
    });
    expect(result).toBe("concept-diagram");
  });

  it("returns concept-diagram for SOLID topics", () => {
    const result = selectTemplate({
      dayNumber: 25,
      topic: "SOLID Principles",
    });
    expect(result).toBe("concept-diagram");
  });

  it("returns concept-diagram for recursion topics", () => {
    const result = selectTemplate({
      dayNumber: 30,
      topic: "Recursion",
    });
    expect(result).toBe("concept-diagram");
  });

  it("returns code-visual for JavaScript topics", () => {
    const result = selectTemplate({
      dayNumber: 5,
      topic: "JavaScript Basics",
    });
    expect(result).toBe("code-visual");
  });

  it("returns code-visual for Python topics", () => {
    const result = selectTemplate({
      dayNumber: 15,
      topic: "Python Functions",
    });
    expect(result).toBe("code-visual");
  });

  it("returns code-visual for React topics", () => {
    const result = selectTemplate({
      dayNumber: 40,
      topic: "React Components",
    });
    expect(result).toBe("code-visual");
  });

  it("returns progress for milestone days (25th)", () => {
    const result = selectTemplate({
      dayNumber: 25,
      topic: "Week 4 Summary",
    });
    expect(result).toBe("progress");
  });

  it("returns progress for day 50", () => {
    const result = selectTemplate({
      dayNumber: 50,
      topic: "Midway Check-in",
    });
    expect(result).toBe("progress");
  });

  it("returns progress for day 75", () => {
    const result = selectTemplate({
      dayNumber: 75,
      topic: "Three Quarter Mark",
    });
    expect(result).toBe("progress");
  });

  it("returns large-number as default", () => {
    const result = selectTemplate({
      dayNumber: 3,
      topic: "General Learning",
    });
    expect(result).toBe("large-number");
  });
});
