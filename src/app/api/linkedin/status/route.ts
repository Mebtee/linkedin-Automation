import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getConnectionStatus } from "@/services/linkedin";

export const dynamic = "force-dynamic";

type StatusResponse = {
  readonly status: "connected" | "expired" | "disconnected";
  readonly connected_at: string | null;
  readonly linkedin_name: string | null;
  readonly linkedin_email: string | null;
};

/**
 * GET /api/linkedin/status
 *
 * Returns the LinkedIn connection status for the authenticated user.
 * Does NOT expose tokens or sensitive data.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const info = await getConnectionStatus(supabase, user.id);

    return NextResponse.json({
      status: info.status,
      connected_at: info.connected_at,
      linkedin_name: info.linkedin_name,
      linkedin_email: info.linkedin_email,
    } satisfies StatusResponse);
  } catch (error) {
    console.error("LinkedIn status check failed:", error);
    return NextResponse.json(
      { error: "Failed to check LinkedIn status" },
      { status: 500 },
    );
  }
}
