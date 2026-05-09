import { NextResponse } from "next/server";
import { generateAndSaveAuditReport, type AuditReportInput } from "@/lib/etl/audit-report";
import { requireUser } from "@/lib/supabase/require-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const body = (await request.json()) as AuditReportInput;
    if (!body.executionRunId) throw new Error("Choose an execution run before generating an audit report.");
    const result = await generateAndSaveAuditReport(body, auth.user.id);
    return NextResponse.json({
      success: true,
      reportId: result.report.id,
      fileName: result.fileName,
      content: result.content,
      message: "Audit report generated successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Audit report could not be generated." },
      { status: 500 },
    );
  }
}
