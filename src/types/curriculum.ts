export type CurriculumDay = {
  /** 1-based day number within the journey. */
  day: number;
  title: string;
  description?: string;
  topics: string[];
  resources?: string[];
};

export type Curriculum = {
  id: string;
  title: string;
  description: string;
  totalDays: number;
  days: CurriculumDay[];
};
