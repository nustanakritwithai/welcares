/**
 * คลาสพื้นฐานสำหรับทุก Agent ในระบบ WelCares
 * ให้ฟังก์ชันพื้นฐานและมาตรฐานที่ทุก Agent ควรมี
 */
export interface AgentInput {
  /** รหัสคำขอที่ไม่ซ้ำกัน */
  requestId: string;
  /** เวลาที่สร้างคำขอ */
  timestamp: string;
  /** ข้อมูลเพิ่มเติมที่เฉพาะเจาะจงกับแต่ละ Agent */
  [key: string]: any;
}

export interface AgentOutput {
  /** รหัสคำขอที่ไม่ซ้ำกัน (ต้องตรงกับ input) */
  requestId: string;
  /** เวลาที่สร้างผลลัพธ์ */
  timestamp: string;
  /** บ่งบอกว่าการประมวลผลสำเร็จหรือไม่ */
  success: boolean;
  /** ข้อความข้อผิดพลาดเมื่อ success = false */
  error?: string;
  /** ข้อมูลเพิ่มเติมที่เฉพาะเจาะจงกับแต่ละ Agent */
  [key: string]: any;
}

export interface AgentConfig {
  /** โมเดล LLM ที่จะใช้ */
  model: string;
  /** อุณหภูมิสำหรับการสุ่ม (0.0-1.0) */
  temperature: number;
  /** จำนวนโทเค็นสูงสุดที่จะสร้าง */
  maxTokens: number;
  /** เวลาหมดเวลาในการเรียก LLM (มิลลิวินาที) */
  timeoutMs: number;
  /** จำนวนครั้งที่จะลองใหม่เมื่อล้มเหลว */
  retryAttempts: number;
}

/**
 * คลาสพื้นฐานที่ทุก Agent ควรสืบทอดมา
 * ให้โครงสร้างมาตรฐานและฟังก์ชันพื้นฐาน
 */
export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * ตรวจสอบความถูกต้องของการตั้งค่า
   */
  protected validateConfig(config: AgentConfig): void {
    if (!config.model) {
      throw new Error('Model must be specified');
    }
    if (config.temperature < 0 || config.temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    if (config.maxTokens <= 0) {
      throw new Error('Max tokens must be positive');
    }
    if (config.timeoutMs <= 0) {
      throw new Error('Timeout must be positive');
    }
    if (config.retryAttempts < 0) {
      throw new Error('Retry attempts cannot be negative');
    }
  }

  /**
   * เมธอดหลักสำหรับประมวลผลคำขอ
   * จะเรียกใช้ validateInput, execute และ validateOutput ตามลำดับ
   */
  public async process(input: AgentInput): Promise<AgentOutput> {
    try {
      // ขั้นตอนที่ 1: ตรวจสอบ input
      this.validateInput(input);

      // ขั้นตอนที่ 2: ประมวลผลหลัก (ต้อง implement ในคลาสลูก)
      const result = await this.execute(input);

      // ขั้นตอนที่ 3: ตรวจสอบ output
      this.validateOutput(result);

      // เพิ่มข้อมูลพื้นฐาน
      return {
        ...result,
        requestId: input.requestId,
        timestamp: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      // จัดการข้อผิดพลาด
      return this.handleError(error, input);
    }
  }

  /**
   * ตรวจสอบความถูกต้องของ input
   * คลาสลูกสามารถ override เพื่อเพิ่มการตรวจสอบเฉพาะเจาะจง
   */
  protected validateInput(input: AgentInput): void {
    if (!input.requestId) {
      throw new Error('Request ID is required');
    }
    if (!input.timestamp) {
      throw new Error('Timestamp is required');
    }
  }

  /**
   * เมธอดที่ต้อง implement ในคลาสลูกสำหรับการประมวลผลหลัก
   */
  protected abstract execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * ตรวจสอบความถูกต้องของ output
   * คลาสลูกสามารถ override เพื่อเพิ่มการตรวจสอบเฉพาะเจาะจง
   */
  protected validateOutput(output: AgentOutput): void {
    if (!output.requestId) {
      throw new Error('Output must contain requestId');
    }
    if (output.requestId !== undefined && output.requestId.length === 0) {
      throw new Error('Request ID cannot be empty');
    }
    if (!output.timestamp) {
      throw new Error('Output must contain timestamp');
    }
  }

  /**
   * จัดการข้อผิดพลาดและสร้างผลลัพธ์ตอบกลับ
   */
  protected handleError(error: Error, input: AgentInput): AgentOutput {
    console.error(`[${this.constructor.name}] Error processing request ${input.requestId}:`, error);

    return {
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      success: false,
      error: error instanceof Error ? error.message : String(error),
      // รักษาข้อมูลเพิ่มเติมจาก input ไว้เผื่อจำเป็น
      ...(input.requestId ? { originalRequestId: input.requestId } : {})
    };
  }

  /**
   * เมธอดช่วยเหลือสำหรับการเรียกใช้ LLM
   * คลาสลูกสามารถ override เพื่อใช้บริการ LLM ที่แตกต่างกัน
   */
  protected async callLLM(prompt: string, options: { temperature?: number; max_tokens?: number } = {}): Promise<string> {
    // การ implement จริงจะขึ้นอยู่กับว่าใช้บริการ LLM ใด
    // ในตัวอย่างนี้ เราจะสร้างผลลัพธ์จำลอง
    // ในระบบจริง ควรเรียกใช้ผ่าน API ที่เหมาะสม (เช่น OpenRouter proxy)

    // จำลองการหน่วงเวลา
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));

    // สร้างผลลัพธ์จำลองเรียบง่าย
    return `LLM Response (simulated): Processed "${prompt.substring(0, 30)}..."`;
  }

  /**
   * เมธอดช่วยเหลือสำหรับการบันทึก log
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      agent: this.constructor.name,
      message,
      ...(meta || {})
    };

    switch (level) {
      case 'error':
        console.error(JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn(JSON.stringify(logEntry));
        break;
      default:
        console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * เมธอดช่วยเหลือสำหรับการสร้างรหัสสุ่ม
   */
  protected generateId(prefix: string = ''): string {
    const randomPart = Math.random().toString(36).substr(2, 9);
    const timestampPart = Date.now().toString(36);
    return `${prefix}${randomPart}${timestampPart}`;
  }
}