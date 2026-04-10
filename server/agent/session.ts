/**
 * Agent System — Session Store (in-memory)
 * Holds conversation history and booking state per session.
 * Sessions expire after 2 hours of inactivity.
 *
 * @module server/agent/session
 */

import type { AgentSession, BookingData } from './types.js';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const sessions = new Map<string, AgentSession>();

// ── cleanup expired sessions every 30 minutes ────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - new Date(session.updatedAt).getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);

// ============================================================================
// PUBLIC API
// ============================================================================

export function createSession(sessionId?: string): AgentSession {
  const id = sessionId ?? generateSessionId();
  const now = new Date().toISOString();
  const session: AgentSession = {
    sessionId: id,
    history: [],
    bookingData: {} as BookingData,
    status: 'collecting',
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(sessionId: string): AgentSession | null {
  return sessions.get(sessionId) ?? null;
}

export function getOrCreateSession(sessionId?: string): AgentSession {
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
  }
  return createSession(sessionId);
}

export function resetSession(sessionId: string): AgentSession {
  sessions.delete(sessionId);
  return createSession(sessionId);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function listActiveSessions(): AgentSession[] {
  return Array.from(sessions.values());
}

// ============================================================================
// HELPERS
// ============================================================================

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
