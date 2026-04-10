/**
 * Family Update Route
 * POST /api/family-update/:jobId  — สร้าง family notification message ตาม state ปัจจุบัน
 *
 * @module server/routes/family-update
 */

import { Router } from 'express';
import { getJobStore } from '../store/index.js';
import { generateFamilyUpdate } from '../../src/agents/family-update/generator.js';

const router = Router();

/**
 * POST /api/family-update/:jobId
 * Body: { notes?: string, providerName?: string, etaMinutes?: number }
 *
 * สร้าง message จาก current job state แล้วคืนให้ caller ส่งต่อ
 * (V1: ไม่ส่งจริง — caller รับผิดชอบส่งผ่าน LINE / SMS)
 */
router.post('/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const { notes, providerName, etaMinutes } = req.body ?? {};

  const store = getJobStore();
  const job = await store.findById(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found', jobId });
  }

  const result = generateFamilyUpdate({
    jobId,
    newState: job.state,
    patientName: job.jobSpec.patient.name,
    providerName: providerName ?? undefined,
    etaMinutes: etaMinutes ?? undefined,
    notes: notes ?? undefined,
  });

  if (!result.success) {
    return res.status(500).json({ success: false, jobId, error: result.error });
  }

  if (result.skipped) {
    return res.json({
      success: true,
      jobId,
      skipped: true,
      skipReason: result.skipReason,
    });
  }

  return res.json({
    success: true,
    jobId,
    message: result.message,
  });
});

/**
 * POST /api/family-update/:jobId/state/:state
 * สร้าง message สำหรับ state ที่ระบุ (ไม่ต้องตรงกับ current state)
 * ใช้เมื่อต้องการ preview หรือส่ง manual message
 */
router.post('/:jobId/state/:state', async (req, res) => {
  const { jobId, state } = req.params;
  const { notes, providerName, etaMinutes } = req.body ?? {};

  const store = getJobStore();
  const job = await store.findById(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found', jobId });
  }

  const result = generateFamilyUpdate({
    jobId,
    newState: state as any,
    patientName: job.jobSpec.patient.name,
    providerName: providerName ?? undefined,
    etaMinutes: etaMinutes ?? undefined,
    notes: notes ?? undefined,
  });

  return res.json({
    success: result.success,
    jobId,
    skipped: result.skipped ?? false,
    skipReason: result.skipReason,
    message: result.message ?? null,
    error: result.error,
  });
});

export default router;
