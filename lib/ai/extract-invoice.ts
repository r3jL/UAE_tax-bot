import { generateObject } from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import { extractionModel, visionModel } from "./models";
import { invoiceFieldsContract, type InvoiceFields } from "./contracts";

// Reads a vendor invoice and extracts its fields for the VAT determination step.
// PDFs with a text layer are parsed locally (unpdf) and read by the text model;
// images (and scanned PDFs uploaded as images) go to the vision model.

const SYSTEM = `You read UAE vendor invoices and extract their fields accurately.
Use exactly what is printed — never invent or infer a VAT amount that is not shown.
Capture EVERY line item in lineItems (an invoice often has several rows, e.g. materials AND equipment hire — never drop one). Make "description" a short summary of what was supplied, built from the line items — NOT the invoice's footer notes, payment terms, or disclaimers.
AMOUNTS: read the invoice's TOTAL rows — subtotal = the net total excluding VAT, vatAmount = the total VAT charged on the whole invoice, total = the grand total payable. When the invoice has both a per-line VAT column AND a totals section, use the TOTALS. Never leave subtotal/vatAmount/total blank if the invoice shows any amounts.
Work out the vendor's country from its address. If a field is absent, return "" (or null where the schema allows it).
LANGUAGE: set "language" to the invoice's primary script — "ar" if it is written in Arabic, "mixed" if it is bilingual Arabic + English (very common in the UAE), "en" if English only. Read Arabic invoices fully: translate Arabic field values (vendor name, description) to English, and convert Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) in amounts to Western digits.
Each field value must contain ONLY the value itself (e.g. "5,040.00 AED") — never commentary, reasoning, or phrases like "not provided" or "can be inferred".`;

const PROMPT = "Extract this invoice's fields into the schema.";

export interface InvoiceInput {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}

// UAE vendor invoices are frequently bilingual (Arabic + English) or Arabic-only.
// On the PDF-text path we already hold the extracted text, so we detect the
// script deterministically — counting Arabic vs Latin letters is exact and free,
// which makes it the source of truth there (LLMs are unreliable at self-reporting
// meta-fields like language). The image path has no pre-OCR text, so there we
// trust the vision model's "language" field instead.
function detectScriptLanguage(text: string): InvoiceFields["language"] {
  let arabic = 0;
  let latin = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (
      (c >= 0x0600 && c <= 0x06ff) || // Arabic
      (c >= 0x0750 && c <= 0x077f) || // Arabic Supplement
      (c >= 0x08a0 && c <= 0x08ff) || // Arabic Extended-A
      (c >= 0xfb50 && c <= 0xfdff) || // Arabic Presentation Forms-A
      (c >= 0xfe70 && c <= 0xfeff) //   Arabic Presentation Forms-B
    ) {
      arabic++;
    } else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) {
      latin++;
    }
  }
  if (arabic < 4) return latin > 0 ? "en" : "unknown"; // ignore a stray glyph/logo
  if (latin === 0) return "ar";
  const arabicRatio = arabic / (arabic + latin);
  if (arabicRatio >= 0.85) return "ar";
  if (arabicRatio <= 0.15) return "en";
  return "mixed";
}

function isPdf(i: InvoiceInput): boolean {
  return i.mimeType === "application/pdf" || i.filename.toLowerCase().endsWith(".pdf");
}

function isImage(i: InvoiceInput): boolean {
  return i.mimeType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(i.filename);
}

export async function extractInvoice(input: InvoiceInput): Promise<InvoiceFields> {
  if (isPdf(input)) {
    const pdf = await getDocumentProxy(input.bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const body = Array.isArray(text) ? text.join("\n") : text;
    if (!body || body.trim().length < 40) {
      throw new Error(
        "This looks like a scanned PDF with no text layer. Please upload it as an image (JPG/PNG) instead.",
      );
    }
    const { object } = await generateObject({
      model: extractionModel(),
      schema: invoiceFieldsContract,
      temperature: 0,
      maxOutputTokens: 2000, // bound output — stops free models running away
      abortSignal: AbortSignal.timeout(50_000), // never hang forever
      system: SYSTEM,
      prompt: `${PROMPT}\n\nInvoice text:\n\n${body.slice(0, 12000)}`,
    });
    // Script detection on the real text beats the model's self-report; only keep
    // the model's value when the text carried no letters to judge from.
    const detected = detectScriptLanguage(body);
    return { ...object, language: detected === "unknown" ? object.language : detected };
  }

  if (isImage(input)) {
    const { object } = await generateObject({
      model: visionModel(),
      schema: invoiceFieldsContract,
      temperature: 0,
      maxOutputTokens: 2000,
      abortSignal: AbortSignal.timeout(50_000),
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image", image: input.bytes, mediaType: input.mimeType },
          ],
        },
      ],
    });
    return object;
  }

  throw new Error("Unsupported file type. Upload a PDF, JPG, or PNG invoice.");
}
