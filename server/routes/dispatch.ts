/**
 * Dispatch Route
 * POST /api/dispatch/:jobId  — รัน dispatch logic แล้วอัปเดต JobStore
 *
 * @module server/routes/dispatch
 */

import { Router } from 'express';
import { getJobStore } from '../store/index.js';
import { dispatch } from '../../src/agents/dispatch/dispatcher.js';
import { generateFamilyUpdate } from '../../src/agents/family-update/generator.js';

const router = Router();

/**
 * POST /api/dispatch/:jobId
 *
 * 1. โหลด job จาก store
 * 2. รัน dispatch() เพื่อเลือก provider
 * 3. อัปเดต job state → ASSIGNED
 * 4. สร้าง Family Update message
 * 5. คืน result
 */
router.post('/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const store = getJobStore();

  const job = await store.findById(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found', jobId });
  }

  // รัน dispatch logic
  const result = dispatch(job);

  if (!result.success || !result.provider) {
    // ต้องให้คนตัดสินใจ
    return res.status(422).json({
      success: false,
      jobId,
      requiresHumanApproval: result.requiresHumanApproval,
      error: result.error || 'No suitable provider found',
    });
  }

  // อัปเดต state → ASSIGNED (ถ้า job ยังอยู่ใน state ที่ transition ได้)
  try {
    const targetState = job.state === 'DISPATCH' ? 'ASSIGNED' : 'DISPATCH';
    // ถ้า job อยู่ใน INTAKE/VALIDATE ให้ transition ไป DISPATCH ก่อน แล้วค่อย ASSIGNED
    if (job.state === 'INTAKE' || job.state === 'VALIDATE') {
      await store.update(jobId, {
        state: 'DISPATCH',
        addHistory: { from: job.state, to: 'DISPATCH', reason: 'Auto-dispatch triggered' },
      });
      await store.update(jobId, {
        state: 'ASSIGNED',
        addHistory: {
          from: 'DISPATCH',
          to: 'ASSIGNED',
          reason: `Assigned to ${result.provider.name}`,
          performedBy: 'dispatch-agent',
        },
      });
    } else if (job.state === 'DISPATCH') {
      await store.update(jobId, {
        state: 'ASSIGNED',
        addHistory: {
          from: 'DISPATCH',
          to: 'ASSIGNED',
          reason: `Assigned to ${result.provider.name}`,
          performedBy: 'dispatch-agent',
        },
      });
    }
  } catch (err) {
    // state transition ล้มเหลว — คืน dispatch result แต่ไม่อัปเดต state
    return res.status(422).json({
      success: false,
      jobId,
      error: err instanceof Error ? err.message : 'State transition failed',
    });
  }

  // สร้าง Family Update message สำหรับ ASSIGNED
  const familyMsg = generateFamilyUpdate({
    jobId,
    newState: 'ASSIGNED',
    patientName: job.jobSpec.patient.name,
    providerName: result.provider.name,
    etaMinutes: result.estimatedArrivalMinutes,
  });

  return res.json({
    success: true,
    jobId,
    provider: result.provider,
    reasoning: result.reasoning,
    estimatedArrivalMinutes: result.estimatedArrivalMinutes,
    requiresHumanApproval: result.requiresHumanApproval,
    familyUpdate: familyMsg.message ?? null,
  });
});

/**
 * GET /api/dispatch/pending
 * ดู jobs ที่รอ dispatch (state = DISPATCH)
 */
router.get('/pending', async (_req, res) => {
  const store = getJobStore();
  const jobs = await store.list({ state: ['DISPATCH'] });
  return res.json({ jobs: jobs.items, total: jobs.total });
});

export default router;
