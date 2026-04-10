# ตัวอย่างการใช้งาน Chat Booking Agent

ไฟล์นี้ให้ตัวอย่างวิธีการใช้งาน Chat Booking Agent ที่เราสร้างขึ้นในโครงการ WelCares

## การตั้งค่าและเริ่มต้นใช้งาน

### 1. การนำเข้าและสร้างอินสแตนซ์
```typescript
import { ChatBookingAgent } from './src/agents';

// การตั้งค่า Agent
const agentConfig = {
  model: 'nvidia/nemotron-3-super-120b-a12b:free', // หรือโมเดลอื่นที่ต้องการใช้
  temperature: 0.3,           // ความคิดสร้างสรรค์ (0.0 - 1.0)
  maxTokens: 500,             // จำนวนโทเค็นสูงสุดต่อการเรียก
  timeoutMs: 5000,            // เวลาหมดเวลา (มิลลิวินาที)
  retryAttempts: 3            // จำนวนครั้งที่จะลองใหม่เมื่อล้มเหลว
};

const chatBookingAgent = new ChatBookingAgent(agentConfig);
```

### 2. การเตรียมข้อมูลนำเข้า
```typescript
const input = {
  requestId: 'req-' + Date.now(), // รหัสคำขอที่ไม่ซ้ำกัน
  timestamp: new Date().toISOString(), // เวลาปัจจุบัน
  message: 'อยากจองรถไปโรงพยาบาลพรุ่งนี้ 9 โมงพร้อมวีลแชร์', // ข้อความจากผู้ใช้
  context: {
    // บริบทเพิ่มเติม (ทางเลือก)
    bookingType: 'TRIP', // ประเภทบริการที่สงสัยว่าอาจจะเป็น
    userId: 'user-123',  // รหัสผู้ใช้ (ถ้ามี)
    sessionId: 'session-456', // รหัสเซสชัน (ถ้ามี)
    files: [             // ไฟล์ที่แนบมา (ถ้ามี)
      {
        name: 'location-map.jpg',
        type: 'image/jpeg',
        size: 204800,
        content: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFRUWFhUVFRUWFhUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGi0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKAAQAMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAAABQIDBAUGBwj/xABEEAABAwIDBQQFBQcAAAAAAAABAgMEEQUREiExBkFREyJhcYGRBxQiQtEVNFKykqGx0RVDYnKCksIVJPH/xAAaAQEAAwEBAQAAAAAAAAAAAAAAAQIDBAUG/8QAKhEAAgIBBAIDAQEBAAAAAAAAAAERAAQTIjEFEFFhcYGR8A/8QAHREAAgEBAQADAQAAAAAAAAAAAAERAiEFUWH/2gAMAwEAAhEDEQA/APx...'
      },
      {
        name: 'patient-info.txt',
        type: 'text/plain',
        size: 1024,
        content: 'ชื่อ: นายทดสอบ รักษ์ดี\nอายุ: 65 ปี\nโรคประจำตัว: เบาหวาน ความดันโลหิตสูง\nโทร: 081-234-5678'
      }
    ]
  }
};
```

### 3. การประมวลผลคำขอ
```typescript
// วิธีที่ 1: ใช้ Promise แบบธรรมดา
chatBookingAgent.process(input)
  .then(result => {
    console.log('ผลลัพธ์:', JSON.stringify(result, null, 2));
    // จัดการผลลัพธ์ตามที่ต้องการ
  })
  .catch(error => {
    console.error('เกิดข้อผิดพลาด:', error);
  });

// วิธีที่ 2: ใช้ async/await (แนะนำ)
async function handleBookingRequest() {
  try {
    const result = await chatBookingAgent.process(input);
    
    if (result.success) {
      // การประมวลผลสำเร็จ
      console.log('เจตนา:', result.intent);
      console.log('ความเชื่อมั่น:', result.confidence_score);
      
      if (result.clarification_needed) {
        // ต้องการข้อมูลเพิ่มเติมจากผู้ใช้
        console.log('ต้องการข้อมูลเพิ่ม:', result.clarification_question);
        // แสดงคำถามให้ผู้ใช้ตอบ
      } else {
        // มีข้อมูลครบถ้วน สามารถดำเนินการต่อได้
        console.log('ข้อมูลที่สกัดออกมา:', result.extracted_entities);
        
        // ดำเนินการตาม suggested_actions ถ้ามี
        if (result.suggested_actions && result.suggested_actions.length > 0) {
          for (const action of result.suggested_actions) {
            console.log('การกระทำที่แนะนำ:', action.description);
            // เรียกใช้ API หรือดำเนินการตามที่เหมาะสม
          }
        }
        
        // จัดการผลลัพธ์จากการใช้สกิล
        if (result.skills_used && result.skills_used.length > 0) {
          for (const skill of result.skills_used) {
            if (skill.success) {
              console.log(`สกิล ${skill.skill_name} ทำงานสำเร็จ`);
              // ใช้ผลลัพธ์จากสกิลถ้าจำเป็น
            } else {
              console.error(`สกิล ${skill.skill_name} ล้มเหลว:`, skill.error);
            }
          }
        }
        
        // จัดการการทำงานกับไฟล์
        if (result.file_operations && result.file_operations.length > 0) {
          for (const fileOp of result.file_operations) {
            if (fileOp.success) {
              console.log(`การทำงานกับไฟล์ ${fileOp.operation} สำเร็จ`);
            } else {
              console.error(`การทำงานกับไฟล์ ${fileOp.operation} ล้มเหลว:`, fileOp.error);
            }
          }
        }
      }
    } else {
      // การประมวลผลล้มเหลว
      console.error('การประมวลผลล้มเหลว:', result.error);
      // อาจต้องแจ้งผู้ใช้หรือบันทึกข้อผิดพลาด
    }
    
    return result;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดที่ไม่คาดคิด:', error);
    throw error;
  }
}

// เรียกใช้ฟังก์ชัน
handleBookingRequest();
```

## ตัวอย่างการใช้งานจริงในสถานการณ์ต่างๆ

### ตัวอย่างที่ 1: การจองรถพยาบาลพร้อมไฟล์แนบ
```typescript
const ambulanceBookingInput = {
  requestId: 'amb-001',
  timestamp: new Date().toISOString(),
  message: 'ด่วน! ต้องการรถพยาบาลไปรับผู้ป่วยฉุกเฉินที่บ้านเลขที่ 123 หมู่ 4 ตำบลท่าทอง อำเภอเมือง จังหวัดสุราษฎร์ธานี ตอนนี้เลยครับ ผู้ป่วยมีอาการหายใจเหนื่อย หอบ เหนื่อยง่าย',
  context: {
    bookingType: 'TRIP',
    urgency: 'EMERGENCY',
    files: [
      {
        name: 'emergency-location.jpg',
        type: 'image/jpeg',
        size: 512000,
        content: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFRUWFhUVFRUWFhUVFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGi0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKAAQAMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAAABQIDBAUGBwj/xABEEAABAwIDBQQFBQcAAAAAAAABAgMEEQUREiExBkFREyJhcYGRBxQiQtEVNFKykqGx0RVDYnKCksIVJPH/xAAaAQEAAwEBAQAAAAAAAAAAAAAAAQIDBAUG/8QAKhEAAgIBBAIDAQEBAAAAAAAAAAERAAQTIjEFEFFhcYGR8A/8QAHREAAgEBAQADAQAAAAAAAAAAAAERAiEFUWH/2gAMAwEAAhEDEQA/APx...'
      }
    ]
  }
};

// ประมวลผล
const result = await chatBookingAgent.process(ambulanceBookingInput);
// ผลลัพธ์ควรแสดงเจตนา BOOK_TRIP พร้อมความเร่งด่วน EMERGENCY
```

### ตัวอย่างที่ 2: การสอบถามสถานะการจอง
```typescript
const statusInquiryInput = {
  requestId: 'stat-002',
  timestamp: new Date().toISOString(),
  message: 'ฉันอยากทราบสถานะการจองหมายเลข BK-20260410-001 ของฉันครับ ว่าเรียบร้อยแล้วหรือยัง',
  context: {}
};

// ประมวลผล
const result = await chatBookingAgent.process(statusInquiryInput);
// ผลลัพธ์ควรแสดงเจตนา INQUIRY_STATUS พร้อม booking_id ที่สกัดออกมา
```

### ตัวอย่างที่ 3: การแก้ไขการจองที่มีอยู่
```typescript
const modifyBookingInput = {
  requestId: 'mod-003',
  timestamp: new Date().toISOString(),
  message: 'ฉันต้องการเปลี่ยนเวลาการจองหมายเลข BK-20260410-002 จากพรุ่งนี้ 9 โมง เป็นวันมะรืนนี้ 10 โมงเช้าแทนได้ไหมครับ',
  context: {}
};

// ประมวลผล
const result = await chatBookingAgent.process(modifyBookingInput);
// ผลลัพธ์ควรแสดงเจตนา MODIFY_BOOKING พร้อม booking_id และข้อมูลที่ต้องการแก้ไข
```

### ตัวอย่างที่ 4: การใช้งานร่วมกับระบบไฟล์จริง
```typescript
// ใน Node.js สภาพแวดล้อมจริง
import { promises as fs } from 'fs';
import path from 'path';

async function processWithRealFiles() {
  try {
    // อ่านไฟล์จริงจากระบบไฟล์
    const fileContent = await fs.readFile(
      path.join(process.cwd(), 'uploads', 'patient-data.json'),
      'utf8'
    );
    
    const input = {
      requestId: 'file-001',
      timestamp: new Date().toISOString(),
      message: 'จากข้อมูลในไฟล์ที่แนบมา ต้องการจัดบริการดูแลที่บ้านให้ผู้ป่วยเบาหวาน',
      context: {
        bookingType: 'HOME_CARE',
        files: [
          {
            name: 'patient-data.json',
            type: 'application/json',
            size: Buffer.byteLength(fileContent, 'utf8'),
            content: fileContent // เนื้อหาจริงจากไฟล์
          }
        ]
      }
    };
    
    const result = await chatBookingAgent.process(input);
    // ประมวลผลผลลัพธ์ตามปกติ
    
    return result;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการอ่านไฟล์:', error);
    throw error;
  }
}
```

## การจัดการผลลัพธ์อย่างละเอียด

### โครงสร้างผลลัพธ์ที่ส่งกลับมา
```typescript
interface ChatBookingOutput {
  requestId: string;        // เดียวกับที่ส่งเข้าไป
  timestamp: string;        // เวลาที่สร้างผลลัพธ์
  success: boolean;         // สถานะความสำเร็จ
  
  // ข้อมูลเฉพาะของ Chat Booking Agent
  intent: 'BOOK_TRIP' | 'BOOK_MEDICINE' | 'BOOK_HOME_CARE' | 
          'MODIFY_BOOKING' | 'CANCEL_BOOKING' | 'INQUIRY_STATUS' | 'GENERAL_QUERY';
  extracted_entities: {
    service_type?: 'TRIP' | 'MEDICINE' | 'HOME_CARE';
    datetime?: string;           // รูปแบบ ISO8601 เช่น "2026-04-11T09:00:00"
    location?: {                 // จุดเริ่มต้น
      lat: number;               // ละติจูด
      lng: number;               // ลองจิจูด
      address: string;           // ที่อยู่
    };
    destination?: {              // จุดปลายทาง (สำหรับ TRIP)
      lat: number;
      lng: number;
      address: string;
    };
    patient_id?: string;
    special_requirements?: string[];  // เช่น ['WHEELCHAIR', 'OXYGEN']
    urgency_level?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    booking_id?: string;         // สำหรับการแก้ไข/ยกเลิก/สอบถามสถานะ
    modify_fields?: string[];    // ฟิลด์ที่ต้องการแก้ไข
  };
  confidence_score: number;      // 0.0 - 1.0
  missing_required_fields?: string[]; // ฟิลด์ที่ขาดหาย
  clarification_needed: boolean; // ต้องการข้อมูลเพิ่มไหม
  clarification_question?: string;    // คำถามเพื่อขอข้อมูลเพิ่ม
  
  // การกระทำที่แนะนำ
  suggested_actions?: Array<{
    type: 'FILE_OPERATION' | 'SKILL_USE' | 'API_CALL' | 'USER_INPUT';
    description: string;
    parameters?: Record<string, any>;
  }>;
  
  // ผลลัพธ์จากการทำงานกับไฟล์
  file_operations?: Array<{
    operation: 'READ' | 'WRITE' | 'APPEND' | 'DELETE';
    file_path: string;
    content?: string;
    success: boolean;
    error?: string;
  }>;
  
  // ผลลัพธ์จากการใช้สกิล
  skills_used?: Array<{
    skill_name: string;
    parameters: Record<string, any>;
    result?: any;
    success: boolean;
    error?: string;
  }>;
  
  // ข้อมูลทั่วไปเมื่อเกิดข้อผิดพลาด
  error?: string;
}
```

### ตัวอย่างผลลัพธ์ที่สำเร็จ
```json
{
  "requestId": "req-12345",
  "timestamp": "2026-04-10T10:30:00.000Z",
  "success": true,
  "intent": "BOOK_TRIP",
  "extracted_entities": {
    "service_type": "TRIP",
    "datetime": "2026-04-11T09:00:00",
    "location": {
      "lat": 13.7563,
      "lng": 100.5018,
      "address": "บ้านพักอาศัย เลขที่ 123 หมู่ 4 ตำบลท่าทอง"
    },
    "destination": {
      "lat": 13.7367,
      "lng": 100.5231,
      "address": "โรงพยาบาลจุฬาลงกรณ์"
    },
    "special_requirements": ["WHEELCHAIR"],
    "urgency_level": "ROUTINE"
  },
  "confidence_score": 0.92,
  "missing_required_fields": [],
  "clarification_needed": false,
  "suggested_actions": [
    {
      "type": "API_CALL",
      "description": "ส่งข้อมูลการจองไปยัง Dispatch Agent",
      "parameters": {
        "endpoint": "/api/dispatch/trip",
        "data": {
          "service_request": {
            "type": "TRIP",
            "datetime": "2026-04-11T09:00:00",
            "pickup_location": {
              "lat": 13.7563,
              "lng": 100.5018,
              "address": "บ้านพักอาศัย เลขที่ 123 หมู่ 4 ตำบลท่าทอง"
            },
            "destination": {
              "lat": 13.7367,
              "lng": 100.5231,
              "address": "โรงพยาบาลจุฬาลงกรณ์"
            },
            "special_requirements": ["WHEELCHAIR"],
            "patient_id": "PAT-789"
          }
        }
      }
    }
  ],
  "skills_used": [
    {
      "skill_name": "calculateETA",
      "parameters": {
        "origin": {
          "lat": 13.7563,
          "lng": 100.5018,
          "address": "บ้านพักอาศัย เลขที่ 123 หมู่ 4 ตำบลท่าทอง"
        },
        "destination": {
          "lat": 13.7367,
          "lng": 100.5231,
          "address": "โรงพยาบาลจุฬาลงกรณ์"
        },
        "service_type": "TRIP"
      },
      "result": {
        "eta_minutes": 25,
        "distance_km": 12.5
      },
      "success": true
    }
  ],
  "file_operations": [
    {
      "operation": "READ",
      "file_path": "/tmp/uploads/location-map.jpg",
      "success": true
    }
  ]
}
```

### ตัวอย่างผลลัพธ์ที่ต้องการข้อมูลเพิ่มเติม
```json
{
  "requestId": "req-67890",
  "timestamp": "2026-04-10T10:35:00.000Z",
  "success": true,
  "intent": "BOOK_TRIP",
  "extracted_entities": {
    "service_type": "TRIP"
  },
  "confidence_score": 0.4,
  "missing_required_fields": ["datetime", "location"],
  "clarification_needed": true,
  "clarification_question": "กรุณาระบุวันและเวลาที่ต้องการใช้บริการ รวมถึงจุดเริ่มต้นการเดินทางครับ",
  "suggested_actions": [
    {
      "type": "USER_INPUT",
      "description": "ขอข้อมูลเพิ่มเติมจากผู้ใช้",
      "parameters": {
        "question": "กรุณาระบุวันและเวลาที่ต้องการใช้บริการ รวมถึงจุดเริ่มต้นการเดินทางครับ"
      }
    }
  ]
}
```

### ตัวอย่างผลลัพธ์ที่เกิดข้อผิดพลาด
```json
{
  "requestId": "req-11111",
  "timestamp": "2026-04-10T10:40:00.000Z",
  "success": false,
  "error": "Failed to process request: Timeout calling LLM service",
  "intent": "GENERAL_QUERY",
  "confidence_score": 0.1
}
```

## การทดสอบและการประกันคุณภาพ

### การทดสอบหน่วย (Unit Testing)
ไฟล์ทดสอบอยู่ที่: `src/agents/__tests__/ChatBookingAgent.test.ts`

ตัวอย่างการรันการทดสอบ:
```bash
# รันทดสอบทั้งหมด
npm test

# รันทดสอบเฉพาะไฟล์นี้
npx vitest run src/agents/__tests__/ChatBookingAgent.test.ts

# รันทดสอบแบบมี UI
npx vitest --ui src/agents/__tests__/ChatBookingAgent.test.ts
```

### การตรวจสอบประเภท (Type Checking)
```bash
# ตรวจสอบประเภท TypeScript
npx tsc --noEmit
```

## การปรับปรุงและการบำรุงรักษา

### เพิ่มสกิลใหม่
หากต้องการเพิ่มสกิลใหม่ให้กับ Chat Booking Agent:

1. เพิ่มเมธอดสกิลใหม่ในไฟล์ `ChatBookingAgent.ts` ภายในส่วน "สกิล..."
2. ลงทะเบียนสกิลในเมธอด `initializeSkills()`:
   ```typescript
   this.availableSkills.set('ทักษะใหม่', this.ใหม่Skill.bind(this));
   ```
3. ใช้สกิลใหม่ในกระบวนการประมวลผลผ่านเมธอด `useSkill()`
4. เพิ่มการทดสอบสำหรับสกิลใหม่ในไฟล์ทดสอบ

### การปรับปรุงประสิทธิภาพ
1. ปรับค่า `temperature`, `maxTokens`, `timeoutMs` ในการตั้งค่าตามความเหมาะสม
2.พิจารณาใช้ caching สำหรับผลลัพธ์ที่ใช้บ่อย
3. ตรวจสอบและลบการทำงานที่ไม่จำเป็นออก
4. ใช้การประมวลผลแบบขนานเมื่อเหมาะสม (Promise.all)

### การอัปเดตความปลอดภัย
1. ตรวจสอบและทำความสะอาดข้อมูลนำเข้าเพื่อป้องกันการฉีดโค้ด
2. จำกัดขนาดไฟล์ที่สามารถอัปโหลดได้
3. ตรวจสอบประเภทไฟล์ที่อนุญาต
4. เข้ารหัสข้อมูลที่ละเอียดอ่อนเมื่อจำเป็น

## การเชื่อมต่อกับส่วนอื่นของระบบ

### การเชื่อมต่อกับ OpenRouter Proxy
Chat Booking Agent ถูกออกแบบให้ทำงานร่วมกับ OpenRouter Proxy ที่มีอยู่ในระบบ:

```typescript
// ในระบบจริง การเรียก LLM จะเป็นเช่นนี้:
protected async callLLM(prompt: string, options: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
  const response = await fetch('http://localhost:3000/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
    },
    body: JSON.stringify({
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? this.config.temperature,
      max_tokens: options.max_tokens ?? this.config.maxTokens
    })
  });
  
  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

### การเชื่อมต่อกับ API จองบริการ
ผลลัพธ์จาก `suggested_actions` สามารถนำไปใช้เรียก API จองบริการที่มีอยู่:

```typescript
// ตัวอย่างการเรียก API จาก suggested_actions
if (result.suggested_actions) {
  for (const action of result.suggested_actions) {
    if (action.type === 'API_CALL') {
      const apiResponse = await fetch(action.parameters.endpoint, {
        method: action.parameters.method || 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(action.parameters.data)
      });
      
      const apiResult = await apiResponse.json();
      // จัดการผลลัพธ์จาก API
    }
  }
}
```

## ข้อควรระวังและแนวทางปฏิบัติที่ดี

### 1. การจัดการข้อมูลที่ละเอียดอ่อน
- ไม่ควรเก็บข้อมูลผู้ป่วย (PHI/PII) ที่ละเอียดอ่อนใน logs หรือผลลัพธ์ที่ไม่จำเป็น
- เข้ารหัสข้อมูลที่ละเอียดอ่อนเมื่อทำการจัดเก็บหรือส่งผ่านเครือข่าย
- ปฏิบัติตามนโยบายการเข้าถึงข้อมูลที่ระบุใน `docs/ai-architecture/03-ai-data-access-policy.md`

### 2. การจัดการทรัพยากร
- ปิดหรือปลดปล่อยทรัพยากรที่เปิดใช้ (ไฟล์, การเชื่อมต่อเครือข่าย) เมื่อใช้งานเสร็จ
- พิจารณาใช้การสตรีมข้อมูลสำหรับไฟล์ขนาดใหญ่แทนการโหลดทั้งหมดเข้าหน่วยความจำ
- ติดตามการใช้หน่วยความจำเพื่อป้องกันการรั่วไหล

### 3. การจัดการข้อผิดพลาด
- มีกลยุทธ์ fallback เมื่อบริการภายนอกล้มเหลว
- บันทึกข้อผิดพลาดอย่างละเอียดเพื่อการวิเคราะห์และปรับปรุง
- แจ้งผู้ใช้อย่างเหมาะสมเมื่อเกิดข้อผิดพลาดที่ไม่สามารถแก้ไขได้โดยอัตโนมัติ

### 4. การทดสอบอย่างครอบคลุม
- ทดสอบกรณีปกติและกรณีขอบเขต (edge cases)
- ทดสอบการทำงานร่วมกับส่วนอื่นของระบบ (integration testing)
- ทดสอบประสิทธิภาพภายใต้ภาระงานต่างๆ
- ทดสอบความปลอดภัย (security testing)

### 5. การบำรุงรักษาโค้ด
- ทำตามมาตรฐานการเขียนโค้ดของโครงการ
- เขียนคอมเมนต์อธิบายเมื่อตรรกะซับซ้อน
- แบ่งฟังก์ชันที่ยาวออกเป็นฟังก์ชันย่อยๆ ที่มีความรับผิดชอบชัดเจน
- ทำ code review เป็นประจำ