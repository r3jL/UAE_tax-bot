import { extractText as pdfExtractText, getDocumentProxy } from "unpdf";
import { generateText } from "ai";
import { visionModel } from "./models";

// Pull readable text out of a file the user attaches to the chat, so it can be
// used as context. PDFs with a text layer are parsed locally (no LLM); images
// (and photos of documents) are transcribed by the vision model (OCR).

export interface FileInput {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}

export interface ExtractedDoc {
  name: string;
  text: string;
}

const MAX_CHARS = 8000; // keep one document's context bounded

const isPdf = (i: FileInput) =>
  i.mimeType === "application/pdf" || i.filename.toLowerCase().endsWith(".pdf");

const isImage = (i: FileInput) =>
  i.mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(i.filename);

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

  throw new Error(`Unsupported file "${input.filename}". Upload a PDF, JPG, or PNG.`);
}
