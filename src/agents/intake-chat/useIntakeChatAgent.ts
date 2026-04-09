/**
 * Intake Chat Agent - React Hook
 * Hook สำหรับ conversational intake chatbot
 * 
 * @version 1.0
 * @module src/agents/intake-chat/useIntakeChatAgent
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChatMessage,
  QuickReplyOption,
  IntakeFormData,
  JobSpec,
} from './types';
import type { PartialIntakeInput, IntakeInput } from '../intake/types';
import { validateFormData, type ValidateFormDataResult } from '../intake/validator';
import { previewIntake, submitIntake } from '../intake/service';
import { parseInput, detectIntent, applyParsedAnswer } from './parser';
import { parseMessageWithAI, generateAIResponse, isAIConfigured } from './openrouter';
import {
  generateWelcomeMessages,
  generateNextQuestion,
  generateAcknowledgment,
  generateConfirmationMessage,
  generateSubmissionSuccess,
  generateSubmissionError,
  generateValidationError,
  createUserMessage,
  determineConversationState,
} from './conversation';

// ============================================================================
// TYPES
// ============================================================================

export interface UseIntakeChatAgentReturn {
  /** รายการข้อความใน conversation */
  messages: ChatMessage[];
  /** ข้อความที่กำลังพิมพ์ใน input */
  inputText: string;
  /** ตั้งค่าข้อความใน input */
  setInputText: (text: string) => void;
  /** ส่งข้อความ */
  sendMessage: (text?: string) => Promise<void>;
  /** เลือก quick reply */
  selectQuickReply: (option: QuickReplyOption) => void;
  /** รีเซ็ต conversation */
  resetConversation: () => void;
  /** ข้อมูล form ที่กรอก */
  formData: IntakeFormData;
  /** Preview JobSpec */
  preview: JobSpec | null;
  /** ข้อมูลครบหรือไม่ */
  isComplete: boolean;
  /** กำลังรอการยืนยัน */
  awaitingConfirmation: boolean;
  /** กำลังโหลด */
  loading: boolean;
  /** ข้อความ error */
  error: string | null;
  /** สำเร็จแล้ว */
  success: boolean;
}

export interface UseIntakeChatAgentOptions {
  /** Session ID (optional) */
  sessionId?: string;
  /** Callback เมื่อสำเร็จ */
  onSuccess?: (jobId: string) => void;
  /** Callback เมื่อเกิด error */
  onError?: (error: string) => void;
  /** Callback เมื่อข้อมูลเปลี่ยน */
  onFormDataChange?: (formData: PartialIntakeInput) => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * React Hook สำหรับ Intake Chat Agent
 * 
 * @example
 * ```tsx
 * const {
 *   messages,
 *   inputText,
 *   setInputText,
 *   sendMessage,
 *   selectQuickReply,
 *   formData,
 *   isComplete,
 *   awaitingConfirmation,
 *   loading,
 *   success,
 * } = useIntakeChatAgent();
 * ```
 */
export function useIntakeChatAgent(
  options: UseIntakeChatAgentOptions = {}
): UseIntakeChatAgentReturn {
  const { sessionId: initialSessionId, onSuccess, onError, onFormDataChange } = options;
  
  // Generate session ID if not provided
  const sessionIdRef = useRef<string>(
    initialSessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [formData, setFormData] = useState<PartialIntakeInput>({});
  const [preview, setPreview] = useState<JobSpec | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Refs for tracking state
  const isProcessingRef = useRef(false);
  const lastValidationRef = useRef<ValidateFormDataResult | null>(null);
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  /**
   * Initialize conversation with welcome messages
   */
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessages = generateWelcomeMessages();
      setMessages(welcomeMessages);
      
      // Ask first question after welcome
      setTimeout(() => {
        const validation = validateFormData({});
        const nextQuestion = generateNextQuestion(validation, {});
        if (nextQuestion) {
          setMessages(prev => [...prev, nextQuestion]);
        }
      }, 100);
    }
  }, []);
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  /**
   * Update form data and notify callback
   */
  const updateFormData = useCallback((newData: PartialIntakeInput) => {
    setFormData(newData);
    onFormDataChange?.(newData);
  }, [onFormDataChange]);
  
  /**
   * Add message to conversation
   */
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  /**
   * Process validation result and update state
   */
  const processValidation = useCallback((
    validation: ValidateFormDataResult,
    currentFormData: PartialIntakeInput
  ) => {
    lastValidationRef.current = validation;
    
    const state = determineConversationState(validation, currentFormData);
    setIsComplete(state.isComplete);
    setAwaitingConfirmation(state.awaitingConfirmation);
    
    return state;
  }, []);
  
  /**
   * Handle user input and generate response
   */
  const processUserInput = useCallback(async (text: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Detect intent
      const intent = detectIntent(text);
      
      // Handle restart intent
      if (intent.intent === 'restart') {
        resetConversation();
        return;
      }
      
      // Handle confirmation when awaiting confirmation
      if (awaitingConfirmation) {
        if (intent.intent === 'confirm') {
          await handleConfirm();
          return;
        }
        if (intent.intent === 'reject' || intent.intent === 'edit') {
          setAwaitingConfirmation(false);
          addMessage(createUserMessage(text));
          addMessage({
            id: `msg-${Date.now()}`,
            role: 'assistant',
            text: 'กรุณาบอกว่าต้องการแก้ไขข้อมูลส่วนไหนครับ',
            timestamp: Date.now(),
          });
          return;
        }
      }
      
      // Get current field target from last assistant message
      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
      const targetField = lastAssistantMsg?.meta?.field;
      
      // Try AI parsing first if configured
      let parsed;
      let aiResponse: string | undefined;
      
      try {
        const aiEnabled = await isAIConfigured();
        if (aiEnabled) {
          const aiResult = await parseMessageWithAI(text, formData, messages.map(m => m.content));
          if (aiResult.confidence > 0.6 && aiResult.field && aiResult.value !== undefined) {
            parsed = {
              field: aiResult.field,
              value: aiResult.value,
              confidence: aiResult.confidence,
            };
            aiResponse = aiResult.response;
          }
        }
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
      }
      
      // Fallback to rule-based parsing if AI fails or not configured
      if (!parsed) {
        if (targetField) {
          parsed = parseInput(text, targetField);
        } else {
          // Auto-detect field if no target
          parsed = parseInput(text, 'unknown');
        }
      }
      
      // Apply parsed answer to form data
      const newFormData = applyParsedAnswer(formData, parsed);
      updateFormData(newFormData);
      
      // Validate
      const validation = validateFormData(newFormData);
      const state = processValidation(validation, newFormData);
      
      // Add user message
      addMessage(createUserMessage(text));
      
      // Add acknowledgment (use AI response if available, otherwise rule-based)
      if (aiResponse) {
        addMessage({
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: aiResponse,
          type: 'text',
          timestamp: new Date(),
        } as ChatMessage);
      } else if (parsed.confidence > 0.5 && parsed.value !== undefined) {
        const ack = generateAcknowledgment(parsed.field, parsed.value, newFormData);
        addMessage(ack);
      }
      
      // Check if complete
      if (state.isComplete) {
        // Generate preview
        const previewResult = await previewIntake(newFormData);
        if (previewResult.success && previewResult.jobSpec) {
          setPreview(previewResult.jobSpec);
          const confirmationMsg = generateConfirmationMessage(newFormData);
          addMessage(confirmationMsg);
        } else {
          // If preview failed, show error and continue
          const errorMsg = previewResult.error || 'ไม่สามารถสร้าง preview ได้';
          addMessage(generateValidationError('preview', errorMsg));
          
          // Continue with next question
          const nextQuestion = generateNextQuestion(validation, newFormData);
          if (nextQuestion) {
            addMessage(nextQuestion);
          }
        }
      } else {
        // Continue with next question - try AI first
        let nextQuestion: ChatMessage | null = null;
        
        try {
          const aiEnabled = await isAIConfigured();
          if (aiEnabled) {
            const aiResult = await generateAIResponse(
              text,
              newFormData,
              validation.missingFields,
              messages.map(m => m.content)
            );
            if (aiResult.content) {
              nextQuestion = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: aiResult.content,
                type: 'text',
                timestamp: new Date(),
                quickReplies: aiResult.quickReplies,
              } as ChatMessage;
            }
          }
        } catch (aiError) {
          console.error('AI response generation failed:', aiError);
        }
        
        // Fallback to rule-based
        if (!nextQuestion) {
          nextQuestion = generateNextQuestion(validation, newFormData);
        }
        
        if (nextQuestion) {
          addMessage(nextQuestion);
        }
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      setError(errorMsg);
      onError?.(errorMsg);
      addMessage(generateSubmissionError(errorMsg));
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  }, [formData, messages, awaitingConfirmation, addMessage, updateFormData, processValidation]);
  
  /**
   * Handle confirmation and submit
   */
  const handleConfirm = useCallback(async () => {
    if (!isComplete) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await submitIntake(formData);
      
      if (result.success && result.jobId) {
        setSuccess(true);
        setAwaitingConfirmation(false);
        onSuccess?.(result.jobId);
        addMessage(generateSubmissionSuccess(result.jobId));
      } else {
        const errorMsg = result.error || 'ไม่สามารถบันทึกข้อมูลได้';
        setError(errorMsg);
        onError?.(errorMsg);
        addMessage(generateSubmissionError(errorMsg));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      setError(errorMsg);
      onError?.(errorMsg);
      addMessage(generateSubmissionError(errorMsg));
    } finally {
      setLoading(false);
    }
  }, [formData, isComplete, addMessage, onSuccess, onError]);
  
  // ============================================================================
  // PUBLIC ACTIONS
  // ============================================================================
  
  /**
   * Send message
   */
  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputText;
    if (!messageText.trim()) return;
    
    setInputText('');
    await processUserInput(messageText.trim());
  }, [inputText, processUserInput]);
  
  /**
   * Select quick reply
   */
  const selectQuickReply = useCallback((option: QuickReplyOption) => {
    setInputText(option.value);
    sendMessage(option.value);
  }, [sendMessage]);
  
  /**
   * Reset conversation
   */
  const resetConversation = useCallback(() => {
    setMessages([]);
    setFormData({});
    setPreview(null);
    setIsComplete(false);
    setAwaitingConfirmation(false);
    setError(null);
    setSuccess(false);
    setInputText('');
    isProcessingRef.current = false;
    lastValidationRef.current = null;
    
    // Re-initialize
    const welcomeMessages = generateWelcomeMessages();
    setMessages(welcomeMessages);
    
    setTimeout(() => {
      const validation = validateFormData({});
      const nextQuestion = generateNextQuestion(validation, {});
      if (nextQuestion) {
        setMessages(prev => [...prev, nextQuestion]);
      }
    }, 100);
  }, []);

  /**
   * Update a single field directly
   */
  const updateField = useCallback(<K extends keyof IntakeInput>(field: K, value: IntakeInput[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    messages,
    inputText,
    setInputText,
    sendMessage,
    selectQuickReply,
    resetConversation,
    updateField,
    formData: formData as IntakeFormData,
    preview,
    isComplete,
    awaitingConfirmation,
    loading,
    error,
    success,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useIntakeChatAgent;
