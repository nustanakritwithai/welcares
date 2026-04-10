/**
 * MemoryJobStore Tests
 * ทดสอบ in-memory implementation ของ JobStore ทั้งหมด
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryJobStore } from '../store/MemoryJobStore.js';
import {
  JobNotFoundError,
  InvalidStateTransitionError,
} from '../store/types.js';
import type { CreateJobInput } from '../store/types.js';
import type { JobSpec } from '../../src/agents/intake/schema.js';

// ============================================================================
// FIXTURES
// ============================================================================

function makeJobSpec(overrides: Partial<JobSpec['metadata']> = {}): JobSpec {
  return {
    metadata: {
      jobId: 'WC-20260410-TEST',
      version: '1.0',
      createdAt: '2026-04-10T10:00:00.000Z',
      source: 'form',
      priority: 3,
      urgencyLevel: 'normal',
      flags: [],
      ...overrides,
    },
    service: {
      type: 'hospital-visit',
      subType: undefined,
      department: 'อายุรกรรม',
      appointmentType: 'new',
    },
    schedule: {
      date: '2026-05-01',
      time: '10:00',
      flexibility: 'strict',
      estimatedDuration: 180,
    },
    locations: {
      pickup: {
        address: '123 ถนนสุขุมวิท',
        lat: 13.7563,
        lng: 100.5018,
      },
      dropoff: {
        address: 'โรงพยาบาลกรุงเทพ',
        lat: 13.7234,
        lng: 100.5291,
      },
      estimatedDistance: 5.2,
    },
    contact: {
      name: 'สมชาย ใจดี',
      phone: '081-234-5678',
      relationship: 'son',
    },
    patient: {
      name: 'นางทดสอบ',
      mobilityLevel: 'independent',
      needsEscort: false,
      needsWheelchair: false,
      oxygenRequired: false,
      stretcherRequired: false,
      conditions: [],
      allergies: [],
      medications: [],
    },
    addons: {
      medicinePickup: false,
      homeCare: false,
      mealService: false,
      interpretation: false,
      hospitalEscort: false,
    },
    assessment: {
      complexity: 'simple',
      riskFactors: [],
      specialAccommodations: [],
      resourceRequirements: {
        vehicleType: 'sedan',
        navigatorType: 'none',
        specialEquipment: [],
      },
      costEstimate: {
        base: 350,
        distance: 78,
        navigator: 0,
        addons: 0,
        total: 428,
        currency: 'THB',
      },
    },
    notes: {
      special: '',
      internal: '',
    },
  } as unknown as JobSpec;
}

function makeCreateInput(overrides?: Partial<CreateJobInput>): CreateJobInput {
  return {
    jobSpec: makeJobSpec(),
    source: 'form',
    sessionId: 'sess-001',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('MemoryJobStore', () => {
  let store: MemoryJobStore;

  beforeEach(() => {
    store = new MemoryJobStore();
  });

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  describe('create()', () => {
    it('ควรสร้าง Job ใหม่ด้วย state = INTAKE', async () => {
      const job = await store.create(makeCreateInput());

      expect(job.id).toBe('WC-20260410-TEST');
      expect(job.state).toBe('INTAKE');
      expect(job.meta.source).toBe('form');
      expect(job.meta.sessionId).toBe('sess-001');
      expect(job.meta.createdAt).toBeDefined();
      expect(job.meta.updatedAt).toBeDefined();
    });

    it('ควรมี history เริ่มต้น 1 รายการ', async () => {
      const job = await store.create(makeCreateInput());

      expect(job.history).toHaveLength(1);
      expect(job.history[0].from).toBe('INTAKE');
      expect(job.history[0].to).toBe('INTAKE');
      expect(job.history[0].agentId).toBe('IntakeAgent');
    });

    it('ควร default source เป็น api ถ้าไม่ระบุ', async () => {
      const input = makeCreateInput();
      delete (input as any).source;
      const job = await store.create(input);
      expect(job.meta.source).toBe('api');
    });

    it('ควรใช้ jobId จาก jobSpec.metadata.jobId', async () => {
      const jobSpec = makeJobSpec({ jobId: 'WC-CUSTOM-ID' });
      const job = await store.create({ jobSpec, source: 'chat' });
      expect(job.id).toBe('WC-CUSTOM-ID');
    });

    it('ควรเก็บ jobSpec ไว้ครบถ้วน', async () => {
      const input = makeCreateInput();
      const job = await store.create(input);
      expect(job.jobSpec.patient.name).toBe('นางทดสอบ');
      expect(job.jobSpec.service.type).toBe('hospital-visit');
    });

    it('ควรเพิ่ม store.size ขึ้น 1', async () => {
      expect(store.size).toBe(0);
      await store.create(makeCreateInput());
      expect(store.size).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // FIND BY ID
  // --------------------------------------------------------------------------

  describe('findById()', () => {
    it('ควรคืน Job ถ้าพบ', async () => {
      await store.create(makeCreateInput());
      const found = await store.findById('WC-20260410-TEST');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('WC-20260410-TEST');
    });

    it('ควรคืน null ถ้าไม่พบ', async () => {
      const found = await store.findById('NOT-EXIST');
      expect(found).toBeNull();
    });

    it('ควรคืน deep clone (ไม่ใช่ reference เดิม)', async () => {
      await store.create(makeCreateInput());
      const found1 = await store.findById('WC-20260410-TEST');
      const found2 = await store.findById('WC-20260410-TEST');
      expect(found1).not.toBe(found2); // คนละ object
      expect(found1).toEqual(found2);  // แต่ค่าเหมือนกัน
    });
  });

  // --------------------------------------------------------------------------
  // UPDATE — STATE TRANSITIONS
  // --------------------------------------------------------------------------

  describe('update() — state transitions', () => {
    it('ควรเปลี่ยน state จาก INTAKE → VALIDATE ได้', async () => {
      await store.create(makeCreateInput());
      const updated = await store.update('WC-20260410-TEST', {
        state: 'VALIDATE',
        reason: 'ข้อมูลครบแล้ว',
        agentId: 'Validator',
      });

      expect(updated.state).toBe('VALIDATE');
      expect(updated.history).toHaveLength(2);
      expect(updated.history[1].from).toBe('INTAKE');
      expect(updated.history[1].to).toBe('VALIDATE');
      expect(updated.history[1].reason).toBe('ข้อมูลครบแล้ว');
      expect(updated.history[1].agentId).toBe('Validator');
    });

    it('ควรเดิน state machine ได้ตลอดสาย happy path', async () => {
      await store.create(makeCreateInput());
      const id = 'WC-20260410-TEST';

      await store.update(id, { state: 'VALIDATE' });
      await store.update(id, { state: 'DISPATCH' });
      await store.update(id, { state: 'ASSIGNED' });
      await store.update(id, { state: 'PREPARING' });
      await store.update(id, { state: 'ACTIVE' });
      const completed = await store.update(id, { state: 'COMPLETED' });

      expect(completed.state).toBe('COMPLETED');
      expect(completed.history).toHaveLength(7); // 1 initial + 6 transitions
    });

    it('ควรโยน InvalidStateTransitionError ถ้า transition ไม่ถูกต้อง', async () => {
      await store.create(makeCreateInput());
      // INTAKE → ACTIVE ไม่ได้โดยตรง
      await expect(
        store.update('WC-20260410-TEST', { state: 'ACTIVE' })
      ).rejects.toThrow(InvalidStateTransitionError);
    });

    it('ควรโยน InvalidStateTransitionError ถ้าพยายามออกจาก terminal state', async () => {
      await store.create(makeCreateInput());
      const id = 'WC-20260410-TEST';
      await store.update(id, { state: 'VALIDATE' });
      await store.update(id, { state: 'REJECTED' });

      // REJECTED → ไปไหนไม่ได้
      await expect(
        store.update(id, { state: 'INTAKE' })
      ).rejects.toThrow(InvalidStateTransitionError);
    });

    it('ควรโยน JobNotFoundError ถ้า job ไม่มีอยู่', async () => {
      await expect(
        store.update('NOT-EXIST', { state: 'VALIDATE' })
      ).rejects.toThrow(JobNotFoundError);
    });

    it('ควรไม่เพิ่ม history ถ้า state ไม่เปลี่ยน', async () => {
      await store.create(makeCreateInput());
      const before = await store.findById('WC-20260410-TEST');
      const after = await store.update('WC-20260410-TEST', {}); // ไม่ส่ง state
      expect(after.history).toHaveLength(before!.history.length);
    });
  });

  // --------------------------------------------------------------------------
  // UPDATE — ASSIGNED PROVIDER
  // --------------------------------------------------------------------------

  describe('update() — assignedProvider', () => {
    it('ควรบันทึก assignedProvider เมื่อ DISPATCH → ASSIGNED', async () => {
      await store.create(makeCreateInput());
      const id = 'WC-20260410-TEST';
      await store.update(id, { state: 'VALIDATE' });
      await store.update(id, { state: 'DISPATCH' });

      const updated = await store.update(id, {
        state: 'ASSIGNED',
        assignedProvider: {
          providerId: 'DRV-001',
          providerType: 'DRIVER',
          name: 'สมศักดิ์',
          estimatedArrival: '2026-05-01T09:30:00.000Z',
          confidence: 0.95,
        },
      });

      expect(updated.assignedProvider).toBeDefined();
      expect(updated.assignedProvider!.providerId).toBe('DRV-001');
      expect(updated.assignedProvider!.confidence).toBe(0.95);
    });
  });

  // --------------------------------------------------------------------------
  // LIST
  // --------------------------------------------------------------------------

  describe('list()', () => {
    beforeEach(async () => {
      // สร้าง 3 jobs ด้วย state ต่างกัน
      const spec1 = makeJobSpec({ jobId: 'WC-001' });
      const spec2 = makeJobSpec({ jobId: 'WC-002' });
      const spec3 = makeJobSpec({ jobId: 'WC-003' });

      await store.create({ jobSpec: spec1, source: 'form' });
      await store.create({ jobSpec: spec2, source: 'chat' });
      await store.create({ jobSpec: spec3, source: 'api' });

      // เลื่อน WC-002 ไป DISPATCH
      await store.update('WC-002', { state: 'VALIDATE' });
      await store.update('WC-002', { state: 'DISPATCH' });
    });

    it('ควรคืน jobs ทั้งหมดถ้าไม่มี filter', async () => {
      const jobs = await store.list();
      expect(jobs).toHaveLength(3);
    });

    it('ควร filter by state', async () => {
      const dispatching = await store.list({ state: 'DISPATCH' });
      expect(dispatching).toHaveLength(1);
      expect(dispatching[0].id).toBe('WC-002');
    });

    it('ควร filter by หลาย state พร้อมกัน', async () => {
      const results = await store.list({ state: ['INTAKE', 'DISPATCH'] });
      expect(results).toHaveLength(3);
    });

    it('ควร filter by source', async () => {
      const chatJobs = await store.list({ source: 'chat' });
      expect(chatJobs).toHaveLength(1);
      expect(chatJobs[0].id).toBe('WC-002');
    });

    it('ควรรองรับ limit และ offset', async () => {
      const page1 = await store.list({ limit: 2, offset: 0 });
      const page2 = await store.list({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });

    it('ควรเรียงจากใหม่สุด → เก่าสุด', async () => {
      const jobs = await store.list();
      const dates = jobs.map(j => j.meta.createdAt);
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1] >= dates[i]).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // DELETE
  // --------------------------------------------------------------------------

  describe('delete()', () => {
    it('ควรลบ job ที่อยู่ใน terminal state ได้', async () => {
      await store.create(makeCreateInput());
      const id = 'WC-20260410-TEST';

      // เดินไปถึง REJECTED (terminal)
      await store.update(id, { state: 'REJECTED' });
      await store.delete(id);

      expect(store.size).toBe(0);
      expect(await store.findById(id)).toBeNull();
    });

    it('ควรโยน JobNotFoundError ถ้า job ไม่มีอยู่', async () => {
      await expect(store.delete('NOT-EXIST')).rejects.toThrow(JobNotFoundError);
    });
  });

  // --------------------------------------------------------------------------
  // COUNT
  // --------------------------------------------------------------------------

  describe('count()', () => {
    it('ควรนับ jobs ทั้งหมด', async () => {
      expect(await store.count()).toBe(0);
      await store.create(makeCreateInput());
      expect(await store.count()).toBe(1);
    });

    it('ควรนับ jobs ตาม filter', async () => {
      const spec1 = makeJobSpec({ jobId: 'WC-A' });
      const spec2 = makeJobSpec({ jobId: 'WC-B' });
      await store.create({ jobSpec: spec1, source: 'form' });
      await store.create({ jobSpec: spec2, source: 'chat' });

      expect(await store.count({ source: 'form' })).toBe(1);
      expect(await store.count({ source: 'chat' })).toBe(1);
      expect(await store.count({ source: 'api' })).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // IMMUTABILITY
  // --------------------------------------------------------------------------

  describe('immutability', () => {
    it('การแก้ไข job ที่ได้กลับมาไม่ควรกระทบ store', async () => {
      await store.create(makeCreateInput());
      const job = await store.findById('WC-20260410-TEST');

      // แก้ไข object ที่ได้มา
      job!.state = 'COMPLETED' as any;
      job!.history.push({ from: 'INTAKE', to: 'COMPLETED', at: 'fake' });

      // Store ไม่ควรเปลี่ยน
      const original = await store.findById('WC-20260410-TEST');
      expect(original!.state).toBe('INTAKE');
      expect(original!.history).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // CLEAR (test utility)
  // --------------------------------------------------------------------------

  describe('clear()', () => {
    it('ควรล้าง store ทั้งหมด', async () => {
      await store.create(makeCreateInput());
      expect(store.size).toBe(1);
      store.clear();
      expect(store.size).toBe(0);
    });
  });
});
