import { NextRequest, NextResponse } from "next/server";
import { determineVat } from "@/lib/ai/determine";
import { invoiceFieldsContract } from "@/lib/ai/contracts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = invoiceFieldsContract.safeParse(body?.fields ?? body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid invoice fields." }, { status: 400 });
    }
    const result = await determineVat(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Determination failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
