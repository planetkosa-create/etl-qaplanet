import { NextResponse } from "next/server";
import { deleteArtifact, getArtifact } from "@/lib/etl/artifacts";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
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
    const { id } = await context.params;
    const artifact = await getArtifact(id);

    return NextResponse.json({
      success: true,
      configured: true,
      artifact,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: error instanceof Error ? error.message : "Artifact could not be loaded.",
      },
      { status: 404 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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
    const { id } = await context.params;
    await deleteArtifact(id);

    return NextResponse.json({
      success: true,
      configured: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        error: error instanceof Error ? error.message : "Artifact could not be deleted.",
      },
      { status: 500 },
    );
  }
}
