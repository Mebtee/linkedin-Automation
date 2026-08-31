// ─── Theme Layer (Phase 5I professional redesign) ───────────────────────────
// Public entry for the branded 1600×900 theme, split into the three SVG layers:
//   BACKGROUND → renderBrandedBackground (white + navy diagonal split, decor)
//   CONTENT    → primitives (typography, nodes, arrows, pills, cards)
//   BRANDING   → renderBranding (TB logo + footer mark) + KEY TAKEAWAYS panel
// Every exported value is deterministic.

export * from "./geometry";
export * from "./background";
export * from "./primitives";
export * from "./branding";
export * from "./seeded";
export * from "./circuit";
export * from "./takeaways";
export * from "./takeaways-panel";