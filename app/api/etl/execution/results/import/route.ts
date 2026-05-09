import { NextResponse } from "next/server";
import { importExecutionResults, parseImportedExecutionResults } from "@/lib/etl/execution";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

type ImportBody = {
  projectId?: string | null;
  input?: string;
  runName?: string | null;
  databaseType?: string | null;
  environmentName?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const body = (await request.json()) as ImportBody;
    const parsed = parseImportedExecutionResults(body.input ?? "");
    const result = await importExecutionResults({
      ...parsed,
      projectId: body.projectId,
      runName: body.runName ?? parsed.runName,
      databaseType: body.databaseType ?? parsed.databaseType,
      environmentName: body.environmentName ?? parsed.environmentName,
    }, auth.user.id);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Imported ${result.results.length} execution results${result.unmatched ? ` with ${result.unmatched} unmatched script(s)` : ""}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Execution results could not be imported." },
      { status: 500 },
    );
  }
}
