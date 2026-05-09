import { NextResponse } from "next/server";
import { getAnalysisRunSnapshot } from "@/lib/etl/analysis";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const { id } = await context.params;
  const snapshot = await getAnalysisRunSnapshot(id);

  return NextResponse.json({
    success: !snapshot.error,
    ...snapshot,
  });
}
