import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { CourseMaterialsClient } from "@/components/course-materials/course-materials-client";

export const metadata: Metadata = {
  title: "Course Materials",
};

export default async function CourseMaterialsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Course Materials</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Upload a course PDF to draft a journal entry automatically. You always review and
          confirm everything before it is saved.
        </p>
      </div>

      <CourseMaterialsClient />
    </div>
  );
}
