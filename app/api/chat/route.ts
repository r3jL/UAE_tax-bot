import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ai/answer";
import { extractFileText } from "@/lib/ai/extract-text";
import { usernameFrom } from "@/lib/auth/user";
import { appendMessage, createSession, ownsSession } from "@/lib/db/sessions";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless body limit headroom
const MAX_FILES = 4;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let question = "";
    let taxType: "CT" | "VAT" | undefined;
    let sessionId: number | undefined;
    const attachedDocs: { name: string; text: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      question = String(form.get("question") ?? "");
      const tt = form.get("taxType");
      taxType = tt ? (String(tt) as "CT" | "VAT") : undefined;
      const sid = Number(form.get("sessionId"));
      if (Number.isInteger(sid) && sid > 0) sessionId = sid;

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
      if (Number.isInteger(body.sessionId) && body.sessionId > 0) sessionId = body.sessionId;
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }
    const trimmed = question.trim();

    // Persist the turn only for signed-in (non-guest) users. Best-effort: if the
    // DB write fails we still answer, just without saved history.
    const username = usernameFrom(req);
    if (username) {
      try {
        if (sessionId && !(await ownsSession(username, sessionId))) sessionId = undefined;
        if (!sessionId) sessionId = await createSession(username, trimmed);
        await appendMessage(sessionId, "user", trimmed, {
          files: attachedDocs.map((d) => d.name),
        });
      } catch (e) {
        console.warn("[chat] session persist (user turn) failed:", (e as Error).message);
        sessionId = undefined;
      }
    } else {
      sessionId = undefined; // guests never persist
    }

    const result = await answerQuestion(trimmed, {
      taxType,
      attachedDocs,
      username,
      sessionId,
    });

    if (username && sessionId) {
      try {
        await appendMessage(sessionId, "assistant", result.answer ?? "", result);
      } catch (e) {
        console.warn("[chat] session persist (assistant turn) failed:", (e as Error).message);
      }
    }

    return NextResponse.json({ ...result, sessionId: sessionId ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
