import { NextResponse } from "next/server";

import { createWriteClient } from "@/lib/supabase/server";
import { deleteConnection } from "@/services/linkedin";

export const dynamic = "force-dynamic";

/**
 * POST /api/linkedin/disconnect
 *
 * Removes the LinkedIn connection for the authenticated user.
 */
export async function POST() {
  try {
    const supabase = await createWriteClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { error } = await deleteConnection(supabase, user.id);

    if (error) {
      console.error("Failed to delete LinkedIn connection:", error);
      return NextResponse.json(
        { error: "Failed to disconnect" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LinkedIn disconnect failed:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 },
    );
  }
}
