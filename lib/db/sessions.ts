import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { chatMessages, chatSessions } from "./schema";

export type ChatRole = "user" | "assistant" | "reviewer";

// A short session title from the first question.
export function titleFromText(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 60 ? t.slice(0, 57) + "…" : t || "New chat";
}

export async function createSession(username: string, title: string): Promise<number> {
  const [row] = await db
    .insert(chatSessions)
    .values({ username, title: titleFromText(title) })
    .returning({ id: chatSessions.id });
  return row.id;
}

// Append a message and bump the session's updatedAt so it sorts to the top.
export async function appendMessage(
  sessionId: number,
  role: ChatRole,
  content: string,
  data?: unknown,
): Promise<number> {
  const [row] = await db
    .insert(chatMessages)
    .values({ sessionId, role, content, data: data ?? null })
    .returning({ id: chatMessages.id });
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
  return row.id;
}

// Confirm a session belongs to this username (ownership check before read/write).
export async function ownsSession(username: string, sessionId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.username, username)))
    .limit(1);
  return !!row;
}

export async function listSessions(username: string) {
  return db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.username, username))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(100);
}

export async function getSessionMessages(username: string, sessionId: number) {
  if (!(await ownsSession(username, sessionId))) return null;
  const [session] = await db
    .select({ id: chatSessions.id, title: chatSessions.title })
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  const messages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      data: chatMessages.data,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
  return { session, messages };
}

// Delete a session and its messages (ownership-checked). Notifications and
// query_log rows keep their session_id as a soft pointer — harmless if dangling.
export async function deleteSession(username: string, sessionId: number): Promise<boolean> {
  if (!(await ownsSession(username, sessionId))) return false;
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  return true;
}
