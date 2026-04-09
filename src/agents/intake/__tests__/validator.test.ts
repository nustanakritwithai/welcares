/**
 * Intake Agent - Validator Engine Tests
 * ทดสอบฟังก์ชัน normalize และ validate ทั้งหมด
 */

import { describe, it, expect } from 'vitest';
import type { PartialIntakeInput, MobilityLevel, ServiceType } from '../schema';
import {
  // Utility functions
  getNestedValue,
  isEmptyString,
  normalizePhone,
  formatPhone,
  isValidThaiPhone,
  normalizeDate,
  normalizeTime,
  isValidTimeRange,
  isNotPastDate,
  isDifferentLocations,
  
  // Main functions
  normalizeInput,
  validateRequiredFields,
  validateConditionalFields,
  buildNextQuestion,
  generateWarnings,
  validateFormData,
  
  // Constants
  REQUIRED_FIELD_PATHS,
  THAI_PHONE_REGEX,
} from '../validator';

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('getNestedValue', () => {
  it('should get nested value', () => {
    const obj = { contact: { name: 'John', phone: '0812345678' } };
    expect(getNestedValue(obj, 'contact.name')).toBe('John');
    expect(getNestedValue(obj, 'contact.phone')).toBe('0812345678');
  });

  it('should return undefined for missing path', () => {
    const obj = { contact: { name: 'John' } };
    expect(getNestedValue(obj, 'contact.email')).toBeUndefined();
    expect(getNestedValue(obj, 'missing.path')).toBeUndefined();
  });

  it('should handle non-object input', () => {
    expect(getNestedValue(null, 'path')).toBeUndefined();
    expect(getNestedValue(undefined, 'path')).toBeUndefined();
    expect(getNestedValue('string', 'path')).toBeUndefined();
  });
});

describe('isEmptyString', () => {
  it('should return true for empty values', () => {
    expect(isEmptyString('')).toBe(true);
    expect(isEmptyString('   ')).toBe(true);
    expect(isEmptyString(null)).toBe(true);
    expect(isEmptyString(undefined)).toBe(true);
  });

  it('should return false for non-empty strings', () => {
    expect(isEmptyString('hello')).toBe(false);
    expect(isEmptyString('  hello  ')).toBe(false);
    expect(isEmptyString('0')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('should normalize Thai phone numbers', () => {
    expect(normalizePhone('0812345678')).toBe('0812345678');
    expect(normalizePhone('081-234-5678')).toBe('0812345678');
    expect(normalizePhone('081 234 5678')).toBe('0812345678');
  });

  it('should convert +66 to 0', () => {
    expect(normalizePhone('+66812345678')).toBe('0812345678');
    expect(normalizePhone('66812345678')).toBe('0812345678');
  });

  it('should not add leading 0 (validate will catch invalid)', () => {
    // normalizePhone ไม่ควรเติม 0 เอง - ให้ validation จัดการ
    expect(normalizePhone('812345678')).toBe('812345678');
  });
});

describe('formatPhone', () => {
  it('should format 9-digit phones as 0xx-xxx-xxx', () => {
    expect(formatPhone('021234567')).toBe('02-123-4567');
    expect(formatPhone('021234567')).toBe('02-123-4567');
  });

  it('should format 10-digit phones as 0xx-xxx-xxxx', () => {
    expect(formatPhone('0812345678')).toBe('081-234-5678');
    expect(formatPhone('0891234567')).toBe('089-123-4567');
  });
});

describe('isValidThaiPhone', () => {
  it('should validate correct Thai phones', () => {
    expect(isValidThaiPhone('0812345678')).toBe(true);
    expect(isValidThaiPhone('021234567')).toBe(true);
    expect(isValidThaiPhone('0891234567')).toBe(true);
  });

  it('should reject invalid phones', () => {
    expect(isValidThaiPhone('123456789')).toBe(false); // ไม่ขึ้นต้นด้วย 0
    expect(isValidThaiPhone('08123456')).toBe(false);   // สั้นเกินไป
    expect(isValidThaiPhone('08123456789')).toBe(false); // ยาวเกินไป
  });

  it('should validate phones with various formats', () => {
    expect(isValidThaiPhone('+66812345678')).toBe(true);
    expect(isValidThaiPhone('081-234-5678')).toBe(true);
    expect(isValidThaiPhone('081 234 5678')).toBe(true);
  });
});

describe('normalizeDate', () => {
  it('should normalize DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('25/12/2024')).toBe('2024-12-25');
    expect(normalizeDate('5/3/2024')).toBe('2024-03-05');
  });

  it('should normalize DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('25-12-2024')).toBe('2024-12-25');
  });

  it('should handle YYYY/MM/DD format', () => {
    expect(normalizeDate('2024/12/25')).toBe('2024-12-25');
  });

  it('should handle ISO format', () => {
    expect(normalizeDate('2024-12-25T10:00:00Z')).toBe('2024-12-25');
  });

  it('should return undefined for empty values', () => {
    expect(normalizeDate('')).toBeUndefined();
    expect(normalizeDate(null as unknown as string)).toBeUndefined();
    expect(normalizeDate(undefined as unknown as string)).toBeUndefined();
  });
});

describe('normalizeTime', () => {
  it('should normalize H:mm to HH:mm', () => {
    expect(normalizeTime('9:00')).toBe('09:00');
    expect(normalizeTime('14:30')).toBe('14:30');
  });

  it('should normalize HHmm to HH:mm', () => {
    expect(normalizeTime('0900')).toBe('09:00');
    expect(normalizeTime('1430')).toBe('14:30');
  });

  it('should handle Thai time format', () => {
    expect(normalizeTime('9 โมง')).toBe('09:00');
    expect(normalizeTime('14 น.')).toBe('14:00');
    expect(normalizeTime('14 นาฬิกา')).toBe('14:00');
  });

  it('should return undefined for empty values', () => {
    expect(normalizeTime('')).toBeUndefined();
    expect(normalizeTime('   ')).toBeUndefined();
  });
});

describe('isValidTimeRange', () => {
  it('should accept times between 06:00-20:00', () => {
    expect(isValidTimeRange('06:00')).toBe(true);
    expect(isValidTimeRange('10:00')).toBe(true);
    expect(isValidTimeRange('14:30')).toBe(true);
    expect(isValidTimeRange('20:00')).toBe(true);
  });

  it('should reject times outside 06:00-20:00', () => {
    expect(isValidTimeRange('05:59')).toBe(false);
    expect(isValidTimeRange('20:01')).toBe(false);
    expect(isValidTimeRange('23:00')).toBe(false);
    expect(isValidTimeRange('03:00')).toBe(false);
  });
});

describe('isNotPastDate', () => {
  it('should accept today', () => {
    // ใช้เวลา local แทน ISO string เพื่อหลีกเลี่ยงปัญหา timezone
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(isNotPastDate(dateStr)).toBe(true);
  });

  it('should accept future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const dateStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(isNotPastDate(dateStr)).toBe(true);
  });

  it('should reject past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 7);
    const dateStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    expect(isNotPastDate(dateStr)).toBe(false);
  });
});

describe('isDifferentLocations', () => {
  it('should return true for different addresses', () => {
    const pickup = { address: '123 Main St' };
    const dropoff = { address: '456 Oak Ave' };
    expect(isDifferentLocations(pickup, dropoff)).toBe(true);
  });

  it('should return false for same address and room', () => {
    const pickup = { address: '123 Main St', buildingName: 'A', roomNumber: '101' };
    const dropoff = { address: '123 Main St', buildingName: 'A', roomNumber: '101' };
    expect(isDifferentLocations(pickup, dropoff)).toBe(false);
  });

  it('should return true for same address but different building', () => {
    const pickup = { address: '123 Main St', buildingName: 'A' };
    const dropoff = { address: '123 Main St', buildingName: 'B' };
    expect(isDifferentLocations(pickup, dropoff)).toBe(true);
  });

  it('should return true for same building but different room', () => {
    const pickup = { address: '123 Main St', buildingName: 'A', roomNumber: '101' };
    const dropoff = { address: '123 Main St', buildingName: 'A', roomNumber: '102' };
    expect(isDifferentLocations(pickup, dropoff)).toBe(true);
  });

  it('should return true if data is incomplete', () => {
    expect(isDifferentLocations(undefined, { address: '123' })).toBe(true);
    expect(isDifferentLocations({ address: '123' }, undefined)).toBe(true);
  });
});

// ============================================================================
// NORMALIZE INPUT TESTS
// ============================================================================

describe('normalizeInput', () => {
  it('should trim all string fields', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: '  John Doe  ',
        contactPhone: '  0812345678  ',
        relationship: 'self',
      },
    };

    const result = normalizeInput(input);
    expect(result.normalizedData.contact?.contactName).toBe('John Doe');
    expect(result.normalizedData.contact?.contactPhone).toBe('081-234-5678');
  });

  it('should convert empty strings to undefined', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: '',
        contactPhone: '0812345678',
        relationship: 'self',
      },
    };

    const result = normalizeInput(input);
    expect(result.normalizedData.contact?.contactName).toBeUndefined();
  });

  it('should normalize phone format', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John',
        contactPhone: '+66812345678',
        relationship: 'self',
      },
    };

    const result = normalizeInput(input);
    expect(result.normalizedData.contact?.contactPhone).toBe('081-234-5678');
  });

  it('should normalize date format', () => {
    const input: PartialIntakeInput = {
      schedule: {
        appointmentDate: '25/12/2024',
        appointmentTime: '14:00',
        timeFlexibility: 'strict',
      },
    };

    const result = normalizeInput(input);
    expect(result.normalizedData.schedule?.appointmentDate).toBe('2024-12-25');
  });

  it('should normalize time format', () => {
    const input: PartialIntakeInput = {
      schedule: {
        appointmentDate: '2024-12-25',
        appointmentTime: '9 โมง',
        timeFlexibility: 'strict',
      },
    };

    const result = normalizeInput(input);
    expect(result.normalizedData.schedule?.appointmentTime).toBe('09:00');
  });

  it('should track normalized fields', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John',
        contactPhone: '0812345678',
        relationship: 'self',
      },
    };

    const result = normalizeInput(input);
    expect(result.normalizedFields).toContain('contact.contactName');
    expect(result.normalizedFields).toContain('contact.contactPhone');
    expect(result.normalizedFields).toContain('contact.relationship');
  });
});

// ============================================================================
// VALIDATE REQUIRED FIELDS TESTS
// ============================================================================

describe('validateRequiredFields', () => {
  it('should return all missing fields for empty input', () => {
    const result = validateRequiredFields({});
    expect(result.missingFields).toHaveLength(8);
    expect(result.missingFields).toContain('contact.contactName');
    expect(result.missingFields).toContain('contact.contactPhone');
    expect(result.missingFields).toContain('service.serviceType');
    expect(result.missingFields).toContain('schedule.appointmentDate');
    expect(result.missingFields).toContain('schedule.appointmentTime');
    expect(result.missingFields).toContain('locations.pickup.address');
    expect(result.missingFields).toContain('locations.dropoff.address');
    expect(result.missingFields).toContain('patient.name');
    expect(result.isComplete).toBe(false);
  });

  it('should return empty missing fields for complete input', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John',
        contactPhone: '0812345678',
        relationship: 'self',
      },
      service: {
        serviceType: 'hospital-visit' as ServiceType,
        appointmentType: 'new',
      },
      schedule: {
        appointmentDate: '2024-12-25',
        appointmentTime: '10:00',
        timeFlexibility: 'strict',
      },
      locations: {
        pickup: {
          address: '123 Main St',
          contactName: 'John',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: '456 Hospital Rd',
          contactName: 'Jane',
          contactPhone: '0898765432',
        },
      },
      patient: {
        name: 'Patient Name',
        mobilityLevel: 'independent',
        needsEscort: false,
        needsWheelchair: false,
        oxygenRequired: false,
        stretcherRequired: false,
        conditions: [],
        allergies: [],
        medications: [],
      },
    };

    const result = validateRequiredFields(input);
    expect(result.missingFields).toHaveLength(0);
    expect(result.isComplete).toBe(true);
  });

  it('should detect empty string as missing', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: '',
        contactPhone: '0812345678',
        relationship: 'self',
      },
    };

    const result = validateRequiredFields(input);
    expect(result.missingFields).toContain('contact.contactName');
  });
});

// ============================================================================
// VALIDATE CONDITIONAL FIELDS TESTS
// ============================================================================

describe('validateConditionalFields', () => {
  it('should require needsEscort if mobilityLevel is not independent', () => {
    const input: PartialIntakeInput = {
      patient: {
        name: 'Patient',
        mobilityLevel: 'assisted' as MobilityLevel,
      },
    };

    const result = validateConditionalFields(input);
    expect(result.missingFields).toContain('patient.needsEscort');
  });

  it('should not require needsEscort if mobilityLevel is independent', () => {
    const input: PartialIntakeInput = {
      patient: {
        name: 'Patient',
        mobilityLevel: 'independent' as MobilityLevel,
      },
    };

    const result = validateConditionalFields(input);
    expect(result.missingFields).not.toContain('patient.needsEscort');
  });

  it('should require floor if pickup has buildingName', () => {
    const input: PartialIntakeInput = {
      locations: {
        pickup: {
          address: '123 Main St',
          buildingName: 'Building A',
          contactName: 'John',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: '456 Hospital',
          contactName: 'Jane',
          contactPhone: '0898765432',
        },
      },
    };

    const result = validateConditionalFields(input);
    expect(result.missingFields).toContain('locations.pickup.floor');
  });

  it('should require department if serviceType is hospital-visit', () => {
    const input: PartialIntakeInput = {
      service: {
        serviceType: 'hospital-visit' as ServiceType,
        appointmentType: 'new',
      },
    };

    const result = validateConditionalFields(input);
    expect(result.missingFields).toContain('service.department');
  });

  it('should not require department for other service types', () => {
    const input: PartialIntakeInput = {
      service: {
        serviceType: 'physical-therapy' as ServiceType,
        appointmentType: 'new',
      },
    };

    const result = validateConditionalFields(input);
    expect(result.missingFields).not.toContain('service.department');
  });
});

// ============================================================================
// BUILD NEXT QUESTION TESTS
// ============================================================================

describe('buildNextQuestion', () => {
  it('should return completion message for no missing fields', () => {
    const result = buildNextQuestion([]);
    expect(result).toBe('ข้อมูลครบแล้วครับ กรุณาตรวจสอบอีกครั้ง');
  });

  it('should return Thai question for contact name', () => {
    const result = buildNextQuestion(['contact.contactName']);
    expect(result).toBe('ขอชื่อผู้ติดต่อด้วยครับ');
  });

  it('should return Thai question for phone', () => {
    const result = buildNextQuestion(['contact.contactPhone']);
    expect(result).toBe('ขอเบอร์โทรติดต่อด้วยครับ');
  });

  it('should return Thai question for patient name', () => {
    const result = buildNextQuestion(['patient.name']);
    expect(result).toBe('ขอชื่อผู้ป่วยด้วยครับ');
  });

  it('should return Thai question for appointment date', () => {
    const result = buildNextQuestion(['schedule.appointmentDate']);
    expect(result).toBe('นัดวันที่เท่าไรครับ');
  });

  it('should return Thai question for appointment time', () => {
    const result = buildNextQuestion(['schedule.appointmentTime']);
    expect(result).toBe('นัดกี่โมงครับ');
  });

  it('should return Thai question for pickup location', () => {
    const result = buildNextQuestion(['locations.pickup.address']);
    expect(result).toBe('ไปรับที่ไหนครับ');
  });

  it('should return Thai question for dropoff location', () => {
    const result = buildNextQuestion(['locations.dropoff.address']);
    expect(result).toBe('ไปส่งที่ไหนครับ');
  });

  it('should return Thai question for service type', () => {
    const result = buildNextQuestion(['service.serviceType']);
    expect(result).toBe('ต้องการบริการอะไรครับ');
  });

  it('should prioritize fields by importance', () => {
    // ถ้ามีหลาย fields ที่หายไป ต้องถาม field ที่สำคัญก่อน
    const result = buildNextQuestion([
      'schedule.appointmentDate',
      'contact.contactName',
      'patient.name',
    ]);
    expect(result).toBe('ขอชื่อผู้ติดต่อด้วยครับ');
  });
});

// ============================================================================
// GENERATE WARNINGS TESTS
// ============================================================================

describe('generateWarnings', () => {
  it('should warn about invalid phone', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John',
        contactPhone: '123456789', // ไม่ขึ้นต้นด้วย 0
        relationship: 'self',
      },
    };

    const warnings = generateWarnings(input, input);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe('contact.contactPhone');
    expect(warnings[0].severity).toBe('error');
  });

  it('should warn about past date', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    
    const input: PartialIntakeInput = {
      schedule: {
        appointmentDate: pastDate.toISOString().slice(0, 10),
        appointmentTime: '10:00',
        timeFlexibility: 'strict',
      },
    };

    const warnings = generateWarnings(input, input);
    expect(warnings.some(w => w.field === 'schedule.appointmentDate')).toBe(true);
  });

  it('should warn about time outside range', () => {
    const input: PartialIntakeInput = {
      schedule: {
        appointmentDate: '2025-12-25',
        appointmentTime: '22:00', // นอกช่วง 06:00-20:00
        timeFlexibility: 'strict',
      },
    };

    const warnings = generateWarnings(input, input);
    expect(warnings.some(w => w.field === 'schedule.appointmentTime')).toBe(true);
  });

  it('should warn about same pickup and dropoff', () => {
    const input: PartialIntakeInput = {
      locations: {
        pickup: {
          address: 'Same Address',
          contactName: 'John',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: 'Same Address',
          contactName: 'John',
          contactPhone: '0812345678',
        },
      },
    };

    const warnings = generateWarnings(input, input);
    expect(warnings.some(w => w.field === 'locations.dropoff.address')).toBe(true);
  });
});

// ============================================================================
// VALIDATE FORM DATA TESTS (Main Function)
// ============================================================================

describe('validateFormData', () => {
  it('should return isComplete: false for empty form', () => {
    const result = validateFormData({});
    expect(result.isComplete).toBe(false);
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.nextQuestion).toBeTruthy();
  });

  it('should return isComplete: true for valid complete form', () => {
    const futureYear = new Date().getFullYear() + 1;
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John Doe',
        contactPhone: '0812345678',
        relationship: 'self',
      },
      service: {
        serviceType: 'checkup' as ServiceType, // ไม่ต้องการ department
        appointmentType: 'new',
      },
      schedule: {
        appointmentDate: `${futureYear}-12-25`, // อนาคต
        appointmentTime: '10:00', // อยู่ในช่วง 06:00-20:00
        timeFlexibility: 'strict',
      },
      locations: {
        pickup: {
          address: '123 Main St',
          contactName: 'John',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: '456 Hospital Rd',
          contactName: 'Jane',
          contactPhone: '0898765432',
        },
      },
      patient: {
        name: 'Patient Name',
        mobilityLevel: 'independent' as MobilityLevel, // ไม่ต้องการ needsEscort
        needsEscort: false,
        needsWheelchair: false,
        oxygenRequired: false,
        stretcherRequired: false,
        conditions: [],
        allergies: [],
        medications: [],
      },
    };

    const result = validateFormData(input);
    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should normalize data in result', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: '  John Doe  ',
        contactPhone: '+66812345678',
        relationship: 'self',
      },
    };

    const result = validateFormData(input);
    expect(result.normalizedData.contact?.contactName).toBe('John Doe');
    expect(result.normalizedData.contact?.contactPhone).toBe('081-234-5678');
  });

  it('should return next question for missing required fields', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John',
        contactPhone: '0812345678',
        relationship: 'self',
      },
      // ขาด patient.name, service, schedule, locations
    };

    const result = validateFormData(input);
    expect(result.isComplete).toBe(false);
    expect(result.nextQuestion).toBeTruthy();
  });

  it('should include warnings for invalid data', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John',
        contactPhone: 'invalid', // ไม่ถูกต้อง
        relationship: 'self',
      },
    };

    const result = validateFormData(input);
    expect(result.warnings.some(w => w.field === 'contact.contactPhone')).toBe(true);
  });

  it('should handle hospital-visit with department requirement', () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'John',
        contactPhone: '0812345678',
        relationship: 'self',
      },
      service: {
        serviceType: 'hospital-visit' as ServiceType,
        appointmentType: 'new',
        // ขาด department
      },
      schedule: {
        appointmentDate: '2025-12-25',
        appointmentTime: '10:00',
        timeFlexibility: 'strict',
      },
      locations: {
        pickup: {
          address: '123 Main St',
          contactName: 'John',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: '456 Hospital',
          contactName: 'Jane',
          contactPhone: '0898765432',
        },
      },
      patient: {
        name: 'Patient',
        mobilityLevel: 'independent' as MobilityLevel,
        needsEscort: false,
        needsWheelchair: false,
        oxygenRequired: false,
        stretcherRequired: false,
        conditions: [],
        allergies: [],
        medications: [],
      },
    };

    const result = validateFormData(input);
    // ถ้า required fields ครบ ต้องตรวจ conditional fields
    // service.department ต้องมีสำหรับ hospital-visit
    expect(result.missingFields).toContain('service.department');
  });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  it('should have 8 required fields', () => {
    expect(REQUIRED_FIELD_PATHS).toHaveLength(8);
  });

  it('should include all essential fields', () => {
    expect(REQUIRED_FIELD_PATHS).toContain('contact.contactName');
    expect(REQUIRED_FIELD_PATHS).toContain('contact.contactPhone');
    expect(REQUIRED_FIELD_PATHS).toContain('service.serviceType');
    expect(REQUIRED_FIELD_PATHS).toContain('schedule.appointmentDate');
    expect(REQUIRED_FIELD_PATHS).toContain('schedule.appointmentTime');
    expect(REQUIRED_FIELD_PATHS).toContain('locations.pickup.address');
    expect(REQUIRED_FIELD_PATHS).toContain('locations.dropoff.address');
    expect(REQUIRED_FIELD_PATHS).toContain('patient.name');
  });

  it('should have valid phone regex', () => {
    expect(THAI_PHONE_REGEX.test('0812345678')).toBe(true);
    expect(THAI_PHONE_REGEX.test('021234567')).toBe(true);
    expect(THAI_PHONE_REGEX.test('123456789')).toBe(false);
    expect(THAI_PHONE_REGEX.test('08123456')).toBe(false);
  });
});
