import { NextResponse } from "next/server";
import { uploadEvidenceFile } from "@/lib/etl/evidence";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const executionRunId = String(formData.get("executionRunId") ?? "");
    if (!(file instanceof File)) throw new Error("Choose an evidence file to upload.");
    if (!executionRunId) throw new Error("Choose an execution run before uploading evidence.");

    const evidence = await uploadEvidenceFile({
      projectId: stringOrNull(formData.get("projectId")),
      executionRunId,
      executionResultId: stringOrNull(formData.get("executionResultId")),
      scriptId: stringOrNull(formData.get("scriptId")),
      evidenceType: stringOrNull(formData.get("evidenceType")),
      notes: stringOrNull(formData.get("notes")),
      file,
    }, auth.user.id);

    return NextResponse.json({ success: true, evidence, message: "Evidence uploaded successfully." });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Evidence could not be uploaded." },
      { status: 500 },
    );
  }
}

function stringOrNull(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
