/**
 * Dispatch Agent — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  dispatch,
  selectProvider,
  scoreSuitability,
  extractRequiredSkills,
  getPreferredProviderType,
  estimateArrivalMinutes,
  DEFAULT_PROVIDER_POOL,
} from '../dispatcher';
import type { Provider } from '../types';
import type { Job } from '../../../server/store/types';

// ============================================================================
// FIXTURES
// ============================================================================

function makeJob(overrides: Partial<Job['jobSpec']> = {}): Job {
  const base: Job = {
    id: 'WC-TEST-001',
    state: 'INTAKE',
    history: [],
    meta: { source: 'form', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    jobSpec: {
      metadata: {
        jobId: 'WC-TEST-001',
        version: '1.0',
        createdAt: new Date().toISOString(),
        source: 'form',
        priority: 3,
        urgencyLevel: 'normal',
        flags: [],
      },
      service: { type: 'hospital-visit', appointmentType: 'new' },
      schedule: { date: '2026-06-01', time: '09:00', flexibility: 'strict', estimatedDuration: 180 },
      locations: {
        pickup: { address: '123 สุขุมวิท' },
        dropoff: { address: 'โรงพยาบาลกรุงเทพ' },
        estimatedDistance: 8,
      },
      contact: { name: 'สมชาย', phone: '081-000-0000', relationship: 'son' },
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
        resourceRequirements: { vehicleType: 'sedan', navigatorType: 'none', specialEquipment: [] },
        costEstimate: { base: 350, distance: 120, navigator: 0, addons: 0, total: 470, currency: 'THB' },
      },
      notes: { special: '', internal: '' },
      ...overrides,
    } as any,
  };
  return base;
}

function makeWheelchairJob(): Job {
  const job = makeJob();
  job.jobSpec.patient.needsWheelchair = true;
  job.jobSpec.patient.mobilityLevel = 'wheelchair';
  return job;
}

function makeOxygenJob(): Job {
  const job = makeJob();
  job.jobSpec.patient.oxygenRequired = true;
  job.jobSpec.patient.stretcherRequired = true;
  return job;
}

function makeDialysisJob(): Job {
  const job = makeJob();
  (job.jobSpec.service as any).type = 'dialysis';
  return job;
}

// ============================================================================
// extractRequiredSkills
// ============================================================================

describe('extractRequiredSkills()', () => {
  it('งานทั่วไปไม่มี special requirements → skills ว่าง', () => {
    const skills = extractRequiredSkills(makeJob());
    expect(skills).toHaveLength(0);
  });

  it('ผู้ป่วยนั่งรถเข็น → ต้องการ wheelchair', () => {
    expect(extractRequiredSkills(makeWheelchairJob())).toContain('wheelchair');
  });

  it('ต้องการออกซิเจน + เปล → oxygen + stretcher', () => {
    const skills = extractRequiredSkills(makeOxygenJob());
    expect(skills).toContain('oxygen');
    expect(skills).toContain('stretcher');
  });

  it('ฟอกไต → ต้องการ nurse-license', () => {
    expect(extractRequiredSkills(makeDialysisJob())).toContain('nurse-license');
  });

  it('ส่งยา → medicine-delivery', () => {
    const job = makeJob();
    job.jobSpec.addons.medicinePickup = true;
    expect(extractRequiredSkills(job)).toContain('medicine-delivery');
  });
});

// ============================================================================
// getPreferredProviderType
// ============================================================================

describe('getPreferredProviderType()', () => {
  it('งานทั่วไป → DRIVER', () => {
    expect(getPreferredProviderType(makeJob())).toBe('DRIVER');
  });

  it('ต้องการ nurse → NURSE', () => {
    expect(getPreferredProviderType(makeDialysisJob())).toBe('NURSE');
  });

  it('home care → CAREGIVER', () => {
    const job = makeJob();
    job.jobSpec.addons.homeCare = true;
    expect(getPreferredProviderType(job)).toBe('CAREGIVER');
  });

  it('ต้องการออกซิเจน (ไม่ใช่ nurse) → CAREGIVER', () => {
    const job = makeJob();
    job.jobSpec.patient.oxygenRequired = true;
    expect(getPreferredProviderType(job)).toBe('CAREGIVER');
  });
});

// ============================================================================
// scoreSuitability
// ============================================================================

describe('scoreSuitability()', () => {
  const driver = DEFAULT_PROVIDER_POOL.find(p => p.id === 'DRV-001')!;
  const wheelchairDriver = DEFAULT_PROVIDER_POOL.find(p => p.id === 'DRV-002')!;
  const nurse = DEFAULT_PROVIDER_POOL.find(p => p.id === 'RN-001')!;

  it('งานทั่วไป + driver ทั่วไป → score สูง', () => {
    const score = scoreSuitability(driver, makeJob());
    expect(score.score).toBeGreaterThanOrEqual(50);
  });

  it('งาน wheelchair + wheelchair-van driver → score สูงกว่า driver ทั่วไป', () => {
    const job = makeWheelchairJob();
    const scoreWheelchair = scoreSuitability(wheelchairDriver, job);
    const scoreNormal = scoreSuitability(driver, job);
    expect(scoreWheelchair.score).toBeGreaterThan(scoreNormal.score);
  });

  it('งานฟอกไต + nurse → score สูงสุด', () => {
    const score = scoreSuitability(nurse, makeDialysisJob());
    expect(score.score).toBeGreaterThanOrEqual(70);
    expect(score.matchedSkills).toContain('nurse-license');
  });

  it('งาน wheelchair + driver ไม่มี skill → missingSkills มี wheelchair', () => {
    const score = scoreSuitability(driver, makeWheelchairJob());
    expect(score.missingSkills).toContain('wheelchair');
  });
});

// ============================================================================
// selectProvider
// ============================================================================

describe('selectProvider()', () => {
  it('งานทั่วไป → คืน provider', () => {
    const result = selectProvider(makeJob());
    expect(result).not.toBeNull();
    expect(result!.provider.available).toBe(true);
  });

  it('งาน wheelchair → เลือก wheelchair-van driver', () => {
    const result = selectProvider(makeWheelchairJob());
    expect(result).not.toBeNull();
    expect(result!.provider.vehicle).toBe('wheelchair-van');
  });

  it('งาน dialysis → เลือก nurse', () => {
    const result = selectProvider(makeDialysisJob());
    expect(result).not.toBeNull();
    expect(result!.provider.type).toBe('NURSE');
  });

  it('ไม่มี provider ว่าง → คืน null', () => {
    const unavailable = DEFAULT_PROVIDER_POOL.map(p => ({ ...p, available: false }));
    expect(selectProvider(makeJob(), unavailable)).toBeNull();
  });

  it('pool ว่าง → คืน null', () => {
    expect(selectProvider(makeJob(), [])).toBeNull();
  });
});

// ============================================================================
// estimateArrivalMinutes
// ============================================================================

describe('estimateArrivalMinutes()', () => {
  const driver = DEFAULT_PROVIDER_POOL[0];

  it('งาน urgent → เร็วกว่า normal', () => {
    const urgent = makeJob();
    (urgent.jobSpec.metadata as any).urgencyLevel = 'urgent';
    const normal = makeJob();

    expect(estimateArrivalMinutes(urgent, driver)).toBeLessThan(
      estimateArrivalMinutes(normal, driver)
    );
  });

  it('มีอุปกรณ์พิเศษ → เพิ่มเวลา 10 นาที', () => {
    const normal = makeJob();
    const withEquip = makeWheelchairJob();
    expect(estimateArrivalMinutes(withEquip, driver)).toBe(
      estimateArrivalMinutes(normal, driver) + 10
    );
  });
});

// ============================================================================
// dispatch() — integration
// ============================================================================

describe('dispatch()', () => {
  it('งานทั่วไป → success + มี provider', () => {
    const result = dispatch(makeJob());
    expect(result.success).toBe(true);
    expect(result.provider).toBeDefined();
    expect(result.estimatedArrivalMinutes).toBeGreaterThan(0);
    expect(result.requiresHumanApproval).toBe(false);
  });

  it('งาน wheelchair → เลือก provider ที่มี wheelchair skill', () => {
    const result = dispatch(makeWheelchairJob());
    expect(result.success).toBe(true);
    expect(result.provider!.skills).toContain('wheelchair');
  });

  it('งาน dialysis → เลือก nurse', () => {
    const result = dispatch(makeDialysisJob());
    expect(result.success).toBe(true);
    expect(result.provider!.type).toBe('NURSE');
  });

  it('ไม่มี provider ว่าง → requiresHumanApproval = true', () => {
    const unavailable = DEFAULT_PROVIDER_POOL.map(p => ({ ...p, available: false }));
    const result = dispatch(makeJob(), unavailable);
    expect(result.success).toBe(false);
    expect(result.requiresHumanApproval).toBe(true);
  });

  it('job state ผิด → คืน error', () => {
    const job = makeJob();
    job.state = 'COMPLETED';
    const result = dispatch(job);
    expect(result.success).toBe(false);
    expect(result.error).toContain('COMPLETED');
  });

  it('คืน reasoning อธิบายการตัดสินใจ', () => {
    const result = dispatch(makeJob());
    expect(result.reasoning).toBeDefined();
    expect(typeof result.reasoning).toBe('string');
  });
});
