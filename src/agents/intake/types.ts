/**
 * Intake Agent - Types (WelCares)
 * Type definitions สำหรับระบบ WelCares ElderCare
 * 
 * @version 1.0
 * @see schema.ts สำหรับ source of truth
 */

// Re-export ทั้งหมดจาก schema.ts เพื่อใช้เป็น types หลัก
export * from './schema';

// Additional types สำหรับ internal use

/**
 * ผลลัพธ์การ validate form data
 */
export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: ValidationError[];
  missingFields: string[];
  followUpQuestions: FollowUpQuestion[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

/**
 * Error จากการ validate
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * คำถามติดตามที่ต้องถามผู้ใช้
 */
export interface FollowUpQuestion {
  field: string;
  question: string;
  type: 'text' | 'boolean' | 'choice' | 'date' | 'time' | 'number';
  options?: string[];
  required: boolean;
}

/**
 * ผลลัพธ์การ preview ก่อน submit
 */
export interface IntakePreviewResult {
  success: boolean;
  jobSpec?: JobSpec;
  validation?: ValidationResult;
  error?: string;
}

/**
 * ผลลัพธ์การ submit form
 */
export interface IntakeSubmitResult {
  success: boolean;
  jobId?: string;
  jobSpec?: JobSpec;
  error?: string;
  errorType?: 'validation_error' | 'network_error' | 'timeout_error' | 'server_error' | 'unknown_error';
}

/**
 * Request สำหรับ intake API
 */
export interface IntakeRequest {
  input: Partial<IntakeInput>;
  sessionId: string;
  previousQuestions?: FollowUpQuestion[];
}

/**
 * Response จาก intake API
 */
export interface IntakeResponse {
  success: boolean;
  jobSpec?: JobSpec;
  validation?: ValidationResult;
  error?: string;
}

// ============================================================================
// Internal/Working Types
// ============================================================================

/**
 * Form data แบบ step-by-step (incomplete)
 */
export type PartialIntakeInput = Partial<IntakeInput>;

/**
 * Field path สำหรับ nested access
 * เช่น 'contact.contactName', 'locations.pickup.address'
 */
export type FieldPath = string;

/**
 * Hook state สำหรับ React
 */
export interface IntakeHookState {
  formData: Partial<IntakeInput>;
  isComplete: boolean;
  missingFields: string[];
  nextQuestion: FollowUpQuestion | null;
  preview: JobSpec | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

/**
 * Hook actions สำหรับ React
 */
export interface IntakeHookActions {
  updateField: <K extends keyof IntakeInput>(field: K, value: IntakeInput[K]) => Promise<void>;
  updateFields: (partial: Partial<IntakeInput>) => void;
  validateCurrentState: () => Promise<ValidationResult>;
  previewJobSpec: () => Promise<IntakePreviewResult>;
  submitForm: () => Promise<IntakeSubmitResult>;
  resetForm: () => void;
}

/**
 * รวม Hook state + actions
 */
export type UseIntakeAgentReturn = IntakeHookState & IntakeHookActions;

// ============================================================================
// Service Layer Types
// ============================================================================

/**
 * Config สำหรับ intake service
 */
export interface IntakeServiceConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Error types สำหรับ service layer
 */
export type ServiceErrorType = 
  | 'validation_error' 
  | 'network_error' 
  | 'timeout_error'
  | 'server_error' 
  | 'unknown_error';

/**
 * Service error
 */
export interface ServiceError {
  type: ServiceErrorType;
  message: string;
  statusCode?: number;
  retryable: boolean;
}
