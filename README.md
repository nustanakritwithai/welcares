# WelCares - AI-Powered Healthcare Coordination Platform

แพลตฟอร์มบริการสุขภาพอัจฉริยะ ที่ผสาน AI Agents เข้ากับระบบจัดการงานบริการสุขภาพแบบครบวงจร

## ภาพรวมระบบ

WelCares เป็นแพลตฟอร์มที่เชื่อมต่อผู้ใช้บริการสุขภาพกับผู้ให้บริการ (คนขับ ผู้ดูแล พยาบาล) ผ่าน AI Agents 7 ตัวที่ทำงานประสานกัน

### Core Services
- **Trip Service** - จองและจัดการการเดินทาง
- **Medicine Delivery** - ส่งยาถึงที่
- **Home Care** - ดูแลผู้ป่วยที่บ้าน
- **Identity & Verification** - ยืนยันตัวตนและสิทธิ์
- **Hospital Integration** - เชื่อมโรงพยาบาล
- **Billing & Payments** - คิดค่าบริและชำระเงิน
- **Notification System** - แจ้งเตือนทุกช่องทาง

## AI Architecture Documentation

เอกสารออกแบบโครงสร้าง AI ทั้งหมดอยู่ใน [`docs/ai-architecture/`](./docs/ai-architecture/)

| เอกสาร | รายละเอียด |
|--------|-----------|
| [01-agent-responsibility-matrix.md](./docs/ai-architecture/01-agent-responsibility-matrix.md) | กำหนดหน้าที่ ขอบเขต และการส่งต่องานของแต่ละ Agent |
| [02-workflow-state-machine.md](./docs/ai-architecture/02-workflow-state-machine.md) | State machine และ workflow การทำงานของระบบ |
| [03-ai-data-access-policy.md](./docs/ai-architecture/03-ai-data-access-policy.md) | นโยบายการเข้าถึงข้อมูล PII/PHI ของแต่ละ Agent |
| [04-llm-routing-policy.md](./docs/ai-architecture/04-llm-routing-policy.md) | กลยุทธ์เลือกโมเดล คุมต้นทุน และ fallback |
| [05-ai-observability-dashboard.md](./docs/ai-architecture/05-ai-observability-dashboard.md) | KPI และ dashboard สำหรับ monitoring |

## Tech Stack

### Frontend
- React + Vite
- TailwindCSS
- React Query / SWR

### Backend & AI
- Microservices Architecture
- Event-Driven (RabbitMQ / Apache Kafka)
- AI Agents (7 specialized agents)
- LLM Gateway with cost optimization

### Infrastructure
- Docker + Kubernetes
- Prometheus + Grafana
- Jaeger (distributed tracing)
- Multi-region deployment ready

## เริ่มต้นใช้งาน

```bash
# ติดตั้ง dependencies
npm install

# รัน development server
npm run dev

# Build สำหรับ production
npm run build
```

## Project Status

🚧 **กำลังพัฒนา** - Phase 1: AI Architecture Design

---
*Built with ❤️ for better healthcare coordination*
