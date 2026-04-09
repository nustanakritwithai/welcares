/**
 * Intake Chat Parser
 * Rule-based parser สำหรับแปลงข้อความภาษาไทยเป็นค่า field
 * 
 * @version 1.0
 */

import type {
  ServiceType,
  RelationshipType,
  MobilityLevel,
  UrgencyLevel,
  TimeFlexibility,
  IntakeInput,
} from '../intake/schema';

// ============================================================================
// Types
// ============================================================================

export interface ParsedAnswer {
  value: unknown;
  confidence: 'high' | 'medium' | 'low';
  field?: string;
  normalizedText?: string;
}

export type GlobalIntent = 'confirm' | 'restart' | 'edit' | 'skip' | 'unknown';

// ============================================================================
// Keyword Mappings
// ============================================================================

const SERVICE_TYPE_KEYWORDS: Record<string, ServiceType> = {
  // พบแพทย์นอก
  'พบแพทย์': 'hospital-visit',
  'หมอ': 'hospital-visit',
  'คลินิก': 'hospital-visit',
  'โรงพยาบาล': 'hospital-visit',
  'รพ': 'hospital-visit',
  'hospital': 'hospital-visit',
  'doctor': 'hospital-visit',
  'ตรวจ': 'hospital-visit',
  'ติดตามอาการ': 'follow-up',
  'follow': 'follow-up',
  'followup': 'follow-up',
  'follow-up': 'follow-up',
  // กายภาพบำบัด
  'กายภาพ': 'physical-therapy',
  'กายภาพบำบัด': 'physical-therapy',
  'physical': 'physical-therapy',
  'therapy': 'physical-therapy',
  'rehab': 'physical-therapy',
  // ล้างไต
  'ล้างไต': 'dialysis',
  'ไต': 'dialysis',
  'dialysis': 'dialysis',
  'hemodialysis': 'dialysis',
  // เคมีบำบัด
  'เคมี': 'chemotherapy',
  'เคมีบำบัด': 'chemotherapy',
  'chemo': 'chemotherapy',
  'chemotherapy': 'chemotherapy',
  // รังสีรักษา
  'รังสี': 'radiation',
  'รังสีรักษา': 'radiation',
  'radiation': 'radiation',
  'radiotherapy': 'radiation',
  // ตรวจสุขภาพ
  'ตรวจสุขภาพ': 'checkup',
  'checkup': 'checkup',
  'check-up': 'checkup',
  'health check': 'checkup',
  'ตรวจร่างกาย': 'checkup',
  // ฉีดวัคซีน
  'ฉีดวัคซีน': 'vaccination',
  'วัคซีน': 'vaccination',
  'vaccine': 'vaccination',
  'vaccination': 'vaccination',
  'ฉีดยา': 'vaccination',
  // อื่นๆ
  'อื่นๆ': 'other',
  'other': 'other',
  'อื่น': 'other',
};

const RELATIONSHIP_KEYWORDS: Record<string, RelationshipType> = {
  // ลูกสาว
  'ลูกสาว': 'daughter',
  'daughter': 'daughter',
  'girl': 'daughter',
  'หลานสาว': 'relative',
  // ลูกชาย
  'ลูกชาย': 'son',
  'son': 'son',
  'boy': 'son',
  'หลานชาย': 'relative',
  // คู่สมรส
  'คู่สมรส': 'spouse',
  'สามี': 'spouse',
  'ภรรยา': 'spouse',
  'spouse': 'spouse',
  'husband': 'spouse',
  'wife': 'spouse',
  'แฟน': 'spouse',
  'คู่': 'spouse',
  // พ่อแม่
  'พ่อ': 'parent',
  'แม่': 'parent',
  'พ่อแม่': 'parent',
  'parent': 'parent',
  'father': 'parent',
  'mother': 'parent',
  'dad': 'parent',
  'mom': 'parent',
  // พี่น้อง
  'พี่': 'sibling',
  'น้อง': 'sibling',
  'พี่น้อง': 'sibling',
  'sibling': 'sibling',
  'brother': 'sibling',
  'sister': 'sibling',
  // ญาติ
  'ญาติ': 'relative',
  'relative': 'relative',
  'cousin': 'relative',
  'aunt': 'relative',
  'uncle': 'relative',
  'หลาน': 'relative',
  // เพื่อน
  'เพื่อน': 'friend',
  'friend': 'friend',
  // ตนเอง
  'ตนเอง': 'self',
  'self': 'self',
  'me': 'self',
  'myself': 'self',
  'ผมเอง': 'self',
  'ดิฉันเอง': 'self',
  'ฉันเอง': 'self',
  // อื่นๆ
  'อื่นๆ': 'other',
  'other': 'other',
  'อื่น': 'other',
};

const MOBILITY_LEVEL_KEYWORDS: Record<string, MobilityLevel> = {
  // เดินได้เอง
  'เดินได้เอง': 'independent',
  'เดินได้': 'independent',
  'independent': 'independent',
  'walk': 'independent',
  'walking': 'independent',
  'ปกติ': 'independent',
  'แข็งแรง': 'independent',
  'สามารถเดิน': 'independent',
  // ต้องช่วยพยุง
  'ต้องช่วยพยุง': 'assisted',
  'ช่วยพยุง': 'assisted',
  'assisted': 'assisted',
  'พยุง': 'assisted',
  'ช่วยเดิน': 'assisted',
  'ช่วยเหลือ': 'assisted',
  'ช่วย': 'assisted',
  // ใช้รถเข็น
  'ใช้รถเข็น': 'wheelchair',
  'รถเข็น': 'wheelchair',
  'wheelchair': 'wheelchair',
  'เข็น': 'wheelchair',
  // ติดเตียง
  'ติดเตียง': 'bedridden',
  'bedridden': 'bedridden',
  'bed': 'bedridden',
  'เตียง': 'bedridden',
  'นอน': 'bedridden',
  'ไม่สามารถลุก': 'bedridden',
  'ลุกไม่ไหว': 'bedridden',
};

const URGENCY_LEVEL_KEYWORDS: Record<string, UrgencyLevel> = {
  // ปกติ
  'ปกติ': 'low',
  'low': 'low',
  'ธรรมดา': 'low',
  'ไม่เร่ง': 'low',
  'ไม่ด่วน': 'low',
  // 1-2 วัน
  '1-2 วัน': 'normal',
  'normal': 'normal',
  'ธรรมดา': 'normal',
  'เร็วๆนี้': 'normal',
  // พรุ่งนี้
  'พรุ่งนี้': 'high',
  'high': 'high',
  'tomorrow': 'high',
  'เร่งหน่อย': 'high',
  'ด่วน': 'high',
  // วันนี้/ฉุกเฉิน
  'วันนี้': 'urgent',
  'ฉุกเฉิน': 'urgent',
  'urgent': 'urgent',
  'emergency': 'urgent',
  'today': 'urgent',
  'ด่วนมาก': 'urgent',
  'เร่งด่วน': 'urgent',
  'critical': 'urgent',
};

const TIME_FLEXIBILITY_KEYWORDS: Record<string, TimeFlexibility> = {
  // strict
  'ตรงเวลา': 'strict',
  'strict': 'strict',
  'พอดี': 'strict',
  'เป๊ะ': 'strict',
  'ต้องตรง': 'strict',
  // 30min
  '30 นาที': '30min',
  '30min': '30min',
  'ยืดหยุ่นนิดหน่อย': '30min',
  'flexible little': '30min',
  // 1hour
  '1 ชั่วโมง': '1hour',
  '1hour': '1hour',
  '1 ชม': '1hour',
  'ยืดหยุ่น': '1hour',
  'flexible': '1hour',
  // anytime
  'anytime': 'anytime',
  'เวลาไหนก็ได้': 'anytime',
  'ไหนก็ได้': 'anytime',
  'ไม่เกี่ยง': 'anytime',
  'ตลอดวัน': 'anytime',
};

const BOOLEAN_KEYWORDS = {
  true: [
    'ใช่', 'yes', 'yeah', 'yep', 'y', 'true', 'correct', 'right',
    'ต้องการ', 'want', 'need', 'ต้อง', 'อยาก', 'เอา', 'ok', 'okay',
    'ได้', 'ครับ', 'ค่ะ', 'ใช่แล้ว', 'ถูกต้อง', 'แน่นอน', 'sure',
  ],
  false: [
    'ไม่', 'no', 'nah', 'nope', 'n', 'false', 'wrong',
    'ไม่ต้องการ', 'ไม่เอา', 'ไม่ต้อง', 'ไม่อยาก', 'ไม่เป็นไร',
    'ไม่ครับ', 'ไม่ค่ะ', 'ไม่ใช่', 'ผิด', 'cancel', 'ยกเลิก',
  ],
};

const INTENT_KEYWORDS: Record<GlobalIntent, string[]> = {
  confirm: [
    'ตกลง', 'ok', 'okay', 'ใช่', 'yes', 'ได้', 'ครับ', 'ค่ะ', 'confirm',
    'ยืนยัน', 'ถูกต้อง', 'ใช่แล้ว', 'ผ่าน', 'next', 'continue',
  ],
  restart: [
    'เริ่มใหม่', 'restart', 'reset', 'ใหม่', 'cancel', 'ยกเลิก', 'clear',
    'ลบ', 'เริ่มต้นใหม่', 'เริ่มอีกครั้ง', 'start over',
  ],
  edit: [
    'แก้ไข', 'edit', 'แก้', 'เปลี่ยน', 'change', 'modify', 'update',
    'ผิด', 'wrong', 'ไม่ถูก', 'incorrect', 'แก้อีก', 'ปรับ', 'แก้ใหม่',
  ],
  skip: [
    'ข้าม', 'skip', 'ไม่มี', 'none', 'nothing', 'ไม่', 'no', 'ไม่ต้อง',
    'ไม่เอา', 'ไม่เป็นไร', 'ต่อไป', 'next', 'ไปต่อ', 'later', 'ภายหลัง',
  ],
  unknown: [],
};

// ============================================================================
// Main Parser Function
// ============================================================================

export function parseUserAnswer(
  field: string,
  text: string,
  formData: Partial<IntakeInput> = {}
): ParsedAnswer {
  const normalizedText = normalizeThaiText(text);

  // Route to specific parser based on field
  if (field.includes('serviceType')) {
    return parseServiceTypeAnswer(normalizedText);
  }
  if (field.includes('relationship')) {
    return parseRelationshipAnswer(normalizedText);
  }
  if (field.includes('appointmentDate')) {
    return parseDateAnswer(normalizedText);
  }
  if (field.includes('appointmentTime')) {
    return parseTimeAnswer(normalizedText);
  }
  if (field.includes('mobilityLevel')) {
    return parseMobilityLevelAnswer(normalizedText);
  }
  if (field.includes('urgencyLevel')) {
    return parseUrgencyLevelAnswer(normalizedText);
  }
  if (field.includes('timeFlexibility')) {
    return parseTimeFlexibilityAnswer(normalizedText);
  }
  if (field.includes('contactPhone') || field.includes('Phone')) {
    return parsePhoneAnswer(normalizedText);
  }
  if (field.includes('needs') || field.includes('Required')) {
    return parseBooleanAnswer(normalizedText, field);
  }
  if (field.includes('address')) {
    return parseAddressAnswer(normalizedText);
  }

  // Default: text answer with medium confidence
  return {
    value: text.trim(),
    confidence: 'medium',
    field,
    normalizedText,
  };
}

// ============================================================================
// Individual Parsers
// ============================================================================

export function parseGlobalIntent(text: string): GlobalIntent {
  const normalized = normalizeThaiText(text);
  
  // Check for exact matches first
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === 'unknown') continue;
    for (const keyword of keywords) {
      if (normalized === keyword) {
        return intent as GlobalIntent;
      }
    }
  }
  
  // Special handling for phrases with context
  // Check "เริ่มใหม่" or "เริ่มต้นใหม่" patterns first
  if (normalized.includes('เริ่มใหม่') || normalized.includes('เริ่มต้นใหม่')) {
    return 'restart';
  }
  
  // Check "ผิด" before generic matching
  if (normalized.includes('ผิด')) {
    return 'edit';
  }
  
  // Check "ไปต่อ" as skip
  if (normalized === 'ไปต่อ' || normalized.includes('ไปต่อ')) {
    return 'skip';
  }
  
  // "ไม่" at start of phrase = skip
  if (normalized.startsWith('ไม่') && normalized.length > 2) {
    // Exclude cases where it's "ไม่เข้าใจ" etc.
    if (normalized.includes('เข้าใจ') || normalized.includes('แน่ใจ')) {
      return 'unknown';
    }
    return 'skip';
  }
  
  // Then check partial matches for longer keywords
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === 'unknown') continue;
    for (const keyword of keywords) {
      // Skip very short keywords for partial matching to avoid false positives
      if (keyword.length <= 2) continue;
      if (normalized.includes(keyword)) {
        return intent as GlobalIntent;
      }
    }
  }
  
  return 'unknown';
}

export function parseServiceType(text: string): ServiceType | null {
  const normalized = normalizeThaiText(text);
  
  // Direct match
  if (SERVICE_TYPE_KEYWORDS[normalized]) {
    return SERVICE_TYPE_KEYWORDS[normalized];
  }
  
  // Partial match
  for (const [keyword, value] of Object.entries(SERVICE_TYPE_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      return value;
    }
  }
  
  return null;
}

export function parseRelationship(text: string): RelationshipType | null {
  const normalized = normalizeThaiText(text);
  
  // Direct match
  if (RELATIONSHIP_KEYWORDS[normalized]) {
    return RELATIONSHIP_KEYWORDS[normalized];
  }
  
  // Partial match
  for (const [keyword, value] of Object.entries(RELATIONSHIP_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      return value;
    }
  }
  
  return null;
}

export function parseDate(text: string): string | null {
  const normalized = normalizeThaiText(text);
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // วันนี้
  if (normalized.includes('วันนี้') || normalized.includes('today')) {
    return formatDate(today);
  }
  
  // พรุ่งนี้
  if (normalized.includes('พรุ่งนี้') || normalized.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }
  
  // มะรืนนี้
  if (normalized.includes('มะรืน') || normalized.includes('day after tomorrow')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return formatDate(dayAfter);
  }
  
  // วันพรุ่งนี้, วันพรุ่งนี้
  const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  const dayFullNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  
  for (let i = 0; i < 7; i++) {
    if (normalized.includes(dayNames[i]) || normalized.includes(dayFullNames[i])) {
      const targetDate = getNextDayOfWeek(today, i);
      return formatDate(targetDate);
    }
  }
  
  // ISO format: 2025-04-15 (check first to avoid matching as Thai date)
  const isoMatch = normalized.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    // Validate it's a reasonable ISO date (year >= 2000)
    if (year >= 2000 && year < 2100) {
      const date = new Date(year, month - 1, day);
      if (isValidDate(date)) {
        return formatDate(date);
      }
    }
  }
  
  // Thai date format: 15/04, 15/04/2568, 15-04-2025
  const thaiDateMatch = normalized.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);
  if (thaiDateMatch) {
    const day = parseInt(thaiDateMatch[1], 10);
    const month = parseInt(thaiDateMatch[2], 10);
    let year = thaiDateMatch[3] ? parseInt(thaiDateMatch[3], 10) : currentYear;
    
    // Convert Buddhist year to Gregorian
    if (year > 2500) {
      year -= 543;
    } else if (year < 100) {
      year += 2000;
    }
    
    const date = new Date(year, month - 1, day);
    if (isValidDate(date)) {
      return formatDate(date);
    }
  }
  
  return null;
}

export function parseTime(text: string): string | null {
  const normalized = normalizeThaiText(text);
  
  // 24-hour format: 14:00, 14.00, 14 00
  const time24Match = normalized.match(/(\d{1,2})[:\.\s](\d{2})/);
  if (time24Match) {
    const hour = parseInt(time24Match[1], 10);
    const minute = parseInt(time24Match[2], 10);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
  }
  
  // Thai time format: 9 โมง, 9 โมงเช้า, บ่าย 2 โมง, 3 โมงเย็น
  
  // โมงเช้า (AM)
  const morningMatch = normalized.match(/(\d{1,2})\s*โมง(?:เช้า)?/);
  if (morningMatch && !normalized.includes('บ่าย') && !normalized.includes('หลัง')) {
    let hour = parseInt(morningMatch[1], 10);
    if (hour >= 1 && hour <= 12) {
      // Thai time 1-6 = 1AM-6AM, but often people use 1-12
      if (hour > 6) {
        // Could be PM, but with เช้า it's AM
      }
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  }
  
  // บ่าย XX (PM) - support both Arabic and Thai numbers
  const thaiNumbers: Record<string, number> = {
    'หนึ่ง': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5,
    'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9, 'สิบ': 10,
    'สิบเอ็ด': 11, 'สิบสอง': 12,
  };
  
  // Check for บ่าย with Thai numbers (e.g., บ่ายสามโมง)
  for (const [thaiNum, value] of Object.entries(thaiNumbers)) {
    if (normalized.includes(`บ่าย${thaiNum}`) || normalized.includes(`บ่าย ${thaiNum}`)) {
      if (value >= 1 && value <= 6) {
        const hour = value + 12;
        return `${hour.toString().padStart(2, '0')}:00`;
      }
    }
  }
  
  const afternoonMatch = normalized.match(/บ่าย\s*(\d{1,2})/);
  if (afternoonMatch) {
    let hour = parseInt(afternoonMatch[1], 10);
    if (hour >= 1 && hour <= 6) {
      hour += 12;
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  }
  
  // หลังเที่ยง
  const noonMatch = normalized.match(/หลังเที่ยง\s*(\d{1,2})/);
  if (noonMatch) {
    let hour = parseInt(noonMatch[1], 10);
    if (hour >= 1 && hour <= 12) {
      if (hour < 12) hour += 12;
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  }
  
  // โมงเย็น
  const eveningMatch = normalized.match(/(\d{1,2})\s*โมงเย็น/);
  if (eveningMatch) {
    let hour = parseInt(eveningMatch[1], 10);
    if (hour >= 1 && hour <= 6) {
      hour += 12;
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  }
  
  // เที่ยงคืน (must check before เที่ยง)
  if (normalized.includes('เที่ยงคืน') || normalized.includes('midnight')) {
    return '00:00';
  }
  
  // เที่ยง
  if (normalized.includes('เที่ยง')) {
    return '12:00';
  }
  
  // เช้า, สาย, เย็น, ค่ำ, ดึก (check specific period words before generic)
  if (normalized.includes('เช้ามาก')) {
    return '08:00';
  }
  if (normalized.includes('เช้า') && !normalized.includes('โมง')) {
    return '08:00';
  }
  if (normalized.includes('สาย') && !normalized.includes('โมง')) {
    return '10:00';
  }
  // Only check generic บ่าย if no specific time given
  if (normalized === 'บ่าย' || normalized.endsWith(' บ่าย') || normalized.startsWith('บ่าย ')) {
    if (!normalized.match(/บ่าย\s*\d/)) {
      return '14:00';
    }
  }
  if (normalized.includes('เย็น') && !normalized.includes('โมง')) {
    return '17:00';
  }
  if (normalized.includes('ค่ำ')) {
    return '19:00';
  }
  if (normalized.includes('ดึก') || normalized.includes('กลางคืน')) {
    return '21:00';
  }
  
  return null;
}

export function parsePhone(text: string): string | null {
  const normalized = text.replace(/\s/g, '').replace(/[-.]/g, '');
  
  // Thai mobile: 08X-XXX-XXXX, 09X-XXX-XXXX, 06X-XXX-XXXX (10 digits)
  // Landline: 0X-XXX-XXXX (9 digits for Bangkok), 0XX-XXX-XXX (9 digits for provinces)
  
  const mobileMatch = normalized.match(/^(0[689]\d{8})$/);
  if (mobileMatch) {
    return mobileMatch[1];
  }
  
  const landlineMatch = normalized.match(/^(0[2-7]\d{7,8})$/);
  if (landlineMatch) {
    return landlineMatch[1];
  }
  
  // With country code: +66, 66
  const intlMatch = normalized.match(/^\+?66([689]\d{8})$/);
  if (intlMatch) {
    return '0' + intlMatch[1];
  }
  
  const intlLandlineMatch = normalized.match(/^\+?66([2-7]\d{7,8})$/);
  if (intlLandlineMatch) {
    return '0' + intlLandlineMatch[1];
  }
  
  return null;
}

export function parseBoolean(text: string): boolean | null {
  const normalized = normalizeThaiText(text);
  
  // Check for exact matches first (higher priority)
  for (const keyword of BOOLEAN_KEYWORDS.true) {
    if (normalized === keyword) {
      return true;
    }
  }
  
  for (const keyword of BOOLEAN_KEYWORDS.false) {
    if (normalized === keyword) {
      return false;
    }
  }
  
  // Then check startsWith for phrases
  for (const keyword of BOOLEAN_KEYWORDS.true) {
    if (normalized.startsWith(keyword + ' ') || normalized.startsWith(keyword + 'ครับ') || normalized.startsWith(keyword + 'ค่ะ')) {
      return true;
    }
  }
  
  for (const keyword of BOOLEAN_KEYWORDS.false) {
    if (normalized.startsWith(keyword + ' ') || normalized.startsWith(keyword + 'ครับ') || normalized.startsWith(keyword + 'ค่ะ')) {
      return false;
    }
  }
  
  return null;
}

export function parseMobilityLevel(text: string): MobilityLevel | null {
  const normalized = normalizeThaiText(text);
  
  // Direct match
  if (MOBILITY_LEVEL_KEYWORDS[normalized]) {
    return MOBILITY_LEVEL_KEYWORDS[normalized];
  }
  
  // Partial match
  for (const [keyword, value] of Object.entries(MOBILITY_LEVEL_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      return value;
    }
  }
  
  return null;
}

export function parseUrgencyLevel(text: string): UrgencyLevel | null {
  const normalized = normalizeThaiText(text);
  
  // Direct match
  if (URGENCY_LEVEL_KEYWORDS[normalized]) {
    return URGENCY_LEVEL_KEYWORDS[normalized];
  }
  
  // Partial match
  for (const [keyword, value] of Object.entries(URGENCY_LEVEL_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      return value;
    }
  }
  
  return null;
}

export function parseTimeFlexibility(text: string): TimeFlexibility | null {
  const normalized = normalizeThaiText(text);
  
  // Direct match
  if (TIME_FLEXIBILITY_KEYWORDS[normalized]) {
    return TIME_FLEXIBILITY_KEYWORDS[normalized];
  }
  
  // Partial match
  for (const [keyword, value] of Object.entries(TIME_FLEXIBILITY_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      return value;
    }
  }
  
  return null;
}

export function extractAddressLikeText(text: string): string | null {
  const normalized = text.trim();
  
  // Address indicators
  const addressPatterns = [
    // Street patterns
    /(?:ถนน|ถ\.|th\.?|thanon|road|rd\.?)\s*[\w\sก-๙]+/i,
    // Soi patterns
    /(?:ซอย|ซ\.|soi)\s*[\w\sก-๙0-9\-\/]+/i,
    // District patterns
    /(?:แขวง|เขต|ตำบล|อำเภอ|district|subdistrict)\s*[\w\sก-๙]+/i,
    // Province patterns
    /(?:จังหวัด|จ\.|province)\s*[\w\sก-๙]+/i,
    // Building/Condo patterns
    /(?:คอนโด|อพาร์ทเมนท์|อาคาร|หมู่บ้าน|หมู่บ้าน|village|building|condo|apartment)\s*[\w\sก-๙0-9]+/i,
    // Number + moo patterns
    /\d+\s*(?:หมู่|ม\.?|moo)\s*\d+/i,
    // Postal code
    /\d{5}/,
  ];
  
  // Check if text looks like an address
  let looksLikeAddress = false;
  for (const pattern of addressPatterns) {
    if (pattern.test(normalized)) {
      looksLikeAddress = true;
      break;
    }
  }
  
  // Additional heuristics
  const addressKeywords = [
    'บ้าน', 'บ้านเลขที่', 'ที่อยู่', 'อาคาร', 'คอนโด', 'หมู่บ้าน',
    'ถนน', 'ซอย', 'แขวง', 'เขต', 'จังหวัด', 'ไปรษณีย์',
    'house', 'address', 'building', 'street', 'road', 'soi',
    'district', 'province', 'postal', 'zip',
  ];
  
  for (const keyword of addressKeywords) {
    if (normalized.toLowerCase().includes(keyword)) {
      looksLikeAddress = true;
      break;
    }
  }
  
  if (looksLikeAddress || normalized.length > 10) {
    return normalized;
  }
  
  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeThaiText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

function getNextDayOfWeek(fromDate: Date, dayOfWeek: number): Date {
  const date = new Date(fromDate);
  const currentDay = date.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  date.setDate(date.getDate() + daysUntil);
  return date;
}

// ============================================================================
// Internal Answer Parsers (return ParsedAnswer)
// ============================================================================

function parseServiceTypeAnswer(text: string): ParsedAnswer {
  const result = parseServiceType(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'service.serviceType',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'service.serviceType',
    normalizedText: text,
  };
}

function parseRelationshipAnswer(text: string): ParsedAnswer {
  const result = parseRelationship(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'contact.relationship',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'contact.relationship',
    normalizedText: text,
  };
}

function parseDateAnswer(text: string): ParsedAnswer {
  const result = parseDate(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'schedule.appointmentDate',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'schedule.appointmentDate',
    normalizedText: text,
  };
}

function parseTimeAnswer(text: string): ParsedAnswer {
  const result = parseTime(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'schedule.appointmentTime',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'schedule.appointmentTime',
    normalizedText: text,
  };
}

function parseMobilityLevelAnswer(text: string): ParsedAnswer {
  const result = parseMobilityLevel(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'patient.mobilityLevel',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'patient.mobilityLevel',
    normalizedText: text,
  };
}

function parseUrgencyLevelAnswer(text: string): ParsedAnswer {
  const result = parseUrgencyLevel(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'urgencyLevel',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'urgencyLevel',
    normalizedText: text,
  };
}

function parseTimeFlexibilityAnswer(text: string): ParsedAnswer {
  const result = parseTimeFlexibility(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'schedule.timeFlexibility',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'schedule.timeFlexibility',
    normalizedText: text,
  };
}

function parsePhoneAnswer(text: string): ParsedAnswer {
  const result = parsePhone(text);
  if (result) {
    return {
      value: result,
      confidence: 'high',
      field: 'contact.contactPhone',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'contact.contactPhone',
    normalizedText: text,
  };
}

function parseBooleanAnswer(text: string, field: string): ParsedAnswer {
  const result = parseBoolean(text);
  if (result !== null) {
    return {
      value: result,
      confidence: 'high',
      field,
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field,
    normalizedText: text,
  };
}

function parseAddressAnswer(text: string): ParsedAnswer {
  const result = extractAddressLikeText(text);
  if (result) {
    return {
      value: result,
      confidence: 'medium',
      field: 'locations.pickup.address',
      normalizedText: text,
    };
  }
  return {
    value: text,
    confidence: 'low',
    field: 'locations.pickup.address',
    normalizedText: text,
  };
}

// ============================================================================
// Additional Parser Functions (Required by useIntakeChatAgent)
// ============================================================================

export interface IntentDetectionResult {
  intent: 'confirm' | 'reject' | 'edit' | 'restart' | 'skip' | 'unknown';
  confidence: number;
  entities?: Array<{ name: string; value: string }>;
}

/**
 * Detect user intent from text
 */
export function detectIntent(text: string): IntentDetectionResult {
  const globalIntent = parseGlobalIntent(text);
  
  // Map GlobalIntent to IntentDetectionResult
  const intentMap: Record<GlobalIntent, IntentDetectionResult['intent']> = {
    confirm: 'confirm',
    restart: 'restart',
    edit: 'edit',
    skip: 'skip',
    unknown: 'unknown',
  };
  
  // Check for reject patterns
  const normalized = normalizeThaiText(text);
  const rejectWords = ['ไม่', 'no', 'ไม่เอา', 'ไม่ต้อง', 'cancel', 'ยกเลิก'];
  const isReject = rejectWords.some(w => normalized.includes(w)) && 
                   !normalized.includes('ใช่') && 
                   !normalized.includes('yes');
  
  if (isReject && globalIntent === 'unknown') {
    return { intent: 'reject', confidence: 0.7 };
  }
  
  return {
    intent: intentMap[globalIntent],
    confidence: globalIntent === 'unknown' ? 0.3 : 0.9,
  };
}

/**
 * Parse input with optional target field
 * Returns a structured result with field, value, and confidence
 */
export function parseInput(
  text: string, 
  targetField?: string
): { field: string; value: unknown; confidence: number } {
  const result = parseUserAnswer(targetField || 'unknown', text);
  
  // Convert ParsedAnswer confidence to number
  const confidenceMap: Record<ParsedAnswer['confidence'], number> = {
    high: 0.9,
    medium: 0.6,
    low: 0.3,
  };
  
  return {
    field: result.field || targetField || 'unknown',
    value: result.value,
    confidence: confidenceMap[result.confidence],
  };
}

/**
 * Apply parsed answer to form data
 */
export function applyParsedAnswer(
  formData: Partial<import('../intake/types').IntakeInput>,
  parsed: { field: string; value: unknown; confidence: number }
): Partial<import('../intake/types').IntakeInput> {
  if (parsed.confidence < 0.5) {
    return formData;
  }
  
  const newFormData = { ...formData };
  const fieldPath = parsed.field;
  
  // Handle nested fields
  if (fieldPath.includes('.')) {
    const keys = fieldPath.split('.');
    let current: Record<string, unknown> = newFormData;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    
    current[keys[keys.length - 1]] = parsed.value;
  } else {
    (newFormData as Record<string, unknown>)[fieldPath] = parsed.value;
  }
  
  return newFormData;
}

/**
 * Auto-detect field from text content
 */
export function autoDetectField(text: string): string | null {
  const normalized = normalizeThaiText(text);
  
  // Check for phone number patterns
  if (parsePhone(text)) {
    return 'contact.contactPhone';
  }
  
  // Check for date patterns
  if (parseDate(text)) {
    return 'schedule.appointmentDate';
  }
  
  // Check for time patterns
  if (parseTime(text)) {
    return 'schedule.appointmentTime';
  }
  
  // Check for service type
  if (parseServiceType(text)) {
    return 'service.serviceType';
  }
  
  // Check for relationship
  if (parseRelationship(text)) {
    return 'contact.relationship';
  }
  
  // Check for mobility level
  if (parseMobilityLevel(text)) {
    return 'patient.mobilityLevel';
  }
  
  // Check for address-like text (long text with location keywords)
  if (extractAddressLikeText(text)) {
    return 'locations.pickup.address';
  }
  
  return null;
}

/**
 * Check if text contains any of the keywords
 */
export function containsAny(text: string, keywords: string[]): boolean {
  const normalized = normalizeThaiText(text);
  return keywords.some(kw => normalized.includes(normalizeThaiText(kw)));
}

/**
 * Extract phone number from text
 */
export function extractPhone(text: string): string | null {
  return parsePhone(text);
}

/**
 * Extract age from text
 */
export function extractAge(text: string): number | null {
  const normalized = normalizeThaiText(text);
  
  // Match patterns like "65 ปี", "65 years", "อายุ 65"
  const patterns = [
    /(\d{1,3})\s*(?:ปี|years?|y\.?o\.?)/i,
    /อายุ\s*(\d{1,3})/i,
    /(\d{1,3})\s*ขวบ/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const age = parseInt(match[1], 10);
      if (age > 0 && age < 150) {
        return age;
      }
    }
  }
  
  return null;
}

/**
 * Extract date from text
 */
export function extractDate(text: string): string | null {
  return parseDate(text);
}

/**
 * Extract time from text
 */
export function extractTime(text: string): string | null {
  return parseTime(text);
}

// ============================================================================
// Export all for testing
// ============================================================================

export {
  SERVICE_TYPE_KEYWORDS,
  RELATIONSHIP_KEYWORDS,
  MOBILITY_LEVEL_KEYWORDS,
  URGENCY_LEVEL_KEYWORDS,
  TIME_FLEXIBILITY_KEYWORDS,
  BOOLEAN_KEYWORDS,
  INTENT_KEYWORDS,
};
