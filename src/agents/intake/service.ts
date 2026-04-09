/**
 * Intake Agent - API Service
 * ส่ง Job Spec ต่อให้ Backend/Service Layer ใช้งานได้
 */

import type {
  IntakeFormData,
  JobSpec,
  IntakeRequest,
  IntakeResponse,
  ValidationResult,
  FollowUpQuestion,
} from './types';
import { IntakeValidator } from './validator';
import { IntakeTransformer } from './transformer';

// ==================== CONFIGURATION ====================

const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// ==================== SERVICE CLASS ====================

export class IntakeAgentService {
  private sessionId: string;
  private currentFormData: Partial<IntakeFormData>;
  private previousQuestions: FollowUpQuestion[];

  constructor(sessionId?: string) {
    this.sessionId = sessionId || this.generateSessionId();
    this.currentFormData = {};
    this.previousQuestions = [];
  }

  /**
   * สร้าง Session ID ใหม่
   */
  private generateSessionId(): string {
    return `intake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * รับข้อมูลจาก form และประมวลผล
   * @returns ValidationResult + คำถามติดตาม (ถ้ามี)
   */
  async processInput(
    field: keyof IntakeFormData,
    value: unknown
  ): Promise<{
    isComplete: boolean;
    validation: ValidationResult;
    nextQuestion: FollowUpQuestion | null;
    progress: { total: number; completed: number; percentage: number };
  }> {
    // อัพเดตข้อมูล
    this.currentFormData = {
      ...this.currentFormData,
      [field]: value,
    };

    // ตรวจสอบความถูกต้อง
    const validation = IntakeValidator.validate(this.currentFormData);

    // หาคำถามต่อไป
    const nextQuestion = IntakeValidator.generateNextQuestion(this.currentFormData);

    // คำนวณ progress
    const progress = IntakeValidator.getProgress(this.currentFormData);

    return {
      isComplete: validation.isComplete,
      validation,
      nextQuestion,
      progress: {
        total: progress.total,
        completed: progress.completed,
        percentage: progress.percentage,
      },
    };
  }

  /**
   * รับข้อมูลทั้งหมดจาก form ครั้งเดียว
   */
  async submitForm(formData: IntakeFormData): Promise<IntakeResponse> {
    // ตรวจสอบก่อนส่ง
    const validation = IntakeValidator.validate(formData);

    if (!validation.isValid) {
      return {
        success: false,
        validation,
        error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบ',
      };
    }

    if (!validation.isComplete) {
      return {
        success: false,
        validation,
        error: 'ข้อมูลไม่ครบถ้วน',
      };
    }

    try {
      // แปลงเป็น JobSpec
      const jobSpec = IntakeTransformer.transform(formData);

      // ส่งไป backend
      const result = await this.submitToBackend(jobSpec);

      return {
        success: true,
        jobSpec: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ',
      };
    }
  }

  /**
   * ส่ง Job Spec ไป Backend
   */
  private async submitToBackend(jobSpec: JobSpec): Promise<JobSpec> {
    const url = `${API_CONFIG.baseUrl}/intake/jobs`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': this.sessionId,
      },
      body: JSON.stringify(jobSpec),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * ดึง Job Spec ที่สร้างไปแล้ว
   */
  async getJob(jobId: string): Promise<JobSpec | null> {
    try {
      const url = `${API_CONFIG.baseUrl}/intake/jobs/${jobId}`;
      const response = await fetch(url, {
        headers: { 'X-Session-ID': this.sessionId },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * อัพเดต Job Spec
   */
  async updateJob(jobId: string, updates: Partial<JobSpec>): Promise<JobSpec> {
    const url = `${API_CONFIG.baseUrl}/intake/jobs/${jobId}`;
    
    const response = await this.fetchWithRetry(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': this.sessionId,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * ยกเลิก Job
   */
  async cancelJob(jobId: string, reason?: string): Promise<boolean> {
    try {
      const url = `${API_CONFIG.baseUrl}/intake/jobs/${jobId}/cancel`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': this.sessionId,
        },
        body: JSON.stringify({ reason }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * ดึงประวัติการสนทนา/คำถามที่เคยถาม
   */
  getConversationHistory(): FollowUpQuestion[] {
    return [...this.previousQuestions];
  }

  /**
   * รีเซ็ต session
   */
  reset(): void {
    this.currentFormData = {};
    this.previousQuestions = [];
    this.sessionId = this.generateSessionId();
  }

  /**
   * ดึง Session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * ดึงข้อมูล form ปัจจุบัน
   */
  getCurrentFormData(): Partial<IntakeFormData> {
    return { ...this.currentFormData };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string, 
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt < API_CONFIG.retryAttempts) {
        await this.delay(API_CONFIG.retryDelay * attempt);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * สร้าง IntakeAgent instance ใหม่
 */
export function createIntakeAgent(sessionId?: string): IntakeAgentService {
  return new IntakeAgentService(sessionId);
}

/**
 * ตรวจสอบข้อมูลแบบ standalone (ไม่ต้องสร้าง instance)
 */
export function validateIntakeData(formData: Partial<IntakeFormData>): ValidationResult {
  return IntakeValidator.validate(formData);
}

/**
 * แปลงข้อมูลเป็น JobSpec แบบ standalone
 */
export function transformToJobSpec(formData: IntakeFormData): JobSpec {
  return IntakeTransformer.transform(formData);
}

export default IntakeAgentService;
