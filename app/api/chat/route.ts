import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ai/answer";
import { extractFileText } from "@/lib/ai/extract-text";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless body limit headroom
const MAX_FILES = 4;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let question = "";
    let taxType: "CT" | "VAT" | undefined;
    const attachedDocs: { name: string; text: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      question = String(form.get("question") ?? "");
      const tt = form.get("taxType");
      taxType = tt ? (String(tt) as "CT" | "VAT") : undefined;

      const files = form
        .getAll("files")
        .filter((f): f is File => f instanceof File)
        .slice(0, MAX_FILES);

      for (const f of files) {
        if (f.size > MAX_BYTES) {
          return NextResponse.json(
            { error: `"${f.name}" is too large (max 4 MB).` },
            { status: 400 },
          );
        }
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          attachedDocs.push(
            await extractFileText({ bytes, mimeType: f.type, filename: f.name }),
          );
        } catch (err) {
          // Clear, per-file feedback (e.g. scanned PDF) beats a silent drop.
          return NextResponse.json(
            { error: err instanceof Error ? err.message : `Could not read "${f.name}".` },
            { status: 400 },
          );
        }
      }
    } else {
      const body = await req.json();
      question = body.question;
      taxType = body.taxType;
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    const result = await answerQuestion(question.trim(), { taxType, attachedDocs });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
