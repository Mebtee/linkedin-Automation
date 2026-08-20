import type { Metadata } from "next";

import { LinkedInConnectionCard } from "@/components/settings/linkedin-connection-card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage integrations, branding and content preferences."
      />
      <div className="space-y-6">
        <LinkedInConnectionCard />
      </div>
    </>
  );
}
