# WelCares AI Architecture

เอกสารออกแบบโครงสร้าง AI สำหรับ Healthcare Coordination Platform

---

## เอกสารทั้งหมด

| ลำดับ | เอกสาร | สาระสำคัญ |
|-------|--------|-----------|
| 1 | [Agent Responsibility Matrix](./01-agent-responsibility-matrix.md) | กำหนดหน้าที่ ขอบเขต input/output ของ 7 AI Agents |
| 2 | [Workflow State Machine](./02-workflow-state-machine.md) | State machine และ workflow การทำงานหลักของระบบ |
| 3 | [AI Data Access Policy](./03-ai-data-access-policy.md) | นโยบายการเข้าถึงข้อมูล PII/PHI |
| 4 | [LLM Routing Policy](./04-llm-routing-policy.md) | กลยุทธ์เลือกโมเดล คุมต้นทุน และ fallback |
| 5 | [AI Observability Dashboard](./05-ai-observability-dashboard.md) | KPI และ dashboard สำหรับ monitoring |

---

## ภาพรวมระบบ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WELCARES PLATFORM                              │
│                     AI-Powered Healthcare Coordination                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USERS                    AI ORCHESTRATION LAYER                  PROVIDERS │
│  ─────                    ──────────────────────                  ───────── │
│                                                                             │
│  ┌─────────┐             ┌─────────────────────────┐            ┌─────────┐ │
│  │ Patients│────────────▶│   Central Orchestrator  │───────────▶│ Drivers │ │
│  └─────────┘             │   (State Machine +      │            └─────────┘ │
│       │                  │    Event Router)        │            ┌─────────┐ │
│       │                  └───────────┬─────────────┘───────────▶│Caregiver│ │
│       │                              │                         └─────────┘ │
│       ▼                              │                                     │
│  ┌─────────┐                         ▼                                     │
│  │ Family  │              ┌─────────────────────┐                          │
│  │ Members │◀────────────│  7 AI Agents        │                          │
│  └─────────┘             │                     │                          │
│                          │  1. Intake          │                          │
│                          │  2. Dispatch        │                          │
│  HOSPITALS               │  3. Navigation      │                          │
│  ─────────               │  4. Family Update   │                          │
│                          │  5. Safety          │                          │
│  ┌─────────┐             │  6. Summary         │                          │
│  │  HIS    │◀───────────▶│  7. Cost Meter      │                          │
│  │ Systems │             └─────────────────────┘                          │
│  └─────────┘                                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         INFRASTRUCTURE LAYER                                │
│  LLM Gateway │ Event Bus │ Data Services │ Security │ Observability         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Services Integration

| Service | AI Agents Involved | Description |
|---------|-------------------|-------------|
| Trip Service | Intake, Dispatch, Navigation, Family, Safety | จองและจัดการการเดินทาง |
| Medicine Delivery | Intake, Dispatch, Navigation, Family, Cost | ส่งยาถึงที่ |
| Home Care | All agents | ดูแลผู้ป่วยที่บ้าน |
| Identity & Verification | Intake, Safety | ยืนยันตัวตนและสิทธิ์ |
| Hospital Integration | Summary | เชื่อมโรงพยาบาล |
| Billing | Cost Meter, Summary | คิดค่าบริการ |
| Notification | Family Update | แจ้งเตือนทุกช่องทาง |

---

## หลักการออกแบบ

### 1. Separation of Concerns
แต่ละ Agent มีหน้าที่ชัดเจน ไม่ซ้อนทับกัน

### 2. State-Driven Workflow
AI เดินตาม state machine ไม่ใช่ prompt อย่างเดียว

### 3. Data Security by Design
PII/PHI ถูกควบคุมตั้งแต่ระดับ Agent

### 4. Cost Optimization
Model selection ตามความซับซ้อนงาน + fallback strategy

### 5. Observability First
ทุกการตัดสินใจวัดผลและตรวจสอบได้

---

## สถานะปัจจุบัน

- [x] Agent Responsibility Matrix
- [x] Workflow State Machine
- [x] Data Access Policy
- [x] LLM Routing Policy
- [x] Observability Dashboard Spec

---

## ขั้นตอนต่อไป

1. **Implementation Phase**
   - [ ] Set up LLM Gateway
   - [ ] Implement Central Orchestrator
   - [ ] Build Agent services
   - [ ] Integrate with core services

2. **Testing Phase**
   - [ ] Unit tests for each agent
   - [ ] Integration tests
   - [ ] Load testing
   - [ ] Security audit

3. **Deployment Phase**
   - [ ] Staging environment
   - [ ] Production rollout
   - [ ] Monitoring setup
   - [ ] Documentation

---

*Last updated: 2025-04-09*
