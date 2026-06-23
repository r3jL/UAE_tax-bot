import { config } from "dotenv";
// Load .env.local first (matches the app + other scripts), then .env.
config({ path: ".env.local" });
config();

import { answerQuestion } from "../lib/ai/answer";
import { EVAL_SET, type EvalCase } from "../evals/dataset";

// Lightweight cited-answer eval harness. Runs each case through the real answer
// engine and scores: status match, citation presence, and expected mentions.
// It is intentionally loose — the goal is a trend line you can A/B against, not
// a strict grader. Expand evals/dataset.ts with F&A's real questions.

function mentioned(needles: string[] | undefined, haystacks: string[]): boolean {
  if (!needles?.length) return true;
  const hay = haystacks.join(" \n ").toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

async function runCase(c: EvalCase) {
  const res = await answerQuestion(c.question, { taxType: c.taxType });
  const checks: { name: string; pass: boolean }[] = [];

  if (c.expectStatus) {
    // An escalate-expected case also passes if the model flagged a false premise.
    const statusOk =
      res.status === c.expectStatus ||
      (c.expectStatus === "escalate" && !!res.flaggedPremise);
    checks.push({ name: `status=${c.expectStatus}`, pass: statusOk });
  }
  if (res.status === "answered") {
    checks.push({ name: "has citation", pass: res.citations.length > 0 });
  }
  if (c.expectMentions) {
    const hay = [
      res.answer,
      res.reasoning,
      ...res.citations.map((x) => x.articleRef),
    ];
    checks.push({
      name: `mentions ${c.expectMentions.join("|")}`,
      pass: mentioned(c.expectMentions, hay),
    });
  }

  return { res, checks, pass: checks.every((x) => x.pass) };
}

async function main() {
  console.log(`Running ${EVAL_SET.length} eval case(s)...\n`);
  let passed = 0;
  for (const c of EVAL_SET) {
    try {
      const { res, checks, pass } = await runCase(c);
      if (pass) passed++;
      console.log(
        `[${pass ? "PASS" : "FAIL"}] ${c.id}  ` +
          `(status=${res.status}, confidence=${res.confidence}, citations=${res.citations.length})`,
      );
      for (const ch of checks) if (!ch.pass) console.log(`        ✗ ${ch.name}`);
    } catch (e) {
      console.log(`[ERR ] ${c.id} — ${(e as Error).message}`);
    }
  }
  console.log(`\nScore: ${passed}/${EVAL_SET.length} passed.`);
  process.exit(passed === EVAL_SET.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
