/**
 * Intake Bridge Routes
 *
 * รับ request จาก submitIntake() (src/agents/intake/service.ts)
 * และ เก็บลง JobStore โดยตรง
 *
 * Bridge นี้ทำให้ frontend ไม่ต้องเปลี่ยน API contract —
 * แค่ชี้ VITE_INTAKE_API_URL ไปที่ http://localhost:3000/api
 *
 * @module server/routes/intake
 */

import { Router, Request, Response } from 'express';
import { getJobStore } from '../store/index.js';
import type { CreateJobInput } from '../store/index.js';

const router = Router();

// ============================================================================
// POST /api/intake/submit
// ============================================================================

/**
 * รับ JobSpec จาก submitIntake() เก็บลง JobStore
 *
 * Request body (ตรงกับที่ submitIntake() ส่งมา):
 * {
 *   jobSpec:     JobSpec       — จาก transformToJobSpec()
 *   sessionId:   string        — session ของ user
 *   submittedAt: string        — ISO8601
 *   source?:     string        — 'form' | 'chat' | 'api'
 * }
 *
 * Response (ตรงกับที่ submitIntake() คาดหวัง):
 * {
 *   jobId:  string  — WC-YYYYMMDD-XXXX
 *   status: string  — 'confirmed'
 * }
 */
router.post('/submit', async (req: Request, res: Response) => {
  const { jobSpec, sessionId, submittedAt, source } = req.body;

  if (!jobSpec) {
    return res.status(400).json({
      error: 'MISSING_JOB_SPEC',
      message: 'jobSpec is required',
    });
  }

  if (!jobSpec.metadata?.jobId) {
    return res.status(400).json({
      error: 'INVALID_JOB_SPEC',
      message: 'jobSpec.metadata.jobId is required',
    });
  }

  try {
    const store = getJobStore();

    // ตรวจว่ามีอยู่แล้วหรือเปล่า (idempotent submit)
    const existing = await store.findById(jobSpec.metadata.jobId);
    if (existing) {
      return res.json({
        jobId: existing.id,
        status: 'confirmed',
        message: 'Job already exists',
      });
    }

    const createInput: CreateJobInput = {
      jobSpec,
      source: (source as 'form' | 'chat' | 'api') ?? 'form',
      sessionId,
    };

    const job = await store.create(createInput);

    console.log(`[intake/submit] Job created: ${job.id} (source: ${job.meta.source})`);

    return res.status(201).json({
      jobId: job.id,
      status: 'confirmed',
    });
  } catch (err) {
    console.error('[POST /api/intake/submit]', err);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to save job',
    });
  }
});

// ============================================================================
// GET /api/intake/jobs — ดู jobs ที่มาจาก intake
// ============================================================================

router.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const store = getJobStore();
    const jobs = await store.list({ source: 'form' });
    return res.json({ jobs, total: jobs.length });
  } catch (err) {
    console.error('[GET /api/intake/jobs]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list jobs' });
  }
});

export default router;
