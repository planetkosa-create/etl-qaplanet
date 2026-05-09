import { NextResponse } from "next/server";
import { getAnalysisSnapshot, resetAnalysisData } from "@/lib/etl/analysis";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getAnalysisSnapshot();

  return NextResponse.json({
    success: !snapshot.error || !snapshot.configured,
    ...snapshot,
  });
}

export async function DELETE() {
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
