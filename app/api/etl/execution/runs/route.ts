import { NextResponse } from "next/server";
import { createExecutionRun, getExecutionSnapshot, type CreateExecutionRunRequest } from "@/lib/etl/execution";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const url = new URL(request.url);
  const snapshot = await getExecutionSnapshot({
    projectId: url.searchParams.get("projectId"),
    executionRunId: url.searchParams.get("executionRunId"),
  });

  return NextResponse.json({
    success: !snapshot.error || !snapshot.configured,
    ...snapshot,
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const body = (await request.json()) as CreateExecutionRunRequest;
    const result = await createExecutionRun(body, auth.user.id);
    return NextResponse.json({
      success: true,
      run: result.run,
      results: result.results,
      message: `Execution run created with ${result.results.length} validation scripts.`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Execution run could not be created." },
      { status: 500 },
    );
  }
}
