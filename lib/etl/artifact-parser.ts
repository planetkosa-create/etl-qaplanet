import mammoth from "mammoth";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { getFileExtension, isSupportedExtension, type JsonValue } from "@/lib/etl/artifacts";

export type ParsedArtifact = {
  extractedText: string;
  extractedJson: JsonValue;
};

type CsvRow = Record<string, string | number | boolean | null>;

export async function parseArtifact(fileBuffer: Buffer, fileName: string, mimeType?: string): Promise<ParsedArtifact> {
  const extension = getFileExtension(fileName);

  if (!isSupportedExtension(extension)) {
    throw new Error("Unsupported file type. Upload DOCX, PDF, XLSX, CSV, or TXT files.");
  }

  if (extension === "txt") {
    return parseTxt(fileBuffer);
  }

  if (extension === "csv") {
    return parseCsv(fileBuffer);
  }

  if (extension === "xlsx") {
    return parseXlsx(fileBuffer);
  }

  if (extension === "docx") {
    return parseDocx(fileBuffer);
  }

  if (extension === "pdf") {
    return parsePdf(fileBuffer, mimeType);
  }

  throw new Error("Unsupported file type. Upload DOCX, PDF, XLSX, CSV, or TXT files.");
}

function parseTxt(fileBuffer: Buffer): ParsedArtifact {
  const text = fileBuffer.toString("utf8").trim();

  return {
    extractedText: text,
    extractedJson: {
      kind: "text",
      characterCount: text.length,
    },
  };
}

function parseCsv(fileBuffer: Buffer): ParsedArtifact {
  const csvText = fileBuffer.toString("utf8");
  const result = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${result.errors[0]?.message ?? "Invalid CSV content."}`);
  }

  const headers = result.meta.fields ?? [];
  const rows = result.data;

  return {
    extractedText: [
      `CSV File: ${headers.length} columns, ${rows.length} rows`,
      `Headers: ${headers.join(", ")}`,
      "",
      ...rows.slice(0, 500).map((row, index) => `Row ${index + 1}: ${headers.map((header) => `${header}=${row[header] ?? ""}`).join("; ")}`),
    ].join("\n"),
    extractedJson: {
      headers,
      rows,
    } as JsonValue,
  };
}

function parseXlsx(fileBuffer: Buffer): ParsedArtifact {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true,
    dense: false,
  });

  const sheets = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number | boolean | null>>(worksheet, {
      defval: null,
      raw: false,
    });

    return {
      name,
      rows,
    };
  });

  const extractedText = sheets
    .map((sheet) => {
      const previewRows = sheet.rows
        .slice(0, 300)
        .map((row, index) => `Row ${index + 1}: ${Object.entries(row).map(([key, value]) => `${key}=${value ?? ""}`).join("; ")}`);

      return [`Sheet: ${sheet.name}`, `Rows: ${sheet.rows.length}`, ...previewRows].join("\n");
    })
    .join("\n\n");

  return {
    extractedText,
    extractedJson: {
      sheets,
    } as JsonValue,
  };
}

async function parseDocx(fileBuffer: Buffer): Promise<ParsedArtifact> {
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer: fileBuffer }),
    mammoth.convertToHtml({ buffer: fileBuffer }),
  ]);

  const tableRows = extractSimpleHtmlTables(htmlResult.value);
  const warnings = [...textResult.messages, ...htmlResult.messages].map((message) => message.message);
  const extractedText = textResult.value.trim();

  return {
    extractedText,
    extractedJson: {
      paragraphs: extractedText.split(/\n{2,}/).filter(Boolean),
      tables: tableRows,
      warnings,
    } as JsonValue,
  };
}

async function parsePdf(fileBuffer: Buffer, mimeType?: string): Promise<ParsedArtifact> {
  if (mimeType && mimeType !== "application/pdf") {
    throw new Error("The selected file does not appear to be a valid PDF.");
  }

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
  let textResult!: Awaited<ReturnType<typeof parser.getText>>;
  let infoResult!: Awaited<ReturnType<typeof parser.getInfo>>;

  try {
    [textResult, infoResult] = await Promise.all([parser.getText(), parser.getInfo()]);
  } finally {
    await parser.destroy();
  }

  const text = textResult.text.trim();

  if (!text) {
    throw new Error("No readable text was found in this PDF. OCR is not supported in Phase 2.");
  }

  return {
    extractedText: text,
    extractedJson: {
      pages: textResult.total,
      info: makeJsonSafe(infoResult.info ?? null),
      fingerprints: infoResult.fingerprints ?? [],
    } as JsonValue,
  };
}

function extractSimpleHtmlTables(html: string) {
  const tables: string[][][] = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];

  for (const tableHtml of tableMatches) {
    const rows: string[][] = [];
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

    for (const rowHtml of rowMatches) {
      const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
        stripHtml(match[1]).trim(),
      );

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) {
      tables.push(rows);
    }
  }

  return tables;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

function makeJsonSafe(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => makeJsonSafe(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, makeJsonSafe(item)]),
    );
  }

  return String(value);
}
