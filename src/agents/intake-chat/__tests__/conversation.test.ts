/**
 * Tests for Conversation Engine
 * ทดสอบฟังก์ชันทั้งหมดของ conversation engine
 */

import { describe, it, expect } from 'vitest';
import {
  getInitialMessages,
  getRequiredFieldOrder,
  getNextField,
  buildQuestionForField,
  getConditionalQuestions,
  shouldAskField,
  buildConfirmationSummary,
  handleUserTurn,
  deriveConversationState,
  getQuickRepliesForField,
  type ConversationState,
  type FormData,
  type ParserResult,
  SERVICE_TYPES,
  MOBILITY_LEVELS
} from '../conversation';

// ==================== Test Cases ====================

describe('Conversation Engine', () => {
  // Test 1: getInitialMessages
  describe('getInitialMessages', () => {
    it('ควรส่งคืนข้อความต้อนรับที่ถูกต้อง', () => {
      const messages = getInitialMessages();
      
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toContain('สวัสดีค่ะ');
      expect(messages[0].content).toContain('WelCares');
    });
  });

  // Test 2: getRequiredFieldOrder
  describe('getRequiredFieldOrder', () => {
    it('ควรส่งคืนลำดับ field ที่ถูกต้อง', () => {
      const order = getRequiredFieldOrder();
      
      expect(order).toEqual([
        'contactName',
        'contactPhone',
        'serviceType',
        'appointmentDate',
        'appointmentTime',
        'pickup.address',
        'dropoff.address',
        'patient.name'
      ]);
    });
  });

  // Test 3: getNextField - เริ่มต้น
  describe('getNextField - initial state', () => {
    it('ควรส่งคืน contactName เป็นครั้งแรก', () => {
      const state: ConversationState = {
        formData: {},
        currentField: null,
        askedFields: [],
        confirmed: false
      };
      
      const nextField = getNextField(state);
      expect(nextField).toBe('contactName');
    });
  });

  // Test 4: getNextField - หลังจากถามไปแล้ว
  describe('getNextField - after asking contactName', () => {
    it('ควรส่งคืน contactPhone หลังจากถาม contactName แล้ว', () => {
      const state: ConversationState = {
        formData: { contactName: 'สมชาย' },
        currentField: 'contactName',
        askedFields: ['contactName'],
        confirmed: false
      };
      
      const nextField = getNextField(state);
      expect(nextField).toBe('contactPhone');
    });
  });

  // Test 5: getNextField - form ครบแล้ว
  describe('getNextField - complete form', () => {
    it('ควรส่งคืน null เมื่อ form ครบแล้ว', () => {
      const state: ConversationState = {
        formData: {
          contactName: 'สมชาย',
          contactPhone: '0812345678',
          serviceType: 'clinic-visit', // ไม่ต้องการ department
          appointmentDate: '2024-01-15',
          appointmentTime: '10:00',
          pickup: { address: 'บ้านเลขที่ 123' },
          dropoff: { address: 'โรงพยาบาลรามาธิบดี' },
          patient: { name: 'คุณยายสมใจ' }
        },
        currentField: 'patient.name',
        askedFields: ['contactName', 'contactPhone', 'serviceType', 'appointmentDate', 'appointmentTime', 'pickup.address', 'dropoff.address', 'patient.name'],
        confirmed: false
      };
      
      const nextField = getNextField(state);
      expect(nextField).toBeNull();
    });
  });

  // Test 6: buildQuestionForField
  describe('buildQuestionForField', () => {
    it('ควรส่งคืนคำถามสำหรับ contactName', () => {
      const question = buildQuestionForField('contactName', {});
      expect(question).toBe('กรุณาบอกชื่อผู้ติดต่อหลักค่ะ');
    });

    it('ควรส่งคืนคำถามสำหรับ serviceType ที่มี context', () => {
      const question = buildQuestionForField('serviceType', { contactName: 'สมชาย' });
      expect(question).toContain('สมชาย');
    });
  });

  // Test 7: getConditionalQuestions - hospital-visit
  describe('getConditionalQuestions - hospital-visit', () => {
    it('ควรถาม department เมื่อ serviceType เป็น hospital-visit', () => {
      const formData: FormData = {
        serviceType: 'hospital-visit'
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).toContain('department');
    });

    it('ไม่ควรถาม department เมื่อ serviceType ไม่ใช่ hospital-visit', () => {
      const formData: FormData = {
        serviceType: 'clinic-visit'
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).not.toContain('department');
    });
  });

  // Test 8: getConditionalQuestions - mobilityLevel
  describe('getConditionalQuestions - mobilityLevel', () => {
    it('ควรถาม needsEscort เมื่อ mobilityLevel ไม่ใช่ independent', () => {
      const formData: FormData = {
        patient: { mobilityLevel: 'assistance' }
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).toContain('needsEscort');
    });

    it('ไม่ควรถาม needsEscort เมื่อ mobilityLevel เป็น independent', () => {
      const formData: FormData = {
        patient: { mobilityLevel: 'independent' }
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).not.toContain('needsEscort');
    });
  });

  // Test 9: getConditionalQuestions - buildingName
  describe('getConditionalQuestions - buildingName', () => {
    it('ควรถาม floor/room เมื่อมี buildingName ที่ pickup', () => {
      const formData: FormData = {
        pickup: { buildingName: 'คอนโด ABC' }
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).toContain('pickup.floor');
      expect(conditionalFields).toContain('pickup.room');
    });

    it('ควรถาม floor/room เมื่อมี buildingName ที่ dropoff', () => {
      const formData: FormData = {
        dropoff: { buildingName: 'โรงพยาบาล XYZ' }
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).toContain('dropoff.floor');
      expect(conditionalFields).toContain('dropoff.room');
    });
  });

  // Test 10: getConditionalQuestions - wheelchair/stretcher
  describe('getConditionalQuestions - wheelchair/stretcher', () => {
    it('ควรถาม equipmentNeeds เมื่อ mobilityLevel เป็น wheelchair', () => {
      const formData: FormData = {
        patient: { mobilityLevel: 'wheelchair' }
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).toContain('equipmentNeeds');
    });

    it('ควรถาม equipmentNeeds เมื่อ mobilityLevel เป็น stretcher', () => {
      const formData: FormData = {
        patient: { mobilityLevel: 'stretcher' }
      };
      
      const conditionalFields = getConditionalQuestions(formData);
      expect(conditionalFields).toContain('equipmentNeeds');
    });
  });

  // Test 11: shouldAskField
  describe('shouldAskField', () => {
    it('ควรส่งคืน true เมื่อ field ไม่มีค่า', () => {
      const result = shouldAskField('contactName', {});
      expect(result).toBe(true);
    });

    it('ควรส่งคืน false เมื่อ field มีค่าแล้ว', () => {
      const result = shouldAskField('contactName', { contactName: 'สมชาย' });
      expect(result).toBe(false);
    });

    it('ควรส่งคืน false สำหรับ department เมื่อ serviceType ไม่ใช่ hospital-visit', () => {
      const result = shouldAskField('department', { serviceType: 'clinic-visit' });
      expect(result).toBe(false);
    });

    it('ควรส่งคืน false สำหรับ needsEscort เมื่อ mobilityLevel เป็น independent', () => {
      const result = shouldAskField('needsEscort', { patient: { mobilityLevel: 'independent' } });
      expect(result).toBe(false);
    });

    it('ควรส่งคืน false สำหรับ pickup.floor เมื่อไม่มี buildingName', () => {
      const result = shouldAskField('pickup.floor', { pickup: {} });
      expect(result).toBe(false);
    });
  });

  // Test 12: buildConfirmationSummary
  describe('buildConfirmationSummary', () => {
    it('ควรสร้างสรุปที่ครบถ้วน', () => {
      const formData: FormData = {
        contactName: 'สมชาย',
        contactPhone: '0812345678',
        serviceType: 'hospital-visit',
        department: 'อายุรกรรม',
        appointmentDate: '2024-01-15',
        appointmentTime: '10:00',
        pickup: {
          address: 'บ้านเลขที่ 123',
          buildingName: 'คอนโด ABC',
          floor: '5',
          room: '501'
        },
        dropoff: {
          address: 'โรงพยาบาลรามาธิบดี'
        },
        patient: {
          name: 'คุณยายสมใจ',
          mobilityLevel: 'wheelchair'
        },
        needsEscort: true,
        equipmentNeeds: 'ออกซิเจน'
      };

      const summary = buildConfirmationSummary(formData, {
        duration: '45 นาที',
        priceEstimate: '850 บาท'
      });

      expect(summary).toContain('สมชาย');
      expect(summary).toContain('0812345678');
      expect(summary).toContain('พาผู้ป่วยไปโรงพยาบาล');
      expect(summary).toContain('อายุรกรรม');
      expect(summary).toContain('คอนโด ABC');
      expect(summary).toContain('ชั้น 5');
      expect(summary).toContain('ห้อง 501');
      expect(summary).toContain('คุณยายสมใจ');
      expect(summary).toContain('850 บาท');
      expect(summary).toContain('ยืนยัน');
    });

    it('ควรสร้างสรุปที่ไม่มี optional fields', () => {
      const formData: FormData = {
        contactName: 'สมชาย',
        serviceType: 'clinic-visit',
        pickup: { address: 'บ้าน' },
        dropoff: { address: 'คลินิก' },
        patient: { name: 'ผู้ป่วย' }
      };

      const summary = buildConfirmationSummary(formData);

      expect(summary).toContain('สมชาย');
      expect(summary).not.toContain('แผนก');
    });
  });

  // Test 13: handleUserTurn - เริ่มต้น
  describe('handleUserTurn - initial turn', () => {
    it('ควรถาม contactName ในครั้งแรก', () => {
      const state: ConversationState = {
        formData: {},
        currentField: null,
        askedFields: [],
        confirmed: false
      };

      const result = handleUserTurn(state, 'สวัสดี');

      expect(result.response).toContain('ชื่อผู้ติดต่อ');
      expect(result.updatedState.currentField).toBe('contactName');
    });
  });

  // Test 14: handleUserTurn - ยืนยันการจอง
  describe('handleUserTurn - confirmation', () => {
    it('ควรยืนยันการจองเมื่อ form ครบและผู้ใช้พิมพ์ยืนยัน', () => {
      const state: ConversationState = {
        formData: {
          contactName: 'สมชาย',
          contactPhone: '0812345678',
          serviceType: 'clinic-visit', // ไม่ต้องการ department
          appointmentDate: '2024-01-15',
          appointmentTime: '10:00',
          pickup: { address: 'บ้าน' },
          dropoff: { address: 'คลินิก' },
          patient: { name: 'ผู้ป่วย' }
        },
        currentField: 'patient.name',
        askedFields: ['contactName', 'contactPhone', 'serviceType', 'appointmentDate', 'appointmentTime', 'pickup.address', 'dropoff.address', 'patient.name'],
        confirmed: false
      };

      const result = handleUserTurn(state, 'ยืนยัน');

      expect(result.isComplete).toBe(true);
      expect(result.response).toContain('เสร็จสมบูรณ์');
    });

    it('ควรแสดงสรุปเมื่อ form ครบแต่ยังไม่ได้ยืนยัน', () => {
      const state: ConversationState = {
        formData: {
          contactName: 'สมชาย',
          contactPhone: '0812345678',
          serviceType: 'clinic-visit', // ไม่ต้องการ department
          appointmentDate: '2024-01-15',
          appointmentTime: '10:00',
          pickup: { address: 'บ้าน' },
          dropoff: { address: 'คลินิก' },
          patient: { name: 'ผู้ป่วย' }
        },
        currentField: 'patient.name',
        askedFields: ['contactName', 'contactPhone', 'serviceType', 'appointmentDate', 'appointmentTime', 'pickup.address', 'dropoff.address'],
        confirmed: false
      };

      const parserResult: ParserResult = {
        field: 'patient.name',
        value: 'ผู้ป่วย',
        confidence: 0.9
      };

      const result = handleUserTurn(state, 'ผู้ป่วย', parserResult);

      expect(result.needsConfirmation).toBe(true);
      expect(result.quickReplies).toBeDefined();
      expect(result.response).toContain('สรุปรายละเอียด');
    });
  });

  // Test 15: handleUserTurn - อัพเดทข้อมูลจาก parser
  describe('handleUserTurn - parser result', () => {
    it('ควรอัพเดท formData เมื่อมี parserResult', () => {
      const state: ConversationState = {
        formData: {},
        currentField: null,
        askedFields: [],
        confirmed: false
      };

      const parserResult: ParserResult = {
        field: 'contactName',
        value: 'สมชาย',
        confidence: 0.95
      };

      const result = handleUserTurn(state, 'ชื่อสมชายครับ', parserResult);

      expect(result.updatedState.formData.contactName).toBe('สมชาย');
      expect(result.updatedState.askedFields).toContain('contactName');
    });
  });

  // Test 16: deriveConversationState
  describe('deriveConversationState', () => {
    it('ควรส่งคืน isComplete = false เมื่อ form ไม่ครบ', () => {
      const formData: FormData = {
        contactName: 'สมชาย'
      };

      const result = deriveConversationState(formData);

      expect(result.isComplete).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
      expect(result.completedFields).toContain('contactName');
    });

    it('ควรส่งคืน isComplete = true เมื่อ form ครบทุก required field', () => {
      const formData: FormData = {
        contactName: 'สมชาย',
        contactPhone: '0812345678',
        serviceType: 'clinic-visit',
        appointmentDate: '2024-01-15',
        appointmentTime: '10:00',
        pickup: { address: 'บ้าน' },
        dropoff: { address: 'คลินิก' },
        patient: { name: 'ผู้ป่วย' }
      };

      const result = deriveConversationState(formData);

      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('ควรรวม conditional fields ใน missingFields', () => {
      const formData: FormData = {
        serviceType: 'hospital-visit'
        // department ไม่ได้ระบุ แต่ควรต้องมีเพราะเป็น hospital-visit
      };

      const result = deriveConversationState(formData);

      expect(result.missingFields).toContain('department');
    });
  });

  // Test 17: getQuickRepliesForField - serviceType
  describe('getQuickRepliesForField - serviceType', () => {
    it('ควรส่งคืนรายการประเภทบริการ', () => {
      const replies = getQuickRepliesForField('serviceType');
      
      expect(replies).toBeDefined();
      expect(replies!.length).toBe(SERVICE_TYPES.length);
      expect(replies![0]).toHaveProperty('label');
      expect(replies![0]).toHaveProperty('value');
    });
  });

  // Test 18: getQuickRepliesForField - mobilityLevel
  describe('getQuickRepliesForField - mobilityLevel', () => {
    it('ควรส่งคืนรายการระดับการเคลื่อนไหว', () => {
      const replies = getQuickRepliesForField('patient.mobilityLevel');
      
      expect(replies).toBeDefined();
      expect(replies!.length).toBe(MOBILITY_LEVELS.length);
    });
  });

  // Test 19: getQuickRepliesForField - needsEscort
  describe('getQuickRepliesForField - needsEscort', () => {
    it('ควรส่งคืนรายการใช่/ไม่ใช่', () => {
      const replies = getQuickRepliesForField('needsEscort');
      
      expect(replies).toBeDefined();
      expect(replies).toHaveLength(2);
      expect(replies![0].value).toBe('true');
      expect(replies![1].value).toBe('false');
    });
  });

  // Test 20: getQuickRepliesForField - appointmentDate
  describe('getQuickRepliesForField - appointmentDate', () => {
    it('ควรส่งคืนรายการวันที่แนะนำ', () => {
      const replies = getQuickRepliesForField('appointmentDate');
      
      expect(replies).toBeDefined();
      expect(replies!.length).toBe(8); // วันนี้ + 7 วัน
      expect(replies![0].label).toBe('วันนี้');
      expect(replies![1].label).toBe('พรุ่งนี้');
    });
  });

  // Test 21: getQuickRepliesForField - appointmentTime
  describe('getQuickRepliesForField - appointmentTime', () => {
    it('ควรส่งคืนรายการเวลาแนะนำ', () => {
      const replies = getQuickRepliesForField('appointmentTime');
      
      expect(replies).toBeDefined();
      expect(replies!.length).toBeGreaterThan(0);
    });
  });

  // Test 22: getQuickRepliesForField - ไม่มี quick replies
  describe('getQuickRepliesForField - no quick replies', () => {
    it('ควรส่งคืน undefined สำหรับ field ที่ไม่มี quick replies', () => {
      const replies = getQuickRepliesForField('contactName');
      
      expect(replies).toBeUndefined();
    });
  });

  // Test 23: handleUserTurn - กรณีที่ยืนยันแล้ว
  describe('handleUserTurn - already confirmed', () => {
    it('ควรส่งข้อความเสร็จสมบูรณ์เมื่อ confirmed = true', () => {
      const state: ConversationState = {
        formData: { contactName: 'สมชาย' },
        currentField: null,
        askedFields: [],
        confirmed: true
      };

      const result = handleUserTurn(state, 'ขอบคุณ');

      expect(result.response).toContain('เสร็จสมบูรณ์');
      expect(result.isComplete).toBe(true);
    });
  });

  // Test 24: ทดสอบ complete flow แบบ end-to-end
  describe('Complete Conversation Flow', () => {
    it('ควรสามารถทำ conversation จนจบได้', () => {
      let state: ConversationState = {
        formData: {},
        currentField: null,
        askedFields: [],
        confirmed: false
      };

      // Step 1: เริ่มต้น
      let result = handleUserTurn(state, 'สวัสดี');
      expect(result.response).toContain('ชื่อผู้ติดต่อ');
      state = result.updatedState;

      // Step 2: ให้ชื่อ
      result = handleUserTurn(state, 'สมชาย', { field: 'contactName', value: 'สมชาย', confidence: 0.95 });
      expect(result.response).toContain('เบอร์โทร');
      state = result.updatedState;

      // Step 3: ให้เบอร์โทร
      result = handleUserTurn(state, '0812345678', { field: 'contactPhone', value: '0812345678', confidence: 0.95 });
      expect(result.response).toContain('บริการ');
      state = result.updatedState;

      // Step 4: เลือกบริการ
      result = handleUserTurn(state, 'hospital-visit', { field: 'serviceType', value: 'hospital-visit', confidence: 0.95 });
      expect(result.response).toContain('แผนก');
      state = result.updatedState;

      // Step 5: ระบุแผนก
      result = handleUserTurn(state, 'อายุรกรรม', { field: 'department', value: 'อายุรกรรม', confidence: 0.9 });
      expect(result.response).toContain('วันที่');
      state = result.updatedState;

      // Step 6: ให้วันที่
      result = handleUserTurn(state, '2024-01-15', { field: 'appointmentDate', value: '2024-01-15', confidence: 0.95 });
      expect(result.response).toContain('เวลา');
      state = result.updatedState;

      // Step 7: ให้เวลา
      result = handleUserTurn(state, '10:00', { field: 'appointmentTime', value: '10:00', confidence: 0.95 });
      expect(result.response).toContain('รับที่ไหน');
      state = result.updatedState;

      // Step 8: ให้ที่อยู่รับ
      result = handleUserTurn(state, 'บ้านเลขที่ 123', { field: 'pickup.address', value: 'บ้านเลขที่ 123', confidence: 0.9 });
      expect(result.response).toContain('ส่งที่ไหน');
      state = result.updatedState;

      // Step 9: ให้ที่อยู่ส่ง
      result = handleUserTurn(state, 'โรงพยาบาล', { field: 'dropoff.address', value: 'โรงพยาบาล', confidence: 0.9 });
      expect(result.response).toContain('ผู้ป่วย');
      state = result.updatedState;

      // Step 10: ให้ชื่อผู้ป่วย
      result = handleUserTurn(state, 'คุณยายสมใจ', { field: 'patient.name', value: 'คุณยายสมใจ', confidence: 0.9 });
      
      // ควรแสดงสรุป
      expect(result.needsConfirmation).toBe(true);
      expect(result.response).toContain('สรุปรายละเอียด');
      state = result.updatedState;

      // Step 11: ยืนยัน
      result = handleUserTurn(state, 'ยืนยัน');
      expect(result.isComplete).toBe(true);
      expect(result.response).toContain('เสร็จสมบูรณ์');
    });
  });
});
