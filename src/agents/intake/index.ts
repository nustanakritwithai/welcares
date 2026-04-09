/**
 * Intake Agent - Main Export
 * 
 * Intake Agent ทำ 4 อย่าง:
 * 1. รับข้อมูลจากหน้าเว็บ
 * 2. แปลงข้อมูลภาษาคน ให้เป็น structured job spec
 * 3. ตรวจว่าข้อมูลครบหรือยัง → ถามต่อแบบสั้นและตรง
 * 4. ส่ง job spec ต่อให้ backend/service layer
 * 
 * @example
 * ```tsx
 * import { useIntakeAgent } from './agents/intake';
 * 
 * function BookingForm() {
 *   const { 
 *     formData, 
 *     updateField, 
 *     submitForm, 
 *     isComplete,
 *     nextQuestion,
 *     progress 
 *   } = useIntakeAgent();
 *   
 *   // ใช้งาน...
 * }
 * ```
 */

// Schema (Source of Truth)
export * from './schema';

// Legacy Types (backward compatibility)
export type {
  IntakeFormData,
  JobSpec,
  ServiceType,
  UrgencyLevel,
  LocationInfo,
  ServiceDetails,
  ScheduleDetails,
  LocationPair,
  PatientRequirements,
  ServiceAddons,
  JobAssessment,
  CostEstimate,
  ResourceNeeds,
  ValidationError,
  ValidationResult,
  FollowUpQuestion,
  IntakeRequest,
  IntakeResponse,
} from './types';

// Core Classes
export { IntakeValidator } from './validator';
export { IntakeTransformer } from './transformer';
export { IntakeAgentService, createIntakeAgent, validateIntakeData, transformToJobSpec } from './service';

// React Hook
export { useIntakeAgent } from './useIntakeAgent';
export type { UseIntakeAgentReturn } from './useIntakeAgent';

// Default export
export { IntakeAgentService as default } from './service';
