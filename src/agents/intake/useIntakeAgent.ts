/**
 * Intake Agent - React Hook (MVP)
 * Custom hook สำหรับจัดการ state และ logic ของ Intake Form
 * 
 * @version 1.0
 * @module src/agents/intake/useIntakeAgent
 */

import { useState, useCallback, useRef } from 'react';
import type {
  IntakeInput,
  PartialIntakeInput,
  JobSpec,
  FollowUpQuestion,
  ValidationResult,
  IntakePreviewResult,
  IntakeSubmitResult,
} from './types';

import {
  validateFormData,
  normalizeInput,
  ValidateFormDataResult,
} from './validator';

import {
  previewIntake,
  submitIntake,
} from './service';

// ============================================================================
// TYPES
// ============================================================================

/**
 * State ของ Hook
 */
export interface UseIntakeAgentState {
  /** ข้อมูล form ที่กรอก (อาจไม่ครบ) */
  formData: PartialIntakeInput;
  /** ข้อมูลครบทั้งหมดหรือไม่ */
  isComplete: boolean;
  /** รายการ fields ที่ยังขาด */
  missingFields: string[];
  /** คำถามถัดไปที่ต้องถามผู้ใช้ */
  nextQuestion: FollowUpQuestion | null;
  /** JobSpec preview (ถ้าข้อมูลครบ) */
  preview: JobSpec | null;
  /** กำลังประมวลผล */
  loading: boolean;
  /** ข้อความ error (ถ้ามี) */
  error: string | null;
  /** ส่งข้อมูลสำเร็จ */
  success: boolean;
}

/**
 * Actions ของ Hook
 */
export interface UseIntakeAgentActions {
  /** 
   * Update field เดียว - รองรับ nested path (เช่น 'locations.pickup.address')
   * @param path - path ของ field (ใช้ dot notation สำหรับ nested)
   * @param value - ค่าที่จะ set
   */
  updateField: (path: string, value: unknown) => void;

  /**
   * Update หลาย fields พร้อมกัน
   * @param partial - Partial object ที่ต้องการ merge
   */
  updateFields: (partial: Partial<IntakeInput>) => void;

  /**
   * Validate state ปัจจุบัน
   * @returns ValidationResult
   */
  validateCurrentState: () => Promise<ValidationResult>;

  /**
   * Preview JobSpec จากข้อมูลปัจจุบัน
   * @returns IntakePreviewResult
   */
  previewJobSpec: () => Promise<IntakePreviewResult>;

  /**
   * Submit form ไปยัง API
   * @returns IntakeSubmitResult
   */
  submitForm: () => Promise<IntakeSubmitResult>;

  /**
   * Reset form กลับไปสู่ค่าเริ่มต้น
   */
  resetForm: () => void;
}

/**
 * Return type ของ hook
 */
export type UseIntakeAgentReturn = UseIntakeAgentState & UseIntakeAgentActions;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Initial state เริ่มต้น */
const INITIAL_STATE: UseIntakeAgentState = {
  formData: {},
  isComplete: false,
  missingFields: [],
  nextQuestion: null,
  preview: null,
  loading: false,
  error: null,
  success: false,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Set nested value ใน object ด้วย path string
 * เช่น setNestedValue(obj, 'locations.pickup.address', 'value')
 */
function setNestedValue<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split('.');
  const result = { ...obj };
  
  let current: Record<string, unknown> = result;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
}

/**
 * แปลง ValidateFormDataResult เป็น FollowUpQuestion
 */
function toFollowUpQuestion(result: ValidateFormDataResult): FollowUpQuestion | null {
  if (result.missingFields.length === 0 && result.isComplete) {
    return null;
  }

  const field = result.missingFields[0];
  if (!field) return null;

  // Infer question type from field name
  const type = inferQuestionType(field);

  return {
    field,
    question: result.nextQuestion || `ขอข้อมูล ${field} ด้วยครับ`,
    type,
    required: true,
  };
}

/**
 * ประมาณการ type ของคำถามจาก field name
 */
function inferQuestionType(field: string): FollowUpQuestion['type'] {
  if (field.includes('Date')) return 'date';
  if (field.includes('Time')) return 'time';
  if (field.includes('Age')) return 'number';
  if (field.includes('needs') || field.includes('Required')) return 'boolean';
  if (field.includes('serviceType') || field.includes('mobilityLevel') || field.includes('relationship')) return 'choice';
  return 'text';
}

/**
 * แปลง ValidateFormDataResult เป็น ValidationResult
 */
function toValidationResult(result: ValidateFormDataResult): ValidationResult {
  const total = 15; // ประมาณจำนวน fields ทั้งหมด
  const completed = Math.max(0, total - result.missingFields.length);

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
      completed,
      percentage: Math.round((completed / total) * 100),
    },
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * React Hook สำหรับจัดการ Intake Form
 * 
 * @example
 * ```tsx
 * function IntakeForm() {
 *   const {
 *     formData,
 *     isComplete,
 *     missingFields,
 *     nextQuestion,
 *     preview,
 *     loading,
 *     error,
 *     success,
 *     updateField,
 *     updateFields,
 *     validateCurrentState,
 *     previewJobSpec,
 *     submitForm,
 *     resetForm,
 *   } = useIntakeAgent();
 * 
 *   return (
 *     <form>
 *       <input 
 *         value={formData.contact?.contactName || ''} 
 *         onChange={(e) => updateField('contact.contactName', e.target.value)}
 *       />
 *       {nextQuestion && <p>{nextQuestion.question}</p>}
 *       {loading && <Spinner />}
 *       {error && <ErrorMessage message={error} />}
 *     </form>
 *   );
 * }
 * ```
 */
export function useIntakeAgent(): UseIntakeAgentReturn {
  // State
  const [formData, setFormData] = useState<PartialIntakeInput>(INITIAL_STATE.formData);
  const [isComplete, setIsComplete] = useState(INITIAL_STATE.isComplete);
  const [missingFields, setMissingFields] = useState<string[]>(INITIAL_STATE.missingFields);
  const [nextQuestion, setNextQuestion] = useState<FollowUpQuestion | null>(INITIAL_STATE.nextQuestion);
  const [preview, setPreview] = useState<JobSpec | null>(INITIAL_STATE.preview);
  const [loading, setLoading] = useState(INITIAL_STATE.loading);
  const [error, setError] = useState<string | null>(INITIAL_STATE.error);
  const [success, setSuccess] = useState(INITIAL_STATE.success);

  // Ref สำหรับ track abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Update field เดียว - รองรับ nested path
   */
  const updateField = useCallback((path: string, value: unknown) => {
    setFormData(prev => {
      const newFormData = setNestedValue(prev, path, value);
      
      // Auto-validate after update
      const validation = validateFormData(newFormData);
      setIsComplete(validation.isComplete);
      setMissingFields(validation.missingFields);
      setNextQuestion(toFollowUpQuestion(validation));
      
      // Clear error when user updates data
      if (error) setError(null);
      
      return newFormData;
    });
  }, [error]);

  /**
   * Update หลาย fields พร้อมกัน
   */
  const updateFields = useCallback((partial: Partial<IntakeInput>) => {
    setFormData(prev => {
      const newFormData = { ...prev, ...partial };
      
      // Deep merge สำหรับ nested objects
      if (partial.contact) {
        newFormData.contact = { ...prev.contact, ...partial.contact };
      }
      if (partial.service) {
        newFormData.service = { ...prev.service, ...partial.service };
      }
      if (partial.schedule) {
        newFormData.schedule = { ...prev.schedule, ...partial.schedule };
      }
      if (partial.locations) {
        newFormData.locations = {
          pickup: { ...prev.locations?.pickup, ...partial.locations.pickup },
          dropoff: { ...prev.locations?.dropoff, ...partial.locations.dropoff },
        };
      }
      if (partial.patient) {
        newFormData.patient = { ...prev.patient, ...partial.patient };
      }
      if (partial.addons) {
        newFormData.addons = { ...prev.addons, ...partial.addons };
      }
      
      // Auto-validate after update
      const validation = validateFormData(newFormData);
      setIsComplete(validation.isComplete);
      setMissingFields(validation.missingFields);
      setNextQuestion(toFollowUpQuestion(validation));
      
      // Clear error when user updates data
      if (error) setError(null);
      
      return newFormData;
    });
  }, [error]);

  /**
   * Validate state ปัจจุบัน
   */
  const validateCurrentState = useCallback(async (): Promise<ValidationResult> => {
    setLoading(true);
    setError(null);

    try {
      // Cancel previous operation if any
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const validation = validateFormData(formData);
      
      setIsComplete(validation.isComplete);
      setMissingFields(validation.missingFields);
      setNextQuestion(toFollowUpQuestion(validation));

      const result = toValidationResult(validation);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล';
      setError(errorMessage);
      
      return {
        isValid: false,
        isComplete: false,
        errors: [{ field: 'general', message: errorMessage, severity: 'error' }],
        missingFields: [],
        followUpQuestions: [],
        progress: { total: 15, completed: 0, percentage: 0 },
      };
    } finally {
      setLoading(false);
    }
  }, [formData]);

  /**
   * Preview JobSpec จากข้อมูลปัจจุบัน
   */
  const previewJobSpec = useCallback(async (): Promise<IntakePreviewResult> => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Cancel previous operation if any
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const result = await previewIntake(formData);

      if (result.success && result.jobSpec) {
        setPreview(result.jobSpec);
        setIsComplete(true);
      } else if (result.validation) {
        setMissingFields(result.validation.missingFields);
        setNextQuestion(result.validation.followUpQuestions[0] || null);
      }

      if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการ preview';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, [formData]);

  /**
   * Submit form ไปยัง API
   */
  const submitForm = useCallback(async (): Promise<IntakeSubmitResult> => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Cancel previous operation if any
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const result = await submitIntake(formData);

      if (result.success) {
        setSuccess(true);
        setPreview(result.jobSpec || null);
      } else {
        setError(result.error || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งข้อมูล';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        errorType: 'unknown_error',
      };
    } finally {
      setLoading(false);
    }
  }, [formData]);

  /**
   * Reset form กลับไปสู่ค่าเริ่มต้น
   */
  const resetForm = useCallback(() => {
    // Cancel any pending operation
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setFormData(INITIAL_STATE.formData);
    setIsComplete(INITIAL_STATE.isComplete);
    setMissingFields(INITIAL_STATE.missingFields);
    setNextQuestion(INITIAL_STATE.nextQuestion);
    setPreview(INITIAL_STATE.preview);
    setLoading(INITIAL_STATE.loading);
    setError(INITIAL_STATE.error);
    setSuccess(INITIAL_STATE.success);
  }, []);

  return {
    // State
    formData,
    isComplete,
    missingFields,
    nextQuestion,
    preview,
    loading,
    error,
    success,
    // Actions
    updateField,
    updateFields,
    validateCurrentState,
    previewJobSpec,
    submitForm,
    resetForm,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useIntakeAgent;
