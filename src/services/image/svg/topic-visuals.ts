// ─── Topic → Visual Mapping ─────────────────────────────────────────────────
// Maps common curriculum topics to simple visual elements for SVG templates.
// Each topic maps to a description that the template renderer can use.
// Visuals are kept clean, modern, and simple.

export interface TopicVisual {
  readonly label: string;
  readonly icon: "code" | "blocks" | "nodes" | "stack" | "tree" | "chart" | "gears" | "book";
}

const TOPIC_VISUAL_MAP: Record<string, TopicVisual> = {
  "git": { label: "Git", icon: "nodes" },
  "python": { label: "Python", icon: "code" },
  "oop": { label: "OOP", icon: "blocks" },
  "object-oriented": { label: "OOP", icon: "blocks" },
  "solid": { label: "SOLID", icon: "gears" },
  "arrays": { label: "Arrays", icon: "blocks" },
  "hashmaps": { label: "Hashmaps", icon: "blocks" },
  "hash map": { label: "Hashmaps", icon: "blocks" },
  "dictionary": { label: "Dictionaries", icon: "blocks" },
  "linked list": { label: "Linked Lists", icon: "nodes" },
  "linked lists": { label: "Linked Lists", icon: "nodes" },
  "stack": { label: "Stacks", icon: "stack" },
  "stacks": { label: "Stacks", icon: "stack" },
  "queue": { label: "Queues", icon: "stack" },
  "queues": { label: "Queues", icon: "stack" },
  "recursion": { label: "Recursion", icon: "tree" },
  "searching": { label: "Searching", icon: "chart" },
  "sorting": { label: "Sorting", icon: "chart" },
  "trees": { label: "Trees", icon: "tree" },
  "binary tree": { label: "Binary Trees", icon: "tree" },
  "graphs": { label: "Graphs", icon: "nodes" },
  "graph": { label: "Graphs", icon: "nodes" },
  "heaps": { label: "Heaps", icon: "tree" },
  "heap": { label: "Heaps", icon: "tree" },
  "html": { label: "HTML", icon: "code" },
  "css": { label: "CSS", icon: "code" },
  "javascript": { label: "JavaScript", icon: "code" },
  "typescript": { label: "TypeScript", icon: "code" },
  "react": { label: "React", icon: "blocks" },
  "next.js": { label: "Next.js", icon: "blocks" },
  "nextjs": { label: "Next.js", icon: "blocks" },
  "node.js": { label: "Node.js", icon: "gears" },
  "nodejs": { label: "Node.js", icon: "gears" },
  "express": { label: "Express", icon: "gears" },
  "database": { label: "Databases", icon: "blocks" },
  "sql": { label: "SQL", icon: "blocks" },
  "postgresql": { label: "PostgreSQL", icon: "blocks" },
  "supabase": { label: "Supabase", icon: "blocks" },
  "api": { label: "APIs", icon: "gears" },
  "rest": { label: "REST APIs", icon: "gears" },
  "authentication": { label: "Auth", icon: "gears" },
  "testing": { label: "Testing", icon: "chart" },
  "deployment": { label: "Deployment", icon: "gears" },
  "docker": { label: "Docker", icon: "blocks" },
  "algorithm": { label: "Algorithms", icon: "chart" },
  "algorithms": { label: "Algorithms", icon: "chart" },
  "data structure": { label: "Data Structures", icon: "blocks" },
  "data structures": { label: "Data Structures", icon: "blocks" },
  "project": { label: "Project", icon: "book" },
  "architecture": { label: "Architecture", icon: "gears" },
  "design pattern": { label: "Design Patterns", icon: "gears" },
  "design patterns": { label: "Design Patterns", icon: "gears" },
  "function": { label: "Functions", icon: "code" },
  "functions": { label: "Functions", icon: "code" },
  "variable": { label: "Variables", icon: "code" },
  "variables": { label: "Variables", icon: "code" },
  "loop": { label: "Loops", icon: "code" },
  "loops": { label: "Loops", icon: "code" },
  "condition": { label: "Conditionals", icon: "code" },
  "conditionals": { label: "Conditionals", icon: "code" },
  "string": { label: "Strings", icon: "code" },
  "strings": { label: "Strings", icon: "code" },
  "number": { label: "Numbers", icon: "code" },
  "numbers": { label: "Numbers", icon: "code" },
  "boolean": { label: "Booleans", icon: "code" },
  "booleans": { label: "Booleans", icon: "code" },
  "object": { label: "Objects", icon: "blocks" },
  "objects": { label: "Objects", icon: "blocks" },
  "class": { label: "Classes", icon: "blocks" },
  "classes": { label: "Classes", icon: "blocks" },
  "inheritance": { label: "Inheritance", icon: "tree" },
  "polymorphism": { label: "Polymorphism", icon: "blocks" },
  "encapsulation": { label: "Encapsulation", icon: "gears" },
  "abstraction": { label: "Abstraction", icon: "gears" },
  "closure": { label: "Closures", icon: "code" },
  "closures": { label: "Closures", icon: "code" },
  "promise": { label: "Promises", icon: "gears" },
  "promises": { label: "Promises", icon: "gears" },
  "async": { label: "Async/Await", icon: "gears" },
  "async/await": { label: "Async/Await", icon: "gears" },
  "dom": { label: "DOM", icon: "blocks" },
  "event": { label: "Events", icon: "gears" },
  "events": { label: "Events", icon: "gears" },
  "component": { label: "Components", icon: "blocks" },
  "components": { label: "Components", icon: "blocks" },
  "state": { label: "State", icon: "blocks" },
  "hook": { label: "Hooks", icon: "blocks" },
  "hooks": { label: "Hooks", icon: "blocks" },
  "routing": { label: "Routing", icon: "nodes" },
  "middleware": { label: "Middleware", icon: "gears" },
};

/**
 * Looks up visual metadata for a curriculum topic.
 * Returns a default if no match is found.
 */
export function getTopicVisual(topic: string): TopicVisual {
  const normalized = topic.toLowerCase().trim();

  // Direct match
  if (TOPIC_VISUAL_MAP[normalized]) {
    return TOPIC_VISUAL_MAP[normalized];
  }

  // Partial match — check if any key is contained in the topic
  for (const [key, value] of Object.entries(TOPIC_VISUAL_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Default
  return { label: topic, icon: "book" };
}
