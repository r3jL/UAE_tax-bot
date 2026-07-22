import { extractText as pdfExtractText, getDocumentProxy } from "unpdf";
import { generateText } from "ai";
import { visionModel } from "./models";

// Pull readable text out of a file the user attaches to the chat, so it can be
// used as context. PDFs with a text layer, spreadsheets, CSV, DOCX and plain
// text are parsed locally (no LLM); images (and photos of documents) are
// transcribed by the vision model (OCR).

export interface FileInput {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}

export interface ExtractedDoc {
  name: string;
  text: string;
}

// Per-document context cap (chars). Env-overridable alongside the chat-level
// budgets in the chat route so the whole context policy tunes in one place.
const MAX_CHARS = Number(process.env.FILE_EXTRACT_MAX_CHARS ?? 8000);

const ext = (i: FileInput) => i.filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";

const isPdf = (i: FileInput) =>
  i.mimeType === "application/pdf" || ext(i) === ".pdf";

const isImage = (i: FileInput) =>
  i.mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(i.filename);

const isXlsx = (i: FileInput) =>
  i.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
  ext(i) === ".xlsx";

const isDocx = (i: FileInput) =>
  i.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  ext(i) === ".docx";

const isCsv = (i: FileInput) =>
  ["text/csv", "text/tab-separated-values"].includes(i.mimeType) ||
  [".csv", ".tsv"].includes(ext(i));

const isPlainText = (i: FileInput) =>
  i.mimeType.startsWith("text/") || [".txt", ".md"].includes(ext(i));

// Spreadsheet → readable CSV-style text, one section per sheet. Formula cells
// contribute their computed result (finance sheets are full of formulas).
async function xlsxToText(bytes: Uint8Array): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const parts: string[] = [];
  for (const ws of wb.worksheets) {
    const rows: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as unknown[])
        .slice(1) // exceljs row.values is 1-indexed
        .map((v) => {
          if (v == null) return "";
          if (typeof v === "object") {
            const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
            if (o.result != null) return String(o.result); // formula → result
            if (o.text != null) return String(o.text); // hyperlink / rich text
            if (o.richText) return o.richText.map((r) => r.text).join("");
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            return "";
          }
          return String(v);
        });
      rows.push(cells.join(", "));
    });
    if (rows.length) parts.push(`=== Sheet: ${ws.name} ===\n${rows.join("\n")}`);
  }
  return parts.join("\n\n");
}

export async function extractFileText(input: FileInput): Promise<ExtractedDoc> {
  if (isPdf(input)) {
    const pdf = await getDocumentProxy(input.bytes);
    const { text } = await pdfExtractText(pdf, { mergePages: true });
    const body = (Array.isArray(text) ? text.join("\n") : text) ?? "";
    if (body.trim().length < 20) {
      throw new Error(
        `"${input.filename}" looks like a scanned PDF with no text layer — upload it as an image (JPG/PNG) instead.`,
      );
    }
    return { name: input.filename, text: body.slice(0, MAX_CHARS) };
  }

  if (isImage(input)) {
    const { text } = await generateText({
      model: visionModel(),
      temperature: 0,
      maxOutputTokens: 1500,
      abortSignal: AbortSignal.timeout(50_000),
      system:
        "Transcribe ALL text from this document or image faithfully and completely — preserve figures, dates, names and reference numbers. End with a brief one-line note of what the document appears to be. Output plain text only, no preamble.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this document." },
            { type: "image", image: input.bytes, mediaType: input.mimeType },
          ],
        },
      ],
    });
    return { name: input.filename, text: (text ?? "").slice(0, MAX_CHARS) };
  }

  if (isXlsx(input)) {
    const body = await xlsxToText(input.bytes);
    if (!body.trim()) {
      throw new Error(`"${input.filename}" has no readable cells.`);
    }
    return { name: input.filename, text: body.slice(0, MAX_CHARS) };
  }

  if (isDocx(input)) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(input.bytes),
    });
    if (!value?.trim()) {
      throw new Error(`"${input.filename}" has no readable text.`);
    }
    return { name: input.filename, text: value.slice(0, MAX_CHARS) };
  }

  if (isCsv(input) || isPlainText(input)) {
    const body = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
    if (!body.trim()) {
      throw new Error(`"${input.filename}" is empty.`);
    }
    return { name: input.filename, text: body.slice(0, MAX_CHARS) };
  }

  throw new Error(
    `Unsupported file "${input.filename}". Upload a PDF, image (JPG/PNG), Excel (.xlsx), CSV, Word (.docx), or text file.`,
  );
}
