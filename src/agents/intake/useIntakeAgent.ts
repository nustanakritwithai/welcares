/**
 * Intake Agent - React Hook
 * ใช้สำหรับ integrate เข้ากับ React components
 */

import { useState, useCallback, useRef } from 'react';
import type {
  IntakeFormData,
  JobSpec,
  ValidationResult,
  FollowUpQuestion,
} from './types';
import { IntakeAgentService } from './service';

export interface UseIntakeAgentReturn {
  // State
  formData: Partial<IntakeFormData>;
  isLoading: boolean;
  error: string | null;
  validation: ValidationResult | null;
  progress: { total: number; completed: number; percentage: number };
  isComplete: boolean;
  nextQuestion: FollowUpQuestion | null;
  jobSpec: JobSpec | null;

  // Actions
  updateField: <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K]
  ) => Promise<void>;
  submitForm: () => Promise<JobSpec | null>;
  reset: () => void;
  
  // Session
  sessionId: string;
}

export function useIntakeAgent(sessionId?: string): UseIntakeAgentReturn {
  const agentRef = useRef(new IntakeAgentService(sessionId));
  
  const [formData, setFormData] = useState<Partial<IntakeFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState({ total: 7, completed: 0, percentage: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [nextQuestion, setNextQuestion] = useState<FollowUpQuestion | null>(null);
  const [jobSpec, setJobSpec] = useState<JobSpec | null>(null);

  const updateField = useCallback(async <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K]
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await agentRef.current.processInput(field, value);
      
      setFormData(agentRef.current.getCurrentFormData());
      setValidation(result.validation);
      setProgress(result.progress);
      setIsComplete(result.isComplete);
      setNextQuestion(result.nextQuestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitForm = useCallback(async (): Promise<JobSpec | null> => {
    if (!isComplete) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await agentRef.current.submitForm(formData as IntakeFormData);
      
      if (result.success && result.jobSpec) {
        setJobSpec(result.jobSpec);
        return result.jobSpec;
      } else {
        setError(result.error || 'การส่งข้อมูลล้มเหลว');
        if (result.validation) {
          setValidation(result.validation);
        }
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งข้อมูล');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [formData, isComplete]);

  const reset = useCallback(() => {
    agentRef.current.reset();
    setFormData({});
    setError(null);
    setValidation(null);
    setProgress({ total: 7, completed: 0, percentage: 0 });
    setIsComplete(false);
    setNextQuestion(null);
    setJobSpec(null);
  }, []);

  return {
    formData,
    isLoading,
    error,
    validation,
    progress,
    isComplete,
    nextQuestion,
    jobSpec,
    updateField,
    submitForm,
    reset,
    sessionId: agentRef.current.getSessionId(),
  };
}

export default useIntakeAgent;
