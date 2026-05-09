import { NextResponse } from "next/server";
import { getExecutionRunDetails } from "@/lib/etl/execution";
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
    const details = await getExecutionRunDetails(id);
    return NextResponse.json({ success: true, ...details });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Execution run could not be loaded." },
      { status: 500 },
    );
  }
}
