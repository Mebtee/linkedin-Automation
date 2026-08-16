import { NextResponse } from "next/server";

import { app } from "@/config/app";

export const dynamic = "force-dynamic";

type HealthResponse = {
  status: "ok" | "error";
  application: string;
  timestamp: string;
};

export function GET() {
  try {
    const body: HealthResponse = {
      status: "ok",
      application: app.id,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(body);
  } catch {
    const body: HealthResponse = {
      status: "error",
      application: app.id,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(body, { status: 500 });
  }
}
