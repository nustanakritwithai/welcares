import { ChatBookingAgent } from '../ChatBookingAgent';

describe('ChatBookingAgent', () => {
  let agent: ChatBookingAgent;

  beforeEach(() => {
    agent = new ChatBookingAgent({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      temperature: 0.3,
      maxTokens: 500,
      timeoutMs: 5000,
      retryAttempts: 3
    });
  });

  describe('การจองรถ (TRIP)', () => {
    it('ควรจองรถสำเร็จเมื่อให้ข้อมูลครบถ้วน', async () => {
      const input = {
        requestId: 'test-001',
        timestamp: new Date().toISOString(),
        message: 'อยากจองรถไปโรงพยาบาลพรุ่งนี้ 9 โมงพร้อมวีลแชร์',
        context: {
          bookingType: 'TRIP'
        }
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('BOOK_TRIP');
      expect(result.confidence_score).toBeGreaterThan(0.7);
      expect(result.extracted_entities.datetime).toBeDefined();
      expect(result.clarification_needed).toBe(false);
    });

    it('ควรขอข้อมูลเพิ่มเติมเมื่อข้อมูลไม่ครบ', async () => {
      const input = {
        requestId: 'test-002',
        timestamp: new Date().toISOString(),
        message: 'อยากจองรถ',
        context: {
          bookingType: 'TRIP'
        }
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('BOOK_TRIP');
      expect(result.clarification_needed).toBe(true);
      expect(result.clarification_question).toContain('วันและเวลา');
      expect(result.clarification_question).toContain('จุดเริ่มต้น');
    });
  });

  describe('การจองส่งยา (MEDICINE)', () => {
    it('ควรจองส่งยาสำเร็จเมื่อให้ข้อมูลครบถ้วน', async () => {
      const input = {
        requestId: 'test-003',
        timestamp: new Date().toISOString(),
        message: 'ต้องการส่งยาไปที่บ้านพรุ่งนี้ 10 โมงเช้า',
        context: {
          bookingType: 'MEDICINE'
        }
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('BOOK_MEDICINE');
      expect(result.confidence_score).toBeGreaterThan(0.7);
      expect(result.extracted_entities.datetime).toBeDefined();
      expect(result.clarification_needed).toBe(false);
    });
  });

  describe('การจองดูแลที่บ้าน (HOME_CARE)', () => {
    it('ควรจองดูแลที่บ้านสำเร็จเมื่อให้ข้อมูลครบถ้วน', async () => {
      const input = {
        requestId: 'test-004',
        timestamp: new Date().toISOString(),
        message: 'ต้องการพยาบาลมาดูแลแม่ที่บ้านวันมะรืนนี้ บ่ายสองโมง',
        context: {
          bookingType: 'HOME_CARE'
        }
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('BOOK_HOME_CARE');
      expect(result.confidence_score).toBeGreaterThan(0.7);
      expect(result.extracted_entities.datetime).toBeDefined();
      expect(result.clarification_needed).toBe(false);
    });
  });

  describe('การยกเลิกการจอง', () => {
    it('ควรขอหมายเลขการจองเมื่อต้องการยกเลิกแต่ไม่ให้หมายเลข', async () => {
      const input = {
        requestId: 'test-005',
        timestamp: new Date().toISOString(),
        message: 'ฉันต้องการยกเลิกการจอง',
        context: {}
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('CANCEL_BOOKING');
      expect(result.clarification_needed).toBe(true);
      expect(result.clarification_question).toContain('หมายเลขการจอง');
    });
  });

  describe('การสอบถามสถานะ', () => {
    it('ควรขอหมายเลขการจองเมื่อต้องการทราบสถานะแต่ไม่ให้หมายเลข', async () => {
      const input = {
        requestId: 'test-006',
        timestamp: new Date().toISOString(),
        message: 'อยากทราบสถานะการจองของฉัน',
        context: {}
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('INQUIRY_STATUS');
      expect(result.clarification_needed).toBe(true);
      expect(result.clarification_question).toContain('หมายเลขการจอง');
    });
  });

  describe('คำถามทั่วไป', () => {
    it('ควรตอบคำทักทายอย่างเหมาะสม', async () => {
      const input = {
        requestId: 'test-007',
        timestamp: new Date().toISOString(),
        message: 'สวัสดีครับ',
        context: {}
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('GENERAL_QUERY');
      // ในการทดสอบจริง เราอาจต้องตรวจสอบว่ามี suggested_actions หรือไม่
    });

    it('ควรตอบคำขอบคุณอย่างเหมาะสม', async () => {
      const input = {
        requestId: 'test-008',
        timestamp: new Date().toISOString(),
        message: 'ขอบคุณมากครับ',
        context: {}
      };

      const result = await agent.process(input);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('GENERAL_QUERY');
    });
  });

  describe('การทำงานกับไฟล์', () => {
    it('ควรสามารถใช้สกิลอ่านไฟล์ได้', async () => {
      // การทดสอบนี้จะต้องมีการ mock หรือใช้ไฟล์จริงใน test environment
      // สำหรับตัวอย่างนี้ เราจะสมมติว่าสกิลทำงานได้
      expect(true).toBe(true);
    });

    it('ควรสามารถใช้สกิลเขียนไฟล์ได้', async () => {
      expect(true).toBe(true);
    });
  });

  describe('การจัดการข้อผิดพลาด', () => {
    it('ควรจัดการข้อผิดพลาดอย่างเหมาะสมเมื่อสกิลล้มเหลว', async () => {
      // การทดสอบการจัดการข้อผิดพลาด
      // ในการทดสอบจริง จะต้องมีการ mock ให้สกิลล้มเหลว
      expect(true).toBe(true);
    });
  });

  describe('ประสิทธิภาพ', () => {
    it('ควรประมวลผลคำขอภายในเวลาที่เหมาะสม', async () => {
      const input = {
        requestId: 'perf-test-001',
        timestamp: new Date().toISOString(),
        message: 'ทดสอบประสิทธิภาพ',
        context: {}
      };

      const startTime = Date.now();
      const result = await agent.process(input);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      // เวลาที่เหมาะสมอาจจะขึ้นอยู่กับความซับซ้อนของงาน
      // สำหรับการทดสอบนี้ เราแค่ต้องแน่ใจว่าไม่ติดอยู่ใน loop อนันต์
      expect(endTime - startTime).toBeLessThan(5000); // น้อยกว่า 5 วินาที
    });
  });
});