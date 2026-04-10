/**
 * Intake Chat Agent - React Hook (Refactored v2.0)
 * Source of truth: formData state
 * 
 * @version 2.0
 * @module src/agents/intake-chat/useIntakeChatAgent
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChatMessage,
  QuickReply,
  ConversationStatus,
} from './types';
import type { PartialIntakeInput, IntakeInput, JobSpec } from '../intake/types';
import { validateFormData, type ValidateFormDataResult } from '../intake/validator';
import { previewIntake, submitIntake } from '../intake/service';
import { parseMessageWithAI, generateAIResponse, isAIConfigured } from './openrouter';

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
  selectQuickReply: (reply: QuickReply) => void;
  /** รีเซ็ต conversation */
  resetConversation: () => void;
  /** ข้อมูล form ที่กรอก (SOURCE OF TRUTH) */
  formData: PartialIntakeInput;
  /** Field ที่กำลังถามอยู่ */
  currentField: string | null;
  /** Fields ที่ยังขาด */
  missingFields: string[];
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
  /** Job ID */
  jobId: string | null;
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
// FIELD DEFINITIONS (Order matters)
// ============================================================================

const FIELD_ORDER = [
  'contact.contactName',
  'contact.contactPhone',
  'service.serviceType',
  'schedule.appointmentDate',
  'schedule.appointmentTime',
  'locations.pickup.address',
  'locations.dropoff.address',
  'patient.name',
  'patient.mobilityLevel',
  'patient.equipmentNeeds',
] as const;

const FIELD_QUESTIONS: Record<string, { text: string; type: 'text' | 'select' | 'date' | 'time'; options?: QuickReply[] }> = {
  'contact.contactName': {
    text: '👋 สวัสดีค่ะ! กรุณาบอกชื่อผู้ติดต่อด้วยค่ะ',
    type: 'text',
  },
  'contact.contactPhone': {
    text: '📞 ขอเบอร์โทรศัพท์ติดต่อด้วยค่ะ',
    type: 'text',
  },
  'service.serviceType': {
    text: '🏥 เลือกประเภทบริการที่ต้องการค่ะ',
    type: 'select',
    options: [
      { id: 'hospital-visit', label: '🏥 พบแพทย์', value: 'hospital-visit' },
      { id: 'follow-up', label: '💊 ติดตามอาการ', value: 'follow-up' },
      { id: 'physical-therapy', label: '🏃 กายภาพ', value: 'physical-therapy' },
      { id: 'dialysis', label: '💧 ล้างไต', value: 'dialysis' },
      { id: 'checkup', label: '📋 ตรวจสุขภาพ', value: 'checkup' },
      { id: 'vaccination', label: '💉 วัคซีน', value: 'vaccination' },
    ],
  },
  'schedule.appointmentDate': {
    text: '📅 วันนัดหมายวันไหนคะ? (เช่น 15/01/2026)',
    type: 'date',
  },
  'schedule.appointmentTime': {
    text: '🕐 เวลากี่โมงคะ? (เช่น 14:30)',
    type: 'time',
  },
  'locations.pickup.address': {
    text: '📍 รับจากที่ไหนคะ?',
    type: 'text',
  },
  'locations.dropoff.address': {
    text: '🏥 ส่งที่ไหนคะ?',
    type: 'text',
  },
  'patient.name': {
    text: '🧑‍⚕️ ชื่อผู้ป่วยค่ะ',
    type: 'text',
  },
  'patient.mobilityLevel': {
    text: '♿ ผู้ป่วยเคลื่อนไหวอย่างไรคะ?',
    type: 'select',
    options: [
      { id: 'independent', label: '🚶 เดินได้เอง', value: 'independent' },
      { id: 'assisted', label: '🤝 ต้องช่วยพยุง', value: 'assisted' },
      { id: 'wheelchair', label: '♿ ใช้รถเข็น', value: 'wheelchair' },
      { id: 'bedridden', label: '🛏️ ติดเตียง', value: 'bedridden' },
    ],
  },
  'patient.equipmentNeeds': {
    text: '🦽 ต้องการอุปกรณ์พิเศษไหมคะ?',
    type: 'select',
    options: [
      { id: 'none', label: '❌ ไม่ต้องการ', value: 'none' },
      { id: 'oxygen', label: '💨 ถังออกซิเจน', value: 'oxygen' },
      { id: 'stretcher', label: '🛏️ เปลนอน', value: 'stretcher' },
      { id: 'iv-stand', label: '💧 ขาตั้งน้ำเกลือ', value: 'iv-stand' },
    ],
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Set nested value by path (e.g., "contact.contactName")
 */
function setNestedValue<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T {
  const parts = path.split('.');
  const result = { ...obj };
  
  let current: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current[key] = { ...(current[key] as Record<string, unknown>) };
    current = current[key] as Record<string, unknown>;
  }
  
  current[parts[parts.length - 1]] = value;
  return result;
}

/**
 * Get nested value by path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Check if field has value
 */
function hasFieldValue(formData: PartialIntakeInput, field: string): boolean {
  const value = getNestedValue(formData as Record<string, unknown>, field);
  return value !== undefined && value !== null && value !== '';
}

/**
 * Parse user input based on field type
 */
function parseInputForField(text: string, field: string): { value: unknown; confidence: number } | null {
  const trimmed = text.trim();
  
  switch (field) {
    case 'contact.contactName':
    case 'patient.name':
      return trimmed.length >= 2 
        ? { value: trimmed, confidence: 0.9 }
        : null;
      
    case 'contact.contactPhone':
      // Phone number validation (Thai format)
      const phone = trimmed.replace(/[-\s]/g, '');
      if (/^0\d{8,9}$/.test(phone)) {
        return { value: phone, confidence: 0.95 };
      }
      return null;
      
    case 'service.serviceType':
      const serviceMap: Record<string, string> = {
        'พบแพทย์': 'hospital-visit',
        'หมอ': 'hospital-visit',
        'ติดตาม': 'follow-up',
        'กายภาพ': 'physical-therapy',
        'ล้างไต': 'dialysis',
        'ตรวจสุขภาพ': 'checkup',
        'วัคซีน': 'vaccination',
      };
      const serviceKey = Object.keys(serviceMap).find(k => trimmed.includes(k));
      if (serviceKey) {
        return { value: serviceMap[serviceKey], confidence: 0.9 };
      }
      return null;
      
    case 'schedule.appointmentDate':
      // Parse date (Thai format: DD/MM/YYYY or D/M/YY)
      const dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const fullYear = year.length === 2 ? `20${year}` : year;
        const dateStr = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        return { value: dateStr, confidence: 0.9 };
      }
      return null;
      
    case 'schedule.appointmentTime':
      // Parse time (HH:MM)
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const [, hour, minute] = timeMatch;
        const timeStr = `${hour.padStart(2, '0')}:${minute}`;
        return { value: timeStr, confidence: 0.9 };
      }
      return null;
      
    case 'locations.pickup.address':
    case 'locations.dropoff.address':
      return trimmed.length >= 5
        ? { value: trimmed, confidence: 0.85 }
        : null;
      
    case 'patient.mobilityLevel':
      const mobilityMap: Record<string, string> = {
        'เดิน': 'independent',
        'เอง': 'independent',
        'ช่วย': 'assisted',
        'พยุง': 'assisted',
        'รถเข็น': 'wheelchair',
        'เข็น': 'wheelchair',
        'ติดเตียง': 'bedridden',
        'เตียง': 'bedridden',
      };
      const mobilityKey = Object.keys(mobilityMap).find(k => trimmed.includes(k));
      if (mobilityKey) {
        return { value: mobilityMap[mobilityKey], confidence: 0.9 };
      }
      return null;
      
    case 'patient.equipmentNeeds':
      if (trimmed.includes('ไม่') || trimmed === 'none') {
        return { value: 'none', confidence: 0.9 };
      }
      const equipMap: Record<string, string> = {
        'ออกซิเจน': 'oxygen',
        'ถัง': 'oxygen',
        'เปล': 'stretcher',
        'นอน': 'stretcher',
        'น้ำเกลือ': 'iv-stand',
        'เกลือ': 'iv-stand',
      };
      const equipKey = Object.keys(equipMap).find(k => trimmed.includes(k));
      if (equipKey) {
        return { value: equipMap[equipKey], confidence: 0.9 };
      }
      return null;
      
    default:
      return { value: trimmed, confidence: 0.5 };
  }
}

/**
 * Generate question message for field
 */
function generateQuestionMessage(field: string): ChatMessage {
  const config = FIELD_QUESTIONS[field];
  if (!config) {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      type: 'text',
      content: `กรุณากรอก ${field}`,
      timestamp: new Date(),
      metadata: { field },
    };
  }
  
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    type: config.type === 'select' ? 'quick_replies' : 'text',
    content: config.text,
    quickReplies: config.options,
    timestamp: new Date(),
    metadata: { field, type: config.type },
  };
}

/**
 * Generate welcome message
 */
function generateWelcomeMessage(): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    type: 'text',
    content: '👋 สวัสดีค่ะ! ฉันคือน้องแคร์ ผู้ช่วยจองบริการรถรับ-ส่งผู้ป่วย 🚑\n\nให้ฉันช่วยจองให้นะคะ',
    timestamp: new Date(),
  };
}

/**
 * Generate acknowledgment
 */
function generateAcknowledgment(field: string, value: unknown): string {
  const fieldNames: Record<string, string> = {
    'contact.contactName': 'ชื่อผู้ติดต่อ',
    'contact.contactPhone': 'เบอร์โทร',
    'service.serviceType': 'บริการ',
    'schedule.appointmentDate': 'วันนัด',
    'schedule.appointmentTime': 'เวลา',
    'locations.pickup.address': 'จุดรับ',
    'locations.dropoff.address': 'จุดส่ง',
    'patient.name': 'ชื่อผู้ป่วย',
    'patient.mobilityLevel': 'การเคลื่อนไหว',
    'patient.equipmentNeeds': 'อุปกรณ์',
  };
  
  const name = fieldNames[field] || field;
  return `✅ บันทึก ${name}: ${value}`;
}

/**
 * Generate summary/preview message
 */
function generateSummaryMessage(formData: PartialIntakeInput): ChatMessage {
  const contact = (formData as Record<string, unknown>).contact as Record<string, string> | undefined;
  const service = (formData as Record<string, unknown>).service as Record<string, string> | undefined;
  const schedule = (formData as Record<string, unknown>).schedule as Record<string, string> | undefined;
  const locations = (formData as Record<string, unknown>).locations as Record<string, Record<string, string>> | undefined;
  const patient = (formData as Record<string, unknown>).patient as Record<string, string> | undefined;
  
  const summary = [
    '📋 สรุปข้อมูลการจอง',
    '',
    `👤 ผู้ติดต่อ: ${contact?.contactName || '-'}` ,
    `📞 โทร: ${contact?.contactPhone || '-'}`,
    `🏥 บริการ: ${service?.serviceType || '-'}`,
    `📅 วันที่: ${schedule?.appointmentDate || '-'} ${schedule?.appointmentTime || ''}`,
    `📍 รับ: ${locations?.pickup?.address || '-'}`,
    `🏥 ส่ง: ${locations?.dropoff?.address || '-'}`,
    `🧑‍⚕️ ผู้ป่วย: ${patient?.name || '-'}`,
    `♿ การเคลื่อนไหว: ${patient?.mobilityLevel || '-'}`,
    '',
    'ยืนยันข้อมูลถูกต้องไหมคะ?',
  ].join('\n');
  
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    type: 'confirmation',
    content: summary,
    quickReplies: [
      { id: 'confirm', label: '✅ ยืนยัน', value: 'confirm' },
      { id: 'edit', label: '✏️ แก้ไข', value: 'edit' },
    ],
    timestamp: new Date(),
  };
}

/**
 * Generate success message
 */
function generateSuccessMessage(jobId: string): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    type: 'success',
    content: `🎉 จองสำเร็จ!\n\nหมายเลขการจอง: #${jobId}\n\nขอบคุณที่ใช้บริการค่ะ 💜`,
    timestamp: new Date(),
  };
}

/**
 * Generate error message
 */
function generateErrorMessage(error: string): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    type: 'error',
    content: `❌ เกิดข้อผิดพลาด: ${error}`,
    timestamp: new Date(),
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useIntakeChatAgent(
  options: UseIntakeChatAgentOptions = {}
): UseIntakeChatAgentReturn {
  const { onSuccess, onError, onFormDataChange } = options;
  
  // ============================================================================
  // STATE - Source of Truth
  // ============================================================================
  
  /** Messages แยกออกจาก booking state */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  /** Input text */
  const [inputText, setInputText] = useState('');
  
  /** Form Data - SOURCE OF TRUTH */
  const [formData, setFormData] = useState<PartialIntakeInput>({});
  
  /** Current field being asked */
  const [currentField, setCurrentField] = useState<string | null>(null);
  
  /** Missing fields */
  const [missingFields, setMissingFields] = useState<string[]>(FIELD_ORDER.slice());
  
  /** Preview JobSpec */
  const [preview, setPreview] = useState<JobSpec | null>(null);
  
  /** Status flags */
  const [isComplete, setIsComplete] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  
  /** Processing lock */
  const isProcessingRef = useRef(false);
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  useEffect(() => {
    if (messages.length === 0) {
      // Add welcome message
      setMessages([generateWelcomeMessage()]);
      
      // Start with first field
      setTimeout(() => {
        const firstField = FIELD_ORDER[0];
        setCurrentField(firstField);
        setMessages(prev => [...prev, generateQuestionMessage(firstField)]);
      }, 500);
    }
  }, []);
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  /**
   * Add message to conversation
   */
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  /**
   * Update form data with nested path support
   */
  const updateFormDataField = useCallback((field: string, value: unknown) => {
    setFormData(prev => {
      const updated = setNestedValue(prev as Record<string, unknown>, field, value);
      onFormDataChange?.(updated);
      return updated;
    });
  }, [onFormDataChange]);
  
  /**
   * Find next missing field
   */
  const findNextField = useCallback((currentFormData: PartialIntakeInput): string | null => {
    for (const field of FIELD_ORDER) {
      if (!hasFieldValue(currentFormData, field)) {
        return field;
      }
    }
    return null;
  }, []);
  
  /**
   * Update missing fields based on current form data
   */
  const updateMissingFields = useCallback((currentFormData: PartialIntakeInput) => {
    const missing = FIELD_ORDER.filter(field => !hasFieldValue(currentFormData, field));
    setMissingFields(missing);
    return missing;
  }, []);
  
  /**
   * Validate and check completeness
   */
  const validateAndCheckComplete = useCallback(async (currentFormData: PartialIntakeInput): Promise<boolean> => {
    const validation = validateFormData(currentFormData);
    
    // Check if all required fields have values
    const missing = updateMissingFields(currentFormData);
    const complete = missing.length === 0;
    
    setIsComplete(complete);
    return complete;
  }, [updateMissingFields]);
  
  /**
   * Handle user turn - MAIN FLOW
   */
  const handleUserTurn = useCallback(async (text: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setLoading(true);
    
    try {
      // 1. Add user message
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        type: 'text',
        content: text,
        timestamp: new Date(),
      };
      addMessage(userMessage);
      
      // 2. Handle confirmation state
      if (awaitingConfirmation) {
        const lowerText = text.toLowerCase().trim();
        
        if (lowerText === 'confirm' || lowerText === 'ยืนยัน' || lowerText === 'yes' || lowerText === 'ใช่') {
          // Submit booking
          const result = await submitIntake(formData);
          
          if (result.success && result.jobId) {
            setJobId(result.jobId);
            setSuccess(true);
            setAwaitingConfirmation(false);
            addMessage(generateSuccessMessage(result.jobId));
            onSuccess?.(result.jobId);
          } else {
            const errorMsg = result.error || 'ไม่สามารถบันทึกข้อมูลได้';
            setError(errorMsg);
            addMessage(generateErrorMessage(errorMsg));
            onError?.(errorMsg);
          }
          
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }
        
        if (lowerText === 'edit' || lowerText === 'แก้ไข' || lowerText === 'no') {
          setAwaitingConfirmation(false);
          // Find first field to edit
          const nextField = findNextField(formData);
          if (nextField) {
            setCurrentField(nextField);
            addMessage({
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              role: 'assistant',
              type: 'text',
              content: 'กรุณาแก้ไขข้อมูลค่ะ',
              timestamp: new Date(),
            });
            addMessage(generateQuestionMessage(nextField));
          }
          
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }
      }
      
      // 3. Parse user input based on current field
      const fieldToParse = currentField || findNextField(formData);
      
      if (!fieldToParse) {
        // All fields filled
        const complete = await validateAndCheckComplete(formData);
        
        if (complete) {
          setAwaitingConfirmation(true);
          addMessage(generateSummaryMessage(formData));
        }
        
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }
      
      // 4. Try AI parsing first
      let parsedValue: unknown = null;
      let parseConfidence = 0;
      let aiResponse: string | undefined;
      
      try {
        const aiEnabled = await isAIConfigured();
        if (aiEnabled) {
          const aiResult = await parseMessageWithAI(text, formData, messages.map(m => m.content));
          if (aiResult.confidence > 0.6 && aiResult.field && aiResult.value !== undefined) {
            parsedValue = aiResult.value;
            parseConfidence = aiResult.confidence;
            aiResponse = aiResult.response;
          }
        }
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
      }
      
      // 5. Fallback to rule-based parsing
      if (!parsedValue) {
        const ruleResult = parseInputForField(text, fieldToParse);
        if (ruleResult) {
          parsedValue = ruleResult.value;
          parseConfidence = ruleResult.confidence;
        }
      }
      
      // 6. Update formData with parsed value
      if (parsedValue !== null) {
        updateFormDataField(fieldToParse, parsedValue);
        
        // Create updated formData for validation
        const updatedFormData = setNestedValue(
          formData as Record<string, unknown>,
          fieldToParse,
          parsedValue
        ) as PartialIntakeInput;
        
        // 7. Acknowledge
        if (aiResponse) {
          addMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            type: 'text',
            content: aiResponse,
            timestamp: new Date(),
          });
        } else {
          addMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            type: 'text',
            content: generateAcknowledgment(fieldToParse, parsedValue),
            timestamp: new Date(),
          });
        }
        
        // 8. Validate with updated data
        const complete = await validateAndCheckComplete(updatedFormData);
        
        if (complete) {
          // 9. All complete - show summary
          setAwaitingConfirmation(true);
          setPreview(updatedFormData as unknown as JobSpec);
          addMessage(generateSummaryMessage(updatedFormData));
        } else {
          // 10. Find and ask next field
          const nextField = findNextField(updatedFormData);
          if (nextField) {
            setCurrentField(nextField);
            
            // Try AI response generation
            try {
              const aiEnabled = await isAIConfigured();
              if (aiEnabled) {
                const missing = updateMissingFields(updatedFormData);
                const aiResult = await generateAIResponse(
                  text,
                  updatedFormData,
                  missing,
                  messages.map(m => m.content)
                );
                if (aiResult.content) {
                  addMessage({
                    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    role: 'assistant',
                    type: 'text',
                    content: aiResult.content,
                    timestamp: new Date(),
                  });
                }
              }
            } catch (aiError) {
              console.error('AI response failed:', aiError);
            }
            
            // Always ask next question
            addMessage(generateQuestionMessage(nextField));
          }
        }
      } else {
        // Parse failed - ask again
        addMessage({
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          type: 'text',
          content: 'ขออภัย ไม่เข้าใจค่ะ กรุณาตอบใหม่อีกครั้ง',
          timestamp: new Date(),
        });
        
        if (currentField) {
          addMessage(generateQuestionMessage(currentField));
        }
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setError(errorMsg);
      addMessage(generateErrorMessage(errorMsg));
      onError?.(errorMsg);
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  }, [
    formData,
    currentField,
    awaitingConfirmation,
    messages,
    addMessage,
    updateFormDataField,
    validateAndCheckComplete,
    findNextField,
    updateMissingFields,
    onSuccess,
    onError,
  ]);
  
  /**
   * Send message (public API)
   */
  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputText;
    if (!messageText.trim()) return;
    
    setInputText('');
    await handleUserTurn(messageText.trim());
  }, [inputText, handleUserTurn]);
  
  /**
   * Select quick reply
   */
  const selectQuickReply = useCallback((reply: QuickReply) => {
    setInputText(reply.value);
    sendMessage(reply.value);
  }, [sendMessage]);
  
  /**
   * Confirm booking
   */
  const confirmBooking = useCallback(async () => {
    if (!isComplete) return;
    await handleUserTurn('confirm');
  }, [isComplete, handleUserTurn]);
  
  /**
   * Reset conversation
   */
  const resetConversation = useCallback(() => {
    setMessages([]);
    setFormData({});
    setCurrentField(null);
    setMissingFields(FIELD_ORDER.slice());
    setPreview(null);
    setIsComplete(false);
    setAwaitingConfirmation(false);
    setError(null);
    setSuccess(false);
    setJobId(null);
    setInputText('');
    isProcessingRef.current = false;
    
    // Re-initialize
    setTimeout(() => {
      setMessages([generateWelcomeMessage()]);
      const firstField = FIELD_ORDER[0];
      setCurrentField(firstField);
      setTimeout(() => {
        setMessages(prev => [...prev, generateQuestionMessage(firstField)]);
      }, 500);
    }, 100);
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
    formData,
    currentField,
    missingFields,
    preview,
    isComplete,
    awaitingConfirmation,
    loading,
    error,
    success,
    jobId,
  };
}

export default useIntakeChatAgent;
