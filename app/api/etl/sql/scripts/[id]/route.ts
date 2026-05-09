import { NextResponse } from "next/server";
import { deleteValidationScript, getValidationScript } from "@/lib/etl/sql";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await context.params;
    const script = await getValidationScript(id);
    return NextResponse.json({ success: true, script });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Validation script could not be loaded." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const { id } = await context.params;
    await deleteValidationScript(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Validation script could not be deleted." },
      { status: 500 },
    );
  }
}
