import { BaseAgent, AgentInput, AgentOutput, AgentConfig } from './BaseAgent';
import { buildDraftJobSpec, saveJobToStore } from './shared/jobStoreClient';

/**
 * Chat Booking Agent - Agent ที่ช่วยจัดการการจองบริการผ่านแชท
 * มีความสามารถในการทำงานกับไฟล์ เลือกใช้สกิล/เครื่องมือต่างๆ ได้
 * ออกแบบให้มีความสามารถคล้ายกับ Claude ในการจัดการงานซับซ้อน
 */
export interface ChatBookingInput extends AgentInput {
  message: string;
  userId?: string;
  sessionId?: string;
  context?: {
    bookingType?: 'TRIP' | 'MEDICINE' | 'HOME_CARE';
    existingData?: Record<string, any>;
    files?: Array<{
      name: string;
      type: string;
      size: number;
      content?: string; // base64 encoded หรือ text
      url?: string;
    }>;
  };
}

export interface ChatBookingOutput extends AgentOutput {
  intent: 'BOOK_TRIP' | 'BOOK_MEDICINE' | 'BOOK_HOME_CARE' | 'MODIFY_BOOKING' | 'CANCEL_BOOKING' | 'INQUIRY_STATUS' | 'GENERAL_QUERY';
  extracted_entities: {
    service_type?: string;
    datetime?: string; // ISO8601
    location?: { lat: number; lng: number; address: string };
    destination?: { lat: number; lng: number; address: string };
    patient_id?: string;
    special_requirements?: string[];
    urgency_level?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    booking_id?: string;
    modify_fields?: string[];
  };
  confidence_score: number;
  missing_required_fields?: string[];
  clarification_needed: boolean;
  clarification_question?: string;
  /** jobId ที่บันทึกลง JobStore สำเร็จ (มีเฉพาะเมื่อ booking entities ครบ) */
  jobId?: string;
  suggested_actions?: Array<{
    type: 'FILE_OPERATION' | 'SKILL_USE' | 'API_CALL' | 'USER_INPUT';
    description: string;
    parameters?: Record<string, any>;
  }>;
  file_operations?: Array<{
    operation: 'READ' | 'WRITE' | 'APPEND' | 'DELETE';
    file_path: string;
    content?: string;
    success: boolean;
    error?: string;
  }>;
  skills_used?: Array<{
    skill_name: string;
    parameters: Record<string, any>;
    result?: any;
    success: boolean;
    error?: string;
  }>;
}

export class ChatBookingAgent extends BaseAgent {
  private availableSkills: Map<string, Function> = new Map();

  constructor(config: AgentConfig) {
    super(config);
    this.initializeSkills();
  }

  /**
   * เริ่มต้นสกิลที่มีให้ใช้งาน
   */
  private initializeSkills(): void {
    // สกิลจัดการไฟล์
    this.availableSkills.set('readFile', this.readFileSkill.bind(this));
    this.availableSkills.set('writeFile', this.writeFileSkill.bind(this));
    this.availableSkills.set('appendFile', this.appendFileSkill.bind(this));
    this.availableSkills.set('deleteFile', this.deleteFileSkill.bind(this));
    this.availableSkills.set('listFiles', this.listFilesSkill.bind(this));

    // สกิลวิเคราะห์ข้อมูล
    this.availableSkills.set('extractEntities', this.extractEntitiesSkill.bind(this));
    this.availableSkills.set('validateBooking', this.validateBookingSkill.bind(this));
    this.availableSkills.set('calculateETA', this.calculateETASkill.bind(this));
    this.availableSkills.set('findNearbyProviders', this.findNearbyProvidersSkill.bind(this));

    // สกิลการสื่อสาร
    this.availableSkills.set('sendNotification', this.sendNotificationSkill.bind(this));
    this.availableSkills.set('generateResponse', this.generateResponseSkill.bind(this));
    this.availableSkills.set('translateText', this.translateTextSkill.bind(this));
  }

  /**
   * ประมวลผลหลักของ Chat Booking Agent
   */
  protected async execute(input: ChatBookingInput): Promise<ChatBookingOutput> {
    // 1. วิเคราะห์ข้อความและกำหนดเจตนา
    const intentAnalysis = await this.analyzeIntent(input.message, input.context);

    // 2. ตรวจสอบว่าต้องการข้อมูลเพิ่มเติมหรือไม่
    if (intentAnalysis.needsClarification) {
      return {
        ...intentAnalysis,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        success: true,
        clarification_needed: true,
        suggested_actions: [{
          type: 'USER_INPUT',
          description: 'ขอข้อมูลเพิ่มเติมจากผู้ใช้',
          parameters: { question: intentAnalysis.clarification_question }
        }]
      };
    }

    // 3. ดำเนินการตามเจตนาที่กำหนด
    const result = await this.executeIntent(intentAnalysis, input);

    // 4. เพิ่มข้อมูลพื้นฐาน
    return {
      ...result,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      success: true
    };
  }

  /**
   * วิเคราะห์เจตนาจากข้อความผู้ใช้
   */
  private async analyzeIntent(message: string, context?: Record<string, any>): Promise<Partial<ChatBookingOutput>> {
    const prompt = this.buildIntentAnalysisPrompt(message, context);

    try {
      const llmResponse = await this.callLLM(prompt);
      return this.parseIntentAnalysis(llmResponse);
    } catch (error) {
      console.error('Intent analysis failed:', error);
      // Fallback เมื่อ LLM ล้มเหลว
      return this.fallbackIntentAnalysis(message);
    }
  }

  /**
   * สร้าง prompt สำหรับการวิเคราะห์เจตนา
   */
  private buildIntentAnalysisPrompt(message: string, context?: Record<string, any>): string {
    const contextInfo = context ? `
บริบทเพิ่มเติม:
- ประเภทบริการที่มีอยู่: ${context.bookingType || 'ไม่ระบุ'}
- ข้อมูลที่มีอยู่แล้ว: ${JSON.stringify(context.existingData || {})}
- ไฟล์ที่แนบมา: ${context.files?.length || 0} ไฟล์
` : '';

    return `
คุณคือผู้ช่วยจองบริการสุขภาพอัจฉริยะ วิเคราะห์ข้อความต่อไปนี้และกำหนดเจตนา:

ข้อความจากผู้ใช้: "${message}"
${contextInfo}

กรุณาตอบในรูปแบบ JSON ที่มีโครงสร้างดังนี้:
{
  "intent": "หนึ่งใน [BOOK_TRIP, BOOK_MEDICINE, BOOK_HOME_CARE, MODIFY_BOOKING, CANCEL_BOOKING, INQUIRY_STATUS, GENERAL_QUERY]",
  "extracted_entities": {
    "service_type": "TRIP|MEDICINE|HOME_CARE (ถ้ามี)",
    "datetime": "วันเวลาในรูปแบบ ISO8601 (ถ้ามี)",
    "location": {"lat": ตัวเลข, "lng": ตัวเลข, "address": "ที่อยู่ต้นทาง (ถ้ามี)"},
    "destination": {"lat": ตัวเลข, "lng": ตัวเลข, "address": "ที่อยู่ปลายทาง (ถ้ามี)}",
    "patient_id": "รหัสผู้ป่วย (ถ้ามี)",
    "special_requirements": ["ความต้องการพิเศษ เช่น WHEELCHAIR, OXYGEN"],
    "urgency_level": "ROUTINE|URGENT|EMERGENCY",
    "booking_id": "รหัสการจอง (ถ้าต้องการแก้ไขหรือยกเลิก)",
    "modify_fields": ["ฟิลด์ที่ต้องการแก้ไข"]
  },
  "confidence_score": ความเชื่อมั่นระหว่าง 0.0-1.0,
  "missing_required_fields": ["รายการฟิลด์ที่จำเป็นแต่ขาดหาย"],
  "clarification_needed": true/false,
  "clarification_question": "คำถามเพื่อขอข้อมูลเพิ่มเติมถ้าต้องการ"
}

ตัวอย่างการตอบ:
{
  "intent": "BOOK_TRIP",
  "extracted_entities": {
    "service_type": "TRIP",
    "datetime": "2026-04-11T09:00:00",
    "location": {"lat": 13.7563, "lng": 100.5018, "address": "บ้านพักอาศัย"},
    "destination": {"lat": 13.7367, "lng": 100.5231, "address": "โรงพยาบาลจุฬาลงกรณ์"},
    "special_requirements": ["WHEELCHAIR"],
    "urgency_level": "ROUTINE"
  },
  "confidence_score": 0.9,
  "missing_required_fields": [],
  "clarification_needed": false,
  "clarification_question": ""
}
`;
  }

  /**
   * แยกวิเคราะห์ผลลัพธ์จาก LLM สำหรับการวิเคราะห์เจตนา
   */
  private parseIntentAnalysis(response: string): Partial<ChatBookingOutput> {
    try {
      // พยายามแยก JSON ออกจากข้อความ
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // ตรวจสอบและเติมค่าเริ่มต้น
      return {
        intent: this.validateIntent(parsed.intent) || 'GENERAL_QUERY',
        extracted_entities: parsed.extracted_entities || {},
        confidence_score: Math.max(0, Math.min(1, parsed.confidence_score || 0.5)),
        missing_required_fields: parsed.missing_required_fields || [],
        clarification_needed: parsed.clarification_needed ?? false,
        clarification_question: parsed.clarification_question || '',
        suggested_actions: []
      };
    } catch (error) {
      console.error('Failed to parse intent analysis:', error);
      return this.fallbackIntentAnalysis(''); // จะสร้าง fallback จากข้อความเปล่า
    }
  }

  /**
   * วิเคราะห์เจตนาแบบ fallback เมื่อ LLM ล้มเหลว
   */
  private fallbackIntentAnalysis(message: string): Partial<ChatBookingOutput> {
    const lowerMessage = message.toLowerCase();

    // ตรวจสอบคำสำคัญเบื้องต้น
    if (lowerMessage.includes('จอง') || lowerMessage.includes('book')) {
      if (lowerMessage.includes('ยา') || lowerMessage.includes('medicine')) {
        return {
          intent: 'BOOK_MEDICINE',
          confidence_score: 0.6,
          clarification_needed: true,
          clarification_question: 'ต้องการส่งยาไปที่ไหนและเวลาไหนครับ?'
        };
      } else if (lowerMessage.includes('ที่บ้าน') || lowerMessage.includes('home')) {
        return {
          intent: 'BOOK_HOME_CARE',
          confidence_score: 0.6,
          clarification_needed: true,
          clarification_question: 'ต้องการบริการดูแลที่บ้านประเภทใดและเวลาไหนครับ?'
        };
      } else {
        return {
          intent: 'BOOK_TRIP',
          confidence_score: 0.6,
          clarification_needed: true,
          clarification_question: 'ต้องการจองรถไปที่ไหนและเวลาไหนครับ?'
        };
      }
    } else if (lowerMessage.includes('ยกเลิก') || lowerMessage.includes('cancel')) {
      return {
        intent: 'CANCEL_BOOKING',
        confidence_score: 0.7,
        clarification_needed: true,
        clarification_question: 'ต้องการยกเลิกการจองหมายเลขใดครับ?'
      };
    } else if (lowerMessage.includes('แก้ไข') || lowerMessage.includes('modify') || lowerMessage.includes('เปลี่ยน')) {
      return {
        intent: 'MODIFY_BOOKING',
        confidence_score: 0.7,
        clarification_needed: true,
        clarification_question: 'ต้องการแก้ไขการจองหมายเลขใด และต้องการเปลี่ยนข้อมูลอะไรบ้างครับ?'
      };
    } else if (lowerMessage.includes('สถานะ') || lowerMessage.includes('status')) {
      return {
        intent: 'INQUIRY_STATUS',
        confidence_score: 0.7,
        clarification_needed: true,
        clarification_question: 'ต้องการทราบสถานะการจองหมายเลขใดครับ?'
      };
    } else {
      return {
        intent: 'GENERAL_QUERY',
        confidence_score: 0.4,
        clarification_needed: true,
        clarification_question: 'คุณต้องการความช่วยเหลือเกี่ยวกับบริการใดครับ? เช่น จองรถพยาบาล ส่งยา หรือบริการดูแลที่บ้าน'
      };
    }
  }

  /**
   * ตรวจสอบความถูกต้องของเจตนา
   */
  private validateIntent(intent: string):
    | 'BOOK_TRIP'
    | 'BOOK_MEDICINE'
    | 'BOOK_HOME_CARE'
    | 'MODIFY_BOOKING'
    | 'CANCEL_BOOKING'
    | 'INQUIRY_STATUS'
    | 'GENERAL_QUERY'
    | null {
    const validIntents: ChatBookingOutput['intent'][] = [
      'BOOK_TRIP',
      'BOOK_MEDICINE',
      'BOOK_HOME_CARE',
      'MODIFY_BOOKING',
      'CANCEL_BOOKING',
      'INQUIRY_STATUS',
      'GENERAL_QUERY'
    ];
    return validIntents.includes(intent as any) ? intent as any : null;
  }

  /**
   * ดำเนินการตามเจตนาที่กำหนด
   */
  private async executeIntent(
    intentAnalysis: Partial<ChatBookingOutput>,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const intent = intentAnalysis.intent as ChatBookingOutput['intent'];
    const baseResult: ChatBookingOutput = {
      ...intentAnalysis,
      suggested_actions: [],
      file_operations: [],
      skills_used: []
    };

    switch (intent) {
      case 'BOOK_TRIP':
        return await this.handleTripBooking(baseResult, input);
      case 'BOOK_MEDICINE':
        return await this.handleMedicineBooking(baseResult, input);
      case 'BOOK_HOME_CARE':
        return await this.handleHomeCareBooking(baseResult, input);
      case 'MODIFY_BOOKING':
        return await this.handleModifyBooking(baseResult, input);
      case 'CANCEL_BOOKING':
        return await this.handleCancelBooking(baseResult, input);
      case 'INQUIRY_STATUS':
        return await this.handleInquiryStatus(baseResult, input);
      case 'GENERAL_QUERY':
        return await this.handleGeneralQuery(baseResult, input);
      default:
        return {
          ...baseResult,
          intent: 'GENERAL_QUERY',
          confidence_score: 0.1,
          clarification_needed: true,
          clarification_question: 'ขอโทษครับ ไม่เข้าใจความต้องการ คุณสามารถอธิบายเพิ่มเติมได้ไหมครับ?'
        };
    }
  }

  /**
   * บันทึก draft job ลง JobStore เมื่อ booking entities ครบ
   * fire-and-forget — ไม่ block result ถ้า store ไม่ตอบสนอง
   */
  private async attemptJobCreation(
    intent: ChatBookingOutput['intent'],
    entities: ChatBookingOutput['extracted_entities'],
    sessionId?: string
  ): Promise<string | undefined> {
    try {
      const sid = sessionId ?? `chat-${Date.now()}`;
      const draftSpec = buildDraftJobSpec(intent, entities, sid);
      const saveResult = await saveJobToStore(draftSpec, { source: 'chat', sessionId: sid });
      if (saveResult.success) {
        this.log('info', `[ChatBookingAgent] Draft job saved: ${saveResult.jobId}`);
        return saveResult.jobId;
      }
      this.log('warn', `[ChatBookingAgent] Failed to save job: ${saveResult.error}`);
    } catch (err) {
      this.log('warn', '[ChatBookingAgent] Job save threw', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return undefined;
  }

  /**
   * จัดการการจองรถ
   */
  private async handleTripBooking(
    baseResult: ChatBookingOutput,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const result = { ...baseResult };

    // ตรวจสอบข้อมูลที่จำเป็น
    const requiredFields = ['datetime', 'location'];
    const missingFields = requiredFields.filter(field =>
      !result.extracted_entities[field as keyof typeof result.extracted_entities]
    );

    if (missingFields.length > 0) {
      result.missing_required_fields = missingFields;
      result.clarification_needed = true;
      result.clarification_question = `กรุณาระบุข้อมูลต่อไปนี้: ${missingFields.map(f =>
        f === 'datetime' ? 'วันและเวลา' :
        f === 'location' ? 'จุดเริ่มต้น' : f
      ).join(', ')}`;
      return result;
    }

    // ใช้สกิลเพิ่มเติมถ้ามีไฟล์แนบ
    if (input.context?.files && input.context.files.length > 0) {
      for (const file of input.context.files) {
        const fileOp = await this.useSkill('readFile', {
          file_path: `/tmp/uploads/${file.name}`,
          content: file.content
        });
        if (fileOp.success) {
          result.file_operations?.push(fileOp);

          // วิเคราะห์ไฟล์เพื่อหาข้อมูลเพิ่มเติม
          if (file.type.includes('image')) {
            const analysis = await this.useSkill('extractEntities', {
              text: `ภาพที่แนบมาอาจแสดงแผนที่หรือสถานที่: ${file.name}`,
              context: { file_type: 'image' }
            });
            if (analysis.success) {
              result.skills_used?.push(analysis);
            }
          }
        }
      }
    }

    // คำนวณ ETA โดยประมาณ
    if (result.extracted_entities.location && result.extracted_entities.dateTime) {
      const etaSkill = await this.useSkill('calculateETA', {
        origin: result.extracted_entities.location,
        destination: result.extracted_entities.destination ||
                  { lat: 13.7367, lng: 100.5231, address: 'โรงพยาบาลจุฬาลงกรณ์' }, // ค่าเริ่มต้น
        service_type: 'TRIP'
      });
      if (etaSkill.success) {
        result.skills_used?.push(etaSkill);
        // เพิ่ม ETA เข้าไปในผลลัพธ์ถ้าต้องการ
      }
    }

    // แนะนำการดำเนินการต่อไป
    result.suggested_actions.push({
      type: 'API_CALL',
      description: 'ส่งข้อมูลการจองไปยัง Dispatch Agent',
      parameters: {
        endpoint: '/api/dispatch/trip',
        data: {
          service_request: {
            type: 'TRIP',
            datetime: result.extracted_entities.datetime,
            pickup_location: result.extracted_entities.location,
            destination: result.extracted_entities.destination,
            special_requirements: result.extracted_entities.special_requirements || [],
            patient_id: result.extracted_entities.patient_id
          }
        }
      }
    });

    result.intent = 'BOOK_TRIP';
    result.confidence_score = Math.min(0.95, (result.confidence_score || 0.7) + 0.1);

    // บันทึก draft job ลง JobStore (fire-and-forget)
    result.jobId = await this.attemptJobCreation('BOOK_TRIP', result.extracted_entities, input.sessionId);

    return result;
  }

  /**
   * จัดการการจองส่งยา
   */
  private async handleMedicineBooking(
    baseResult: ChatBookingOutput,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const result = { ...baseResult };

    // ตรวจสอบข้อมูลที่จำเป็น
    const requiredFields = ['datetime', 'location'];
    const missingFields = requiredFields.filter(field =>
      !result.extracted_entities[field as keyof typeof result.extracted_entities]
    );

    if (missingFields.length > 0) {
      result.missing_required_fields = missingFields;
      result.clarification_needed = true;
      result.clarification_question = `กรุณาระบุข้อมูลต่อไปนี้: ${missingFields.map(f =>
        f === 'datetime' ? 'วันและเวลา' :
        f === 'location' ? 'ที่อยู่จัดส่ง' : f
      ).join(', ')}`;
      return result;
    }

    // แนะนำการดำเนินการต่อไป
    result.suggested_actions.push({
      type: 'API_CALL',
      description: 'ส่งข้อมูลการจองส่งยาไปยังระบบ',
      parameters: {
        endpoint: '/api/dispatch/medicine',
        data: {
          service_request: {
            type: 'MEDICINE',
            datetime: result.extracted_entities.datetime,
            destination: result.extracted_entities.location,
            special_requirements: result.extracted_entities.special_requirements || [],
            patient_id: result.extracted_entities.patient_id
          }
        }
      }
    });

    result.intent = 'BOOK_MEDICINE';
    result.confidence_score = Math.min(0.95, (result.confidence_score || 0.7) + 0.1);

    // บันทึก draft job ลง JobStore (fire-and-forget)
    result.jobId = await this.attemptJobCreation('BOOK_MEDICINE', result.extracted_entities, input.sessionId);

    return result;
  }

  /**
   * จัดการการจองดูแลที่บ้าน
   */
  private async handleHomeCareBooking(
    baseResult: ChatBookingOutput,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const result = { ...baseResult };

    // ตรวจสอบข้อมูลที่จำเป็น
    const requiredFields = ['datetime', 'location'];
    const missingFields = requiredFields.filter(field =>
      !result.extracted_entities[field as keyof typeof result.extracted_entities]
    );

    if (missingFields.length > 0) {
      result.missing_required_fields = missingFields;
      result.clarification_needed = true;
      result.clarification_question = `กรุณาระบุข้อมูลต่อไปนี้: ${missingFields.map(f =>
        f === 'datetime' ? 'วันและเวลา' :
        f === 'location' ? 'ที่อยู่ให้บริการ' : f
      ).join(', ')}`;
      return result;
    }

    // แนะนำการดำเนินการต่อไป
    result.suggested_actions.push({
      type: 'API_CALL',
      description: 'ส่งข้อมูลการจองดูแลที่บ้านไปยังระบบ',
      parameters: {
        endpoint: '/api/dispatch/home-care',
        data: {
          service_request: {
            type: 'HOME_CARE',
            datetime: result.extracted_entities.datetime,
            location: result.extracted_entities.location,
            special_requirements: result.extracted_entities.special_requirements || [],
            patient_id: result.extracted_entities.patient_id
          }
        }
      }
    });

    result.intent = 'BOOK_HOME_CARE';
    result.confidence_score = Math.min(0.95, (result.confidence_score || 0.7) + 0.1);

    // บันทึก draft job ลง JobStore (fire-and-forget)
    result.jobId = await this.attemptJobCreation('BOOK_HOME_CARE', result.extracted_entities, input.sessionId);

    return result;
  }

  /**
   * จัดการการแก้ไขการจอง
   */
  private async handleModifyBooking(
    baseResult: ChatBookingOutput,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const result = { ...baseResult };

    // ตรวจสอบว่ามี booking_id หรือไม่
    if (!result.extracted_entities.booking_id) {
      result.clarification_needed = true;
      result.clarification_question = 'กรุณาระบุหมายเลขการจองที่ต้องการแก้ไข';
      return result;
    }

    // แนะนำการดำเนินการต่อไป
    result.suggested_actions.push({
      type: 'API_CALL',
      description: 'ดึงข้อมูลการจองปัจจุบันเพื่อแสดงให้ผู้ใช้ดู',
      parameters: {
        endpoint: `/api/bookings/${result.extracted_entities.booking_id}`,
        method: 'GET'
      }
    });

    result.intent = 'MODIFY_BOOKING';
    result.confidence_score = result.confidence_score || 0.7;
    return result;
  }

  /**
   * จัดการการยกเลิกการจอง
   */
  private async handleCancelBooking(
    baseResult: ChatBookingOutput,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const result = { ...baseResult };

    // ตรวจสอบว่ามี booking_id หรือไม่
    if (!result.extracted_entities.booking_id) {
      result.clarification_needed = true;
      result.clarification_question = 'กรุณาระบุหมายเลขการจองที่ต้องการยกเลิก';
      return result;
    }

    // แนะนำการดำเนินการต่อไป
    result.suggested_actions.push({
      type: 'API_CALL',
      description: 'ยืนยันการยกเลิกการจอง',
      parameters: {
        endpoint: `/api/bookings/${result.extracted_entities.booking_id}`,
        method: 'DELETE'
      }
    });

    result.intent = 'CANCEL_BOOKING';
    result.confidence_score = result.confidence_score || 0.8;
    return result;
  }

  /**
   * จัดการการสอบถามสถานะ
   */
  private async handleInquiryStatus(
    baseResult: ChatBookingOutput,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const result = { ...baseResult };

    // ตรวจสอบว่ามี booking_id หรือไม่
    if (!result.extracted_entities.booking_id) {
      result.clarification_needed = true;
      result.clarification_question = 'กรุณาระบุหมายเลขการจองที่ต้องการทราบสถานะ';
      return result;
    }

    // แนะนำการดำเนินการต่อไป
    result.suggested_actions.push({
      type: 'API_CALL',
      description: 'ตรวจสอบสถานะการจอง',
      parameters: {
        endpoint: `/api/bookings/${result.extracted_entities.booking_id}/status`,
        method: 'GET'
      }
    });

    result.intent = 'INQUIRY_STATUS';
    result.confidence_score = result.confidence_score || 0.8;
    return result;
  }

  /**
   * จัดการคำถามทั่วไป
   */
  private async handleGeneralQuery(
    baseResult: ChatBookingOutput,
    input: ChatBookingInput
  ): Promise<ChatBookingOutput> {
    const result = { ...baseResult };

    // สร้างคำตอบทั่วไปโดยใช้สกิล
    const responseSkill = await this.useSkill('generateResponse', {
      prompt: `ผู้ใช้ถามว่า: "${input.message}". ให้ตอบเป็นภาษาไทยอย่างเป็นมิตรและช่วยเหลือ แนะนำบริการหลักของ WelCares ได้แก่ จองรถพยาบาล ส่งยาถึงบ้าน และบริการดูแลผู้ป่วยที่บ้าน`,
      context: input.context
    });

    if (responseSkill.success) {
      result.skills_used?.push(responseSkill);
      // อาจเก็บคำตอบจากสกิลไว้ในผลลัพธ์ถ้าต้องการแสดงทันที
    }

    result.intent = 'GENERAL_QUERY';
    result.confidence_score = result.confidence_score || 0.5;
    return result;
  }

  /**
   * ใช้สกิลที่มีให้บริการ
   */
  private async useSkill(skillName: string, parameters: Record<string, any>): Promise<{
    skill_name: string;
    parameters: Record<string, any>;
    result?: any;
    success: boolean;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const skillFunc = this.availableSkills.get(skillName);
      if (!skillFunc) {
        throw new Error(`Skill not found: ${skillName}`);
      }

      const result = await skillFunc(parameters);

      return {
        skill_name: skillName,
        parameters,
        result,
        success: true,
        error: undefined
      };
    } catch (error) {
      return {
        skill_name: skillName,
        parameters,
        result: undefined,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      // บันทึกเวลาการทำงานของสกิลถ้าต้องการ monitoring
      // const duration = Date.now() - startTime;
    }
  }

  // ============================================================================
  // สกิลจัดการไฟล์
  // ============================================================================

  /**
   * สกิลอ่านไฟล์
   */
  private async readFileSkill(params: { file_path: string; content?: string }): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // ในสภาพแวดล้อมจริง จะใช้ fs.promises.readFile หรือ equivalent
      // ที่นี่เราจำลองการทำงาน
      if (params.content) {
        // หากมีเนื้อหามาให้แล้ว ให้ใช้เนื้อหานั้น
        return { success: true, content: params.content };
      }

      // จำลองการอ่านไฟล์
      return {
        success: true,
        content: `# จำลองเนื้อหาจากไฟล์ ${params.file_path}\n\nนี่คือเนื้อหาตัวอย่างที่อ่านได้จากไฟล์นี้`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลเขียนไฟล์
   */
  private async writeFileSkill(params: { file_path: string; content: string }): Promise<{ success: boolean; error?: string }> {
    try {
      // จำลองการเขียนไฟล์
      console.log(`เขียนไฟล์ ${params.file_path} (ความยาว ${params.content.length} ตัวอักษร)`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลต่อท้ายไฟล์
   */
  private async appendFileSkill(params: { file_path: string; content: string }): Promise<{ success: boolean; error?: string }> {
    try {
      // จำลองการต่อท้ายไฟล์
      console.log(`ต่อท้ายไฟล์ ${params.file_path} (เพิ่ม ${params.content.length} ตัวอักษร)`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลลบไฟล์
   */
  private async deleteFileSkill(params: { file_path: string }): Promise<{ success: boolean; error?: string }> {
    try {
      // จำลองการลบไฟล์
      console.log(`ลบไฟล์ ${params.file_path}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลแสดงรายการไฟล์ในโฟลเดอร์
   */
  private async listFilesSkill(params: { directory_path: string }): Promise<{
    success: boolean;
    files?: Array<{name: string; size: number; type: string}>;
    error?: string
  }> {
    try {
      // จำลองการแสดงรายการไฟล์
      return {
        success: true,
        files: [
          { name: 'example.txt', size: 1024, type: 'text/plain' },
          { name: 'data.json', size: 2048, type: 'application/json' }
        ]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ============================================================================
  // สกิลวิเคราะห์ข้อมูล
  // ============================================================================

  /**
   * สกิลดึงข้อมูลสำคัญจากข้อความ
   */
  private async extractEntitiesSkill(params: { text: string; context?: Record<string, any> }): Promise<{
    success: boolean;
    entities?: Record<string, any>;
    error?: string
  }> {
    try {
      // ใช้ LLM เพื่อดึงข้อมูลสำคัญ
      const prompt = `
ดึงข้อมูลสำคัญจากข้อความต่อไปนี้และตอบเป็น JSON:
"${params.text}"

บริบท: ${JSON.stringify(params.context || {})}

กรุณาตอบในรูปแบบ JSON ที่มีข้อมูลที่ดึงออกมาได้ เช่น วันที่ เวลา สถานที่ เบอร์โทร เป็นต้น
ถ้าไม่พบข้อมูล ให้ตอบเป็นวัตถุเปล่า {}
`;

      const llmResponse = await this.callLLM(prompt);

      // พยายามแยก JSON
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const entities = JSON.parse(jsonMatch[0]);
        return { success: true, entities };
      } else {
        return { success: true, entities: {} };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลตรวจสอบความถูกต้องของการจอง
   */
  private async validateBookingSkill(params: { booking_data: Record<string, any> }): Promise<{
    success: boolean;
    is_valid: boolean;
    errors?: string[];
    error?: string
  }> {
    try {
      const errors: string[] = [];
      const data = params.booking_data;

      // ตรวจสอบฟิลด์พื้นฐาน
      if (!data.service_type || !['TRIP', 'MEDICINE', 'HOME_CARE'].includes(data.service_type)) {
        errors.push('ประเภทบริการไม่ถูกต้อง');
      }

      if (!data.datetime || isNaN(Date.parse(data.datetime))) {
        errors.push('วันและเวลาไม่ถูกต้อง');
      } else {
        const bookingTime = new Date(data.datetime);
        const now = new Date();
        if (bookingTime <= now) {
          errors.push('วันและเวลาต้องอยู่ในอนาคต');
        }
      }

      if (!data.destination && (!data.location || !data.location.address)) {
        errors.push('ต้องระบุที่อยู่ปลายทางหรือที่อยู่เริ่มต้น');
      }

      return {
        success: true,
        is_valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลคำนวณ ETA โดยประมาณ
   */
  private async calculateETASkill(params: {
    origin: { lat: number; lng: number; address: string };
    destination?: { lat: number; lng: number; address: string };
    service_type?: 'TRIP' | 'MEDICINE' | 'HOME_CARE';
    traffic_condition?: 'NORMAL' | 'HEAVY';
  }): Promise<{
    success: boolean;
    eta_minutes?: number;
    distance_km?: number;
    error?: string
  }> {
    try {
      // การคำนวณระยะทางโดยประมาณ (ใช้สูตร Haversine ที่ทำให้ง่ายขึ้น)
      const toRad = (value: number) => value * Math.PI / 180;

      const origin = params.origin;
      const destination = params.destination || {
        lat: 13.7367,
        lng: 100.5231,
        address: 'โรงพยาบาลจุฬาลงกรณ์'
      };

      const lat1 = toRad(origin.lat);
      const lng1 = toRad(origin.lng);
      const lat2 = toRad(destination.lat);
      const lng2 = toRad(destination.lng);

      const dLat = lat2 - lat1;
      const dLng = lng2 - lng1;

      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      // รัศมีโลกในกิโลเมตร
      const R = 6371;
      let distance = R * c;

      // ปรับระยะทางตามสภาพการจราจรและประเภทบริการ
      let speedKmH = 30; // ความเร็วเฉลี่ยในเมือง (กม./ชม.)

      if (params.traffic_condition === 'HEAVY') {
        speedKmH *= 0.6; // จราจรหนาแน่น ลดความเร็วลง 40%
      } else if (params.traffic_condition === 'NORMAL') {
        speedKmH *= 0.8; // จราจรปกติ ลดความเร็วลง 20%
      }

      // ปรับตามประเภทบริการ
      switch (params.service_type) {
        case 'EMERGENCY':
          speedKmH *= 1.5; // ฉุกเฉิน เพิ่มความเร็ว
          break;
        case 'HOME_CARE':
          speedKmH *= 0.8; // ดูแลที่บ้าน อาจต้องระมัดระวังมากขึ้น
          break;
        default:
          break;
      }

      const etaHours = distance / speedKmH;
      const etaMinutes = Math.round(etaHours * 60);

      return {
        success: true,
        eta_minutes: etaMinutes,
        distance_km: Math.round(distance * 10) / 10, // ทศนิยม 1 ตำแหน่ง
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลค้นหาผู้ให้บริการใกล้เคียง
   */
  private async findNearbyProvidersSkill(params: {
    location: { lat: number; lng: number };
    service_type: 'TRIP' | 'MEDICINE' | 'HOME_CARE';
    skills_required?: string[];
    max_distance_km?: number;
  }): Promise<{
    success: boolean;
    providers?: Array<{
      id: string;
      type: 'DRIVER' | 'CAREGIVER' | 'NURSE';
      name: string;
      distance_km: number;
      skills: string[];
      rating: number;
      available: boolean;
    }>;
    error?: string
  }> {
    try {
      // จำลองการค้นหาผู้ให้บริการใกล้เคียง
      // ในระบบจริง จะมีการค้นหาจากฐานข้อมูลหรือบริการแผนที่

      const mockProviders = [
        {
          id: 'prov_001',
          type: 'DRIVER' as const,
          name: 'สมชาย ใจดี',
          distance_km: 2.5,
          skills: ['WHEELCHAIR', 'FIRST_AID'],
          rating: 4.8,
          available: true
        },
        {
          id: 'prov_002',
          type: 'CAREGIVER' as const,
          name: 'ประคอง รักษาไว้',
          distance_km: 3.2,
          skills: ['ELDERLY_CARE', 'MEDICATION_ASSISTANCE'],
          rating: 4.9,
          available: true
        },
        {
          id: 'prov_003',
          type: 'NURSE' as const,
          name: 'บุญเลิศ พยาบาล',
          distance_km: 1.8,
          skills: ['WOUND_CARE', 'IV_THERAPY', 'VITAL_MONITORING'],
          rating: 4.7,
          available: params.service_type === 'HOME_CARE' ? true : false
        }
      ];

      // กรองตามความต้องการทักษะ
      let filteredProviders = mockProviders;
      if (params.skills_required && params.skills_required.length > 0) {
        filteredProviders = mockProviders.filter(provider =>
          params.skills_required!.every(skill =>
            provider.skills.includes(skill)
          )
        );
      }

      // กรองตามระยะทางสูงสุดที่กำหนด
      if (params.max_distance_km) {
        filteredProviders = filteredProviders.filter(
          provider => provider.distance_km <= params.max_distance_km
        );
      }

      // เรียงตามระยะทาง (ใกล้ที่สุดก่อน)
      filteredProviders.sort((a, b) => a.distance_km - b.distance_km);

      return {
        success: true,
        providers: filteredProviders
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ============================================================================
  // สกิลการสื่อสาร
  // ============================================================================

  /**
   * สกิลส่งการแจ้งเตือน
   */
  private async sendNotificationSkill(params: {
    recipient: string;
    channel: 'SMS' | 'LINE' | 'APP_PUSH' | 'EMAIL';
    message: string;
    template_id?: string;
  }): Promise<{
    success: boolean;
    message_id?: string;
    error?: string
  }> {
    try {
      // จำลองการส่งการแจ้งเตือน
      console.log(`ส่งการแจ้งเตือนไปยัง ${params.recipient} ผ่าน ${params.channel}: ${params.message.substring(0, 50)}...`);

      // สร้าง message ID จำลอง
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        message_id: messageId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลสร้างคำตอบโดยใช้ LLM
   */
  private async generateResponseSkill(params: {
    prompt: string;
    context?: Record<string, any>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<{
    success: boolean;
    response?: string;
    error?: string
  }> {
    try {
      const llmResponse = await this.callLLM(params.prompt, {
        temperature: params.temperature,
        max_tokens: params.max_tokens
      });

      return {
        success: true,
        response: llmResponse.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * สกิลแปลข้อความ
   */
  private async translateTextSkill(params: {
    text: string;
    source_lang: 'th' | 'en';
    target_lang: 'th' | 'en';
  }): Promise<{
    success: boolean;
    translated_text?: string;
    error?: string
  }> {
    try {
      // จำลองการแปลข้อความ
      // ในระบบจริง จะใช้บริการแปลภาษาเช่น Google Translate API หรือ DeepL

      if (params.source_lang === params.target_lang) {
        return { success: true, translated_text: params.text };
      }

      // ตัวอย่างการแปลง่ายๆ (ในความเป็นจริงควรใช้บริการแปลจริง)
      const translations: Record<string, Record<string, string>> = {
        'th': {
          'en': {
            'สวัสดี': 'Hello',
            'ขอบคุณ': 'Thank you',
            'ต้องการความช่วยเหลือ': 'Need assistance',
            'จองรถ': 'Book a vehicle',
            'ส่งยา': 'Deliver medicine',
            'ดูแลที่บ้าน': 'Home care'
          }
        },
        'en': {
          'th': {
            'Hello': 'สวัสดี',
            'Thank you': 'ขอบคุณ',
            'Need assistance': 'ต้องการความช่วยเหลือ',
            'Book a vehicle': 'จองรถ',
            'Deliver medicine': 'ส่งยา',
            'Home care': 'ดูแลที่บ้าน'
          }
        }
      };

      const sourceDict = translations[params.source_lang];
      if (sourceDict && sourceDict[params.target_lang]) {
        // แปลคำต่อคำแบบง่ายๆ (ในความเป็นจริงควรใช้ NLP ที่ซับซ้อนกว่า)
        let translated = params.text;
        Object.entries(sourceDict[params.target_lang] as Record<string, string>).forEach(([th, en]) => {
          if (params.source_lang === 'th') {
            translated = translated.split(th).join(en);
          } else {
            translated = translated.split(en).join(th);
          }
        });

        return { success: true, translated_text: translated };
      }

      // ถ้าไม่มีในพจนานุกรม ให้คืนต้นฉบับและแจ้งว่าไม่สามารถแปลได้
      return {
        success: true,
        translated_text: params.text,
        // ในความเป็นจริงอาจจะต้องมีฟิลด์เพิ่มเติมเพื่อแสดงว่าการแปลไม่สมบูรณ์
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // ============================================================================
  // เมธอดช่วยเหลือภายใน
  // ============================================================================

  /**
   * เรียกใช้ LLM ผ่าน API
   */
  private async callLLM(prompt: string, options: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
    const { temperature = 0.3, max_tokens = 500 } = options;

    // ในระบบจริง จะเรียกใช้ผ่าน OpenRouter proxy หรือ API ที่ตั้งค่าไว้
    // ที่นี่เราจำลองการทำงาน

    // จำลองการหน่วงเวลาเพื่อแสดงว่ากำลังประมวลผล
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

    // สร้างผลลัพธ์จำลองตามประเภทของ prompt
    if (prompt.includes('วิเคราะห์เจตนา') || prompt.includes('analyze intent')) {
      return this.generateMockIntentResponse(prompt);
    } else if (prompt.includes('ดึงข้อมูลสำคัญ') || prompt.includes('extract entities')) {
      return this.generateMockEntitiesResponse(prompt);
    } else if (prompt.includes('สร้างคำตอบ') || prompt.includes('generate response')) {
      return this.generateMockGeneralResponse(prompt);
    } else {
      // ผลลัพธ์ทั่วไป
      return `ประมวลผลเรียบร้อยแล้ว: "${prompt.substring(0, 50)}..."`;
    }
  }

  /**
   * สร้างผลลัพธ์จำลองสำหรับการวิเคราะห์เจตนา
   */
  private generateMockIntentResponse(prompt: string): string {
    // ตรวจสอบว่ามีข้อมูลสำคัญใน prompt หรือไม่
    if (prompt.includes('จอง') || prompt.includes('book')) {
      if (prompt.includes('ยา') || prompt.includes('medicine')) {
        return JSON.stringify({
          intent: 'BOOK_MEDICINE',
          extracted_entities: {
            service_type: 'MEDICINE',
            datetime: '2026-04-11T14:30:00',
            location: { lat: 13.7563, lng: 100.5018, address: 'บ้านพักอาศัย' }
          },
          confidence_score: 0.85,
          missing_required_fields: [],
          clarification_needed: false,
          clarification_question: ''
        });
      } else if (prompt.includes('ที่บ้าน') || prompt.includes('home')) {
        return JSON.stringify({
          intent: 'BOOK_HOME_CARE',
          extracted_entities: {
            service_type: 'HOME_CARE',
            datetime: '2026-04-12T09:00:00',
            location: { lat: 13.7563, lng: 100.5018, address: 'บ้านพักอาศัย' }
          },
          confidence_score: 0.8,
          missing_required_fields: [],
          clarification_needed: false,
          clarification_question: ''
        });
      } else {
        return JSON.stringify({
          intent: 'BOOK_TRIP',
          extracted_entities: {
            service_type: 'TRIP',
            datetime: '2026-04-11T09:00:00',
            location: { lat: 13.7563, lng: 100.5018, address: 'บ้านพักอาศัย' },
            destination: { lat: 13.7367, lng: 100.5231, address: 'โรงพยาบาลจุฬาลงกรณ์' }
          },
          confidence_score: 0.9,
          missing_required_fields: [],
          clarification_needed: false,
          clarification_question: ''
        });
      }
    } else if (prompt.includes('ยกเลิก') || prompt.includes('cancel')) {
      return JSON.stringify({
        intent: 'CANCEL_BOOKING',
        extracted_entities: {
          booking_id: 'BK-20260410-001'
        },
        confidence_score: 0.85,
        missing_required_fields: [],
        clarification_needed: false,
        clarification_question: ''
      });
    } else if (prompt.includes('สถานะ') || prompt.includes('status')) {
      return JSON.stringify({
        intent: 'INQUIRY_STATUS',
        extracted_entities: {
          booking_id: 'BK-20260410-001'
        },
        confidence_score: 0.8,
        missing_required_fields: [],
        clarification_needed: false,
        clarification_question: ''
      });
    } else {
      return JSON.stringify({
        intent: 'GENERAL_QUERY',
        extracted_entities: {},
        confidence_score: 0.4,
        missing_required_fields: ['ข้อมูลเพิ่มเติม'],
        clarification_needed: true,
        clarification_question: 'กรุณาอธิบายความต้องการของคุณให้ชัดเจนขึ้นครับ'
      });
    }
  }

  /**
   * สร้างผลลัพธ์จำลองสำหรับการดึงข้อมูลสำคัญ
   */
  private generateMockEntitiesResponse(prompt: string): string {
    // ดึงวันที่เวลาจากข้อความใน prompt
    const dateMatch = prompt.match(/\d{4}-\d{2}-\d{2}/);
    const timeMatch = prompt.match(/\d{1,2}:\d{2}/);

    let datetime = '';
    if (dateMatch && timeMatch) {
      datetime = `${dateMatch[0]}T${timeMatch[0]}:00`;
    } else if (dateMatch) {
      datetime = `${dateMatch[0]}T10:00:00`; // เวลาเริ่มต้น默认
    }

    return JSON.stringify({
      datetime: datetime,
      locations: [
        {
          address: prompt.includes('โรงพยาบาล') ? 'โรงพยาบาลจุฬาลงกรณ์' :
                   prompt.includes('บ้าน') ? 'ที่พักอาศัย' :
                   'สถานที่ไม่ระบุ'
        }
      ],
      contact_info: prompt.match(/\d{9,}/)?.[0] || undefined
    });
  }

  /**
   * สร้างผลลัพธ์จำลองสำหรับการสร้างคำตอบทั่วไป
   */
  private generateMockGeneralResponse(prompt: string): string {
    if (prompt.includes('สวัสดี') || prompt.includes('hello')) {
      return 'สวัสดีครับ! ยินดีต้อนรับสู่ WelCares บริการสุขภาพอัจฉริยะของเรา มีอะไรให้ผมช่วยเหลือวันนี้ครับ?';
    } else if (prompt.includes('ขอบคุณ') || prompt.includes('thank')) {
      return 'ยินดีครับ! หากคุณต้องการความช่วยเหลือเพิ่มเติม อย่าลังเลที่จะติดต่อมาใหม่นะครับ';
    } else if (prompt.includes('ช่วยเหลือ') || prompt.includes('help')) {
      return 'ผมสามารถช่วยคุณจองรถพยาบาล ส่งยาถึงบ้าน หรือจัดบริการดูแลผู้ป่วยที่บ้านได้ครับ เพียงบอกความต้องการของคุณมาได้เลย';
    } else {
      return 'ขอบคุณที่ใช้บริการ WelCares มีอะไรให้ช่วยเหลือเพิ่มเติมไหมครับ?';
    }
  }
}

// Export เพื่อใช้ในไฟล์อื่นๆ
export default ChatBookingAgent;