import { NextResponse } from "next/server";
import { getAnalysisRunSnapshot } from "@/lib/etl/analysis";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const snapshot = await getAnalysisRunSnapshot(id);

  return NextResponse.json({
    success: !snapshot.error,
    ...snapshot,
  });
}
