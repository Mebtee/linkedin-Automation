import type { Metadata } from "next";

import { LinkedInConnectionCard } from "@/components/settings/linkedin-connection-card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Settings",
};

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams;
  const linkedinResult = Array.isArray(params.linkedin)
    ? params.linkedin[0]
    : params.linkedin ?? null;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage integrations, branding and content preferences."
      />
      <div className="space-y-6">
        <LinkedInConnectionCard initialCallbackResult={linkedinResult} />
      </div>
    </>
  );
}
