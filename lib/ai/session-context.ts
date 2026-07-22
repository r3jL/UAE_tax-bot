import { generateText } from "ai";
import { DECOMPOSE_MODEL } from "./models";
import {
  getSessionFiles,
  getSessionSummary,
  getSessionTurns,
  setSessionSummary,
} from "../db/sessions";

// Context-window policy for the Ask tab, in one place.
//
// The reasoning model (gpt-oss-120b) has a 131k-token window; Gateway Sonnet
// has 200k. The bound that matters in practice is latency + free-tier cost,
// not the raw window — so the budget below keeps a worst-case prompt around
// ~20k tokens: retrieval (~20k chars) + files (≤24k) + history (≤24k) + the
// question. All char-denominated (≈4 chars/token), all env-overridable.
//
// Compaction (Claude-style): when a session's verbatim history outgrows
// HISTORY_BUDGET, the older turns are folded into a rolling summary stored on
// the session (chat_sessions.summary); only the summary + the most recent
// turns are sent from then on. Compaction runs lazily at the start of the turn
// that finds the history over budget.

const HISTORY_BUDGET = Number(process.env.CHAT_HISTORY_BUDGET_CHARS ?? 24_000);
const KEEP_RECENT_TURNS = Number(process.env.CHAT_KEEP_RECENT_TURNS ?? 6);
const TURN_CHAR_CAP = 2_000; // one verbatim turn's max contribution
const FILES_BUDGET = Number(process.env.CHAT_FILES_BUDGET_CHARS ?? 24_000);
const SUMMARY_CHAR_CAP = 3_000;

export interface SessionTurn {
  role: string; // user | assistant | reviewer
  content: string;
}

export interface SessionContext {
  // Rolling summary of compacted older turns (null until first compaction).
  summary: string | null;
  // Recent turns to include verbatim, oldest first.
  turns: SessionTurn[];
  // Session files (previous uploads) to include, oldest dropped when over budget.
  files: { name: string; text: string }[];
  // Names of files that no longer fit the budget (mentioned, not included).
  droppedFiles: string[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + " …[truncated]" : s);

const COMPACT_SYSTEM = `You maintain the running summary of a UAE tax Q&A conversation, replacing older turns that no longer fit the context window. Merge the previous summary (if any) with the new turns into ONE updated summary, ≤300 words. Preserve, with priority:
1. Facts and figures the user stated (amounts, dates, entities, elections) — exact numbers.
2. Conclusions and computed results already given (treatments, tax due, VAT positions).
3. What each uploaded file is and the key figures it contains.
4. Open questions or corrections the user made.
Write dense plain prose. No preamble, no markdown headings.`;

// Fold `older` turns into the existing summary. Failure-safe: returns the old
// summary unchanged if the model call fails (the turns are then simply absent
// from context — degraded, never broken).
async function compact(
  previousSummary: string | null,
  older: SessionTurn[],
): Promise<string | null> {
  try {
    const transcript = older
      .map((t) => `${t.role.toUpperCase()}: ${clip(t.content, TURN_CHAR_CAP)}`)
      .join("\n\n");
    const { text } = await generateText({
      model: DECOMPOSE_MODEL,
      temperature: 0,
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(30_000),
      system: COMPACT_SYSTEM,
      prompt: `${
        previousSummary ? `Previous summary:\n${previousSummary}\n\n` : ""
      }Turns to fold in:\n\n${transcript}\n\nUpdated summary:`,
    });
    return text?.trim() ? clip(text.trim(), SUMMARY_CHAR_CAP) : previousSummary;
  } catch (e) {
    console.warn("[compact] failed, keeping previous summary:", (e as Error).message);
    return previousSummary;
  }
}

// Load everything the answer engine needs about a session, compacting first if
// the verbatim history has outgrown its budget.
export async function loadSessionContext(sessionId: number): Promise<SessionContext> {
  const [{ summary, summarizedUpTo }, allTurns, allFiles] = await Promise.all([
    getSessionSummary(sessionId),
    getSessionTurns(sessionId),
    getSessionFiles(sessionId),
  ]);

  // Which recent turns fit the budget verbatim? Walk backwards from newest.
  const recent: SessionTurn[] = [];
  let used = 0;
  let recentStart = allTurns.length;
  for (let i = allTurns.length - 1; i >= 0; i--) {
    const cost = Math.min(allTurns[i].content.length, TURN_CHAR_CAP);
    if (recent.length >= KEEP_RECENT_TURNS || used + cost > HISTORY_BUDGET) break;
    recent.unshift({ role: allTurns[i].role, content: clip(allTurns[i].content, TURN_CHAR_CAP) });
    used += cost;
    recentStart = i;
  }

  // Turns older than the verbatim window that the stored summary does NOT yet
  // cover (id > watermark). Only these ever get folded — the watermark stops
  // every later turn from re-paying the compaction call for the same history.
  const uncovered = allTurns
    .slice(0, recentStart)
    .filter((t) => t.id > (summarizedUpTo ?? 0));

  let effectiveSummary = summary;
  const uncoveredChars = uncovered.reduce(
    (n, t) => n + Math.min(t.content.length, TURN_CHAR_CAP),
    0,
  );
  const COMPACT_TRIGGER_CHARS = 4_000; // don't pay a model call for a tiny tail
  if (uncoveredChars > COMPACT_TRIGGER_CHARS) {
    const folded = await compact(summary, uncovered.slice(-20));
    if (folded && folded !== summary) {
      effectiveSummary = folded;
      try {
        await setSessionSummary(sessionId, folded, uncovered[uncovered.length - 1].id);
      } catch (e) {
        console.warn("[compact] summary persist failed:", (e as Error).message);
      }
    }
  } else if (uncovered.length > 0) {
    // Tiny uncovered tail — append its gist inline rather than spend a call.
    const gist = uncovered.map((t) => `${t.role}: ${clip(t.content, 300)}`).join("\n");
    effectiveSummary = summary ? `${summary}\n\nRecent (not yet compacted):\n${gist}` : gist;
  }

  // Session files, newest kept when over budget (older uploads matter less).
  const files: { name: string; text: string }[] = [];
  const droppedFiles: string[] = [];
  let fileChars = 0;
  for (let i = allFiles.length - 1; i >= 0; i--) {
    if (fileChars + allFiles[i].text.length <= FILES_BUDGET) {
      files.unshift(allFiles[i]);
      fileChars += allFiles[i].text.length;
    } else {
      droppedFiles.unshift(allFiles[i].name);
    }
  }

  return { summary: effectiveSummary, turns: recent, files, droppedFiles };
}
