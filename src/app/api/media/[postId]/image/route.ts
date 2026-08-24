import "server-only";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/media/[postId]/image
 *
 * Serves the branded SVG image for a generated post to its owner only.
 *
 * Authorization flow:
 * 1. Require an authenticated session (401 otherwise).
 * 2. Load the media_assets row filtered by generated_post_id AND
 *    profile_id = user.id — RLS additionally enforces ownership, so another
 *    user's asset is indistinguishable from a missing one.
 * 3. Download the object bytes using the admin client with the storage path
 *    taken from the authorized DB row — never from user input.
 *
 * The bucket is private; this route is the only way images reach a browser.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

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

  const { data: asset } = await supabase
    .from("media_assets")
    .select("storage_path, mime_type")
    .eq("generated_post_id", postId)
    .eq("profile_id", user.id)
    .single();

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adminSupabase = createAdminClient();
  const { data: blob, error } = await adminSupabase.storage
    .from("post-images")
    .download(asset.storage_path);

  if (error || !blob) {
    console.error("Image download failed for owned media asset");
    return NextResponse.json(
      { error: "Failed to load image" },
      { status: 500 },
    );
  }

  return new NextResponse(blob, {
    headers: {
      "Content-Type": asset.mime_type ?? "image/svg+xml",
      "Cache-Control": "private, no-store",
    },
  });
}
