import { NextResponse } from "next/server";
import { getValidationScript } from "@/lib/etl/sql";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await context.params;
    const script = await getValidationScript(id);
    return NextResponse.json({ success: true, sqlText: script.sql_text });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Validation script could not be copied." },
      { status: 500 },
    );
  }
}
