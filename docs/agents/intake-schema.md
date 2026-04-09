# Intake Agent - Schema Definition

> **Version:** 1.0  
> **Date:** 2025-04-09  
> **Purpose:** กำหนด Input/Output และ Missing-fields Policy ก่อน implement

---

## A. Input Schema (จากหน้าเว็บ)

ข้อมูลที่รับจากฟอร์มการจอง แบ่งเป็น 6 กลุ่มหลัก

### A.1 Contact Info (ข้อมูลผู้ติดต่อ)
| Field | Type | คำอธิบาย | ตัวอย่าง |
|-------|------|---------|---------|
| `contactName` | string | ชื่อผู้ติดต่อหลัก | "คุณเจดา" |
| `contactPhone` | string | เบอร์โทรติดต่อ | "0812345678" |
| `contactEmail` | string? | อีเมล (optional) | "jada@email.com" |
| `lineUserId` | string? | LINE User ID (ถ้ามี) | "U4af4980629..." |
| `relationship` | enum | ความสัมพันธ์กับผู้ป่วย | "daughter", "son", "self", "other" |

### A.2 Service Type (ประเภทบริการ)
| Field | Type | คำอธิบาย | ตัวอย่าง |
|-------|------|---------|---------|
| `serviceType` | enum | ประเภทบริการหลัก | "hospital-visit" |
| `serviceSubType` | string? | รายละเอียดเพิ่มเติม | "พบอายุรกรรม" |
| `department` | string? | แผนก/คลินิก | "อายุรกรรม" |
| `doctorName` | string? | ชื่อแพทย์ (ถ้ารู้) | "นพ.สมชาย" |
| `appointmentType` | enum | ประเภทนัด | "new", "follow-up", "procedure" |

**Service Type Options:**
- `hospital-visit` - พบแพทย์นอก
- `follow-up` - ติดตามอาการ
- `physical-therapy` - กายภาพบำบัด
- `dialysis` - ล้างไต
- `chemotherapy` - เคมีบำบัด
- `radiation` - รังสีรักษา
- `checkup` - ตรวจสุขภาพ
- `vaccination` - ฉีดวัคซีน
- `other` - อื่นๆ

### A.3 Schedule (วันและเวลา)
| Field | Type | คำอธิบาย | ตัวอย่าง |
|-------|------|---------|---------|
| `appointmentDate` | string (YYYY-MM-DD) | วันนัด | "2025-04-15" |
| `appointmentTime` | string (HH:mm) | เวลานัด | "09:30" |
| `timeFlexibility` | enum | ความยืดหยุ่นเวลา | "strict", "30min", "1hour", "anytime" |
| `duration` | number? | ระยะเวลาโดยประมาณ (นาที) | 120 |

### A.4 Locations (จุดรับ-ส่ง)
#### Pickup Location (จุดรับ)
| Field | Type | คำอธิบาย | ตัวอย่าง |
|-------|------|---------|---------|
| `pickup.address` | string | ที่อยู่เต็ม | "123 ถนนสุขุมวิท คอนโด ABC" |
| `pickup.lat` | number? | พิกัดละติจูด | 13.7563 |
| `pickup.lng` | number? | พิกัดลองจิจูด | 100.5018 |
| `pickup.contactName` | string | ชื่อผู้ติดต่อที่จุดรับ | "คุณยายมุก" |
| `pickup.contactPhone` | string | เบอร์โทรที่จุดรับ | "0898765432" |
| `pickup.buildingName` | string? | ชื่ออาคาร/คอนโด | "คอนโด ABC" |
| `pickup.floor` | string? | ชั้น | "12" |
| `pickup.roomNumber` | string? | ห้อง | "A1205" |
| `pickup.landmarks` | string? | จุดสังเกต | "ตรงข้าม 7-11" |
| `pickup.parkingNote` | string? | ข้อมูลที่จอดรถ | "จอดล็อบบี้ชั้น 1" |

#### Dropoff Location (ปลายทาง)
| Field | Type | คำอธิบาย | ตัวอย่าง |
|-------|------|---------|---------|
| `dropoff.name` | string | ชื่อสถานที่ | "รพ.จุฬาลงกรณ์" |
| `dropoff.address` | string | ที่อยู่ | "1873 ถนนพระราม 4" |
| `dropoff.lat` | number? | พิกัด | 13.7333 |
| `dropoff.lng` | number? | พิกัด | 100.5333 |
| `dropoff.building` | string? | อาคาร | "อาคารภูมิสิริมังคลานุสรณ์" |
| `dropoff.floor` | string? | ชั้น | "3" |
| `dropoff.room` | string? | ห้องตรวจ | "302" |
| `dropoff.department` | string? | แผนก | "อายุรกรรม" |

### A.5 Patient Info (ข้อมูลผู้ป่วยเบื้องต้น)
| Field | Type | คำอธิบาย | ตัวอย่าง |
|-------|------|---------|---------|
| `patient.name` | string | ชื่อผู้ป่วย | "คุณยายมุก ใจดี" |
| `patient.age` | number? | อายุ | 78 |
| `patient.gender` | enum? | เพศ | "female", "male", "other" |
| `patient.weight` | number? | น้ำหนัก (kg) | 55 |
| `patient.mobilityLevel` | enum | ระดับการเคลื่อนไหว | "independent", "assisted", "wheelchair", "bedridden" |
| `patient.needsEscort` | boolean | ต้องมีคนพา | true |
| `patient.needsWheelchair` | boolean | ต้องใช้รถเข็น | false |
| `patient.oxygenRequired` | boolean | ต้องการออกซิเจน | false |
| `patient.stretcherRequired` | boolean | ต้องการเปล | false |
| `patient.conditions` | string[] | โรคประจำตัว | ["เบาหวาน", "ความดัน"] |
| `patient.allergies` | string[] | แพ้ยา/อาหาร | ["แพ้เพนนิซิลลิน"] |
| `patient.medications` | string[] | ยาประจำ | ["Metformin"] |

### A.6 Special Requirements (ความต้องการพิเศษ)
| Field | Type | คำอธิบาย | ตัวอย่าง |
|-------|------|---------|---------|
| `addons.medicinePickup` | boolean | รับยากลับบ้าน | true |
| `addons.homeCare` | boolean | ดูแลต่อที่บ้าน | false |
| `addons.mealService` | boolean | จัดอาหาร | false |
| `addons.interpretation` | boolean | ล่าม/ตีความ | false |
| `addons.accompanyInside` | boolean | พี่เลี้ยงเข้าไปด้วยใน รพ. | true |
| `specialNotes` | string | บันทึกพิเศษ | "ผู้ป่วยกลัวเข็ม ต้องคอยปลอบ" |
| `urgencyLevel` | enum | ระดับความเร่งด่วน | "normal", "high", "urgent" |

---

## B. Output Schema (Job Spec)

Output ที่ Intake Agent สร้าง และส่งต่อให้ Service Layer

```typescript
interface JobSpec {
  // B.1 Metadata
  jobId: string;           // "WC-20250409-A1B2C3"
  version: "1.0";
  createdAt: string;       // ISO 8601 timestamp
  status: "draft" | "pending" | "confirmed" | "cancelled";
  source: "web" | "line" | "phone";
  sessionId: string;       // สำหรับติดตาม session

  // B.2 Service Details
  service: {
    type: ServiceType;           // "hospital-visit"
    typeLabel: string;           // "พบแพทย์นอก"
    category: "medical" | "therapy" | "checkup" | "other";
    subType?: string;            // "พบอายุรกรรม"
    department?: string;         // "อายุรกรรม"
    doctorName?: string;         // "นพ.สมชาย"
    priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
    estimatedDuration: number;   // นาที
  };

  // B.3 Schedule
  schedule: {
    date: string;              // "2025-04-15"
    time: string;              // "09:30"
    datetime: string;          // ISO 8601
    flexibility: "strict" | "30min" | "1hour" | "anytime";
    estimatedEndTime?: string; // คำนวณจาก duration
  };

  // B.4 Locations
  locations: {
    pickup: LocationDetails;
    dropoff: LocationDetails;
    estimatedDistance?: number;  // km (จาก Google Maps)
    estimatedDuration?: number;  // นาทีเดินทาง
    routePolyline?: string;      // Encoded polyline
  };

  // B.5 Contact
  contact: {
    primary: {
      name: string;
      phone: string;
      email?: string;
      lineUserId?: string;
    };
    relationship: string;  // "daughter"
    emergency?: {
      name: string;
      phone: string;
    };
  };

  // B.6 Patient
  patient: {
    name: string;
    age?: number;
    gender?: "female" | "male" | "other";
    weight?: number;
    mobilityLevel: "independent" | "assisted" | "wheelchair" | "bedridden";
    needsEscort: boolean;
    needsWheelchair: boolean;
    oxygenRequired: boolean;
    stretcherRequired: boolean;
    conditions: string[];
    allergies: string[];
    medications: string[];
    specialAccommodations: string[];
  };

  // B.7 Add-ons
  addons: {
    medicinePickup: boolean;
    homeCare: boolean;
    mealService: boolean;
    interpretation: boolean;
    accompanyInside: boolean;
  };

  // B.8 Assessment (คำนวณโดย Intake Agent)
  assessment: {
    urgencyLevel: "low" | "normal" | "high" | "urgent";
    complexity: "simple" | "moderate" | "complex" | "critical";
    riskFactors: string[];     // ["นัดเร่งด่วน", "ผู้สูงอายุ 78 ปี"]
    
    // Cost Estimate
    estimatedCost: {
      base: number;            // ฿350
      distance: number;        // ฿150 (10km × 15)
      duration: number;        // ฿400 (2hr × 200)
      addons: number;          // ฿250
      total: number;           // ฿1150
      currency: "THB";
    };

    // Resource Requirements
    resources: {
      navigatorRequired: boolean;
      navigatorType?: "PN" | "RN" | "CG";
      vehicleType: "sedan" | "mpv" | "wheelchair-van" | "ambulance";
      estimatedNavHours: number;
      specialEquipment: string[];
    };
  };

  // B.9 Notes
  notes: {
    customer: string;          // บันทึกจากลูกค้า
    internal: string;          // บันทึกภายใน (AI generated)
    flags: string[];           // ["VIP", "URGENT", "WHEELCHAIR"]
  };
}
```

---

## C. Missing-Fields Policy

กำหนดว่า field ไหนขาดไม่ได้ และ policy ในการถามต่อ

### C.1 Required Fields (ขาดไม่ได้)
ต้องมีครบก่อนถึงจะสร้าง Job ได้

| Field | ความสำคัญ | Error Message |
|-------|----------|---------------|
| `contactName` | 🔴 Critical | "กรุณาระบุชื่อผู้ติดต่อ" |
| `contactPhone` | 🔴 Critical | "กรุณาระบุเบอร์โทร" |
| `serviceType` | 🔴 Critical | "ต้องการบริการอะไรครับ?" |
| `appointmentDate` | 🔴 Critical | "นัดวันไหนครับ?" |
| `appointmentTime` | 🔴 Critical | "กี่โมงครับ?" |
| `pickup.address` | 🔴 Critical | "รับจากที่ไหนครับ?" |
| `dropoff.address` | 🔴 Critical | "ไปที่ไหนครับ?" |
| `patient.name` | 🔴 Critical | "ชื่อผู้ป่วยครับ?" |

### C.2 Conditionally Required (ขึ้นกับ context)
| Field | เงื่อนไข | Question |
|-------|---------|----------|
| `patient.needsEscort` | ถ้า mobilityLevel ≠ "independent" | "ต้องมีคนพาไหมครับ?" |
| `patient.needsWheelchair` | ถ้า mobilityLevel = "wheelchair" | "ใช้รถเข็นไหมครับ?" |
| `pickup.floor/room` | ถ้าเป็นคอนโด/อาคาร | "อยู่ชั้นไหน ห้องอะไรครับ?" |
| `dropoff.department` | ถ้า serviceType = hospital-visit | "นัดแผนกไหนครับ?" |

### C.3 Optional Fields (ถามเพิ่มได้)
ถ้ายังไม่มี ไม่เป็นไร แต่ถ้ามีจะดีขึ้น

| Field | Follow-up Question | Priority |
|-------|-------------------|----------|
| `patient.age` | "อายุเท่าไหร่ครับ?" | Medium |
| `patient.conditions` | "มีโรคประจำตัวไหมครับ?" | Medium |
| `doctorName` | "นัดหมออะไรครับ?" | Low |
| `specialNotes` | "มีอะไรเพิ่มเติมไหมครับ?" | Low |
| `addons.medicinePickup` | "ต้องรับยากลับไหมครับ?" | Low |

### C.4 Smart Follow-up Rules

**Rule 1: Ask One at a Time**
- ถามทีละคำถาม ไม่ถามหลายอันพร้อมกัน
- รอคำตอบก่อนถามต่อ

**Rule 2: Context-Aware**
- ถ้าเลือก `serviceType: dialysis` → ถามว่า "รับยากลับไหม" (เพราะ dialysis มักมียา)
- ถ้าเลือก `needsWheelchair: true` → ถาม floor/room (เพราะต้องเตรียมลิฟต์)

**Rule 3: Short & Direct**
- ❌ "กรุณากรอกข้อมูลวันที่และเวลาที่ต้องการนัดหมาย"
- ✅ "นัดวันไหนครับ?" / "กี่โมงครับ?"

**Rule 4: Progressive Disclosure**
1. ถาม Critical ก่อน (8 fields)
2. ถาม Conditionally Required
3. ถาม Optional ตาม priority

### C.5 Validation Rules

**Time Validation:**
- วันต้องไม่ย้อนหลัง
- เวลาต้องอยู่ระหว่าง 06:00 - 20:00
- ถ้านัด < 2 ชม. ข้างหน้า → auto-urgent

**Location Validation:**
- pickup ≠ dropoff
- ที่อยู่ต้องมีความยาว ≥ 10 ตัวอักษร
- เบอร์โทรต้องเป็นรูปแบบไทย (0xx-xxx-xxxx)

**Phone Validation:**
- contactPhone ต้องขึ้นต้นด้วย 0
- ความยาว 9-10 ตัว
- pickup.contactPhone แยกกับ contactPhone ได้

---

## D. State Machine

```
[START]
   ↓
[VALIDATE] ──Missing?──→ [ASK_QUESTION] → [WAIT_INPUT]
   ↓ Complete              ↑______________________↓
[TRANSFORM]
   ↓
[CREATE_JOB_SPEC]
   ↓
[SUBMIT_TO_BACKEND]
   ↓
[SUCCESS] / [ERROR_RETRY]
```

---

## E. API Endpoints (ที่ Service Layer ต้องมี)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intake/jobs` | POST | สร้าง Job ใหม่ |
| `/api/intake/jobs/:id` | GET | ดึง Job Spec |
| `/api/intake/jobs/:id` | PATCH | อัพเดต Job |
| `/api/intake/jobs/:id/cancel` | POST | ยกเลิก Job |
| `/api/maps/distance` | GET | คำนวณระยะทาง |

---

## F. Example Flow

**Input (จากลูกค้า):**
```
"อยากพาแม่ไปหาหมอครับ วันพรุ่งนี้บ่ายโมง ที่รพ.จุฬา"
```

**Missing Fields Detected:**
- contactName ❌
- contactPhone ❌
- pickup.address ❌
- patient.name ❌

**Follow-up Questions:**
1. "ชื่อผู้ติดต่อครับ?"
2. "เบอร์โทรครับ?"
3. "รับจากที่ไหนครับ?"
4. "ชื่อผู้ป่วยครับ?"

**Final Job Spec:** (ครบทุก field แล้ว)
```json
{
  "jobId": "WC-20250409-X7Y9Z2",
  "service": { "type": "hospital-visit", ... },
  "schedule": { "date": "2025-04-10", "time": "13:00", ... },
  "locations": { "pickup": {...}, "dropoff": {...} },
  "patient": { "name": "คุณแม่", "needsEscort": true, ... },
  "assessment": { "complexity": "moderate", "estimatedCost": {...} }
}
```

---

**Next Step:** Implement Intake Agent ตาม schema นี้
