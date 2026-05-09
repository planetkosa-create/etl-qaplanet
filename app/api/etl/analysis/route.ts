import { NextResponse } from "next/server";
import { getAnalysisSnapshot, resetAnalysisData } from "@/lib/etl/analysis";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const snapshot = await getAnalysisSnapshot();

  return NextResponse.json({
    success: !snapshot.error || !snapshot.configured,
    ...snapshot,
  });
}

export async function DELETE() {
  const auth = await requireUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: "Supabase is not configured.",
      },
      { status: 503 },
    );
  }

  try {
    await resetAnalysisData();

    return NextResponse.json({
      success: true,
      configured: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: error instanceof Error ? error.message : "Analysis data could not be deleted.",
      },
      { status: 500 },
    );
  }
}
