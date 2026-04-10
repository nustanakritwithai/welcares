/**
 * Agent Route
 * POST /api/agent/chat  — Main agentic booking conversation
 * GET  /api/agent/session/:id  — Get current session state
 * DELETE /api/agent/session/:id — Reset a session
 *
 * @module server/routes/agent
 */

import { Router } from 'express';
import { getOrCreateSession, resetSession, listActiveSessions } from '../agent/session.js';
import { runAgentLoop } from '../agent/loop.js';

const router = Router();

const getApiKey = (): string | null =>
  process.env.Nemotron_API ?? process.env.OPENROUTER_API_KEY ?? null;

// ============================================================================
// POST /api/agent/chat
// ============================================================================

router.post('/chat', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI not configured',
      message: 'Set OPENROUTER_API_KEY on the server',
    });
  }

  const { sessionId, message, apiKey: bodyApiKey } = req.body ?? {};

  // Allow client to provide their own API key (overrides server key)
  const resolvedKey = (typeof bodyApiKey === 'string' && bodyApiKey.trim())
    ? bodyApiKey.trim()
    : apiKey;

  if (!resolvedKey) {
    return res.status(503).json({
      error: 'AI not configured',
      message: 'กรุณาใส่ OpenRouter API Key ในช่องตั้งค่าด้านบนก่อนค่ะ',
    });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const session = getOrCreateSession(sessionId as string | undefined);

  try {
    const response = await runAgentLoop(session, message.trim(), resolvedKey);
    return res.json(response);
  } catch (err) {
    console.error('[POST /api/agent/chat] error:', err);
    return res.status(500).json({
      error: 'Agent error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /api/agent/session/:id
// ============================================================================

router.get('/session/:id', (req, res) => {
  const session = getOrCreateSession(req.params.id);
  return res.json({
    sessionId: session.sessionId,
    bookingData: session.bookingData,
    status: session.status,
    jobId: session.jobId,
    historyLength: session.history.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
});

// ============================================================================
// DELETE /api/agent/session/:id — reset session (start over)
// ============================================================================

router.delete('/session/:id', (req, res) => {
  const fresh = resetSession(req.params.id);
  return res.json({ sessionId: fresh.sessionId, status: 'reset' });
});

// ============================================================================
// GET /api/agent/sessions — admin: list active sessions
// ============================================================================

router.get('/sessions', (_req, res) => {
  const sessions = listActiveSessions();
  return res.json({
    count: sessions.length,
    sessions: sessions.map(s => ({
      sessionId: s.sessionId,
      status: s.status,
      jobId: s.jobId,
      historyLength: s.history.length,
      updatedAt: s.updatedAt,
    })),
  });
});

export default router;
