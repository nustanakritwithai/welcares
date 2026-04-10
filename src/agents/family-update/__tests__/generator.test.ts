/**
 * Family Update Agent — Tests
 */

import { describe, it, expect } from 'vitest';
import { generateFamilyUpdate, getNotifiableStates } from '../generator';
import type { FamilyUpdateInput } from '../types';

// ============================================================================
// FIXTURES
// ============================================================================

function makeInput(overrides: Partial<FamilyUpdateInput> = {}): FamilyUpdateInput {
  return {
    jobId: 'WC-TEST-001',
    newState: 'ASSIGNED',
    patientName: 'นางทดสอบ',
    providerName: 'สมชาย ขับดี',
    etaMinutes: 25,
    notes: '',
    ...overrides,
  };
}

// ============================================================================
// generateFamilyUpdate — silent states
// ============================================================================

describe('generateFamilyUpdate() — silent states', () => {
  it('INTAKE → skipped (ไม่ส่ง message)', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'INTAKE' }));
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('VALIDATE → skipped', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'VALIDATE' }));
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('REJECTED → skipped', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'REJECTED' }));
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it('skipReason มีข้อความอธิบาย', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'INTAKE' }));
    expect(result.skipReason).toBeDefined();
    expect(typeof result.skipReason).toBe('string');
  });
});

// ============================================================================
// generateFamilyUpdate — notifiable states
// ============================================================================

describe('generateFamilyUpdate() — DISPATCH state', () => {
  it('คืน message ที่มีข้อความ', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'DISPATCH' }));
    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.message!.messageTh.length).toBeGreaterThan(0);
  });

  it('channel = LINE', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'DISPATCH' }));
    expect(result.message!.recommendedChannel).toBe('LINE');
  });

  it('มีชื่อผู้ป่วยในข้อความ', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'DISPATCH', patientName: 'นางทดสอบ' }));
    expect(result.message!.messageTh).toContain('นางทดสอบ');
  });
});

describe('generateFamilyUpdate() — ASSIGNED state', () => {
  it('คืน message ที่ระบุชื่อ provider + ETA', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'ASSIGNED', providerName: 'สมชาย', etaMinutes: 20 }));
    expect(result.success).toBe(true);
    expect(result.message!.messageTh).toContain('สมชาย');
    expect(result.message!.messageTh).toContain('20');
  });

  it('tone = REASSURING', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'ASSIGNED' }));
    expect(result.message!.tone).toBe('REASSURING');
  });

  it('triggerState = ASSIGNED', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'ASSIGNED' }));
    expect(result.message!.triggerState).toBe('ASSIGNED');
  });
});

describe('generateFamilyUpdate() — PREPARING state', () => {
  it('คืน message ที่บอกว่าใกล้ถึง', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'PREPARING' }));
    expect(result.success).toBe(true);
    expect(result.message!.messageTh).toBeTruthy();
  });
});

describe('generateFamilyUpdate() — ACTIVE state', () => {
  it('คืน message ที่บอกว่ารับตัวแล้ว', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'ACTIVE' }));
    expect(result.success).toBe(true);
    expect(result.message!.messageTh).toBeTruthy();
  });

  it('tone = REASSURING', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'ACTIVE' }));
    expect(result.message!.tone).toBe('REASSURING');
  });
});

describe('generateFamilyUpdate() — DELAYED state', () => {
  it('คืน message ที่มี notes', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'DELAYED', notes: 'รถติด' }));
    expect(result.success).toBe(true);
    expect(result.message!.messageTh).toContain('รถติด');
  });
});

describe('generateFamilyUpdate() — INCIDENT state', () => {
  it('channel = SMS (urgent)', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'INCIDENT' }));
    expect(result.success).toBe(true);
    expect(result.message!.recommendedChannel).toBe('SMS');
  });

  it('tone = URGENT', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'INCIDENT' }));
    expect(result.message!.tone).toBe('URGENT');
  });
});

describe('generateFamilyUpdate() — COMPLETED state', () => {
  it('คืน message แจ้งเสร็จสิ้น', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'COMPLETED' }));
    expect(result.success).toBe(true);
    expect(result.message!.messageTh).toBeTruthy();
  });

  it('channel = LINE', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'COMPLETED' }));
    expect(result.message!.recommendedChannel).toBe('LINE');
  });
});

describe('generateFamilyUpdate() — CANCELLED state', () => {
  it('คืน message แจ้งยกเลิก', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'CANCELLED' }));
    expect(result.success).toBe(true);
    expect(result.message!.messageTh).toBeTruthy();
  });
});

// ============================================================================
// message structure
// ============================================================================

describe('FamilyUpdateMessage structure', () => {
  it('มี createdAt เป็น ISO string', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'ASSIGNED' }));
    const msg = result.message!;
    expect(msg.createdAt).toBeDefined();
    expect(() => new Date(msg.createdAt)).not.toThrow();
  });

  it('jobId ตรงกับ input', () => {
    const result = generateFamilyUpdate(makeInput({ newState: 'ASSIGNED', jobId: 'WC-XYZ-999' }));
    expect(result.jobId).toBe('WC-XYZ-999');
  });

  it('ไม่มีชื่อผู้ป่วย → ข้อความยังส่งออกได้ (ไม่ crash)', () => {
    const result = generateFamilyUpdate({ jobId: 'WC-001', newState: 'ASSIGNED' });
    expect(result.success).toBe(true);
    expect(result.message!.messageTh).toBeTruthy();
  });
});

// ============================================================================
// getNotifiableStates
// ============================================================================

describe('getNotifiableStates()', () => {
  it('คืน array ของ state ที่มี template', () => {
    const states = getNotifiableStates();
    expect(Array.isArray(states)).toBe(true);
    expect(states.length).toBeGreaterThan(0);
  });

  it('มี ASSIGNED และ COMPLETED', () => {
    const states = getNotifiableStates();
    expect(states).toContain('ASSIGNED');
    expect(states).toContain('COMPLETED');
  });

  it('ไม่มี INTAKE (silent state)', () => {
    const states = getNotifiableStates();
    expect(states).not.toContain('INTAKE');
  });
});
