import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState
        title="Settings coming soon"
        description="Integration and preference settings will be implemented in a later phase."
      />
    </>
  );
}
