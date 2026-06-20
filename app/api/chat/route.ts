import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ai/answer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { question, taxType } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "A question is required." },
        { status: 400 },
      );
    }
    const result = await answerQuestion(question.trim(), { taxType });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
