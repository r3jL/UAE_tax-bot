import { NextRequest, NextResponse } from "next/server";
import { extractInvoice } from "@/lib/ai/extract-invoice";
import { determineVat } from "@/lib/ai/determine";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — under Vercel's ~4.5 MB body limit

// One-shot: extract a single invoice's fields, then run the VAT determination
// (with the deterministic computation attached). Used by the bulk uploader so
// each file is a single round-trip.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach an invoice file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 4 MB)." }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fields = await extractInvoice({ bytes, mimeType: file.type, filename: file.name });
    const determination = await determineVat(fields);
    return NextResponse.json({ fields, determination });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
