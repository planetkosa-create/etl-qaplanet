import { NextResponse } from "next/server";
import { updateExecutionResult, type UpdateExecutionResultRequest } from "@/lib/etl/execution";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateExecutionResultRequest;
    const result = await updateExecutionResult(id, body);
    return NextResponse.json({ success: true, result, message: "Result updated successfully." });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Execution result could not be updated." },
      { status: 500 },
    );
  }
}
