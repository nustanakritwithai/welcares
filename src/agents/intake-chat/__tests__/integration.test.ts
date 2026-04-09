/**
 * Integration Tests for Intake Chat Agent
 * 
 * End-to-end tests สำหรับทดสอบ flow การสนทนาเต็มรูปแบบ
 * จากเริ่มต้นจนถึงยืนยันการจอง
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  parseInput, 
  detectIntent,
  applyParsedAnswer,
} from '../parser';
import {
  getInitialMessages,
  getNextField,
  buildQuestionForField,
  buildConfirmationSummary,
  handleUserTurn,
  deriveConversationState,
  type ConversationState,
  type FormData,
} from '../conversation';

// ============================================================================
// Mock Services
// ============================================================================

vi.mock('@/agents/intake/service', () => ({
  previewIntake: vi.fn().mockResolvedValue({
    success: true,
    jobSpec: {
      jobId: 'WC-TEST123',
      service: { typeLabel: 'พบแพทย์นอก' },
    },
  }),
  submitIntake: vi.fn().mockResolvedValue({
    success: true,
    jobId: 'WC-TEST123',
  }),
}));

vi.mock('@/agents/intake/validator', () => ({
  validateFormData: vi.fn((data) => ({
    isComplete: isFormComplete(data),
    missingFields: getMissingFields(data),
    nextQuestion: null,
    warnings: [],
    normalizedData: data,
  })),
}));

// Helper function to check if form is complete
function isFormComplete(formData: FormData): boolean {
  const required = ['contactName', 'contactPhone', 'serviceType', 'appointmentDate', 'appointmentTime', 'pickup.address', 'dropoff.address', 'patient.name'];
  return required.every(field => {
    const value = getNestedValue(formData, field);
    return value !== undefined && value !== null && value !== '';
  });
}

// Helper function to get missing fields
function getMissingFields(formData: FormData): string[] {
  const required = ['contactName', 'contactPhone', 'serviceType', 'appointmentDate', 'appointmentTime', 'pickup.address', 'dropoff.address', 'patient.name'];
  return required.filter(field => {
    const value = getNestedValue(formData, field);
    return value === undefined || value === null || value === '';
  });
}

// Helper to get nested value
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Intake Chat Integration Tests', () => {
  
  // Reset state before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Conversation Flow', () => {
    it('ควรสามารถทำการจองได้สำเร็จตั้งแต่ต้นจนจบ (Happy Path)', async () => {
      // Step 1: Get welcome messages
      const welcomeMessages = getInitialMessages();
      expect(welcomeMessages).toHaveLength(1);
      expect(welcomeMessages[0].content).toContain('สวัสดี');

      // Initial state
      let state: ConversationState = {
        formData: {},
        currentField: null,
        askedFields: [],
        confirmed: false,
      };

      // Step 2: Get first field to ask
      let nextField = getNextField(state);
      expect(nextField).toBe('contactName');

      // Step 3: Answer contact name
      let parsed = parseInput('สมชาย ใจดี', 'contactName');
      expect(parsed.confidence).toBeGreaterThan(0.5);
      
      state = {
        ...state,
        formData: applyParsedAnswer(state.formData, parsed) as FormData,
        currentField: 'contactName',
        askedFields: [...state.askedFields, 'contactName'],
      };

      // Step 4: Get next field (contactPhone)
      nextField = getNextField(state);
      expect(nextField).toBe('contactPhone');

      let question = buildQuestionForField(nextField, state.formData);
      expect(question).toContain('เบอร์โทร');

      // Step 5: Answer phone number
      parsed = parseInput('0812345678', 'contactPhone');
      expect(parsed.value).toBe('0812345678');
      
      state = {
        ...state,
        formData: applyParsedAnswer(state.formData, parsed) as FormData,
        currentField: 'contactPhone',
        askedFields: [...state.askedFields, 'contactPhone'],
      };

      // Step 6: Get next field (serviceType)
      nextField = getNextField(state);
      expect(nextField).toBe('serviceType');

      // Step 7: Answer service type (hospital visit)
      parsed = parseInput('พบแพทย์', 'serviceType');
      expect(parsed.value).toBe('hospital-visit');
      
      state = {
        ...state,
        formData: {
          ...applyParsedAnswer(state.formData, parsed) as FormData,
          serviceType: 'hospital-visit',
        },
        currentField: 'serviceType',
        askedFields: [...state.askedFields, 'serviceType'],
      };

      // Step 8: Should ask for department (conditional)
      nextField = getNextField(state);
      expect(nextField).toBe('department');

      // Answer department
      state = {
        ...state,
        formData: {
          ...state.formData,
          department: 'อายุรกรรม',
        },
        currentField: 'department',
        askedFields: [...state.askedFields, 'department'],
      };

      // Step 9: Get appointment date
      nextField = getNextField(state);
      expect(nextField).toBe('appointmentDate');

      // Answer date
      parsed = parseInput('พรุ่งนี้', 'appointmentDate');
      expect(parsed.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      state = {
        ...state,
        formData: {
          ...state.formData,
          appointmentDate: parsed.value as string,
        },
        currentField: 'appointmentDate',
        askedFields: [...state.askedFields, 'appointmentDate'],
      };

      // Step 10: Get appointment time
      nextField = getNextField(state);
      expect(nextField).toBe('appointmentTime');

      // Answer time
      parsed = parseInput('บ่าย 2 โมง', 'appointmentTime');
      expect(parsed.value).toBe('14:00');
      
      state = {
        ...state,
        formData: {
          ...state.formData,
          appointmentTime: parsed.value as string,
        },
        currentField: 'appointmentTime',
        askedFields: [...state.askedFields, 'appointmentTime'],
      };

      // Step 11: Get pickup address
      nextField = getNextField(state);
      expect(nextField).toBe('pickup.address');

      state = {
        ...state,
        formData: {
          ...state.formData,
          pickup: { address: '123 ถนนสุขุมวิท แขวงคลองเตย' },
        },
        currentField: 'pickup.address',
        askedFields: [...state.askedFields, 'pickup.address'],
      };

      // Step 12: Get dropoff address
      nextField = getNextField(state);
      expect(nextField).toBe('dropoff.address');

      state = {
        ...state,
        formData: {
          ...state.formData,
          dropoff: { address: 'โรงพยาบาลรามาธิบดี' },
        },
        currentField: 'dropoff.address',
        askedFields: [...state.askedFields, 'dropoff.address'],
      };

      // Step 13: Get patient name
      nextField = getNextField(state);
      expect(nextField).toBe('patient.name');

      state = {
        ...state,
        formData: {
          ...state.formData,
          patient: { name: 'คุณยายสมใจ' },
        },
        currentField: 'patient.name',
        askedFields: [...state.askedFields, 'patient.name'],
      };

      // Step 14: Check that form is complete
      const derivedState = deriveConversationState(state.formData);
      expect(derivedState.isComplete).toBe(true);
      expect(derivedState.missingFields).toHaveLength(0);

      // Step 15: Build confirmation summary
      const summary = buildConfirmationSummary(state.formData);
      expect(summary).toContain('สมชาย');
      expect(summary).toContain('0812345678');
      expect(summary).toContain('อายุรกรรม');
      expect(summary).toContain('คุณยายสมใจ');
      expect(summary).toContain('ยืนยัน');

      // Step 16: Handle confirmation
      const result = handleUserTurn(state, 'ยืนยัน');
      expect(result.isComplete).toBe(true);
      expect(result.needsConfirmation).toBeUndefined();
    });

    it('ควรจัดการการแก้ไขข้อมูลได้อย่างถูกต้อง', () => {
      let state: ConversationState = {
        formData: {
          contactName: 'สมชาย',
          contactPhone: '0812345678',
          serviceType: 'hospital-visit',
          appointmentDate: '2024-12-25',
        },
        currentField: 'serviceType',
        askedFields: ['contactName', 'contactPhone', 'serviceType', 'appointmentDate'],
        confirmed: false,
      };

      // Try to edit service type
      const intent = detectIntent('แก้ไขบริการ');
      expect(intent.intent).toBe('edit');

      // User indicates they want to change something
      const result = handleUserTurn(state, 'แก้ไข');
      expect(result.response).toContain('แก้ไข');
    });

    it('ควรสามารถ restart conversation ได้', () => {
      const state: ConversationState = {
        formData: {
          contactName: 'สมชาย',
          contactPhone: '0812345678',
        },
        currentField: 'contactPhone',
        askedFields: ['contactName', 'contactPhone'],
        confirmed: false,
      };

      // Detect restart intent
      const intent = detectIntent('เริ่มใหม่');
      expect(intent.intent).toBe('restart');
      expect(intent.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Parser Integration', () => {
    it('ควรแปลงข้อความภาษาไทยเป็นข้อมูลได้ถูกต้อง', () => {
      const testCases = [
        { input: 'พบแพทย์', field: 'serviceType', expected: 'hospital-visit' },
        { input: 'ล้างไต', field: 'serviceType', expected: 'dialysis' },
        { input: 'กายภาพบำบัด', field: 'serviceType', expected: 'physical-therapy' },
        { input: 'พรุ่งนี้', field: 'appointmentDate', expectedPattern: /^\d{4}-\d{2}-\d{2}$/ },
        { input: 'บ่าย 3 โมง', field: 'appointmentTime', expected: '15:00' },
        { input: '0812345678', field: 'contactPhone', expected: '0812345678' },
      ];

      for (const tc of testCases) {
        const parsed = parseInput(tc.input, tc.field);
        expect(parsed.confidence).toBeGreaterThan(0.5);
        
        if (tc.expected !== undefined) {
          expect(parsed.value).toBe(tc.expected);
        }
        if (tc.expectedPattern) {
          expect(parsed.value).toMatch(tc.expectedPattern);
        }
      }
    });

    it('ควรตรวจจับ intent จากข้อความได้ถูกต้อง', () => {
      const testCases = [
        { input: 'ยืนยัน', expected: 'confirm' },
        { input: 'ตกลง', expected: 'confirm' },
        { input: 'แก้ไข', expected: 'edit' },
        { input: 'เปลี่ยน', expected: 'edit' },
        { input: 'เริ่มใหม่', expected: 'restart' },
        { input: 'ยกเลิก', expected: 'restart' },
        { input: 'ข้าม', expected: 'skip' },
        { input: 'ไม่มี', expected: 'skip' },
      ];

      for (const tc of testCases) {
        const result = detectIntent(tc.input);
        expect(result.intent).toBe(tc.expected);
        expect(result.confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Conditional Questions Flow', () => {
    it('ควรถาม department เมื่อเลือก hospital-visit', () => {
      const state: ConversationState = {
        formData: {
          serviceType: 'hospital-visit',
        },
        currentField: 'serviceType',
        askedFields: ['contactName', 'contactPhone', 'serviceType'],
        confirmed: false,
      };

      const nextField = getNextField(state);
      expect(nextField).toBe('department');
    });

    it('ไม่ควรถาม department เมื่อเลือกบริการอื่น', () => {
      const state: ConversationState = {
        formData: {
          serviceType: 'dialysis',
        },
        currentField: 'serviceType',
        askedFields: ['contactName', 'contactPhone', 'serviceType'],
        confirmed: false,
      };

      const nextField = getNextField(state);
      expect(nextField).not.toBe('department');
    });
  });

  describe('Error Handling', () => {
    it('ควรจัดการข้อมูลที่ parse ไม่ได้อย่างเหมาะสม', () => {
      const parsed = parseInput('ข้อความที่ไม่เข้าใจ', 'serviceType');
      expect(parsed.confidence).toBeLessThan(0.6);
    });

    it('ควรคืนค่า null เมื่อไม่มี field ต่อไป', () => {
      const state: ConversationState = {
        formData: {
          contactName: 'สมชาย',
          contactPhone: '0812345678',
          serviceType: 'dialysis',
          appointmentDate: '2024-12-25',
          appointmentTime: '10:00',
          pickup: { address: 'บ้าน' },
          dropoff: { address: 'โรงพยาบาล' },
          patient: { name: 'คุณยาย' },
        },
        currentField: 'patient.name',
        askedFields: ['contactName', 'contactPhone', 'serviceType', 'appointmentDate', 'appointmentTime', 'pickup.address', 'dropoff.address', 'patient.name'],
        confirmed: false,
      };

      const nextField = getNextField(state);
      expect(nextField).toBeNull();
    });
  });
});
