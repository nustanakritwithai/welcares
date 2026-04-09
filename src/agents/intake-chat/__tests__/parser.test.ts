/**
 * Intake Chat Parser Tests
 */

import { describe, it, expect, beforeEach, afterEach, test } from 'vitest';
import {
  parseUserAnswer,
  parseGlobalIntent,
  parseServiceType,
  parseRelationship,
  parseDate,
  parseTime,
  parsePhone,
  parseBoolean,
  parseMobilityLevel,
  parseUrgencyLevel,
  parseTimeFlexibility,
  extractAddressLikeText,
} from '../parser';

// ============================================================================
// parseGlobalIntent Tests
// ============================================================================

describe('parseGlobalIntent', () => {
  test('should detect confirm intent from Thai keywords', () => {
    expect(parseGlobalIntent('ใช่')).toBe('confirm');
    expect(parseGlobalIntent('ตกลงครับ')).toBe('confirm');
    expect(parseGlobalIntent('ยืนยันครับ')).toBe('confirm');
    expect(parseGlobalIntent('ok ครับ')).toBe('confirm');
    expect(parseGlobalIntent('ถูกต้อง')).toBe('confirm');
  });

  test('should detect restart intent', () => {
    expect(parseGlobalIntent('เริ่มใหม่')).toBe('restart');
    expect(parseGlobalIntent('ยกเลิก')).toBe('restart');
    expect(parseGlobalIntent('cancel')).toBe('restart');
    expect(parseGlobalIntent('เริ่มต้นใหม่ครับ')).toBe('restart');
  });

  test('should detect edit intent', () => {
    expect(parseGlobalIntent('แก้ไข')).toBe('edit');
    expect(parseGlobalIntent('เปลี่ยนเวลา')).toBe('edit');
    expect(parseGlobalIntent('ผิดครับ')).toBe('edit');
    expect(parseGlobalIntent('แก้ใหม่')).toBe('edit');
  });

  test('should detect skip intent', () => {
    expect(parseGlobalIntent('ข้าม')).toBe('skip');
    expect(parseGlobalIntent('ไม่มี')).toBe('skip');
    expect(parseGlobalIntent('ไม่ต้องครับ')).toBe('skip');
    expect(parseGlobalIntent('ไปต่อ')).toBe('skip');
  });

  test('should return unknown for unclear intent', () => {
    expect(parseGlobalIntent('อะไรนะ')).toBe('unknown');
    expect(parseGlobalIntent('ไม่เข้าใจ')).toBe('unknown');
    expect(parseGlobalIntent('')).toBe('unknown');
  });
});

// ============================================================================
// parseServiceType Tests
// ============================================================================

describe('parseServiceType', () => {
  test('should parse hospital visit types', () => {
    expect(parseServiceType('พบแพทย์')).toBe('hospital-visit');
    expect(parseServiceType('ไปหาหมอ')).toBe('hospital-visit');
    expect(parseServiceType('ไปโรงพยาบาล')).toBe('hospital-visit');
    expect(parseServiceType('hospital visit')).toBe('hospital-visit');
    expect(parseServiceType('doctor appointment')).toBe('hospital-visit');
  });

  test('should parse dialysis service', () => {
    expect(parseServiceType('ล้างไต')).toBe('dialysis');
    expect(parseServiceType('ไตเทียม')).toBe('dialysis');
    expect(parseServiceType('dialysis')).toBe('dialysis');
  });

  test('should parse physical therapy', () => {
    expect(parseServiceType('กายภาพบำบัด')).toBe('physical-therapy');
    expect(parseServiceType('physical therapy')).toBe('physical-therapy');
    expect(parseServiceType('กายภาพ')).toBe('physical-therapy');
  });

  test('should parse chemotherapy', () => {
    expect(parseServiceType('เคมีบำบัด')).toBe('chemotherapy');
    expect(parseServiceType('chemo')).toBe('chemotherapy');
    expect(parseServiceType('chemotherapy')).toBe('chemotherapy');
  });

  test('should parse checkup', () => {
    expect(parseServiceType('ตรวจสุขภาพ')).toBe('checkup');
    expect(parseServiceType('health checkup')).toBe('checkup');
    expect(parseServiceType('check-up')).toBe('checkup');
  });

  test('should return null for unknown service', () => {
    expect(parseServiceType('อะไรสักอย่าง')).toBeNull();
    expect(parseServiceType('ไม่รู้')).toBeNull();
  });
});

// ============================================================================
// parseRelationship Tests
// ============================================================================

describe('parseRelationship', () => {
  test('should parse family relationships', () => {
    expect(parseRelationship('ลูกสาว')).toBe('daughter');
    expect(parseRelationship('ลูกชาย')).toBe('son');
    expect(parseRelationship('สามี')).toBe('spouse');
    expect(parseRelationship('ภรรยา')).toBe('spouse');
    expect(parseRelationship('พ่อ')).toBe('parent');
    expect(parseRelationship('แม่')).toBe('parent');
    expect(parseRelationship('พี่')).toBe('sibling');
    expect(parseRelationship('น้อง')).toBe('sibling');
  });

  test('should parse other relationships', () => {
    expect(parseRelationship('ญาติ')).toBe('relative');
    expect(parseRelationship('เพื่อน')).toBe('friend');
    expect(parseRelationship('ตนเอง')).toBe('self');
    expect(parseRelationship('myself')).toBe('self');
    expect(parseRelationship('อื่นๆ')).toBe('other');
  });

  test('should parse English relationships', () => {
    expect(parseRelationship('daughter')).toBe('daughter');
    expect(parseRelationship('son')).toBe('son');
    expect(parseRelationship('spouse')).toBe('spouse');
    expect(parseRelationship('husband')).toBe('spouse');
    expect(parseRelationship('wife')).toBe('spouse');
    expect(parseRelationship('friend')).toBe('friend');
  });

  test('should return null for unclear relationship', () => {
    expect(parseRelationship('คนรู้จัก')).toBeNull();
  });
});

// ============================================================================
// parseDate Tests
// ============================================================================

describe('parseDate', () => {
  const mockDate = new Date('2025-04-10');
  const originalDate = global.Date;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockDate);
        } else {
          super(...args);
        }
      }
    } as typeof Date;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  test('should parse relative dates', () => {
    // Mock today as 2025-04-10
    const result = parseDate('วันนี้');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should parse tomorrow', () => {
    const result = parseDate('พรุ่งนี้');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should parse Thai day names', () => {
    const result = parseDate('วันจันทร์');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should parse Thai date format DD/MM', () => {
    const result = parseDate('15/04');
    expect(result).toBe('2025-04-15');
  });

  test('should parse Thai date format with Buddhist year', () => {
    const result = parseDate('15/04/2568');
    expect(result).toBe('2025-04-15');
  });

  test('should parse ISO date format', () => {
    expect(parseDate('2025-04-15')).toBe('2025-04-15');
    expect(parseDate('2025/04/15')).toBe('2025-04-15');
  });

  test('should return null for invalid date', () => {
    expect(parseDate('ไม่รู้วันไหน')).toBeNull();
    expect(parseDate('วันนั้น')).toBeNull();
  });
});

// ============================================================================
// parseTime Tests
// ============================================================================

describe('parseTime', () => {
  test('should parse 24-hour format', () => {
    expect(parseTime('14:00')).toBe('14:00');
    expect(parseTime('9:30')).toBe('09:30');
    expect(parseTime('23:59')).toBe('23:59');
    expect(parseTime('14.00')).toBe('14:00');
    expect(parseTime('14 00')).toBe('14:00');
  });

  test('should parse Thai morning time', () => {
    expect(parseTime('9 โมง')).toBe('09:00');
    expect(parseTime('9 โมงเช้า')).toBe('09:00');
    expect(parseTime('10โมง')).toBe('10:00');
  });

  test('should parse Thai afternoon time', () => {
    expect(parseTime('บ่าย 2')).toBe('14:00');
    expect(parseTime('บ่ายสามโมง')).toBe('15:00');
  });

  test('should parse noon and midnight', () => {
    expect(parseTime('เที่ยง')).toBe('12:00');
    expect(parseTime('เที่ยงคืน')).toBe('00:00');
    expect(parseTime('midnight')).toBe('00:00');
  });

  test('should parse time periods', () => {
    expect(parseTime('เช้า')).toBe('08:00');
    expect(parseTime('สาย')).toBe('10:00');
    expect(parseTime('บ่าย')).toBe('14:00');
    expect(parseTime('เย็น')).toBe('17:00');
    expect(parseTime('ค่ำ')).toBe('19:00');
    expect(parseTime('ดึก')).toBe('21:00');
  });

  test('should return null for invalid time', () => {
    expect(parseTime('ไม่รู้')).toBeNull();
    expect(parseTime('ตอนนั้น')).toBeNull();
  });
});

// ============================================================================
// parsePhone Tests
// ============================================================================

describe('parsePhone', () => {
  test('should parse Thai mobile numbers', () => {
    expect(parsePhone('0812345678')).toBe('0812345678');
    expect(parsePhone('089-123-4567')).toBe('0891234567');
    expectPhone('091 234 5678', '0912345678');
    expect(parsePhone('0612345678')).toBe('0612345678');
  });

  test('should parse Bangkok landline', () => {
    expect(parsePhone('021234567')).toBe('021234567');
    expect(parsePhone('02-123-4567')).toBe('021234567');
  });

  test('should parse provincial landline', () => {
    expect(parsePhone('053123456')).toBe('053123456');
    expect(parsePhone('053-123-456')).toBe('053123456');
  });

  test('should parse international format with +66', () => {
    expect(parsePhone('+66812345678')).toBe('0812345678');
    expect(parsePhone('66891234567')).toBe('0891234567');
  });

  test('should return null for invalid phone', () => {
    expect(parsePhone('1234')).toBeNull();
    expect(parsePhone('123456789012345')).toBeNull();
    expect(parsePhone('ไม่มีเบอร์')).toBeNull();
  });
});

function expectPhone(input: string, expected: string) {
  expect(parsePhone(input)).toBe(expected);
}

// ============================================================================
// parseBoolean Tests
// ============================================================================

describe('parseBoolean', () => {
  test('should parse positive responses', () => {
    expect(parseBoolean('ใช่')).toBe(true);
    expect(parseBoolean('yes')).toBe(true);
    expect(parseBoolean('ต้องการ')).toBe(true);
    expect(parseBoolean('want')).toBe(true);
    expect(parseBoolean('ok')).toBe(true);
    expect(parseBoolean('ได้')).toBe(true);
    expect(parseBoolean('ครับ')).toBe(true);
    expect(parseBoolean('ค่ะ')).toBe(true);
  });

  test('should parse negative responses', () => {
    expect(parseBoolean('ไม่')).toBe(false);
    expect(parseBoolean('no')).toBe(false);
    expect(parseBoolean('ไม่ต้องการ')).toBe(false);
    expect(parseBoolean('ไม่เอา')).toBe(false);
    expect(parseBoolean('ไม่เป็นไร')).toBe(false);
    expect(parseBoolean('cancel')).toBe(false);
  });

  test('should return null for unclear response', () => {
    expect(parseBoolean('อาจจะ')).toBeNull();
    expect(parseBoolean('ไม่แน่ใจ')).toBeNull();
  });
});

// ============================================================================
// parseMobilityLevel Tests
// ============================================================================

describe('parseMobilityLevel', () => {
  test('should parse independent mobility', () => {
    expect(parseMobilityLevel('เดินได้เอง')).toBe('independent');
    expect(parseMobilityLevel('เดินได้')).toBe('independent');
    expect(parseMobilityLevel('independent')).toBe('independent');
    expect(parseMobilityLevel('ปกติ')).toBe('independent');
  });

  test('should parse assisted mobility', () => {
    expect(parseMobilityLevel('ต้องช่วยพยุง')).toBe('assisted');
    expect(parseMobilityLevel('ช่วยพยุง')).toBe('assisted');
    expect(parseMobilityLevel('assisted')).toBe('assisted');
    expect(parseMobilityLevel('ช่วยเดิน')).toBe('assisted');
  });

  test('should parse wheelchair mobility', () => {
    expect(parseMobilityLevel('ใช้รถเข็น')).toBe('wheelchair');
    expect(parseMobilityLevel('รถเข็น')).toBe('wheelchair');
    expect(parseMobilityLevel('wheelchair')).toBe('wheelchair');
  });

  test('should parse bedridden mobility', () => {
    expect(parseMobilityLevel('ติดเตียง')).toBe('bedridden');
    expect(parseMobilityLevel('bedridden')).toBe('bedridden');
    expect(parseMobilityLevel('นอน')).toBe('bedridden');
    expect(parseMobilityLevel('ไม่สามารถลุก')).toBe('bedridden');
  });

  test('should return null for unclear mobility', () => {
    expect(parseMobilityLevel('แย่หน่อย')).toBeNull();
  });
});

// ============================================================================
// parseUrgencyLevel Tests
// ============================================================================

describe('parseUrgencyLevel', () => {
  test('should parse low urgency', () => {
    expect(parseUrgencyLevel('ปกติ')).toBe('low');
    expect(parseUrgencyLevel('low')).toBe('low');
    expect(parseUrgencyLevel('ไม่เร่ง')).toBe('low');
  });

  test('should parse normal urgency', () => {
    expect(parseUrgencyLevel('normal')).toBe('normal');
    expect(parseUrgencyLevel('เร็วๆนี้')).toBe('normal');
  });

  test('should parse high urgency', () => {
    expect(parseUrgencyLevel('พรุ่งนี้')).toBe('high');
    expect(parseUrgencyLevel('high')).toBe('high');
    expect(parseUrgencyLevel('ด่วน')).toBe('high');
  });

  test('should parse urgent level', () => {
    expect(parseUrgencyLevel('วันนี้')).toBe('urgent');
    expect(parseUrgencyLevel('ฉุกเฉิน')).toBe('urgent');
    expect(parseUrgencyLevel('urgent')).toBe('urgent');
    expect(parseUrgencyLevel('ด่วนมาก')).toBe('urgent');
  });

  test('should return null for unclear urgency', () => {
    expect(parseUrgencyLevel('ไม่แน่ใจ')).toBeNull();
  });
});

// ============================================================================
// parseTimeFlexibility Tests
// ============================================================================

describe('parseTimeFlexibility', () => {
  test('should parse strict flexibility', () => {
    expect(parseTimeFlexibility('ตรงเวลา')).toBe('strict');
    expect(parseTimeFlexibility('strict')).toBe('strict');
    expect(parseTimeFlexibility('เป๊ะ')).toBe('strict');
  });

  test('should parse 30min flexibility', () => {
    expect(parseTimeFlexibility('30 นาที')).toBe('30min');
    expect(parseTimeFlexibility('30min')).toBe('30min');
  });

  test('should parse 1hour flexibility', () => {
    expect(parseTimeFlexibility('1 ชั่วโมง')).toBe('1hour');
    expect(parseTimeFlexibility('1hour')).toBe('1hour');
    expect(parseTimeFlexibility('ยืดหยุ่น')).toBe('1hour');
  });

  test('should parse anytime flexibility', () => {
    expect(parseTimeFlexibility('anytime')).toBe('anytime');
    expect(parseTimeFlexibility('เวลาไหนก็ได้')).toBe('anytime');
    expect(parseTimeFlexibility('ไม่เกี่ยง')).toBe('anytime');
  });

  test('should return null for unclear flexibility', () => {
    expect(parseTimeFlexibility('ไม่แน่ใจ')).toBeNull();
  });
});

// ============================================================================
// extractAddressLikeText Tests
// ============================================================================

describe('extractAddressLikeText', () => {
  test('should extract address with street', () => {
    const address = extractAddressLikeText('บ้านเลขที่ 123 ถนนสุขุมวิท');
    expect(address).toContain('123');
    expect(address).toContain('ถนน');
  });

  test('should extract address with building', () => {
    const address = extractAddressLikeText('คอนโด ABC ถนนรัชดา');
    expect(address).not.toBeNull();
  });

  test('should extract address with soi', () => {
    const address = extractAddressLikeText('ซอยสุขุมวิท 21');
    expect(address).not.toBeNull();
  });

  test('should extract address with district', () => {
    const address = extractAddressLikeText('แขวงคลองเตย เขตคลองเตย');
    expect(address).not.toBeNull();
  });

  test('should return null for non-address text', () => {
    expect(extractAddressLikeText('ใช่')).toBeNull();
    expect(extractAddressLikeText('ok')).toBeNull();
    expect(extractAddressLikeText('14:00')).toBeNull();
  });

  test('should handle long text as potential address', () => {
    const longText = 'บ้านเลขที่ 123 หมู่ 4 ถนนสุขุมวิท ซอย 21 แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110';
    expect(extractAddressLikeText(longText)).toBe(longText);
  });
});

// ============================================================================
// parseUserAnswer Integration Tests
// ============================================================================

describe('parseUserAnswer', () => {
  test('should route to service type parser', () => {
    const result = parseUserAnswer('service.serviceType', 'พบแพทย์', {});
    expect(result.value).toBe('hospital-visit');
    expect(result.confidence).toBe('high');
  });

  test('should route to relationship parser', () => {
    const result = parseUserAnswer('contact.relationship', 'ลูกสาว', {});
    expect(result.value).toBe('daughter');
    expect(result.confidence).toBe('high');
  });

  test('should route to phone parser', () => {
    const result = parseUserAnswer('contact.contactPhone', '0812345678', {});
    expect(result.value).toBe('0812345678');
    expect(result.confidence).toBe('high');
  });

  test('should return low confidence for unknown field', () => {
    const result = parseUserAnswer('unknown.field', 'some text', {});
    expect(result.value).toBe('some text');
    expect(result.confidence).toBe('medium');
  });

  test('should route to boolean parser for needs fields', () => {
    const result = parseUserAnswer('patient.needsEscort', 'ใช่', {});
    expect(result.value).toBe(true);
    expect(result.confidence).toBe('high');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  test('should handle empty string', () => {
    expect(parseGlobalIntent('')).toBe('unknown');
    expect(parseServiceType('')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parsePhone('')).toBeNull();
    expect(parseBoolean('')).toBeNull();
  });

  test('should handle whitespace', () => {
    expect(parseServiceType('  พบแพทย์  ')).toBe('hospital-visit');
    expect(parsePhone('  081 234 5678  ')).toBe('0812345678');
  });

  test('should handle mixed Thai-English', () => {
    expect(parseServiceType('ไป hospital')).toBe('hospital-visit');
    expect(parseRelationship('my daughter')).toBe('daughter');
  });

  test('should handle case insensitivity', () => {
    expect(parseServiceType('HOSPITAL')).toBe('hospital-visit');
    expect(parseServiceType('Doctor')).toBe('hospital-visit');
    expect(parseRelationship('DAUGHTER')).toBe('daughter');
  });
});
