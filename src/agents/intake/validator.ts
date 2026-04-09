/**
 * Intake Agent - Validator Engine (MVP)
 * ระบบ validate และ normalize ข้อมูลสำหรับ WelCares Intake Agent
 * 
 * @version 1.0 - MVP
 * @see schema.ts สำหรับ source of truth
 */

import type {
  IntakeInput,
  ValidationError,
  FollowUpQuestion,
  ServiceType,
  MobilityLevel,
} from './schema';

import type { PartialIntakeInput } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidateFormDataResult {
  isComplete: boolean;
  missingFields: string[];
  nextQuestion: string | null;
  warnings: ValidationError[];
  normalizedData: PartialIntakeInput;
}

export interface NormalizeInputResult {
  normalizedData: PartialIntakeInput;
  normalizedFields: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** 8 Required Fields (ขาดไม่ได้) */
export const REQUIRED_FIELD_PATHS = [
  'contact.contactName',
  'contact.contactPhone',
  'service.serviceType',
  'schedule.appointmentDate',
  'schedule.appointmentTime',
  'locations.pickup.address',
  'locations.dropoff.address',
  'patient.name',
] as const;

/** Thai phone regex: 0xxxxxxxx (9-10 digits starting with 0) */
export const THAI_PHONE_REGEX = /^0[0-9]{8,9}$/;

/** Service types ที่ต้องการแผนก */
export const HOSPITAL_VISIT_TYPES: ServiceType[] = ['hospital-visit'];

/** Mobility levels ที่ไม่ต้องการคนพา */
export const INDEPENDENT_MOBILITY: MobilityLevel = 'independent';

/** Question map สำหรับแต่ละ field */
const FIELD_QUESTIONS: Record<string, string> = {
  'contact.contactName': 'ขอชื่อผู้ติดต่อด้วยครับ',
  'contact.contactPhone': 'ขอเบอร์โทรติดต่อด้วยครับ',
  'service.serviceType': 'ต้องการบริการอะไรครับ',
  'schedule.appointmentDate': 'นัดวันที่เท่าไรครับ',
  'schedule.appointmentTime': 'นัดกี่โมงครับ',
  'locations.pickup.address': 'ไปรับที่ไหนครับ',
  'locations.dropoff.address': 'ไปส่งที่ไหนครับ',
  'patient.name': 'ขอชื่อผู้ป่วยด้วยครับ',
  'patient.mobilityLevel': 'ผู้ป่วยเดินได้เองไหมครับ',
  'patient.needsEscort': 'ต้องมีคนพาไหมครับ',
  'patient.needsWheelchair': 'ใช้รถเข็นไหมครับ',
  'locations.pickup.floor': 'อยู่ชั้นไหนครับ',
  'locations.pickup.roomNumber': 'ห้องเท่าไรครับ',
  'locations.dropoff.floor': 'อยู่ชั้นไหนครับ',
  'locations.dropoff.roomNumber': 'ห้องเท่าไรครับ',
  'service.department': 'นัดแผนกไหนครับ',
  'contact.relationship': 'ความสัมพันธ์กับผู้ป่วยคืออะไรครับ',
  'service.appointmentType': 'เป็นการนัดครั้งแรกหรือติดตามอาการครับ',
  'schedule.timeFlexibility': 'เวลายืดหยุ่นได้แค่ไหนครับ',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * ดึงค่าจาก nested object ด้วย path string
 * เช่น getNestedValue(obj, 'contact.name') → obj.contact?.name
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * ตรวจสอบว่า string เป็นค่าว่างหรือไม่
 * ค่าว่าง = '', null, undefined, หรือ whitespace อย่างเดียว
 */
export function isEmptyString(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  return value.trim().length === 0;
}

/**
 * Normalize phone number ให้อยู่ในรูป 0xxxxxxxxx
 * ลบอักขระที่ไม่ใช่ตัวเลข และแปลง +66 เป็น 0
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  // ถ้าขึ้นต้นด้วย 66 ให้แทนที่เป็น 0 (รูปแบบ +66 หรือ 66)
  if (cleaned.startsWith('66') && cleaned.length >= 10) {
    return '0' + cleaned.slice(2);
  }
  
  return cleaned;
}

/**
 * Format phone number ให้อยู่ในรูป 0xx-xxx-xxxx
 */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  
  if (normalized.length === 9) {
    // 0xx-xxx-xxx
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
  } else if (normalized.length === 10) {
    // 0xx-xxx-xxxx
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  
  return normalized;
}

/**
 * ตรวจสอบว่า phone number ถูกต้องตามรูปแบบไทยหรือไม่
 */
export function isValidThaiPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return THAI_PHONE_REGEX.test(normalized);
}

/**
 * Normalize date string ให้อยู่ในรูป YYYY-MM-DD
 */
export function normalizeDate(dateStr: string): string | undefined {
  if (!dateStr || typeof dateStr !== 'string') return undefined;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;
  
  // ถ้าเป็นรูปแบบ DD/MM/YYYY หรือ DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // ถ้าเป็นรูปแบบ YYYY/MM/DD หรือ YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // ถ้าเป็น ISO format อยู่แล้ว
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return trimmed.slice(0, 10);
  }
  
  return trimmed;
}

/**
 * Normalize time string ให้อยู่ในรูป HH:mm
 */
export function normalizeTime(timeStr: string): string | undefined {
  if (!timeStr || typeof timeStr !== 'string') return undefined;
  
  const trimmed = timeStr.trim();
  if (!trimmed) return undefined;
  
  // รูปแบบ HH:mm หรือ H:mm
  const hmMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hmMatch) {
    const [, hour, minute] = hmMatch;
    return `${hour.padStart(2, '0')}:${minute}`;
  }
  
  // รูปแบบ HHmm (4 ตัวเลข)
  const hhmMatch = trimmed.match(/^(\d{2})(\d{2})$/);
  if (hhmMatch) {
    const [, hour, minute] = hhmMatch;
    return `${hour}:${minute}`;
  }
  
  // รูปแบบ H นาฬิกา (เช่น "9 โมง", "14 น.")
  const thaiMatch = trimmed.match(/^(\d{1,2})\s*(?:โมง|น\.?|นาฬิกา)/);
  if (thaiMatch) {
    const hour = thaiMatch[1].padStart(2, '0');
    return `${hour}:00`;
  }
  
  return trimmed;
}

/**
 * ตรวจสอบว่าเวลาอยู่ในช่วง 06:00-20:00 หรือไม่
 */
export function isValidTimeRange(timeStr: string): boolean {
  const normalized = normalizeTime(timeStr);
  if (!normalized) return false;
  
  const [hourStr, minuteStr] = normalized.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  
  if (isNaN(hour) || isNaN(minute)) return false;
  if (hour < 6 || hour > 20) return false;
  if (hour === 20 && minute > 0) return false;
  
  return true;
}

/**
 * ตรวจสอบว่าวันนัดไม่ย้อนหลัง (ต้องเป็นวันนี้หรืออนาคต)
 */
export function isNotPastDate(dateStr: string, referenceDate: Date = new Date()): boolean {
  const normalized = normalizeDate(dateStr);
  if (!normalized) return false;
  
  // Parse YYYY-MM-DD to components
  const [yearStr, monthStr, dayStr] = normalized.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  
  // Create date objects using local timezone (no time component)
  const appointmentDate = new Date(year, month - 1, day);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  
  return appointmentDate >= today;
}

/**
 * ตรวจสอบว่า pickup และ dropoff ไม่เหมือนกัน
 */
export function isDifferentLocations(
  pickup: { address?: string; buildingName?: string; roomNumber?: string } | undefined,
  dropoff: { address?: string; buildingName?: string; roomNumber?: string } | undefined
): boolean {
  if (!pickup?.address || !dropoff?.address) return true; // ถ้ายังไม่มีข้อมูล ถือว่าไม่ซ้ำ
  
  const pickupAddr = pickup.address.trim().toLowerCase();
  const dropoffAddr = dropoff.address.trim().toLowerCase();
  
  // ถ้าที่อยู่เหมือนกัน ต้องดู building/room
  if (pickupAddr === dropoffAddr) {
    const pickupBuilding = (pickup.buildingName || '').trim().toLowerCase();
    const dropoffBuilding = (dropoff.buildingName || '').trim().toLowerCase();
    
    if (pickupBuilding && dropoffBuilding && pickupBuilding === dropoffBuilding) {
      const pickupRoom = (pickup.roomNumber || '').trim().toLowerCase();
      const dropoffRoom = (dropoff.roomNumber || '').trim().toLowerCase();
      
      // ถ้า room เหมือนกันด้วย ถือว่าที่อยู่ซ้ำกัน
      return pickupRoom !== dropoffRoom;
    }
    
    // building ต่างกัน ถือว่าต่างกัน
    return pickupBuilding !== dropoffBuilding;
  }
  
  return true;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Normalize input data - trim strings, empty→undefined, normalize formats
 */
export function normalizeInput(formData: PartialIntakeInput): NormalizeInputResult {
  const normalized: PartialIntakeInput = {};
  const normalizedFields: string[] = [];
  
  // Helper to normalize string fields
  const normalizeString = (value: unknown): string | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return String(value).trim() || undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  };
  
  // Normalize contact
  if (formData.contact) {
    normalized.contact = {};
    
    const contactName = normalizeString(formData.contact.contactName);
    if (contactName !== undefined) {
      normalized.contact.contactName = contactName;
      normalizedFields.push('contact.contactName');
    }
    
    const contactPhone = formData.contact.contactPhone;
    if (contactPhone && !isEmptyString(contactPhone)) {
      normalized.contact.contactPhone = formatPhone(contactPhone);
      normalizedFields.push('contact.contactPhone');
    }
    
    const contactEmail = normalizeString(formData.contact.contactEmail);
    if (contactEmail !== undefined) {
      normalized.contact.contactEmail = contactEmail;
      normalizedFields.push('contact.contactEmail');
    }
    
    const lineUserId = normalizeString(formData.contact.lineUserId);
    if (lineUserId !== undefined) {
      normalized.contact.lineUserId = lineUserId;
      normalizedFields.push('contact.lineUserId');
    }
    
    if (formData.contact.relationship) {
      normalized.contact.relationship = formData.contact.relationship;
      normalizedFields.push('contact.relationship');
    }
  }
  
  // Normalize service
  if (formData.service) {
    normalized.service = {};
    
    if (formData.service.serviceType) {
      normalized.service.serviceType = formData.service.serviceType;
      normalizedFields.push('service.serviceType');
    }
    
    const serviceSubType = normalizeString(formData.service.serviceSubType);
    if (serviceSubType !== undefined) {
      normalized.service.serviceSubType = serviceSubType;
      normalizedFields.push('service.serviceSubType');
    }
    
    const department = normalizeString(formData.service.department);
    if (department !== undefined) {
      normalized.service.department = department;
      normalizedFields.push('service.department');
    }
    
    const doctorName = normalizeString(formData.service.doctorName);
    if (doctorName !== undefined) {
      normalized.service.doctorName = doctorName;
      normalizedFields.push('service.doctorName');
    }
    
    if (formData.service.appointmentType) {
      normalized.service.appointmentType = formData.service.appointmentType;
      normalizedFields.push('service.appointmentType');
    }
  }
  
  // Normalize schedule
  if (formData.schedule) {
    normalized.schedule = {};
    
    if (formData.schedule.appointmentDate) {
      const normalizedDate = normalizeDate(formData.schedule.appointmentDate);
      if (normalizedDate) {
        normalized.schedule.appointmentDate = normalizedDate;
        normalizedFields.push('schedule.appointmentDate');
      }
    }
    
    if (formData.schedule.appointmentTime) {
      const normalizedTime = normalizeTime(formData.schedule.appointmentTime);
      if (normalizedTime) {
        normalized.schedule.appointmentTime = normalizedTime;
        normalizedFields.push('schedule.appointmentTime');
      }
    }
    
    if (formData.schedule.timeFlexibility) {
      normalized.schedule.timeFlexibility = formData.schedule.timeFlexibility;
      normalizedFields.push('schedule.timeFlexibility');
    }
    
    if (formData.schedule.duration !== undefined) {
      normalized.schedule.duration = formData.schedule.duration;
      normalizedFields.push('schedule.duration');
    }
  }
  
  // Normalize locations
  if (formData.locations) {
    normalized.locations = { pickup: {}, dropoff: {} };
    
    // Pickup
    if (formData.locations.pickup) {
      const pickup = formData.locations.pickup;
      
      const pickupAddress = normalizeString(pickup.address);
      if (pickupAddress !== undefined) {
        normalized.locations.pickup.address = pickupAddress;
        normalizedFields.push('locations.pickup.address');
      }
      
      if (pickup.lat !== undefined) {
        normalized.locations.pickup.lat = pickup.lat;
        normalizedFields.push('locations.pickup.lat');
      }
      
      if (pickup.lng !== undefined) {
        normalized.locations.pickup.lng = pickup.lng;
        normalizedFields.push('locations.pickup.lng');
      }
      
      const pickupContactName = normalizeString(pickup.contactName);
      if (pickupContactName !== undefined) {
        normalized.locations.pickup.contactName = pickupContactName;
        normalizedFields.push('locations.pickup.contactName');
      }
      
      if (pickup.contactPhone && !isEmptyString(pickup.contactPhone)) {
        normalized.locations.pickup.contactPhone = formatPhone(pickup.contactPhone);
        normalizedFields.push('locations.pickup.contactPhone');
      }
      
      const buildingName = normalizeString(pickup.buildingName);
      if (buildingName !== undefined) {
        normalized.locations.pickup.buildingName = buildingName;
        normalizedFields.push('locations.pickup.buildingName');
      }
      
      const floor = normalizeString(pickup.floor);
      if (floor !== undefined) {
        normalized.locations.pickup.floor = floor;
        normalizedFields.push('locations.pickup.floor');
      }
      
      const roomNumber = normalizeString(pickup.roomNumber);
      if (roomNumber !== undefined) {
        normalized.locations.pickup.roomNumber = roomNumber;
        normalizedFields.push('locations.pickup.roomNumber');
      }
      
      const landmarks = normalizeString(pickup.landmarks);
      if (landmarks !== undefined) {
        normalized.locations.pickup.landmarks = landmarks;
        normalizedFields.push('locations.pickup.landmarks');
      }
      
      const parkingNote = normalizeString(pickup.parkingNote);
      if (parkingNote !== undefined) {
        normalized.locations.pickup.parkingNote = parkingNote;
        normalizedFields.push('locations.pickup.parkingNote');
      }
    }
    
    // Dropoff
    if (formData.locations.dropoff) {
      const dropoff = formData.locations.dropoff;
      
      const dropoffAddress = normalizeString(dropoff.address);
      if (dropoffAddress !== undefined) {
        normalized.locations.dropoff.address = dropoffAddress;
        normalizedFields.push('locations.dropoff.address');
      }
      
      if (dropoff.lat !== undefined) {
        normalized.locations.dropoff.lat = dropoff.lat;
        normalizedFields.push('locations.dropoff.lat');
      }
      
      if (dropoff.lng !== undefined) {
        normalized.locations.dropoff.lng = dropoff.lng;
        normalizedFields.push('locations.dropoff.lng');
      }
      
      const dropoffContactName = normalizeString(dropoff.contactName);
      if (dropoffContactName !== undefined) {
        normalized.locations.dropoff.contactName = dropoffContactName;
        normalizedFields.push('locations.dropoff.contactName');
      }
      
      if (dropoff.contactPhone && !isEmptyString(dropoff.contactPhone)) {
        normalized.locations.dropoff.contactPhone = formatPhone(dropoff.contactPhone);
        normalizedFields.push('locations.dropoff.contactPhone');
      }
      
      const buildingName = normalizeString(dropoff.buildingName);
      if (buildingName !== undefined) {
        normalized.locations.dropoff.buildingName = buildingName;
        normalizedFields.push('locations.dropoff.buildingName');
      }
      
      const floor = normalizeString(dropoff.floor);
      if (floor !== undefined) {
        normalized.locations.dropoff.floor = floor;
        normalizedFields.push('locations.dropoff.floor');
      }
      
      const roomNumber = normalizeString(dropoff.roomNumber);
      if (roomNumber !== undefined) {
        normalized.locations.dropoff.roomNumber = roomNumber;
        normalizedFields.push('locations.dropoff.roomNumber');
      }
      
      const landmarks = normalizeString(dropoff.landmarks);
      if (landmarks !== undefined) {
        normalized.locations.dropoff.landmarks = landmarks;
        normalizedFields.push('locations.dropoff.landmarks');
      }
      
      const parkingNote = normalizeString(dropoff.parkingNote);
      if (parkingNote !== undefined) {
        normalized.locations.dropoff.parkingNote = parkingNote;
        normalizedFields.push('locations.dropoff.parkingNote');
      }
      
      const name = normalizeString(dropoff.name);
      if (name !== undefined) {
        normalized.locations.dropoff.name = name;
        normalizedFields.push('locations.dropoff.name');
      }
      
      const department = normalizeString(dropoff.department);
      if (department !== undefined) {
        normalized.locations.dropoff.department = department;
        normalizedFields.push('locations.dropoff.department');
      }
    }
  }
  
  // Normalize patient
  if (formData.patient) {
    normalized.patient = {};
    
    const patientName = normalizeString(formData.patient.name);
    if (patientName !== undefined) {
      normalized.patient.name = patientName;
      normalizedFields.push('patient.name');
    }
    
    if (formData.patient.age !== undefined) {
      normalized.patient.age = formData.patient.age;
      normalizedFields.push('patient.age');
    }
    
    if (formData.patient.gender) {
      normalized.patient.gender = formData.patient.gender;
      normalizedFields.push('patient.gender');
    }
    
    if (formData.patient.weight !== undefined) {
      normalized.patient.weight = formData.patient.weight;
      normalizedFields.push('patient.weight');
    }
    
    if (formData.patient.mobilityLevel) {
      normalized.patient.mobilityLevel = formData.patient.mobilityLevel;
      normalizedFields.push('patient.mobilityLevel');
    }
    
    if (formData.patient.needsEscort !== undefined) {
      normalized.patient.needsEscort = formData.patient.needsEscort;
      normalizedFields.push('patient.needsEscort');
    }
    
    if (formData.patient.needsWheelchair !== undefined) {
      normalized.patient.needsWheelchair = formData.patient.needsWheelchair;
      normalizedFields.push('patient.needsWheelchair');
    }
    
    if (formData.patient.oxygenRequired !== undefined) {
      normalized.patient.oxygenRequired = formData.patient.oxygenRequired;
      normalizedFields.push('patient.oxygenRequired');
    }
    
    if (formData.patient.stretcherRequired !== undefined) {
      normalized.patient.stretcherRequired = formData.patient.stretcherRequired;
      normalizedFields.push('patient.stretcherRequired');
    }
    
    if (formData.patient.conditions) {
      normalized.patient.conditions = formData.patient.conditions;
      normalizedFields.push('patient.conditions');
    }
    
    if (formData.patient.allergies) {
      normalized.patient.allergies = formData.patient.allergies;
      normalizedFields.push('patient.allergies');
    }
    
    if (formData.patient.medications) {
      normalized.patient.medications = formData.patient.medications;
      normalizedFields.push('patient.medications');
    }
  }
  
  // Normalize addons
  if (formData.addons) {
    normalized.addons = {
      medicinePickup: formData.addons.medicinePickup ?? false,
      homeCare: formData.addons.homeCare ?? false,
      mealService: formData.addons.mealService ?? false,
      interpretation: formData.addons.interpretation ?? false,
      accompanyInside: formData.addons.accompanyInside ?? false,
    };
    normalizedFields.push('addons');
  }
  
  // Normalize specialNotes
  const specialNotes = normalizeString(formData.specialNotes);
  if (specialNotes !== undefined) {
    normalized.specialNotes = specialNotes;
    normalizedFields.push('specialNotes');
  }
  
  // Normalize urgencyLevel
  if (formData.urgencyLevel) {
    normalized.urgencyLevel = formData.urgencyLevel;
    normalizedFields.push('urgencyLevel');
  }
  
  return { normalizedData: normalized, normalizedFields };
}

/**
 * Validate required fields - ตรวจสอบ 8 fields ที่ขาดไม่ได้
 */
export function validateRequiredFields(formData: PartialIntakeInput): {
  missingFields: string[];
  isComplete: boolean;
} {
  const missingFields: string[] = [];
  
  for (const fieldPath of REQUIRED_FIELD_PATHS) {
    const value = getNestedValue(formData, fieldPath);
    
    if (value === undefined || value === null) {
      missingFields.push(fieldPath);
    } else if (typeof value === 'string' && isEmptyString(value)) {
      missingFields.push(fieldPath);
    }
  }
  
  return {
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

/**
 * Validate conditional fields - ตรวจสอบ fields ที่ต้องมีตามเงื่อนไข
 */
export function validateConditionalFields(formData: PartialIntakeInput): {
  missingFields: string[];
  conditionalMissing: Array<{ field: string; condition: string }>;
} {
  const missingFields: string[] = [];
  const conditionalMissing: Array<{ field: string; condition: string }> = [];
  
  // 1. needsEscort - ถ้า mobilityLevel !== 'independent' ต้องมี needsEscort
  const mobilityLevel = formData.patient?.mobilityLevel;
  if (mobilityLevel && mobilityLevel !== INDEPENDENT_MOBILITY) {
    if (formData.patient?.needsEscort === undefined) {
      missingFields.push('patient.needsEscort');
      conditionalMissing.push({
        field: 'patient.needsEscort',
        condition: 'mobilityLevel !== independent',
      });
    }
  }
  
  // 2. floor/room - ถ้ามี buildingName ต้องมี floor (pickup)
  if (formData.locations?.pickup?.buildingName && !isEmptyString(formData.locations.pickup.buildingName)) {
    if (!formData.locations.pickup.floor || isEmptyString(formData.locations.pickup.floor)) {
      missingFields.push('locations.pickup.floor');
      conditionalMissing.push({
        field: 'locations.pickup.floor',
        condition: 'pickup has buildingName',
      });
    }
  }
  
  // 3. floor/room - ถ้ามี buildingName ต้องมี floor (dropoff)
  if (formData.locations?.dropoff?.buildingName && !isEmptyString(formData.locations.dropoff.buildingName)) {
    if (!formData.locations.dropoff.floor || isEmptyString(formData.locations.dropoff.floor)) {
      missingFields.push('locations.dropoff.floor');
      conditionalMissing.push({
        field: 'locations.dropoff.floor',
        condition: 'dropoff has buildingName',
      });
    }
  }
  
  // 4. department - ถ้า serviceType === 'hospital-visit' ต้องมี department
  if (formData.service?.serviceType === 'hospital-visit') {
    if (!formData.service.department || isEmptyString(formData.service.department)) {
      missingFields.push('service.department');
      conditionalMissing.push({
        field: 'service.department',
        condition: "serviceType === 'hospital-visit'",
      });
    }
  }
  
  return { missingFields, conditionalMissing };
}

/**
 * Build next question - สร้างคำถามภาษาไทยสั้น สุภาพ สำหรับ missing field
 */
export function buildNextQuestion(
  missingFields: string[],
  formData?: PartialIntakeInput
): string {
  if (missingFields.length === 0) {
    return 'ข้อมูลครบแล้วครับ กรุณาตรวจสอบอีกครั้ง';
  }
  
  // หา field ที่สำคัญที่สุดตามลำดับ
  const priorityOrder = [
    'contact.contactName',
    'contact.contactPhone',
    'patient.name',
    'service.serviceType',
    'schedule.appointmentDate',
    'schedule.appointmentTime',
    'locations.pickup.address',
    'locations.dropoff.address',
    'patient.mobilityLevel',
    'patient.needsEscort',
    'patient.needsWheelchair',
    'locations.pickup.floor',
    'locations.dropoff.floor',
    'service.department',
    'contact.relationship',
  ];
  
  // หา field แรกที่มีใน priorityOrder
  for (const field of priorityOrder) {
    if (missingFields.includes(field)) {
      return FIELD_QUESTIONS[field] || `ขอข้อมูล ${field} ด้วยครับ`;
    }
  }
  
  // ถ้าไม่มีใน priorityOrder ใช้ field แรก
  const firstField = missingFields[0];
  return FIELD_QUESTIONS[firstField] || `ขอข้อมูล ${firstField} ด้วยครับ`;
}

/**
 * สร้าง warnings จาก validation rules
 */
export function generateWarnings(
  formData: PartialIntakeInput,
  normalizedData: PartialIntakeInput
): ValidationError[] {
  const warnings: ValidationError[] = [];
  
  // 1. ตรวจสอบเบอร์โทร (ใช้ formData เพื่อจับ invalid input ที่ถูกกรองออก)
  const rawContactPhone = formData.contact?.contactPhone;
  if (rawContactPhone) {
    if (!isValidThaiPhone(rawContactPhone)) {
      warnings.push({
        field: 'contact.contactPhone',
        message: 'เบอร์โทรไม่ถูกต้อง กรุณาตรวจสอบ',
        severity: 'error',
      });
    }
  }
  
  const rawPickupPhone = formData.locations?.pickup?.contactPhone;
  if (rawPickupPhone) {
    if (!isValidThaiPhone(rawPickupPhone)) {
      warnings.push({
        field: 'locations.pickup.contactPhone',
        message: 'เบอร์โทรผู้ติดต่อจุดรับไม่ถูกต้อง',
        severity: 'error',
      });
    }
  }
  
  const rawDropoffPhone = formData.locations?.dropoff?.contactPhone;
  if (rawDropoffPhone) {
    if (!isValidThaiPhone(rawDropoffPhone)) {
      warnings.push({
        field: 'locations.dropoff.contactPhone',
        message: 'เบอร์โทรผู้ติดต่อจุดส่งไม่ถูกต้อง',
        severity: 'error',
      });
    }
  }
  
  // 2. ตรวจสอบวันเวลาไม่ย้อนหลัง
  const appointmentDate = normalizedData.schedule?.appointmentDate;
  const appointmentTime = normalizedData.schedule?.appointmentTime;
  
  if (appointmentDate && !isNotPastDate(appointmentDate)) {
    warnings.push({
      field: 'schedule.appointmentDate',
      message: 'วันนัดต้องไม่ย้อนหลัง',
      severity: 'error',
    });
  }
  
  // 3. ตรวจสอบเวลาอยู่ในช่วง 06:00-20:00
  if (appointmentTime && !isValidTimeRange(appointmentTime)) {
    warnings.push({
      field: 'schedule.appointmentTime',
      message: 'เวลานัดต้องอยู่ในช่วง 06:00-20:00 น.',
      severity: 'error',
    });
  }
  
  // 4. ตรวจสอบ pickup ≠ dropoff
  if (
    normalizedData.locations?.pickup?.address &&
    normalizedData.locations?.dropoff?.address
  ) {
    if (
      !isDifferentLocations(
        normalizedData.locations.pickup,
        normalizedData.locations.dropoff
      )
    ) {
      warnings.push({
        field: 'locations.dropoff.address',
        message: 'จุดส่งต้องไม่เหมือนกับจุดรับ',
        severity: 'error',
      });
    }
  }
  
  return warnings;
}

/**
 * Main validation function - validate form data ทั้งหมด
 */
export function validateFormData(formData: PartialIntakeInput): ValidateFormDataResult {
  // 1. Normalize input
  const { normalizedData } = normalizeInput(formData);
  
  // 2. Validate required fields
  const requiredValidation = validateRequiredFields(normalizedData);
  
  // 3. Validate conditional fields (ถ้า required fields ครบแล้ว)
  let conditionalMissing: string[] = [];
  if (requiredValidation.isComplete) {
    const conditionalValidation = validateConditionalFields(normalizedData);
    conditionalMissing = conditionalValidation.missingFields;
  }
  
  // 4. รวม missing fields
  const missingFields = [...requiredValidation.missingFields, ...conditionalMissing];
  
  // 5. Generate warnings
  const warnings = generateWarnings(formData, normalizedData);
  
  // 6. Build next question
  const nextQuestion = buildNextQuestion(missingFields, normalizedData);
  
  // 7. ตรวจสอบว่ามี warnings ที่เป็น error หรือไม่
  const hasErrors = warnings.some(w => w.severity === 'error');
  
  // 8. isComplete = ไม่มี missing fields และไม่มี error warnings
  const isComplete = missingFields.length === 0 && !hasErrors;
  
  return {
    isComplete,
    missingFields,
    nextQuestion,
    warnings,
    normalizedData,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  FIELD_QUESTIONS,
};
