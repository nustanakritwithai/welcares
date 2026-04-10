/**
 * Job API Routes Tests
 * ทดสอบ REST endpoints ครบทุก scenario
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jobRoutes from '../routes/jobs.js';
import { resetJobStore, setJobStore } from '../store/index.js';
import { MemoryJobStore } from '../store/MemoryJobStore.js';
import type { JobSpec } from '../../src/agents/intake/schema.js';

// ============================================================================
// TEST APP SETUP
// ============================================================================

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', jobRoutes);
  return app;
}

// ============================================================================
// FIXTURES
// ============================================================================

function makeJobSpec(id = 'WC-20260410-TEST'): JobSpec {
  return {
    metadata: {
      jobId: id,
      version: '1.0',
      createdAt: '2026-04-10T10:00:00.000Z',
      source: 'form',
      priority: 3,
      urgencyLevel: 'normal',
      flags: [],
    },
    service: { type: 'hospital-visit', appointmentType: 'new' },
    schedule: { date: '2026-05-01', time: '10:00', flexibility: 'strict', estimatedDuration: 180 },
    locations: {
      pickup: { address: '123 ถนนสุขุมวิท' },
      dropoff: { address: 'โรงพยาบาลกรุงเทพ' },
      estimatedDistance: 5.2,
    },
    contact: { name: 'สมชาย', phone: '081-234-5678', relationship: 'son' },
    patient: {
      name: 'นางทดสอบ',
      mobilityLevel: 'independent',
      needsEscort: false,
      needsWheelchair: false,
      oxygenRequired: false,
      stretcherRequired: false,
      conditions: [], allergies: [], medications: [],
    },
    addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, hospitalEscort: false },
    assessment: {
      complexity: 'simple', riskFactors: [], specialAccommodations: [],
      resourceRequirements: { vehicleType: 'sedan', navigatorType: 'none', specialEquipment: [] },
      costEstimate: { base: 350, distance: 78, navigator: 0, addons: 0, total: 428, currency: 'THB' },
    },
    notes: { special: '', internal: '' },
  } as unknown as JobSpec;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Job API Routes', () => {
  let app: ReturnType<typeof createTestApp>;
  let store: MemoryJobStore;

  beforeEach(() => {
    store = new MemoryJobStore();
    setJobStore(store);
    app = createTestApp();
  });

  afterEach(() => {
    resetJobStore();
  });

  // --------------------------------------------------------------------------
  // POST /api/jobs
  // --------------------------------------------------------------------------

  describe('POST /api/jobs', () => {
    it('ควรสร้าง job และคืน 201', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({ jobSpec: makeJobSpec(), source: 'form', sessionId: 'sess-1' });

      expect(res.status).toBe(201);
      expect(res.body.job.id).toBe('WC-20260410-TEST');
      expect(res.body.job.state).toBe('INTAKE');
    });

    it('ควรคืน 400 ถ้าไม่มี jobSpec', async () => {
      const res = await request(app).post('/api/jobs').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_JOB_SPEC');
    });

    it('ควรคืน 400 ถ้า jobSpec ไม่มี metadata.jobId', async () => {
      const spec = makeJobSpec();
      delete (spec as any).metadata.jobId;

      const res = await request(app).post('/api/jobs').send({ jobSpec: spec });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_JOB_SPEC');
    });

    it('ควรคืน 409 ถ้า jobId ซ้ำ', async () => {
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec() });
      const res = await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec() });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('JOB_ALREADY_EXISTS');
    });
  });

  // --------------------------------------------------------------------------
  // GET /api/jobs
  // --------------------------------------------------------------------------

  describe('GET /api/jobs', () => {
    beforeEach(async () => {
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec('WC-001'), source: 'form' });
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec('WC-002'), source: 'chat' });
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec('WC-003'), source: 'api' });
    });

    it('ควรคืน jobs ทั้งหมดพร้อม meta', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(3);
      expect(res.body.meta.total).toBe(3);
    });

    it('ควร filter by state', async () => {
      // เลื่อน WC-001 ไป DISPATCH
      await request(app).patch('/api/jobs/WC-001/state').send({ state: 'VALIDATE' });
      await request(app).patch('/api/jobs/WC-001/state').send({ state: 'DISPATCH' });

      const res = await request(app).get('/api/jobs?state=DISPATCH');
      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].id).toBe('WC-001');
    });

    it('ควร filter by source', async () => {
      const res = await request(app).get('/api/jobs?source=chat');
      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].id).toBe('WC-002');
    });

    it('ควรรองรับ limit', async () => {
      const res = await request(app).get('/api/jobs?limit=2');
      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // GET /api/jobs/:id
  // --------------------------------------------------------------------------

  describe('GET /api/jobs/:id', () => {
    it('ควรคืน job ถ้าพบ', async () => {
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec() });

      const res = await request(app).get('/api/jobs/WC-20260410-TEST');
      expect(res.status).toBe(200);
      expect(res.body.job.id).toBe('WC-20260410-TEST');
    });

    it('ควรคืน 404 ถ้าไม่พบ', async () => {
      const res = await request(app).get('/api/jobs/NOT-EXIST');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('JOB_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /api/jobs/:id/state
  // --------------------------------------------------------------------------

  describe('PATCH /api/jobs/:id/state', () => {
    beforeEach(async () => {
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec() });
    });

    it('ควรเปลี่ยน state ได้และคืน job ที่อัปเดต', async () => {
      const res = await request(app)
        .patch('/api/jobs/WC-20260410-TEST/state')
        .send({ state: 'VALIDATE', reason: 'ข้อมูลครบ', agentId: 'IntakeAgent' });

      expect(res.status).toBe(200);
      expect(res.body.job.state).toBe('VALIDATE');
      expect(res.body.job.history).toHaveLength(2);
    });

    it('ควรคืน 400 ถ้าไม่ส่ง state', async () => {
      const res = await request(app)
        .patch('/api/jobs/WC-20260410-TEST/state')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_STATE');
    });

    it('ควรคืน 400 ถ้า state ไม่ valid', async () => {
      const res = await request(app)
        .patch('/api/jobs/WC-20260410-TEST/state')
        .send({ state: 'INVALID_STATE' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_STATE');
    });

    it('ควรคืน 422 ถ้า transition ไม่ถูกต้อง', async () => {
      // INTAKE → ACTIVE ไม่ได้โดยตรง
      const res = await request(app)
        .patch('/api/jobs/WC-20260410-TEST/state')
        .send({ state: 'ACTIVE' });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('INVALID_TRANSITION');
    });

    it('ควรคืน 404 ถ้า job ไม่พบ', async () => {
      const res = await request(app)
        .patch('/api/jobs/NOT-EXIST/state')
        .send({ state: 'VALIDATE' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('JOB_NOT_FOUND');
    });

    it('ควรบันทึก assignedProvider เมื่อ transition เป็น ASSIGNED', async () => {
      await request(app).patch('/api/jobs/WC-20260410-TEST/state').send({ state: 'VALIDATE' });
      await request(app).patch('/api/jobs/WC-20260410-TEST/state').send({ state: 'DISPATCH' });

      const res = await request(app)
        .patch('/api/jobs/WC-20260410-TEST/state')
        .send({
          state: 'ASSIGNED',
          assignedProvider: {
            providerId: 'DRV-001',
            providerType: 'DRIVER',
            name: 'สมศักดิ์',
            confidence: 0.92,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.job.assignedProvider.providerId).toBe('DRV-001');
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /api/jobs/:id
  // --------------------------------------------------------------------------

  describe('DELETE /api/jobs/:id', () => {
    it('ควรลบ job ที่อยู่ใน terminal state', async () => {
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec() });
      await request(app).patch('/api/jobs/WC-20260410-TEST/state').send({ state: 'REJECTED' });

      const res = await request(app).delete('/api/jobs/WC-20260410-TEST');
      expect(res.status).toBe(204);

      const check = await request(app).get('/api/jobs/WC-20260410-TEST');
      expect(check.status).toBe(404);
    });

    it('ควรคืน 422 ถ้า job ยังไม่อยู่ใน terminal state', async () => {
      await request(app).post('/api/jobs').send({ jobSpec: makeJobSpec() });

      const res = await request(app).delete('/api/jobs/WC-20260410-TEST');
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('JOB_STILL_ACTIVE');
    });

    it('ควรคืน 404 ถ้า job ไม่พบ', async () => {
      const res = await request(app).delete('/api/jobs/NOT-EXIST');
      expect(res.status).toBe(404);
    });
  });
});
