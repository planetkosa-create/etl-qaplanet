import { NextResponse } from "next/server";
import { getSqlSnapshot } from "@/lib/etl/sql";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const url = new URL(request.url);
  const snapshot = await getSqlSnapshot({
    projectId: url.searchParams.get("projectId"),
    analysisRunId: url.searchParams.get("analysisRunId"),
    databaseType: url.searchParams.get("databaseType"),
    validationCategory: url.searchParams.get("validationCategory"),
  });

  return NextResponse.json({
    success: !snapshot.error || !snapshot.configured,
    ...snapshot,
  });
}
