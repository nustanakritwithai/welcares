/**
 * WelCares Backend Server
 * Express + OpenRouter Proxy ( keeps API key server-side )
 * 
 * @module server/index
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jobRoutes from './routes/jobs.js';
import intakeRoutes from './routes/intake.js';
import dispatchRoutes from './routes/dispatch.js';
import familyUpdateRoutes from './routes/family-update.js';
import agentRoutes from './routes/agent.js';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIG
// ============================================================================

const PORT = process.env.PORT || 3000;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const API_KEY = process.env.Nemotron_API || process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.warn('⚠️  No OpenRouter API key found. Set Nemotron_API or OPENROUTER_API_KEY');
}

// ============================================================================
// APP SETUP
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// API ROUTES
// ============================================================================

// Job Store routes — ใช้โดย Intake Agent และ Dispatch Agent
app.use('/api/jobs', jobRoutes);

// Intake bridge — รับ submit จาก submitIntake() แล้วเก็บลง JobStore
app.use('/api/intake', intakeRoutes);

// Dispatch Agent — เลือก provider แล้ว transition state → ASSIGNED
app.use('/api/dispatch', dispatchRoutes);

// Family Update Agent — สร้าง notification message สำหรับครอบครัว
app.use('/api/family-update', familyUpdateRoutes);

// Agent Chat — ReAct loop สำหรับ booking conversation
app.use('/api/agent', agentRoutes);

/**
 * Health check
 */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    aiConfigured: !!API_KEY,
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST   /api/jobs',
      'GET    /api/jobs',
      'GET    /api/jobs/:id',
      'PATCH  /api/jobs/:id/state',
      'DELETE /api/jobs/:id',
      'POST   /api/dispatch/:jobId',
      'POST   /api/family-update/:jobId',
    ],
  });
});

/**
 * OpenRouter Proxy - Chat Completions
 * POST /api/chat/completions
 * Body: { model, messages, temperature?, max_tokens?, response_format? }
 */
app.post('/api/chat/completions', async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ 
      error: 'AI service not configured',
      message: 'OpenRouter API key not set on server'
    });
  }

  try {
    const { model, messages, temperature, max_tokens, response_format } = req.body;

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': req.headers.origin || 'http://localhost',
        'X-Title': 'WelCares Intake Chat',
      },
      body: JSON.stringify({
        model: model || 'nvidia/nemotron-3-super-120b-a12b:free',
        messages,
        temperature: temperature ?? 0.3,
        max_tokens: max_tokens ?? 500,
        ...(response_format && { response_format }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);
      return res.status(response.status).json({ 
        error: 'OpenRouter API error',
        details: error
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get available models
 */
app.get('/api/models', (_req, res) => {
  const models = [
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super (Free)', provider: 'NVIDIA' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
  ];
  res.json({ models });
});

// ============================================================================
// STATIC FILES (Production)
// ============================================================================

// Serve built frontend files
app.use(express.static(path.join(__dirname, '../dist')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
🚀 WelCares Server running on http://localhost:${PORT}

📡 API Endpoints:
  GET    /api/health              - Health check
  GET    /api/models              - List available models
  POST   /api/chat/completions    - Chat with AI (proxies to OpenRouter)

📋 Job Store:
  POST   /api/jobs                - Create job from JobSpec
  GET    /api/jobs                - List jobs (filter by state/source)
  GET    /api/jobs/:id            - Get job by ID
  PATCH  /api/jobs/:id/state      - Transition job state
  DELETE /api/jobs/:id            - Delete completed/cancelled job

🔗 Intake Bridge:
  POST   /api/intake/submit       - Submit intake form → JobStore (ใช้โดย submitIntake())
  GET    /api/intake/jobs         - List jobs from intake source

🚀 Dispatch Agent:
  POST   /api/dispatch/:jobId     - เลือก provider + transition → ASSIGNED
  GET    /api/dispatch/pending    - ดู jobs ที่รอ dispatch

📣 Family Update Agent:
  POST   /api/family-update/:jobId              - สร้าง message จาก current state
  POST   /api/family-update/:jobId/state/:state - สร้าง message สำหรับ state ที่ระบุ

🤖 AI Status: ${API_KEY ? '✅ Configured' : '❌ Not configured'}
  `);
});

export default app;
