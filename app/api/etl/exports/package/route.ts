import { NextResponse } from "next/server";
import { createValidationPackageZip, type ExportPackageRequest } from "@/lib/etl/export-package";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const body = (await request.json()) as ExportPackageRequest;
    const result = await createValidationPackageZip(body, auth.user.id);
    return NextResponse.json({
      success: true,
      fileName: result.fileName,
      fileContent: result.fileContent,
      contentType: result.contentType,
      encoding: result.encoding,
      manifest: result.manifest,
      message: "Validation package exported successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Validation package could not be exported." },
      { status: 500 },
    );
  }
}
