/**
 * Intake Agent - Service Layer (MVP)
 * จัดการการสื่อสารกับ API และ business logic สำหรับ WelCares Intake Agent
 * 
 * @version 1.0
 * @module src/agents/intake/service
 */

import type {
  IntakeInput,
  PartialIntakeInput,
  JobSpec,
  ValidationResult,
  ValidationError,
  FollowUpQuestion,
  IntakePreviewResult,
  IntakeSubmitResult,
  IntakeServiceConfig,
  ServiceError,
  ServiceErrorType,
} from './types';

import {
  validateFormData,
  normalizeInput,
  ValidateFormDataResult,
} from './validator';

import {
  transformToJobSpec,
} from './transformer';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: IntakeServiceConfig = {
  baseUrl: process.env.INTAKE_API_URL || 'https://api.welcares.com/v1',
  timeout: 30000,        // 30 seconds
  retryAttempts: 3,      // 3 attempts total (initial + 2 retries)
  retryDelay: 1000,      // 1 second between retries
};

/**
 * Get service configuration
 * อ่านจาก env หรือใช้ default
 */
function getConfig(): IntakeServiceConfig {
  return {
    baseUrl: process.env.INTAKE_API_URL || DEFAULT_CONFIG.baseUrl,
    timeout: parseInt(process.env.INTAKE_API_TIMEOUT || '', 10) || DEFAULT_CONFIG.timeout,
    retryAttempts: parseInt(process.env.INTAKE_RETRY_ATTEMPTS || '', 10) || DEFAULT_CONFIG.retryAttempts,
    retryDelay: parseInt(process.env.INTAKE_RETRY_DELAY || '', 10) || DEFAULT_CONFIG.retryDelay,
  };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * สร้าง ServiceError จาก error ที่เกิดขึ้น
 * ไม่รวม PII ใน error message
 */
function createServiceError(error: unknown): ServiceError {
  if (error instanceof IntakeServiceError) {
    return {
      type: error.type,
      message: error.message,
      statusCode: error.statusCode,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')) {
      return {
        type: 'network_error',
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        retryable: true,
      };
    }

    // Timeout errors
    if (error.message.includes('timeout') || 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('AbortError')) {
      return {
        type: 'timeout_error',
        message: 'หมดเวลาการเชื่อมต่อ',
        retryable: true,
      };
    }

    return {
      type: 'unknown_error',
      message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      retryable: false,
    };
  }

  return {
    type: 'unknown_error',
    message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
    retryable: false,
  };
}

/**
 * Custom error class for intake service
 */
class IntakeServiceError extends Error {
  constructor(
    public type: ServiceErrorType,
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'IntakeServiceError';
  }
}

// ============================================================================
// PII PROTECTION
// ============================================================================

/**
 * Sanitize log message - ลบ PII ออกจาก log
 * แสดงเฉพาะ field name ไม่แสดงค่า
 */
function sanitizeForLog(formData: PartialIntakeInput): string {
  const fields: string[] = [];
  
  if (formData.contact?.contactName) fields.push('contact.contactName');
  if (formData.contact?.contactPhone) fields.push('contact.contactPhone');
  if (formData.contact?.contactEmail) fields.push('contact.contactEmail');
  if (formData.patient?.name) fields.push('patient.name');
  if (formData.service?.serviceType) fields.push('service.serviceType');
  if (formData.schedule?.appointmentDate) fields.push('schedule.appointmentDate');
  if (formData.schedule?.appointmentTime) fields.push('schedule.appointmentTime');
  if (formData.locations?.pickup?.address) fields.push('locations.pickup.address');
  if (formData.locations?.dropoff?.address) fields.push('locations.dropoff.address');
  
  return `FormData[${fields.join(', ')}]`;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * แปลง ValidateFormDataResult เป็น ValidationResult (types.ts format)
 */
function toValidationResult(result: ValidateFormDataResult): ValidationResult {
  const total = 15; // ประมาณจำนวน fields ทั้งหมดที่ต้องกรอก
  const completed = total - result.missingFields.length;
  
  return {
    isValid: result.warnings.filter(w => w.severity === 'error').length === 0,
    isComplete: result.isComplete,
    errors: result.warnings,
    missingFields: result.missingFields,
    followUpQuestions: result.missingFields.map(field => ({
      field,
      question: result.nextQuestion || `ขอข้อมูล ${field} ด้วยครับ`,
      type: inferQuestionType(field),
      required: true,
    })),
    progress: {
      total,
      completed: Math.max(0, completed),
      percentage: Math.round((Math.max(0, completed) / total) * 100),
    },
  };
}

/**
 * ประมาณการ type ของคำถามจาก field name
 */
function inferQuestionType(field: string): 'text' | 'boolean' | 'choice' | 'date' | 'time' | 'number' {
  if (field.includes('Date')) return 'date';
  if (field.includes('Time')) return 'time';
  if (field.includes('Age')) return 'number';
  if (field.includes('needs') || field.includes('Required')) return 'boolean';
  if (field.includes('serviceType') || field.includes('mobilityLevel') || field.includes('relationship')) return 'choice';
  return 'text';
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

/**
 * Sleep function สำหรับ retry delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ตรวจสอบว่า error ควร retry หรือไม่
 * Retry เฉพาะ: network error, timeout, 5xx server errors
 * ไม่ retry: 4xx client errors
 */
function shouldRetry(error: ServiceError): boolean {
  if (!error.retryable) return false;
  
  // ไม่ retry 4xx errors (client errors)
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }
  
  return true;
}

/**
 * ส่ง POST request พร้อม retry logic
 */
async function postWithRetry<T>(
  endpoint: string,
  data: unknown,
  config: IntakeServiceConfig
): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;
  const lastAttempt = config.retryAttempts - 1;
  
  for (let attempt = 0; attempt <= lastAttempt; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // จัดการ HTTP errors
      if (!response.ok) {
        const statusCode = response.status;
        
        // 4xx errors - ไม่ retry
        if (statusCode >= 400 && statusCode < 500) {
          throw new IntakeServiceError(
            'validation_error',
            `ข้อมูลไม่ถูกต้อง (${statusCode})`,
            statusCode,
            false
          );
        }
        
        // 5xx errors - retry ได้
        if (statusCode >= 500) {
          throw new IntakeServiceError(
            'server_error',
            `เซิร์ฟเวอร์เกิดข้อผิดพลาด (${statusCode})`,
            statusCode,
            true
          );
        }
        
        throw new IntakeServiceError(
          'unknown_error',
          `HTTP Error ${statusCode}`,
          statusCode,
          false
        );
      }
      
      return await response.json() as T;
      
    } catch (error) {
      const serviceError = createServiceError(error);
      
      // ถ้าเป็น attempt สุดท้าย หรือไม่ควร retry → throw error
      if (attempt === lastAttempt || !shouldRetry(serviceError)) {
        throw error instanceof IntakeServiceError 
          ? error 
          : new IntakeServiceError(
              serviceError.type,
              serviceError.message,
              serviceError.statusCode,
              serviceError.retryable
            );
      }
      
      // รอก่อน retry
      await sleep(config.retryDelay * (attempt + 1)); // Exponential backoff
    }
  }
  
  // ไม่ควรถึงบรรทัดนี้
  throw new IntakeServiceError('unknown_error', 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', undefined, false);
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Preview intake form - normalize + validate + transform
 * 
 * ถ้าข้อมูลไม่ครบ → return validation result พร้อม missing fields
 * ถ้าข้อมูลครบ → return preview with JobSpec
 * 
 * @param formData - ข้อมูล form ที่ผู้ใช้กรอก (อาจไม่ครบ)
 * @returns IntakePreviewResult พร้อม validation หรือ JobSpec
 */
export async function previewIntake(
  formData: PartialIntakeInput
): Promise<IntakePreviewResult> {
  try {
    // 1. Normalize input
    const { normalizedData } = normalizeInput(formData);
    
    // 2. Validate
    const validationResult = validateFormData(formData);
    
    // 3. ถ้ายังไม่ครบ → return validation result
    if (!validationResult.isComplete) {
      return {
        success: false,
        validation: toValidationResult(validationResult),
      };
    }
    
    // 4. ถ้าครบแล้ว → transform เป็น JobSpec
    // Type assertion: เรารู้ว่าข้อมูลครบแล้วจาก isComplete
    const completeData = normalizedData as IntakeInput;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const jobSpec = transformToJobSpec(completeData, sessionId);
    
    return {
      success: true,
      jobSpec,
    };
    
  } catch (error) {
    // Log error โดยไม่รวม PII
    console.error('[previewIntake] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล',
    };
  }
}

/**
 * Submit intake form ไปยัง API
 * 
 * 1. Validate ข้อมูลก่อนส่ง
 * 2. POST ไปยัง endpoint
 * 3. Retry 2-3 ครั้งสำหรับ network/timeout/5xx (ไม่ retry 4xx)
 * 
 * @param formData - ข้อมูล form ที่ผู้ใช้กรอก
 * @returns IntakeSubmitResult พร้อม jobId หรือ error
 */
export async function submitIntake(
  formData: PartialIntakeInput
): Promise<IntakeSubmitResult> {
  const config = getConfig();
  
  try {
    // 1. Validate ก่อนส่ง
    const { normalizedData } = normalizeInput(formData);
    const validationResult = validateFormData(formData);
    
    if (!validationResult.isComplete) {
      return {
        success: false,
        error: 'ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลให้ครบ',
        errorType: 'validation_error',
      };
    }
    
    // 2. ตรวจสอบว่ามี validation errors
    const hasErrors = validationResult.warnings.some(w => w.severity === 'error');
    if (hasErrors) {
      return {
        success: false,
        error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
        errorType: 'validation_error',
      };
    }
    
    // 3. Prepare data for submission
    const completeData = normalizedData as IntakeInput;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate jobSpec สำหรับส่งไป API
    const jobSpec = transformToJobSpec(completeData, sessionId);
    
    // 4. POST ไปยัง API พร้อม retry
    const response = await postWithRetry<{ jobId: string; status: string }>(
      '/intake/submit',
      {
        jobSpec,
        sessionId,
        submittedAt: new Date().toISOString(),
      },
      config
    );
    
    return {
      success: true,
      jobId: response.jobId,
      jobSpec,
    };
    
  } catch (error) {
    // Log error โดยไม่รวม PII (แสดงเฉพาะ field names)
    console.error('[submitIntake] Error for', sanitizeForLog(formData), ':', 
      error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof IntakeServiceError) {
      return {
        success: false,
        error: error.message,
        errorType: error.type,
      };
    }
    
    const serviceError = createServiceError(error);
    return {
      success: false,
      error: serviceError.message,
      errorType: serviceError.type,
    };
  }
}

// ============================================================================
// ADDITIONAL EXPORTS
// ============================================================================

export {
  getConfig,
  createServiceError,
  sanitizeForLog,
};

// Re-export types for convenience
export type {
  IntakeServiceConfig,
  ServiceError,
  ServiceErrorType,
};
