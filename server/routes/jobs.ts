/**
 * Job API Routes
 *
 * REST endpoints สำหรับจัดการ Job lifecycle
 * Dispatch Agent และ agents อื่นๆ ใช้ผ่าน endpoints เหล่านี้
 *
 * @module server/routes/jobs
 *
 * Endpoints:
 *   POST   /api/jobs              — สร้าง Job จาก JobSpec (เรียกโดย Intake Agent)
 *   GET    /api/jobs              — ดู Job ทั้งหมด (พร้อม filter)
 *   GET    /api/jobs/:id          — ดู Job ตาม ID
 *   PATCH  /api/jobs/:id/state    — เปลี่ยน state (เรียกโดย Dispatch / agents อื่น)
 *   DELETE /api/jobs/:id          — ลบ Job
 */

import { Router, Request, Response } from 'express';
import {
  getJobStore,
  JobNotFoundError,
  InvalidStateTransitionError,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
} from '../store/index.js';
import type { JobState, JobFilter, UpdateJobInput } from '../store/index.js';

const router = Router();

// ============================================================================
// POST /api/jobs — สร้าง Job ใหม่
// ============================================================================

/**
 * Body: { jobSpec: JobSpec, source?: 'form'|'chat'|'api', sessionId?: string }
 * Response: { job: Job }
 */
router.post('/', async (req: Request, res: Response) => {
  const { jobSpec, source, sessionId } = req.body;

  if (!jobSpec) {
    return res.status(400).json({
      error: 'MISSING_JOB_SPEC',
      message: 'jobSpec is required',
    });
  }

  // ตรวจสอบ jobSpec มี metadata.jobId (ต้องมาจาก Intake transformer)
  if (!jobSpec.metadata?.jobId) {
    return res.status(400).json({
      error: 'INVALID_JOB_SPEC',
      message: 'jobSpec.metadata.jobId is required — ต้องผ่าน Intake Agent ก่อน',
    });
  }

  try {
    const store = getJobStore();

    // ตรวจสอบว่า jobId ซ้ำไหม
    const existing = await store.findById(jobSpec.metadata.jobId);
    if (existing) {
      return res.status(409).json({
        error: 'JOB_ALREADY_EXISTS',
        message: `Job ${jobSpec.metadata.jobId} already exists`,
        job: existing,
      });
    }

    const job = await store.create({
      jobSpec,
      source: source ?? 'api',
      sessionId,
    });

    return res.status(201).json({ job });
  } catch (err) {
    console.error('[POST /api/jobs]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create job' });
  }
});

// ============================================================================
// GET /api/jobs — ดู Job ทั้งหมด
// ============================================================================

/**
 * Query params:
 *   state   — filter by state (comma-separated เช่น DISPATCH,ASSIGNED)
 *   source  — filter by source
 *   since   — createdAt >= since (ISO8601)
 *   limit   — จำนวนสูงสุด (default 50)
 *   offset  — skip N รายการ (pagination)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const store = getJobStore();

    const filter: JobFilter = {};

    if (req.query.state) {
      const states = (req.query.state as string).split(',') as JobState[];
      filter.state = states.length === 1 ? states[0] : states;
    }
    if (req.query.source) {
      filter.source = req.query.source as 'form' | 'chat' | 'api';
    }
    if (req.query.since) {
      filter.since = req.query.since as string;
    }
    filter.limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    filter.offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const [jobs, total] = await Promise.all([
      store.list(filter),
      store.count(req.query.state || req.query.source || req.query.since ? filter : undefined),
    ]);

    return res.json({
      jobs,
      meta: {
        total,
        limit: filter.limit,
        offset: filter.offset,
      },
    });
  } catch (err) {
    console.error('[GET /api/jobs]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list jobs' });
  }
});

// ============================================================================
// GET /api/jobs/:id — ดู Job ตาม ID
// ============================================================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const store = getJobStore();
    const job = await store.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: 'JOB_NOT_FOUND',
        message: `Job ${req.params.id} not found`,
      });
    }

    return res.json({ job });
  } catch (err) {
    console.error('[GET /api/jobs/:id]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get job' });
  }
});

// ============================================================================
// PATCH /api/jobs/:id/state — เปลี่ยน state
// ============================================================================

/**
 * Body: {
 *   state: JobState        — state ใหม่
 *   reason?: string        — เหตุผล
 *   agentId?: string       — agent ที่เรียก
 *   assignedProvider?: AssignedProvider  — ใส่เมื่อ state = ASSIGNED
 * }
 */
router.patch('/:id/state', async (req: Request, res: Response) => {
  const { state, reason, agentId, assignedProvider } = req.body;

  if (!state) {
    return res.status(400).json({
      error: 'MISSING_STATE',
      message: 'state is required',
    });
  }

  // ตรวจสอบว่า state เป็น valid JobState
  const validStates = Object.keys(VALID_TRANSITIONS) as JobState[];
  if (!validStates.includes(state)) {
    return res.status(400).json({
      error: 'INVALID_STATE',
      message: `Unknown state: ${state}. Valid states: ${validStates.join(', ')}`,
    });
  }

  try {
    const store = getJobStore();

    const input: UpdateJobInput = { state, reason, agentId, assignedProvider };
    const job = await store.update(req.params.id, input);

    return res.json({ job });
  } catch (err) {
    if (err instanceof JobNotFoundError) {
      return res.status(404).json({ error: 'JOB_NOT_FOUND', message: err.message });
    }
    if (err instanceof InvalidStateTransitionError) {
      return res.status(422).json({ error: 'INVALID_TRANSITION', message: err.message });
    }
    console.error('[PATCH /api/jobs/:id/state]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update job' });
  }
});

// ============================================================================
// DELETE /api/jobs/:id
// ============================================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const store = getJobStore();

    // ป้องกันลบ job ที่ยังทำงานอยู่
    const job = await store.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'JOB_NOT_FOUND', message: `Job ${req.params.id} not found` });
    }
    if (!TERMINAL_STATES.includes(job.state)) {
      return res.status(422).json({
        error: 'JOB_STILL_ACTIVE',
        message: `Cannot delete job in state ${job.state}. Cancel it first.`,
      });
    }

    await store.delete(req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err instanceof JobNotFoundError) {
      return res.status(404).json({ error: 'JOB_NOT_FOUND', message: err.message });
    }
    console.error('[DELETE /api/jobs/:id]', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete job' });
  }
});

export default router;
