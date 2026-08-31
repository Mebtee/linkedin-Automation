import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { buildVisualBrief } from "@/services/image/visual/brief";
import { renderVisualBrief } from "@/services/image/visual/compositions";
import { loadLogoEmbed } from "@/services/image/logo";
import { checkSvgSafety } from "@/services/image/svg/escape";
import { initEmbeddedFont } from "@/services/image/fonts";
import type { GeneratedPostRow } from "@/types/generated-post";

function basePost(overrides: Partial<GeneratedPostRow> = {}): GeneratedPostRow {
  return {
    id: "post-1",
    profile_id: "prof-1",
    journal_entry_id: "entry-1",
    day_number: 23,
    status: "draft",
    format: "concept",
    opening: "",
    body: "",
    takeaway: "",
    next_step: "",
    hashtags: [],
    image_headline: null,
    image_subheadline: null,
    image_keywords: null,
    image_visual_concept: null,
    image_template: null,
    provider: "test",
    model: "test",
    tokens_used: 0,
    content_hash: "hash",
    opportunity_id: null,
    recruiter_quality_score: null,
    recruiter_quality_report: null,
    linkedin_post_id: null,
    published_at: null,
    publish_error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const FIXTURES: Array<{ label: string; postType: string | null; topic: string; post: Partial<GeneratedPostRow> }> = [
  {
    label: "python",
    postType: "TECHNICAL_LESSON",
    topic: "Python Collections, Files & Errors",
    post: {
      opening: "Learning Python Collections, Files & Errors.",
      body: "Section 5 covers lists, tuples, dictionaries, sets and comprehensions; Section 7 covers reading and writing files.",
      takeaway: "Python collections, file I/O and error handling are the foundation of data processing.",
      next_step: "Apply these patterns to batch file processing.",
      image_headline: "Python Collections, Files & Errors",
    },
  },
  {
    label: "rest-api",
    postType: "API_INTEGRATION",
    topic: "Building a REST API",
    post: {
      opening: "I built a REST API for the notes app.",
      body: "The client sends a request to the endpoint, the route validates the payload and returns a response.",
      takeaway: "A clean client → endpoint → response flow keeps the API predictable.",
      next_step: "Add schema validation on every endpoint next.",
    },
  },
  {
    label: "database",
    postType: "DATABASE_ENGINEERING",
    topic: "Database Indexing",
    post: {
      opening: "A query was slow because it scanned every row.",
      body: "Adding a database index turned the lookup into a fast path to the right rows.",
      takeaway: "The right index avoids a full table scan and keeps lookups fast.",
      next_step: "Inspect the query plan to confirm the index is used.",
    },
  },
  {
    label: "auth",
    postType: "SECURITY_LESSON",
    topic: "Authentication & Tokens",
    post: {
      opening: "Authentication verifies identity; authorization grants access.",
      body: "A token proves who you are and validation protects every protected route.",
      takeaway: "Confirm identity first, then validate access per route.",
      next_step: "Shorten token lifetime and test the refresh flow.",
    },
  },
  {
    label: "react",
    postType: "PROJECT_SHOWCASE",
    topic: "React Components & State",
    post: {
      opening: "React components render the UI from state and props.",
      body: "State drives what the user sees; props let parent components pass data down to children.",
      takeaway: "One component, one responsibility, one source of state.",
      next_step: "Lift state up where two components share it.",
    },
  },
];

async function main(): Promise<void> {
  const outDir = join(process.cwd(), "scripts", "samples");
  mkdirSync(outDir, { recursive: true });
  const logo = await loadLogoEmbed();
  await initEmbeddedFont();

  for (const f of FIXTURES) {
    const brief = buildVisualBrief({
      post: basePost(f.post),
      topic: f.topic,
      moduleNumber: 2,
      moduleTitle: "Backend Module",
      postType: f.postType,
    });
    const svg = renderVisualBrief(brief, logo);
    const safety = checkSvgSafety(svg);
    if (safety) throw new Error(`${f.label}: unsafe SVG — ${safety}`);

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const meta = await sharp(png).metadata();

    writeFileSync(join(outDir, `${f.label}.svg`), svg, "utf8");
    writeFileSync(join(outDir, `${f.label}.png`), png);

    console.log(`--- ${f.label} ---`);
    console.log(`composition: ${brief.composition}`);
    console.log(`concept: ${brief.concept}`);
    console.log(`metaphor: ${brief.visualMetaphor}`);
    console.log(`headline: ${brief.headline}`);
    console.log(`takeaways: [${brief.keyTakeaways?.join(", ") ?? ""}]`);
    console.log(`png: ${meta.width}x${meta.height}`);
  }
  console.log("\nWrote samples to scripts/samples/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
