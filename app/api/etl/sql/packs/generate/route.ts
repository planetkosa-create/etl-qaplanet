import { NextResponse } from "next/server";
import { generateValidationPacksForScripts } from "@/lib/etl/sql";
import { normalizeDatabaseType } from "@/lib/etl/sql-generator";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

type GeneratePacksRequest = {
  projectId?: string | null;
  analysisRunId?: string | null;
  databaseType?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, configured: false, error: "Supabase is not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as GeneratePacksRequest;
    const packs = await generateValidationPacksForScripts({
      projectId: body.projectId ?? null,
      userId: auth.user.id,
      analysisRunId: body.analysisRunId ?? null,
      databaseType: normalizeDatabaseType(body.databaseType),
    });

    return NextResponse.json({ success: true, configured: true, packs });
  } catch (error) {
    return NextResponse.json(
      { success: false, configured: true, error: error instanceof Error ? error.message : "Validation packs could not be generated." },
      { status: 500 },
    );
  }
}
