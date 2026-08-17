export { getDayFromProfile, calculateCurrentDay } from "./dayProgress";
export type { DayProgress, Profile, CurriculumDayRow, ModuleRow } from "./dayProgress";

export {
  buildJournalStatusMap,
  enrichCurriculumDays,
  calculateCurriculumProgress,
  calculateModuleProgress,
  buildTodayLearning,
  dayStatusLabel,
  journalActionLabel,
} from "./integration";
