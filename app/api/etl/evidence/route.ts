import { NextResponse } from "next/server";
import { getEvidenceFiles } from "@/lib/etl/evidence";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const url = new URL(request.url);
    const evidence = await getEvidenceFiles({
      projectId: url.searchParams.get("projectId"),
      executionRunId: url.searchParams.get("executionRunId"),
      executionResultId: url.searchParams.get("executionResultId"),
    });
    return NextResponse.json({ success: true, evidence });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Evidence files could not be loaded." },
      { status: 500 },
    );
  }
}
