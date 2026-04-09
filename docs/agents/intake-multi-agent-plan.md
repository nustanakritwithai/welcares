# Intake Agent MVP - Multi-Agent Parallel Execution Plan

> **Strategy:** แบ่งงานให้ multiple agents ทำงานคู่ขนาน ลดเวลารวมจาก ~17 ชม. เหลือ ~6-8 ชม.

---

## 🎯 Execution Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARALLEL EXECUTION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

Phase 0: Discovery (1 agent - 30 min)
         │
         ▼
┌─────────────────┐
│  AGENT-1: TYPES │────┬────────────────┬────────────────┐
│  Phase 1        │    │                │                │
│  (1 ชม.)        │    │                │                │
└─────────────────┘    │                │                │
         │             │                │                │
         ▼             ▼                ▼                ▼
┌─────────────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
│  AGENT-2:       │  │  AGENT-3:      │  │  AGENT-4:    │  │  AGENT-5:    │
│  VALIDATOR      │  │  TRANSFORMER   │  │  SERVICE     │  │  TESTS       │
│  Phase 2        │  │  Phase 3       │  │  Phase 4     │  │  (Validator  │
│  (2 ชม.)        │  │  (2 ชม.)       │  │  (2 ชม.)     │  │   + Types)   │
└─────────────────┘  └────────────────┘  └──────────────┘  │  (1.5 ชม.)   │
         │                      │                │         └──────────────┘
         │                      │                │
         └──────────┬───────────┘                │
                    │                            │
                    ▼                            ▼
         ┌─────────────────┐          ┌──────────────────┐
         │  AGENT-6: HOOK  │          │  AGENT-7:        │
         │  Phase 5        │          │  TESTS           │
         │  (2 ชม.)        │          │  (Transformer    │
         └─────────────────┘          │   + Service)     │
                    │                 │  (1.5 ชม.)       │
                    ▼                 └──────────────────┘
         ┌─────────────────┐
         │  AGENT-8: DEMO  │
         │  Phase 6        │
         │  (1.5 ชม.)      │
         └─────────────────┘
                    │
                    ▼
         ┌─────────────────┐
         │  AGENT-9:       │
         │  INTEGRATION    │
         │  Phase 9        │
         │  (1 ชม.)        │
         └─────────────────┘
                    │
                    ▼
         ┌─────────────────┐
         │  AGENT-10:      │
         │  TESTS FINAL    │
         │  Phase 8        │
         │  (1 ชม.)        │
         └─────────────────┘
```

---

## 📋 Agent Assignments

### 🔷 AGENT-1: Foundation (Types)
**Scope:** Phase 1 only  
**Dependencies:** None (reads from schema.ts)  
**Output:** `src/agents/intake/types.ts`

**Tasks:**
- [ ] สร้าง `IntakeFormData` interface
- [ ] สร้าง `ValidationResult`, `MissingField`
- [ ] สร้าง `JobSpec` interface
- [ ] สร้าง enums: ServiceType, MobilityLevel, ComplexityLevel, PriorityLevel, UrgencyLevel
- [ ] สร้าง `CostEstimate`, `ResourceRequirements`
- [ ] สร้าง `IntakeSubmitResult`, `IntakePreviewResult`
- [ ] Export ทั้งหมด

**Success Criteria:**
- ไฟล์ compile ผ่าน (`tsc --noEmit`)
- Types สอดคล้องกับ schema.ts

---

### 🔷 AGENT-2: Validator Engine
**Scope:** Phase 2 only  
**Dependencies:** AGENT-1 (types.ts)  
**Output:** `src/agents/intake/validator.ts`

**Tasks:**
- [ ] `normalizeInput()` - trim, empty→undefined, phone format
- [ ] `validateRequiredFields()` - 8 required fields
- [ ] `validateConditionalFields()` - 3 conditional rules
- [ ] `buildNextQuestion()` - ภาษาไทยสั้น สุภาพ
- [ ] `validateFormData()` - main validation function
- [ ] Time validation (ไม่ย้อนหลัง, 06:00-20:00)
- [ ] Location validation (pickup ≠ dropoff)
- [ ] Phone regex validation

**Success Criteria:**
- ผ่าน validator tests
- คืน nextQuestion ภาษาไทยถูกต้อง

---

### 🔷 AGENT-3: Transformer Engine
**Scope:** Phase 3 only  
**Dependencies:** AGENT-1 (types.ts)  
**Output:** `src/agents/intake/transformer.ts`

**Tasks:**
- [ ] `transformToJobSpec()` - main transform
- [ ] `derivePriority()` - urgent/stretcher → high
- [ ] `estimateDuration()` - rule-based constants
- [ ] `estimateDistanceAndDuration()` - mock values
- [ ] `assessComplexity()` - simple/moderate/complex/critical
- [ ] `estimateCost()` - base + distance + duration
- [ ] `deriveResources()` - navigator, vehicle type
- [ ] Generate jobId: `WC-YYYYMMDD-XXXX`

**Success Criteria:**
- JobSpec output ครบทุก field
- Complexity rules ถูกต้อง

---

### 🔷 AGENT-4: Service Layer
**Scope:** Phase 4 only  
**Dependencies:** AGENT-1 (types), AGENT-2 (validator), AGENT-3 (transformer)  
**Output:** `src/agents/intake/service.ts`

**Tasks:**
- [ ] `previewIntake()` - normalize + validate + transform
- [ ] `submitIntake()` - POST with retry logic
- [ ] Error types: validation_error, network_error, server_error, unknown_error
- [ ] Retry 2-3 ครั้ง (network/timeout/5xx only)
- [ ] Config: base URL, timeout, retry settings
- [ ] Mock endpoint for dev
- [ ] PII protection (ไม่ log ดิบ)

**Success Criteria:**
- ไม่ retry 4xx errors
- Error classification ถูกต้อง

---

### 🔷 AGENT-5: Tests (Validator + Types)
**Scope:** Phase 8 (validator tests)  
**Dependencies:** AGENT-1, AGENT-2  
**Output:** `src/agents/intake/__tests__/validator.test.ts`

**Tasks:**
- [ ] Test required fields detection
- [ ] Test conditional fields logic
- [ ] Test normalizeInput
- [ ] Test phone/date normalization
- [ ] Test time validation rules
- [ ] Test location validation

**Success Criteria:**
- ผ่านทุก test cases
- Coverage > 80% for validator

---

### 🔷 AGENT-6: React Hook
**Scope:** Phase 5 only  
**Dependencies:** AGENT-1, AGENT-4 (service)  
**Output:** `src/agents/intake/useIntakeAgent.ts`

**Tasks:**
- [ ] Hook state: formData, isComplete, missingFields, nextQuestion, preview, loading, error, success
- [ ] `updateField(path, value)` - รองรับ nested
- [ ] `updateFields(partial)`
- [ ] `validateCurrentState()` - เรียก validator
- [ ] `previewJobSpec()` - เรียก service.preview
- [ ] `submitForm()` - เรียก service.submit
- [ ] `resetForm()`

**Success Criteria:**
- Hook ใช้งานได้ใน component
- ไม่ฝัง business logic ซ้ำ

---

### 🔷 AGENT-7: Tests (Transformer + Service)
**Scope:** Phase 8 (transformer + service tests)  
**Dependencies:** AGENT-3, AGENT-4  
**Output:** `src/agents/intake/__tests__/transformer.test.ts`, `service.test.ts`

**Tasks:**
- [ ] Test transformToJobSpec output shape
- [ ] Test complexity rules (4 levels)
- [ ] Test cost estimation
- [ ] Test priority derivation
- [ ] Test vehicle type logic
- [ ] Test service preview flow
- [ ] Test service submit flow
- [ ] Test retry behavior
- [ ] Test error classification

**Success Criteria:**
- ผ่านทุก test cases
- Coverage > 80%

---

### 🔷 AGENT-8: Demo Component
**Scope:** Phase 6 only  
**Dependencies:** AGENT-6 (hook)  
**Output:** `src/agents/intake/IntakeAgentDemo.jsx`

**Tasks:**
- [ ] Form fields: contact, service, schedule, locations, patient, addons
- [ ] ปุ่ม: Validate, Preview, Submit, Reset
- [ ] Display: nextQuestion, missingFields, JSON preview
- [ ] Display: success/error state, loading
- [ ] Basic styling (ใช้งานได้จริง)

**Success Criteria:**
- ใช้งานได้บน browser
- Flow ครบ: input → validate → preview → submit

---

### 🔷 AGENT-9: Integration & Module Exports
**Scope:** Phase 7 + Phase 9  
**Dependencies:** AGENT-1, AGENT-2, AGENT-3, AGENT-4, AGENT-6, AGENT-8  
**Output:** `src/agents/intake/index.ts`

**Tasks:**
- [ ] Export ทุก types
- [ ] Export validator functions
- [ ] Export transformer functions
- [ ] Export service functions
- [ ] Export hook
- [ ] Export demo component
- [ ] ตรวจ imports/exports ทั้งหมด
- [ ] รัน type checking
- [ ] รัน lint (ถ้ามี)

**Success Criteria:**
- ไม่มี import error
- `tsc --noEmit` ผ่าน

---

### 🔷 AGENT-10: Final Tests & Hook Tests
**Scope:** Phase 8 (hook tests + final integration tests)  
**Dependencies:** AGENT-6, AGENT-9  
**Output:** `src/agents/intake/__tests__/useIntakeAgent.test.ts`

**Tasks:**
- [ ] Test hook happy path (input → preview → submit)
- [ ] Test updateField
- [ ] Test validation flow in hook
- [ ] Integration test: ครบทุก phase
- [ ] Run all tests
- [ ] แก้ไข errors/warnings

**Success Criteria:**
- ทุก test ผ่าน
- พร้อมใช้งานจริง

---

## ⏱️ Timeline

```
Time (ชม.)
  0    1    2    3    4    5    6    7    8
  ├────┴────┴────┴────┴────┴────┴────┴────┤
  │
  │  AGENT-1 (Types) ████
  │
  │  AGENT-2 (Validator)    ████████
  │  AGENT-3 (Transformer)  ████████
  │  AGENT-5 (Tests-V)      ██████
  │
  │  AGENT-4 (Service)           ████████
  │
  │  AGENT-6 (Hook)                   ████████
  │  AGENT-7 (Tests-T/S)              ██████
  │
  │  AGENT-8 (Demo)                        ██████
  │
  │  AGENT-9 (Integration)                      ████
  │
  │  AGENT-10 (Tests-Hook)                           ████
  │
  └──────────────────────────────────────────────────────►

Parallel Groups:
- Group 1: AGENT-1 (1 ชม.)
- Group 2: AGENT-2, AGENT-3, AGENT-5 (2 ชม.)
- Group 3: AGENT-4 (2 ชม.)
- Group 4: AGENT-6, AGENT-7 (2 ชม.)
- Group 5: AGENT-8 (1.5 ชม.)
- Group 6: AGENT-9 (1 ชม.)
- Group 7: AGENT-10 (1 ชม.)

Total: ~7.5 ชม. (vs ~17 ชม. แบบ sequential)
```

---

## 📁 File Structure (Target)

```
src/agents/intake/
├── index.ts                      # AGENT-9
├── types.ts                      # AGENT-1
├── schema.ts                     # (มีอยู่แล้ว)
├── validator.ts                  # AGENT-2
├── transformer.ts                # AGENT-3
├── service.ts                    # AGENT-4
├── useIntakeAgent.ts             # AGENT-6
├── IntakeAgentDemo.jsx           # AGENT-8
└── __tests__/
    ├── validator.test.ts         # AGENT-5
    ├── transformer.test.ts       # AGENT-7
    ├── service.test.ts           # AGENT-7
    └── useIntakeAgent.test.ts    # AGENT-10
```

---

## 🔗 Dependencies Matrix

| Agent | Depends On | ถูกใช้โดย |
|-------|------------|----------|
| AGENT-1 (Types) | schema.ts | AGENT-2,3,4,5,6,7,10 |
| AGENT-2 (Validator) | AGENT-1 | AGENT-4,5 |
| AGENT-3 (Transformer) | AGENT-1 | AGENT-4,7 |
| AGENT-4 (Service) | AGENT-1,2,3 | AGENT-6,7 |
| AGENT-5 (Tests-V) | AGENT-1,2 | - |
| AGENT-6 (Hook) | AGENT-1,4 | AGENT-8,10 |
| AGENT-7 (Tests-T/S) | AGENT-3,4 | - |
| AGENT-8 (Demo) | AGENT-6 | - |
| AGENT-9 (Integration) | ทั้งหมด | - |
| AGENT-10 (Tests-Hook) | AGENT-6,9 | - |

---

## 🚀 Launch Command

```bash
# Phase 0: Discovery (ทำก่อนเริ่ม agents)
openclaw agent:digest welcares/intake-schema

# Parallel Group 1
openclaw agent:spawn AGENT-1 --task="Implement types.ts from schema"

# รอ AGENT-1 เสร็จ แล้ว Parallel Group 2
openclaw agent:spawn AGENT-2 --task="Implement validator.ts"
openclaw agent:spawn AGENT-3 --task="Implement transformer.ts"
openclaw agent:spawn AGENT-5 --task="Write validator tests"

# รอ AGENT-2,3 เสร็จ แล้ว Parallel Group 3
openclaw agent:spawn AGENT-4 --task="Implement service.ts"

# รอ AGENT-4 เสร็จ แล้ว Parallel Group 4
openclaw agent:spawn AGENT-6 --task="Implement useIntakeAgent.ts"
openclaw agent:spawn AGENT-7 --task="Write transformer+service tests"

# รอ AGENT-6 เสร็จ แล้ว Parallel Group 5
openclaw agent:spawn AGENT-8 --task="Implement IntakeAgentDemo.jsx"

# รอทั้งหมดเสร็จ แล้ว Parallel Group 6
openclaw agent:spawn AGENT-9 --task="Integration + index.ts exports"

# รอ AGENT-9 เสร็จ แล้ว Final
openclaw agent:spawn AGENT-10 --task="Final tests + validation"
```

---

## ✅ Success Criteria (รวม)

- [ ] ทุกไฟล์ compile ผ่าน (`tsc --noEmit`)
- [ ] Tests ผ่านทั้งหมด
- [ ] Demo component ใช้งานได้จริง
- [ ] ไม่มี business logic ใน component
- [ ] PII protection (ไม่ log ดิบ)
- [ ] พร้อมต่อยอด Dispatch Agent

---

*Plan created: 2026-04-09*  
*Target: Reduce 17h → 7.5h via parallel execution*
