# AI Agent Responsibility Matrix

เอกสารกำหนดหน้าที่ ขอบเขต input/output และการส่งต่องานของ AI Agents ทั้ง 7 ตัวในระบบ WelCares

---

## ภาพรวม Agents

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Central Orchestrator                              │
│                    (State Machine + Event Router)                          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
    ┌────┴────┬──────────┬──────────┬──────────┬──────────┬──────────┐
    │         │          │          │          │          │          │
┌───▼───┐ ┌──▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼─────┐
│Intake │ │Dispatch│ │Navigate│ │Family  │ │Safety  │ │Summary │ │Cost    │
│Agent  │ │Agent   │ │Agent   │ │Update  │ │Agent   │ │Agent   │ │Meter   │
│       │ │        │ │        │ │Agent   │ │        │ │        │ │Agent   │
└───────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └─────────┘
```

---

## 1. Intake Agent

### หน้าที่หลัก
รับเรื่องจากผู้ใช้และแปลงเป็นข้อมูลโครงสร้างที่ระบบใช้ได้

### Input ที่รับ
| แหล่งข้อมูล | รูปแบบ | ตัวอย่าง |
|------------|--------|----------|
| Chat message | Text | "อยากจองรถไปโรงพยาบาลพรุ่งนี้ 9 โมง" |
| Voice message | Audio → STT | "ส่งยาที่บ้านให้หน่อย" |
| Form submission | Structured JSON | Form กรอกข้อมูล |
| External system | API payload | ข้อมูลจากโรงพยาบาล |

### Output ที่ต้องคืน
```json
{
  "intent": "BOOK_TRIP | MEDICINE_DELIVERY | HOME_CARE | INQUIRY",
  "extracted_entities": {
    "service_type": "string",
    "datetime": "ISO8601",
    "location": { "lat": number, "lng": number, "address": "string" },
    "patient_id": "string",
    "special_requirements": ["string"],
    "urgency_level": "ROUTINE | URGENT | EMERGENCY"
  },
  "confidence_score": 0.0-1.0,
  "missing_required_fields": ["string"],
  "clarification_needed": boolean,
  "clarification_question": "string"
}
```

### ขอบเขตที่ชัดเจน
| ทำได้ ✅ | ห้ามทำ ❌ |
|---------|----------|
| ถามข้อมูลที่ขาดหาย | ยืนยันการจองโดยตรง |
| Classify intent | เรียกคนขับ/ผู้ดูแล |
| Extract entities | ประมาณราคาเอง |
| ตรวจสอบสิทธิ์เบื้องต้น | เข้าถึง PHI ละเอียด |

### การส่งต่อ
- ข้อมูลครบ → ส่งต่อ `Dispatch Agent`
- ข้อมูลไม่ครบ → ถามกลับผู้ใช้
- Urgency = EMERGENCY → แจ้ง `Safety Agent` ทันที
- Intent ไม่ชัด → Fallback ให้คนรับเรื่อง

---

## 2. Dispatch Agent

### หน้าที่หลัก
ช่วยจัดคนขับ/ผู้ดูแลตามเงื่อนไขงาน โดยพิจารณาจาก availability, skills, location และ constraint

### Input ที่รับ
```json
{
  "service_request": {
    "type": "TRIP | MEDICINE | HOME_CARE",
    "datetime": "ISO8601",
    "pickup_location": { "lat": number, "lng": number },
    "destination": { "lat": number, "lng": number },
    "special_requirements": ["WHEELCHAIR", "OXYGEN", "ACCOMPANY_NURSE"]
  },
  "available_providers": [
    { "id": "string", "type": "DRIVER | CAREGIVER | NURSE", "location": {}, "skills": [] }
  ],
  "constraints": {
    "max_wait_time_minutes": number,
    "preferred_gender": "MALE | FEMALE | ANY",
    "language_preference": ["th", "en"]
  }
}
```

### Output ที่ต้องคืน
```json
{
  "dispatch_decision": {
    "provider_id": "string",
    "provider_type": "DRIVER | CAREGIVER | NURSE",
    "confidence": 0.0-1.0,
    "estimated_arrival": "ISO8601",
    "reasoning": "string"
  },
  "alternatives": [
    { "provider_id": "string", "eta": "ISO8601" }
  ],
  "fallback_required": boolean,
  "human_approval_needed": boolean
}
```

### ขอบเขตที่ชัดเจน
| ทำได้ ✅ | ห้ามทำ ❌ |
|---------|----------|
| แนะนำ provider ที่เหมาะสม | กำหนดราคาขั้นสุดท้าย |
| คำนวณ ETA | เปลี่ยน provider ที่ยืนยันแล้ว |
| จัดลำดับตาม suitability score | ตัดสินใจแทน provider |

### การส่งต่อ
- เจอ provider เหมาะสม → ส่งต่อ `Navigation Agent`
- ไม่มี provider → แจ้งระบบ + แจ้งผู้ใช้
- Human approval flag = true → รอคนยืนยัน

---

## 3. Navigation Agent

### หน้าที่หลัก
ดูแลเรื่องเส้นทาง เวลา จุดรับส่ง และ real-time tracking

### Input ที่รับ
```json
{
  "trip_id": "string",
  "provider_location": { "lat": number, "lng": number },
  "pickup_location": { "lat": number, "lng": number },
  "destination": { "lat": number, "lng": number },
  "traffic_data": {},
  "patient_condition": "STABLE | NEED_MONITORING | CRITICAL"
}
```

### Output ที่ต้องคืน
```json
{
  "route_optimization": {
    "recommended_route": {},
    "estimated_duration_minutes": number,
    "estimated_arrival": "ISO8601",
    "alternative_routes": []
  },
  "updates": {
    "current_location": {},
    "remaining_distance_km": number,
    "delay_prediction_minutes": number,
    "notification_triggers": []
  }
}
```

---

## 4. Family Update Agent

### หน้าที่หลัก
สรุปสถานะและส่งข้อความอัปเดตให้ญาติผู้ใช้บริการ

### Input ที่รับ
```json
{
  "trip_status": "PICKED_UP | EN_ROUTE | ARRIVED | COMPLETED",
  "patient_status": "NORMAL | NEED_ATTENTION",
  "provider_notes": "string",
  "family_preferences": {
    "notification_channel": "SMS | LINE | APP_PUSH",
    "language": "th | en",
    "update_frequency": "REALTIME | MILESTONE"
  }
}
```

### Output ที่ต้องคืน
```json
{
  "update_message": {
    "th": "คุณแม่ถูกรับตัวที่บ้านเรียบร้อยแล้ว กำลังเดินทางไปโรงพยาบาล...",
    "en": "Your mother has been picked up and is en route to the hospital..."
  },
  "message_tone": "REASSURING | INFORMATIVE | URGENT",
  "recommended_channel": "SMS | LINE | CALL"
}
```

### ข้อควรระวัง
- ห้าม disclose PHI ที่ละเอียดเกินไป
- ต้อง respect ความเป็นส่วนตัวของผู้ป่วย

---

## 5. Safety Agent

### หน้าที่หลัก
ตรวจจับความผิดปกติหรือความเสี่ยง และ trigger การตอบสนองฉุกเฉิน

### Input ที่รับ
```json
{
  "event_type": "DELAY_ANOMALY | PATIENT_DISTRESS | PROVIDER_ALERT | SYSTEM_FAILURE",
  "context": {
    "trip_id": "string",
    "current_location": {},
    "elapsed_time": number,
    "patient_vitals": {} // ถ้ามี
  }
}
```

### Output ที่ต้องคืน
```json
{
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "recommended_action": "MONITOR | CONTACT_PROVIDER | ALERT_FAMILY | EMERGENCY_DISPATCH",
  "alert_message": "string",
  "escalation_required": boolean,
  "escalation_target": "SUPERVISOR | EMERGENCY_TEAM | FAMILY"
}
```

### Trigger Conditions
| สถานการณ์ | ระดับ | การตอบสนอง |
|-----------|-------|-----------|
| Delay > 30 min จาก ETA | MEDIUM | แจ้งครอบครัว |
| Provider กด panic button | HIGH | แจ้ง supervisor + ติดต่อ 1669 |
| Patient vitals ผิดปกติ | CRITICAL | Emergency dispatch |
| No GPS update > 15 min | MEDIUM | โทรหา provider |

---

## 6. Summary Agent

### หน้าที่หลัก
สรุปงานหลังจบเคส สำหรับบันทึกและส่งต่อหน่วยงานที่เกี่ยวข้อง

### Input ที่รับ
```json
{
  "trip_data": {},
  "provider_report": "string",
  "feedback_scores": {},
  "incidents": [],
  "billing_data": {}
}
```

### Output ที่ต้องคืน
```json
{
  "case_summary": {
    "service_type": "string",
    "duration": "string",
    "outcome": "SUCCESS | PARTIAL | FAILED",
    "key_events": [],
    "patient_condition_end": "string"
  },
  "follow_up_recommendations": [],
  "billing_summary": {},
  "quality_score": 0-100
}
```

---

## 7. Cost Meter Agent

### หน้าที่หลัก
คำนวณต้นทุน/ค่าบริการแบบ real-time และ optimize AI cost

### Input ที่รับ
```json
{
  "service_type": "TRIP | MEDICINE | HOME_CARE",
  "distance_km": number,
  "duration_minutes": number,
  "special_requirements": [],
  "patient_tier": "STANDARD | PREMIUM | CORPORATE",
  "ai_token_usage": { "model": "string", "tokens": number }
}
```

### Output ที่ต้องคืน
```json
{
  "cost_breakdown": {
    "base_service_fee": number,
    "distance_fee": number,
    "special_requirements_fee": number,
    "ai_processing_cost": number,
    "total_estimate": number
  },
  "billing_code": "string",
  "insurance_coverage": { "covered": number, "patient_pay": number }
}
```

### AI Cost Tracking
- บันทึก token usage ต่อ agent
- คำนวณ cost per job
- Alert เมื่อเกิน budget

---

## Agent Interaction Flow

```
User Request
     │
     ▼
┌─────────────┐
│Intake Agent │ ──ข้อมูลไม่ครบ──▶ ถามกลับผู้ใช้
└──────┬──────┘
       │ ข้อมูลครบ
       ▼
┌──────────────┐
│Dispatch Agent│ ──ไม่มี provider──▶ แจ้งไม่สามารถให้บริการ
└──────┬───────┘
       │ เจอ provider
       ▼
┌───────────────┐
│Navigation Agent│ ◀──ติดตามตลอด──▶ Real-time Updates
└───────┬───────┘
        │
        ▼
┌─────────────────┐
│Family Update Agent│ ──ส่งอัปเดต──▶ ญาติ
└─────────────────┘
        │
   เกิดเหตุผิดปกติ
        ▼
┌──────────────┐
│Safety Agent  │ ──ฉุกเฉิน──▶ แจ้ง 1669 / Supervisor
└──────────────┘
        │
   จบงาน
        ▼
┌──────────────┐     ┌──────────────┐
│Summary Agent │────▶│Cost Meter    │
└──────────────┘     └──────────────┘
```

---

## Fallback Rules

| สถานการณ์ | การตอบสนอง |
|-----------|-----------|
| AI confidence < 0.7 | ส่งต่อคนตรวจสอบ |
| Intent ไม่ชัด | ถามกลับผู้ใช้ สูงสุด 2 รอบ |
| ข้อมูล sensitive | ต้องมีคน approve ก่อนดำเนินการ |
| Emergency detected | Override AI → คนคุมทันที |
| System error | Fallback to manual process |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-04-09 | Initial matrix definition |
