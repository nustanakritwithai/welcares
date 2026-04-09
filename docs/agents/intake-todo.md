# Intake Agent MVP - Implementation Todo List

> **Role:** Senior AI Application Engineer  
> **Project:** WelCares ElderCare  
> **Source of Truth:** `docs/agents/intake-schema.md` + `src/agents/intake/schema.ts`  
> **Goal:** Production-minded, testable, extendable Intake Agent

---

## Phase 0: Discovery & Setup (30 min)

- [ ] 0.1 อ่าน schema ปัจจุบัน (`docs/agents/intake-schema.md`)
- [ ] 0.2 อ่าน TypeScript types (`src/agents/intake/schema.ts`)
- [ ] 0.3 ตรวจโครงสร้างโปรเจกต์ (test setup, config, existing utils)
- [ ] 0.4 ตรวจสอบไฟล์ที่มีอยู่แล้วใน `src/agents/intake/`
- [ ] 0.5 สร้างโครงสร้างโฟลเดอร์ถ้ายังไม่มี

---

## Phase 1: Types & Schema (1 hour)

**File:** `src/agents/intake/types.ts`

- [ ] 1.1 สร้าง `IntakeFormData` interface (รวมทุก field จาก schema)
- [ ] 1.2 สร้าง `ValidationResult` interface
  - `isComplete: boolean`
  - `missingFields: string[]`
  - `nextQuestion?: string`
  - `warnings?: string[]`
  - `normalizedData: IntakeFormData`
- [ ] 1.3 สร้าง `MissingField` interface
- [ ] 1.4 สร้าง `JobSpec` interface (สอดคล้องกับ schema.ts)
- [ ] 1.5 สร้าง enum types
  - `ServiceType`
  - `MobilityLevel`
  - `ComplexityLevel`
  - `PriorityLevel`
  - `UrgencyLevel`
- [ ] 1.6 สร้าง `CostEstimate` interface
- [ ] 1.7 สร้าง `ResourceRequirements` interface
- [ ] 1.8 สร้าง `IntakeSubmitResult` / `IntakePreviewResult`
- [ ] 1.9 Export ทั้งหมดให้ใช้งานได้

---

## Phase 2: Validator Engine (2 hours)

**File:** `src/agents/intake/validator.ts`

### Core Functions
- [ ] 2.1 Implement `normalizeInput(formData)`
  - [ ] Trim all strings
  - [ ] Convert empty string → undefined
  - [ ] Normalize phone format (0xx-xxx-xxxx)
  - [ ] Normalize date/time (ถ้าทำได้)
  - [ ] Preserve object shape

- [ ] 2.2 Implement `validateRequiredFields(formData)`
  - [ ] Check: `contactName`
  - [ ] Check: `contactPhone`
  - [ ] Check: `serviceType`
  - [ ] Check: `appointmentDate`
  - [ ] Check: `appointmentTime`
  - [ ] Check: `pickup.address`
  - [ ] Check: `dropoff.address`
  - [ ] Check: `patient.name`

- [ ] 2.3 Implement `validateConditionalFields(formData)`
  - [ ] Check `needsEscort` if mobilityLevel !== "independent"
  - [ ] Check `floor/room` if has `buildingName`
  - [ ] Check `department` if serviceType === "hospital-visit"

- [ ] 2.4 Implement `buildNextQuestion(missingFields, formData)`
  - [ ] คืนภาษาไทยสั้น สุภาพ
  - [ ] Map field → question text
  - [ ] ตัวอย่าง: "ขอชื่อผู้ป่วยด้วยครับ"

- [ ] 2.5 Implement `validateFormData(formData)`
  - [ ] Return: `{ isComplete, missingFields, nextQuestion, warnings, normalizedData }`
  - [ ] เรียก normalize ก่อน validate เสมอ

### Validation Rules
- [ ] 2.6 Time validation (ไม่ย้อนหลัง, 06:00-20:00)
- [ ] 2.7 Location validation (pickup ≠ dropoff)
- [ ] 2.8 Phone validation (regex ไทย)

---

## Phase 3: Transformer Engine (2 hours)

**File:** `src/agents/intake/transformer.ts`

### Core Functions
- [ ] 3.1 Implement `transformToJobSpec(formData)`
  - [ ] Generate jobId: `WC-YYYYMMDD-XXXX`
  - [ ] Map all sections ตาม schema
  - [ ] คืน JobSpec ครบทุก field

- [ ] 3.2 Implement `derivePriority(formData)`
  - [ ] urgent → high
  - [ ] stretcher/bedridden → high
  - [ ] default → normal

- [ ] 3.3 Implement `estimateDuration(formData)`
  - [ ] Rule-based constants จาก schema
  - [ ] serviceType → duration mapping

- [ ] 3.4 Implement `estimateDistanceAndDuration(formData)`
  - [ ] Mock/default values (พร้อม comment อธิบาย)
  - [ ] รองรับ enrichment ภายหลัง

- [ ] 3.5 Implement `assessComplexity(formData)`
  - [ ] simple: ไม่มี escort, ไม่มี wheelchair, ไม่มี addon
  - [ ] moderate: มี escort หรือ wheelchair หรือ addon 1 อย่าง
  - [ ] complex: หลายเงื่อนไขร่วมกัน
  - [ ] critical: urgency สูง + mobility หนัก

- [ ] 3.6 Implement `estimateCost(formData)`
  - [ ] base cost
  - [ ] distance cost (mock/estimated)
  - [ ] duration cost
  - [ ] total

- [ ] 3.7 Implement `deriveResources(formData)`
  - [ ] `navigatorRequired` logic
  - [ ] `vehicleType` logic
  - [ ] `specialEquipment` array

### Business Rules
- [ ] 3.8 Vehicle type rules
  - [ ] wheelchair → wheelchair-accessible
  - [ ] stretcher/bedridden → medical-transport
  - [ ] default → standard

- [ ] 3.9 Navigator required rules
  - [ ] needsEscort = true
  - [ ] accompanyInside = true
  - [ ] serviceType = hospital-visit

---

## Phase 4: Service Layer (2 hours)

**File:** `src/agents/intake/service.ts`

### Core Functions
- [ ] 4.1 Implement `previewIntake(formData)`
  - [ ] Call normalize + validate + transform
  - [ ] ถ้าไม่ครบ → คืน validation result
  - [ ] ถ้าครบ → คืน preview พร้อม JobSpec

- [ ] 4.2 Implement `submitIntake(formData)`
  - [ ] Validate ก่อนส่ง
  - [ ] POST ไป endpoint (mock/configurable)
  - [ ] รองรับ retry 2-3 ครั้ง (network/timeout/5xx)
  - [ ] ไม่ retry validation/4xx error

### Error Handling
- [ ] 4.3 Define error types
  - [ ] `validation_error`
  - [ ] `network_error`
  - [ ] `server_error`
  - [ ] `unknown_error`

### Config
- [ ] 4.4 Service config (base URL, timeout, retry)
- [ ] 4.5 Mock endpoint (สำหรับ dev)
- [ ] 4.6 PII protection (ไม่ log ดิบ)

---

## Phase 5: React Hook (2 hours)

**File:** `src/agents/intake/useIntakeAgent.ts`

### State
- [ ] 5.1 Define hook state
  - [ ] `formData`
  - [ ] `isComplete`
  - [ ] `missingFields`
  - [ ] `nextQuestion`
  - [ ] `preview`
  - [ ] `loading`
  - [ ] `error`
  - [ ] `success`

### Actions
- [ ] 5.2 Implement `updateField(path, value)`
  - [ ] รองรับ nested path ถ้าทำได้สะอาด
- [ ] 5.3 Implement `updateFields(partial)`
- [ ] 5.4 Implement `validateCurrentState()`
  - [ ] เรียก validator ไม่ฝัง logic
- [ ] 5.5 Implement `previewJobSpec()`
  - [ ] เรียก service.previewIntake
- [ ] 5.6 Implement `submitForm()`
  - [ ] เรียก service.submitIntake
- [ ] 5.7 Implement `resetForm()`
  - [ ] ล้าง state ทั้งหมด

### Return Value
- [ ] 5.8 Expose ทุกอย่างที่ต้องใช้

---

## Phase 6: Demo Component (1.5 hours)

**File:** `src/agents/intake/IntakeAgentDemo.jsx` (หรือ .tsx)

### UI Elements
- [ ] 6.1 ฟอร์ม field หลัก
  - [ ] contactName, contactPhone
  - [ ] serviceType (dropdown)
  - [ ] appointmentDate, appointmentTime
  - [ ] pickup.address
  - [ ] dropoff.address
  - [ ] patient.name
  - [ ] patient.mobilityLevel (dropdown)
  - [ ] needsEscort, needsWheelchair (checkbox)
  - [ ] specialNotes (textarea)

- [ ] 6.2 ปุ่ม actions
  - [ ] Validate button
  - [ ] Preview button
  - [ ] Submit button
  - [ ] Reset button

- [ ] 6.3 Display sections
  - [ ] Show `nextQuestion`
  - [ ] Show `missingFields` list
  - [ ] Show JSON preview (JobSpec)
  - [ ] Show success/error state
  - [ ] Show loading state

### Styling
- [ ] 6.4 Basic styling (ไม่ต้องสวยมาก แต่ใช้งานได้)
- [ ] 6.5 Responsive consideration

---

## Phase 7: Module Exports (30 min)

**File:** `src/agents/intake/index.ts`

- [ ] 7.1 Export ทุก types
- [ ] 7.2 Export validator functions
- [ ] 7.3 Export transformer functions
- [ ] 7.4 Export service functions
- [ ] 7.5 Export hook
- [ ] 7.6 Export demo component
- [ ] 7.7 Default exports (ถ้าจำเป็น)

---

## Phase 8: Tests (3 hours)

### Test Files
- [ ] 8.1 `src/agents/intake/__tests__/validator.test.ts`
  - [ ] Test required fields detection
  - [ ] Test conditional fields logic
  - [ ] Test normalizeInput
  - [ ] Test phone/date normalization

- [ ] 8.2 `src/agents/intake/__tests__/transformer.test.ts`
  - [ ] Test transformToJobSpec output shape
  - [ ] Test complexity rules
  - [ ] Test cost estimation
  - [ ] Test priority derivation
  - [ ] Test vehicle type logic

- [ ] 8.3 `src/agents/intake/__tests__/service.test.ts`
  - [ ] Test previewIntake flow
  - [ ] Test submitIntake flow
  - [ ] Test retry behavior
  - [ ] Test error classification

- [ ] 8.4 `src/agents/intake/__tests__/useIntakeAgent.test.ts`
  - [ ] Test happy path (ครบ → preview → submit)
  - [ ] Test updateField
  - [ ] Test validation flow

### Test Setup
- [ ] 8.5 ตรวจ test runner ที่มีอยู่
- [ ] 8.6 สร้าง test utilities (ถ้าจำเป็น)
- [ ] 8.7 Mock data fixtures

---

## Phase 9: Integration & Polish (1.5 hours)

- [ ] 9.1 ตรวจสอบ imports/exports ทั้งหมด
- [ ] 9.2 รัน type checking (`tsc --noEmit`)
- [ ] 9.3 รัน lint (ถ้ามี)
- [ ] 9.4 รัน tests ทั้งหมด
- [ ] 9.5 แก้ไข errors/warnings
- [ ] 9.6 ทดสอบ Demo component บน browser
- [ ] 9.7 ตรวจ PII logging (ต้องไม่มี)

---

## Phase 10: Documentation & Summary (1 hour)

- [ ] 10.1 อัพเดต README ถ้าจำเป็น
- [ ] 10.2 เขียน comment สำคัญในโค้ด
- [ ] 10.3 สร้างตัวอย่าง input/output 2-3 เคส
- [ ] 10.4 สรุปจุดที่ยังเป็น mock/rule-based
- [ ] 10.5 ระบุสิ่งที่ควรทำต่อ (Dispatch Agent connection)

---

## Summary Checklist

### Deliverables
- [ ] `src/agents/intake/types.ts` - TypeScript interfaces
- [ ] `src/agents/intake/validator.ts` - Validation engine
- [ ] `src/agents/intake/transformer.ts` - JobSpec transformer
- [ ] `src/agents/intake/service.ts` - API service layer
- [ ] `src/agents/intake/useIntakeAgent.ts` - React hook
- [ ] `src/agents/intake/IntakeAgentDemo.jsx` - Demo component
- [ ] `src/agents/intake/index.ts` - Module exports
- [ ] Tests (validator, transformer, service, hook)

### Quality Checks
- [ ] ใช้ schema.ts เป็น source of truth (ไม่นิยามซ้ำ)
- [ ] Pure logic แยกจาก React hook
- [ ] ไม่มี business logic ใน component
- [ ] ไม่ใช้ LLM (deterministic/rule-based)
- [ ] TypeScript types ครบถ้วน
- [ ] Test coverage ขั้นพื้นฐาน
- [ ] PII protection
- [ ] พร้อมต่อยอด Dispatch Agent

---

## Time Estimate

| Phase | Time |
|-------|------|
| 0: Discovery | 30 min |
| 1: Types | 1 hour |
| 2: Validator | 2 hours |
| 3: Transformer | 2 hours |
| 4: Service | 2 hours |
| 5: Hook | 2 hours |
| 6: Demo | 1.5 hours |
| 7: Exports | 30 min |
| 8: Tests | 3 hours |
| 9: Integration | 1.5 hours |
| 10: Docs | 1 hour |
| **Total** | **~17 hours** |

---

## Next Steps After This

1. **Connect Real Backend** - แก้ mock endpoint เป็น API จริง
2. **Google Maps Integration** - คำนวณ distance/duration จริง
3. **Dispatch Agent** - รับ JobSpec ไป assign navigator/driver
4. **Real-time Updates** - WebSocket/SSE สำหรับ status updates
5. **Payment Integration** - คำนวณ cost จริง + ชำระเงิน
6. **LINE Integration** - ส่ง notification ผ่าน LINE

---

*Created: 2026-04-09*  
*Status: Ready to start*
