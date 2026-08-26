export {
  extractPdfText,
  analyzePages,
} from "./extraction";
export type { PageStructure } from "./extraction";
export { matchCurriculum } from "./matching";
export type { CurriculumSourceData } from "./matching";
export { detectDaySections } from "./multi-day";
export {
  buildJournalFromCourseMaterial,
  collectLearningStatements,
} from "./journal-builder";
export {
  enhanceProposalWithAI,
  buildEnhancementPrompt,
  validateEnhancement,
} from "./ai-enhance";
export {
  getMaxPdfSizeMb,
  sanitizeFileName,
  validatePdfUpload,
  computeContentHash,
} from "./validation";
export {
  ingestCourseMaterial,
  reprocessCourseMaterial,
  listOwnCourseMaterials,
  getOwnCourseMaterial,
  getOwnCourseMaterialPage,
  getOwnCourseMaterialPages,
  deleteOwnCourseMaterial,
} from "./persistence";
