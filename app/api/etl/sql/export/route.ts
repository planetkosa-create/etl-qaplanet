import { NextResponse } from "next/server";
import { exportValidationScripts, type ExportRequest } from "@/lib/etl/sql";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, configured: false, error: "Supabase is not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ExportRequest;
    const result = await exportValidationScripts(body, auth.user.id);

    return NextResponse.json({
      success: true,
      configured: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, configured: true, error: error instanceof Error ? error.message : "Validation export could not be created." },
      { status: 500 },
    );
  }
}
