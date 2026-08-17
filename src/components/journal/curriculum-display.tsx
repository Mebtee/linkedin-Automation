import type { CurriculumDayRow, ModuleRow } from "@/services/curriculum";

type CurriculumDisplayProps = {
  dayNumber: number;
  curriculumDay: CurriculumDayRow | null;
  currentModule: ModuleRow | null;
};

export function CurriculumDisplay({
  dayNumber,
  curriculumDay,
  currentModule,
}: CurriculumDisplayProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Today&apos;s Learning
      </h2>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#06B6D4]/10 px-2.5 py-0.5 text-xs font-medium text-[#06B6D4]">
            Day {dayNumber}
          </span>
          {currentModule && (
            <span className="inline-flex items-center rounded-full bg-[#0F172A]/10 px-2.5 py-0.5 text-xs font-medium text-[#0F172A] dark:bg-zinc-700 dark:text-zinc-300">
              Module {currentModule.module_number}
            </span>
          )}
        </div>

        {curriculumDay ? (
          <div className="mt-4 space-y-3">
            <h3 className="text-lg font-semibold text-[#111827] dark:text-zinc-50">
              {curriculumDay.topic}
            </h3>

            {curriculumDay.content && (
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {curriculumDay.content}
              </p>
            )}

            {curriculumDay.subtopics && curriculumDay.subtopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {curriculumDay.subtopics.map((sub) => (
                  <span
                    key={sub}
                    className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            )}

            {curriculumDay.project_information && (
              <div className="mt-3 rounded-lg bg-[#2563EB]/5 p-3 dark:bg-[#2563EB]/10">
                <p className="text-xs font-medium uppercase tracking-wider text-[#2563EB]">
                  Project
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {curriculumDay.project_information}
                </p>
              </div>
            )}

            {curriculumDay.assessment_information && (
              <div className="mt-2 rounded-lg bg-[#06B6D4]/5 p-3 dark:bg-[#06B6D4]/10">
                <p className="text-xs font-medium uppercase tracking-wider text-[#06B6D4]">
                  Assessment
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {curriculumDay.assessment_information}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Curriculum data for Day {dayNumber} is not available yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
