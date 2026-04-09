# AI Data Access Policy

เอกสารกำหนดนโยบายการเข้าถึงข้อมูล PII (Personally Identifiable Information) และ PHI (Protected Health Information) ของ AI Agents แต่ละตัว

---

## ข้อมูลที่จัดประเภท

### PII (Personally Identifiable Information)
- ชื่อ-นามสกุล
- ที่อยู่
- เบอร์โทรศัพท์
- อีเมล
- เลขบัตรประชาชน
- รูปถ่าย

### PHI (Protected Health Information)
- ประวัติการรักษา
- อาการป่วย
- ใบสั่งยา
- ผลตรวจ
- ข้อมูลประกันสุขภาพ
- ข้อมูล caregiver/family

---

## Data Classification Matrix

| ข้อมูล | ประเภท | ความละเอียดอ่อน | การเข้ารหัส |
|--------|--------|-----------------|-------------|
| ชื่อ-นามสกุล | PII | สูง | Mask in logs |
| เลขบัตรประชาชน | PII | สูงมาก | Encrypt at rest |
| ที่อยู่ | PII | สูง | Mask in prompts |
| เบอร์โทรศัพท์ | PII | สูง | Mask in logs |
| อาการป่วย | PHI | สูงมาก | Anonymize for analytics |
| ใบสั่งยา | PHI | สูงมาก | Encrypt at rest |
| ประวัติการรักษา | PHI | สูงมาก | Role-based access |
| ข้อมูลญาติ | PII | ปานกลาง | Mask in prompts |

---

## Agent Access Matrix

```
┌─────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│     Data Type       │  Intake  │ Dispatch │ Navigate │  Family  │  Safety  │ Summary  │ CostMeter│
├─────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Patient Name        │   R/O    │   R/O    │   R/O    │   R/O    │   R/O    │   R/O    │   R/O    │
│ Patient Address     │   FULL   │   MASK   │   FULL   │   DENY   │   MASK   │   MASK   │   DENY   │
│ Patient Phone       │   FULL   │   MASK   │   MASK   │   DENY   │   FULL   │   MASK   │   DENY   │
│ ID Number           │   MASK   │   DENY   │   DENY   │   DENY   │   DENY   │   MASK   │   DENY   │
│ Medical History     │   HIGH   │   DENY   │   DENY   │   LOW    │   HIGH   │   HIGH   │   DENY   │
│ Current Symptoms    │   HIGH   │   DENY   │   LOW    │   LOW    │   HIGH   │   HIGH   │   DENY   │
│ Medications         │   HIGH   │   DENY   │   LOW    │   DENY   │   HIGH   │   HIGH   │   DENY   │
│ Provider Name       │   DENY   │   FULL   │   FULL   │   R/O    │   FULL   │   FULL   │   R/O    │
│ Provider Location   │   DENY   │   FULL   │   FULL   │   DENY   │   FULL   │   MASK   │   DENY   │
│ Trip Details        │   R/O    │   FULL   │   FULL   │   R/O    │   FULL   │   FULL   │   FULL   │
│ Cost/Billing        │   LOW    │   DENY   │   DENY   │   DENY   │   DENY   │   FULL   │   FULL   │
│ Family Contact      │   R/O    │   DENY   │   DENY   │   FULL   │   FULL   │   MASK   │   DENY   │
└─────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

LEGEND:
  FULL  = Full access (read/write as needed)
  R/O   = Read-only access
  MASK  = Masked/anonymized access
  HIGH  = High-level summary only
  LOW   = Low-detail access
  DENY  = No access allowed
```

---

## รายละเอียดตาม Agent

### 1. Intake Agent - Access Level: STANDARD

**ข้อมูลที่เข้าถึงได้:**
- Patient Name (R/O)
- Patient Address (FULL - ต้องรู้เพื่อบริการ)
- Patient Phone (FULL)
- ID Number (MASK - ตรวจสอบสิทธิ์)
- Medical History (HIGH - เฉพาะข้อมูลที่จำเป็นต่อการบริการ)
- Current Symptoms (HIGH)
- Medications (HIGH)

**Masking Rules:**
```python
# ID Number: 1-2345-67890-12-1 → 1-****-*****-**-*
# Phone: 081-234-5678 → 081-***-****
```

**ข้อมูลที่ห้าม:**
- รายละเอียดการรักษาเต็มรูปแบบ
- ข้อมูลทางการเงิน
- ข้อมูล provider คนอื่น

---

### 2. Dispatch Agent - Access Level: LIMITED

**ข้อมูลที่เข้าถึงได้:**
- Patient Name (R/O - แสดงให้ provider)
- Service Type (FULL)
- Location Coordinates (FULL - ต้องรู้เพื่อ dispatch)
- Special Requirements (FULL)
- Provider Information (FULL)

**Masking Rules:**
```python
# Address: 123/45 ถนนสุขุมวิท → [MASKED_ADDRESS_HASH]
# ใช้ coordinate แทน full address
```

**ข้อมูลที่ห้าม:**
- PHI ทั้งหมด
- ประวัติการรักษา
- ข้อมูลทางการแพทย์

---

### 3. Navigation Agent - Access Level: OPERATIONAL

**ข้อมูลที่เข้าถึงได้:**
- Location Data (FULL - GPS coordinates)
- Route Information (FULL)
- Trip Status (FULL)
- Provider Location (FULL)
- ETA Calculations (FULL)

**Masking Rules:**
```python
# ใช้ location hash แทน full address
# แสดงเฉพาะระยะทางและเวลา ไม่แสดงชื่อสถานที่
```

**ข้อมูลที่ห้าม:**
- ข้อมูลส่วนตัวของผู้ป่วย
- PHI

---

### 4. Family Update Agent - Access Level: COMMUNICATION

**ข้อมูลที่เข้าถึงได้:**
- Patient Name (R/O - ชื่อที่ญาติรู้จัก)
- Trip Status (R/O)
- Milestone Events (R/O)
- Family Contact Info (FULL)

**Masking Rules:**
```python
# ห้าม disclose:
# - รายละเอียดทางการแพทย์
# - อาการที่ไม่เกี่ยวข้อง
# - ข้อมูล provider
# - เส้นทางละเอียด
```

**Approved Message Templates:**
- "คุณ [NAME] ถูกรับตัวที่บ้านเรียบร้อยแล้ว"
- "กำลังเดินทางไปโรงพยาบาลตามกำหนดเวลา"
- "ถึงโรงพยาบาลแล้ว"

---

### 5. Safety Agent - Access Level: EMERGENCY

**ข้อมูลที่เข้าถึงได้:**
- ทุกข้อมูลในกรณีฉุกเฉิน
- Patient Name (FULL)
- Location (FULL)
- Contact Info (FULL)
- Medical History (FULL - ประวัติแพ้ยา, โรคประจำตัว)
- Current Vitals (FULL - ถ้ามี)
- Provider Info (FULL)

**Override Conditions:**
- Panic button pressed
- Safety risk detected
- Emergency protocol activated

**Audit Requirements:**
- ทุกการเข้าถึงต้อง log
- ต้องระบุเหตุผล
- Review ภายใน 24 ชั่วโมง

---

### 6. Summary Agent - Access Level: ANALYTICS

**ข้อมูลที่เข้าถึงได้:**
- Trip Data (FULL)
- Service Details (FULL)
- Timestamps (FULL)
- Provider Report (FULL)
- Cost Data (FULL)

**Anonymization for Storage:**
```python
# ก่อนบันทึกสำหรับ analytics:
# - Hash patient_id
# - Remove exact timestamps (keep relative)
# - Generalize locations (region level)
```

---

### 7. Cost Meter Agent - Access Level: BILLING

**ข้อมูลที่เข้าถึงได้:**
- Service Type (FULL)
- Distance/Duration (FULL)
- Billing Codes (FULL)
- Insurance Info (FULL)
- Token Usage (FULL)

**ข้อมูลที่ห้าม:**
- PHI ทั้งหมด
- รายละเอียดทางการแพทย์
- ข้อมูลส่วนตัวที่ไม่จำเป็นต่อการคำนวณ

---

## Prompt Data Filtering

### Pre-Processing Rules

```javascript
const dataFilter = {
  // ก่อนส่งข้อมูลเข้า LLM
  beforeLLM: (data, agentType) => {
    // 1. ตรวจสอบ agent permission
    const allowedFields = getAllowedFields(agentType);
    
    // 2. Mask sensitive data
    const masked = maskSensitiveData(data, allowedFields);
    
    // 3. Add audit metadata
    masked._audit = {
      agent: agentType,
      timestamp: new Date().toISOString(),
      fields_accessed: Object.keys(masked)
    };
    
    return masked;
  }
};
```

### Masking Functions

```python
def mask_id_number(id_num: str) -> str:
    """1-2345-67890-12-1 → 1-****-*****-**-*"""
    parts = id_num.split('-')
    return f"{parts[0]}-****-*****-**-*"

def mask_phone(phone: str) -> str:
    """081-234-5678 → 081-***-****"""
    return phone[:7] + "-****"

def mask_address(address: str) -> str:
    """123/45 ถนนสุขุมวิท → [ADDRESS_MASKED]"""
    return "[ADDRESS_MASKED]"

def anonymize_patient_id(patient_id: str) -> str:
    """PT-12345 → hash"""
    return hashlib.sha256(patient_id.encode()).hexdigest()[:16]
```

---

## Logging Policy

### What CAN be logged
- Agent decisions (without PII)
- Performance metrics
- Error types (without details)
- Token usage
- State transitions

### What CANNOT be logged
- Full names
- Addresses
- Phone numbers
- Medical details
- ID numbers
- Full prompts with sensitive data

### Log Format
```json
{
  "timestamp": "2025-04-09T10:00:00Z",
  "agent": "IntakeAgent",
  "action": "intent_classified",
  "trip_id": "TRP-xxx",
  "patient_id_hash": "abc123...",
  "decision": "BOOK_TRIP",
  "confidence": 0.92,
  "latency_ms": 245
}
```

---

## Audit Trail

### Required Audit Events

| Event | Data to Log | Retention |
|-------|-------------|-----------|
| PHI Access | Agent, Time, Reason, Fields | 7 years |
| PII Access | Agent, Time, Purpose | 3 years |
| Safety Override | Full context, Trigger reason | 7 years |
| Export/Report | User, Time, Data scope | 3 years |
| Consent Change | User, Time, Change type | Permanent |

---

## Compliance Checklist

### PDPA (Thailand)
- [ ] ได้รับ consent จากผู้ใช้
- [ ] มีวัตถุประสงค์ชัดเจน
- [ ] จำกัดการใช้ตามวัตถุประสงค์
- [ ] มีระบบลบข้อมูลตามคำขอ
- [ ] แจ้งการใช้ข้อมูล AI

### Healthcare Standards
- [ ] HIPAA-aligned practices
- [ ] Audit logging
- [ ] Encryption at rest & transit
- [ ] Access controls
- [ ] Incident response plan

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-04-09 | Initial access policy definition |
