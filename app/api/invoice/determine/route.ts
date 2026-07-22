import { NextRequest, NextResponse } from "next/server";
import { determineVat } from "@/lib/ai/determine";
import { invoiceFieldsContract } from "@/lib/ai/contracts";
import { usernameFrom } from "@/lib/auth/user";
import { appendMessage, createSession, ownsSession } from "@/lib/db/sessions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = invoiceFieldsContract.safeParse(body?.fields ?? body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid invoice fields." }, { status: 400 });
    }
    const fileName = typeof body?.fileName === "string" ? body.fileName : "invoice";

    const result = await determineVat(parsed.data);

    // Persist the check into the asker's session (signed-in users only) so it
    // reloads with history and follow-up questions can reference it. Ask and
    // invoice checks share one thread — that's the merged workspace.
    let sessionId: number | undefined;
    const username = usernameFrom(req);
    if (username) {
      try {
        const requested = Number(body?.sessionId);
        if (Number.isInteger(requested) && requested > 0 && (await ownsSession(username, requested))) {
          sessionId = requested;
        }
        if (!sessionId) sessionId = await createSession(username, `VAT check: ${fileName}`);
        await appendMessage(sessionId, "user", `VAT check: ${fileName}`, {
          files: [fileName],
        });
        await appendMessage(sessionId, "assistant", result.whatToDo ?? "", {
          type: "invoice",
          fileName,
          fields: parsed.data,
          det: result,
        });
      } catch (e) {
        console.warn("[determine] session persist failed:", (e as Error).message);
        sessionId = undefined;
      }
    }

    return NextResponse.json({ ...result, sessionId: sessionId ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Determination failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
