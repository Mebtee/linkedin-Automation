import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Login route-segment metadata.
 *
 * Placed in a layout (not page.tsx) because login/page.tsx is a Client
 * Component ("use client") and cannot export Next.js `metadata` directly.
 *
 * Previously this was incorrectly exported from src/lib/auth.ts (a utility
 * module), where it was never imported. Moved here in the security-hardening
 * phase (Phase SECURITY-HARDENING-01, finding 5).
 */
export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
