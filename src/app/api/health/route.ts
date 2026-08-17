import { NextResponse } from "next/server";

import { app } from "@/config/app";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type HealthResponse = {
  status: "ok" | "degraded" | "error";
  application: string;
  database: "connected" | "unavailable";
  timestamp: string;
};

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabase = createAdminClient();

    // Lightweight connectivity check — the RPC endpoint itself will fail
    // if the database is unreachable. We intentionally ignore the query
    // result; only the absence of a thrown error matters.
    const { error } = await supabase.rpc("version");

    // PostgREST returns an error when the function doesn't exist, but
    // the connection is still healthy. Only network / auth errors indicate
    // a real connectivity problem.
    const isConnected =
      error === null ||
      error.message.includes("function") ||
      error.message.includes("does not exist");

    if (isConnected) {
      return NextResponse.json({
        status: "ok",
        application: app.id,
        database: "connected",
        timestamp,
      } satisfies HealthResponse);
    }

    return NextResponse.json(
      {
        status: "degraded",
        application: app.id,
        database: "unavailable",
        timestamp,
      } satisfies HealthResponse,
      { status: 503 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        application: app.id,
        database: "unavailable",
        timestamp,
      } satisfies HealthResponse,
      { status: 500 },
    );
  }
}
