# คู่มือการพัฒนา AI Agent ให้เก่งเหมือน Claude

## 🎯 หลักการพื้นฐาน

### 1. เข้าใจบริบทอย่างลึกซึ้ง
- อ่านเอกสารโครงการให้เข้าใจก่อนเริ่มพัฒนา
- ทำความเข้าใจขอบเขตงานและความรับผิดชอบของแต่ละ Agent
- ศึกษาการไหลของข้อมูลระหว่าง Agent ต่างๆ

### 2. พัฒนาตามหลัก SOLID
- **Single Responsibility Principle**: แต่ละ Agent มีหน้าที่ชัดเจนหนึ่งอย่าง
- **Open/Closed Principle**: ออกแบบให้ขยาย功能ได้โดยไม่ต้องแก้ไขโค้ดเดิม
- **Liskov Substitution Principle**: Agent สามารถทดแทนกันได้ตามมาตรฐาน interface
- **Interface Segregation Principle**: ออกแบบ interface ให้เฉพาะเจาะจงต่อการใช้งาน
- **Dependency Inversion Principle**: พึ่งพาภายใน abstraction ไม่ใช่ implementation

## 🏗️ สถาปัตยกรรม Agent ที่ดี

### โครงสร้างพื้นฐานของ Agent
```typescript
interface AgentInput {
  // ข้อมูลที่เข้ามา
  requestId: string;
  timestamp: string;
  // ข้อมูลเฉพาะของแต่ละ agent
  [key: string]: any;
}

interface AgentOutput {
  // ผลลัพธ์ที่ส่งออก
  requestId: string;
  timestamp: string;
  success: boolean;
  // ข้อมูลเฉพาะของแต่ละ agent
  [key: string]: any;
}

interface AgentConfig {
  // การตั้งค่า
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retryAttempts: number;
}

class BaseAgent {
  protected config: AgentConfig;
  
  constructor(config: AgentConfig) {
    this.config = config;
  }
  
  // เมธอดหลักที่ต้อง implement
  async process(input: AgentInput): Promise<AgentOutput> {
    try {
      // ตรวจสอบ input
      this.validateInput(input);
      
      // ประมวลผลหลัก
      const result = await this.execute(input);
      
      // ตรวจสอบ output
      this.validateOutput(result);
      
      return {
        ...result,
        success: true,
        requestId: input.requestId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return this.handleError(error, input);
    }
  }
  
  protected validateInput(input: AgentInput): void {
    // ตรวจสอบความถูกต้องของ input
    if (!input.requestId) {
      throw new Error('Request ID is required');
    }
  }
  
  protected abstract execute(input: AgentInput): Promise<AgentOutput>;
  
  protected validateOutput(output: AgentOutput): void {
    // ตรวจสอบความถูกต้องของ output
    if (!output.requestId) {
      throw new Error('Output must contain requestId');
    }
  }
  
  protected handleError(error: Error, input: AgentInput): AgentOutput {
    console.error(`Agent error:`, error);
    return {
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message,
      // ข้อมูลสำรองตามความเหมาะสม
    };
  }
}
```

### ตัวอย่างการ Implement Agent จริง
```typescript
// ในไฟล์ src/agents/IntakeAgent.ts
interface IntakeInput extends AgentInput {
  message: string;
  userId?: string;
  sessionId?: string;
}

interface IntakeOutput extends AgentOutput {
  intent: 'BOOK_TRIP' | 'MEDICINE_DELIVERY' | 'HOME_CARE' | 'INQUIRY';
  extracted_entities: {
    service_type?: string;
    datetime?: string; // ISO8601
    location?: { lat: number; lng: number; address: string };
    patient_id?: string;
    special_requirements?: string[];
    urgency_level?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  };
  confidence_score: number;
  missing_required_fields?: string[];
  clarification_needed: boolean;
  clarification_question?: string;
}

class IntakeAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }
  
  protected async execute(input: IntakeInput): Promise<IntakeOutput> {
    // ใช้ LLM เพื่อวิเคราะห์ข้อความ
    const prompt = this.buildPrompt(input.message);
    const llmResponse = await this.callLLM(prompt);
    
    // ประมวลผลผลลัพธ์จาก LLM
    return this.parseLLMResponse(llmResponse);
  }
  
  private buildPrompt(message: string): string {
    return `
      วิเคราะห์ข้อความต่อไปนี้และดึงข้อมูลสำคัญออกมา:
      "${message}"
      
      กรุณาตอบในรูปแบบ JSON ที่มีโครงสร้างดังนี้:
      {
        "intent": "หนึ่งใน [BOOK_TRIP, MEDICINE_DELIVERY, HOME_CARE, INQUIRY]",
        "extracted_entities": {
          "service_type": "ประเภทบริการ",
          "datetime": "วันเวลาในรูปแบบ ISO8601",
          "location": {"lat": ตัวเลข, "lng": ตัวเลข, "address": "ที่อยู่"},
          "patient_id": "รหัสผู้ป่วยถ้ามี",
          "special_requirements": ["ความต้องการพิเศษ"],
          "urgency_level": "หนึ่งใน [ROUTINE, URGENT, EMERGENCY]"
        },
        "confidence_score": ความเชื่อมั่นระหว่าง 0.0-1.0,
        "missing_required_fields": ["ฟิลด์ที่ขาดหาย"],
        "clarification_needed": true/false,
        "clarification_question": "คำถามเพื่อขอข้อมูลเพิ่มเติมถ้าต้องการ"
      }
    `;
  }
  
  private async callLLM(prompt: string): Promise<string> {
    // เรียกใช้ LLM ผ่าน proxy หรือโดยตรง
    // ในระบบจริงจะใช้การเรียกผ่าน API ที่ตั้งค่าไว้
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  private parseLLMResponse(response: string): IntakeOutput {
    try {
      // พยายามแยก JSON ออกจากข้อความ
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // ตรวจสอบและเติมค่าเริ่มต้น
      return {
        ...parsed,
        intent: parsed.intent || 'INQUIRY',
        extracted_entities: parsed.extracted_entities || {},
        confidence_score: Math.max(0, Math.min(1, parsed.confidence_score || 0.5)),
        missing_required_fields: parsed.missing_required_fields || [],
        clarification_needed: parsed.clarification_needed ?? false,
        clarification_question: parsed.clarification_question || '',
        success: true
      };
    } catch (error) {
      // Fallback response เมื่อ parsing ล้มเหลว
      return {
        intent: 'INQUIRY',
        extracted_entities: {},
        confidence_score: 0.1,
        missing_required_fields: ['message'],
        clarification_needed: true,
        clarification_question: 'กรุณาอธิบายความต้องการของคุณให้ชัดเจนขึ้น',
        success: false,
        error: `Failed to parse LLM response: ${error.message}`
      };
    }
  }
}
```

## 🔧 เครื่องมือและแนวทางปฏิบัติ

### 1. การทดสอบ (Testing)
```typescript
// ตัวอย่างการทดสอบ IntakeAgent
import { IntakeAgent } from './IntakeAgent';

describe('IntakeAgent', () => {
  let agent: IntakeAgent;
  
  beforeEach(() => {
    agent = new IntakeAgent({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      temperature: 0.3,
      maxTokens: 500,
      timeoutMs: 5000,
      retryAttempts: 3
    });
  });
  
  it('should correctly parse appointment request', async () => {
    const input = {
      requestId: 'test-001',
      message: 'อยากจองรถไปโรงพยาบาลพรุ่งนี้ 9 โมง',
      timestamp: new Date().toISOString()
    };
    
    const result = await agent.process(input);
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('BOOK_TRIP');
    expect(result.extracted_entities.datetime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.confidence_score).toBeGreaterThan(0.7);
  });
  
  it('should handle unclear requests', async () => {
    const input = {
      requestId: 'test-002',
      message: 'สวัสดี',
      timestamp: new Date().toISOString()
    };
    
    const result = await agent.process(input);
    
    expect(result.clarification_needed).toBe(true);
    expect(result.confidence_score).toBeLessThan(0.5);
  });
});
```

### 2. การจัดการข้อผิดพลาดและการกู้คืน
- ใช้ retry mechanism สำหรับการเรียก LLM ที่ล้มเหลว
- มี fallback response เมื่อไม่สามารถประมวลผลได้
- บันทึก error เพื่อการวิเคราะห์และปรับปรุง
- ตั้งค่า timeout เพื่อป้องกันการรอค้าง

### 3. การประเมินประสิทธิภาพ
- ติดตาม metrics: ความเร็วในการตอบ, ความสำเร็จ, การใช้โทเค็น
- เก็บ logs เพื่อวิเคราะห์รูปแบบการใช้งาน
- ทำ A/B testing สำหรับ prompt ต่างๆ
- ตรวจสอบ bias และความยุติธรรมในผลลัพธ์

## 📚 แหล่งเรียนรู้เพิ่มเติม

### เอกสารภายในโครงการ
- `docs/ai-architecture/01-agent-responsibility-matrix.md` - รายละเอียดหน้าที่ของแต่ละ Agent
- `docs/ai-architecture/02-workflow-state-machine.md` - การไหลของงานและสถานะ
- `docs/ai-architecture/03-ai-data-access-policy.md` - นโยบายการเข้าถึงข้อมูล
- `docs/ai-architecture/04-llm-routing-policy.md` - กลยุทธ์การเลือกโมเดล
- `docs/ai-architecture/05-ai-observability-dashboard.md` - การ监控และ metrics

### แนวทางการพัฒนา AI ที่ดี
1. **Prompt Engineering**: เรียนรู้การเขียน prompt ที่มีประสิทธิภาพ
2. **Few-shot Learning**: ใช้ตัวอย่างเพื่อชี้นำผลลัพธ์ที่ต้องการ
3. **Chain of Thought**: ให้ AI คิดทีละขั้นตอนเพื่อผลลัพธ์ที่ดีขึ้น
4. **Retrieval-Augmented Generation (RAG)**: เพิ่มความรู้ภายนอกให้กับ AI
5. **Fine-tuning**: ปรับแต่งโมเดลให้เหมาะกับงานเฉพาะ (เมื่อมีทรัพยากร)

## 🚀 ขั้นตอนการพัฒนา

### ขั้นที่ 1: การเตรียมตัว
1. อ่านและทำความเข้าใจเอกสารสถาปัตยกรรมทั้งหมด
2. ศึกษาตัวอย่างโค้ดที่มีอยู่ใน repository
3. ตั้งค่า環境การพัฒนา (Node.js, TypeScript, etc.)

### ขั้นที่ 2: การออกแบบ
1. กำหนดขอบเขตงานและความรับผิดชอบของ Agent ใหม่
2. ออกแบบ input และ output ตามมาตรฐาน
3. วาดไดอะแกรมการไหลของข้อมูล
4. ระบุจุดที่ต้องเชื่อมต่อกับ Agent อื่นๆ

### ขั้นที่ 3: การพัฒนา
1. สร้างไฟล์ Agent ตามโครงสร้างที่แนะนำ
2. Implement เมธอดหลักตามที่ออกแบบไว้
3. เพิ่มการจัดการข้อผิดพลาดและ logging
4. เขียน unit test ครอบคลุม

### ขั้นที่ 4: การทดสอบและปรับปรุง
1. รัน unit test และแก้ไขข้อผิดพลาด
2. ทำ integration test กับ Agent อื่นๆ
3. ประเมินประสิทธิภาพและปรับปรุง
4. ทำ code review และปรับปรุงตามข้อเสนอแนะ

### ขั้นที่ 5: การDeploy
1. ตรวจสอบความพร้อมก่อน deploy
2. ติดตามผลหลัง deployment
3. รวบรวม feedback เพื่อปรับปรุงต่อไป

## 💡 เคล็ดลับความสำเร็จ

### การทำงานกับ LLM อย่างมีประสิทธิภาพ
- ใช้ prompt ที่ชัดเจนและเฉพาะเจาะจง
- ให้ตัวอย่างเมื่อจำเป็น (few-shot prompting)
- ตรวจสอบและจำกัดขอบเขตของผลลัพธ์
- ใช้ temperature ที่เหมาะสม (ต่ำสำหรับข้อเท็จจริง, สูงสำหรับความสร้างสรรค์)

### การจัดการความซับซ้อน
- แบ่งงานที่ซับซ้อนออกเป็นขั้นตอนเล็กๆ
- ใช้ pattern เช่น Chain of Responsibility หรือ Pipeline
- พิจารณาการใช้ state machine สำหรับงานที่มีหลายขั้นตอน

### การรับประกันคุณภาพ
- ตรวจสอบผลลัพธ์อย่างสม่ำเสมอ
- สร้างชุดข้อมูลทดสอบที่ครอบคลุมกรณีต่างๆ
- ติดตามการเปลี่ยนแปลงประสิทธิภาพเมื่ออัปเดตโมเดล
- ฟังความคิดเห็นจากผู้ใช้จริงและปรับปรุงตามนั้น

---

*จำไว้ว่า การพัฒนา AI Agent ที่ดีนั้นไม่ใช่แค่เรื่องเทคนิค แต่ยังต้องเข้าใจบริบท ผู้ใช้ และผลกระทบในโลกความเป็นจริงด้วย*