/**
 * Intake Chat Agent - Conversation Engine
 * จัดการ flow ของ conversation
 * 
 * @version 1.0
 * @module src/agents/intake-chat/conversation
 */

import type {
  ChatMessage,
  QuickReplyOption,
  ConversationStep,
  ChatMessageMeta,
} from './types';
import type { PartialIntakeInput } from '../intake/types';
import type { ValidateFormDataResult } from '../intake/validator';

// ============================================================================
// CONSTANTS
// ============================================================================

const WELCOME_MESSAGES = [
  'สวัสดีครับ! ยินดีต้อนรับสู่ WelCares 🏥',
  'ผมช่วยจัดการการนัดหมายและขนส่งผู้ป่วยให้ครับ ขอข้อมูลสักครู่นะครับ',
];

const FIELD_QUESTIONS: Record<string, string> = {
  'contact.contactName': 'ขอชื่อผู้ติดต่อด้วยครับ',
  'contact.contactPhone': 'ขอเบอร์โทรติดต่อด้วยครับ',
  'contact.relationship': 'ความสัมพันธ์กับผู้ป่วยคืออะไรครับ',
  'service.serviceType': 'ต้องการบริการอะไรครับ',
  'schedule.appointmentDate': 'นัดวันที่เท่าไรครับ',
  'schedule.appointmentTime': 'นัดกี่โมงครับ',
  'schedule.timeFlexibility': 'เวลายืดหยุ่นได้แค่ไหนครับ',
  'locations.pickup.address': 'ไปรับที่ไหนครับ',
  'locations.dropoff.address': 'ไปส่งที่ไหนครับ',
  'patient.name': 'ขอชื่อผู้ป่วยด้วยครับ',
  'patient.age': 'อายุเท่าไหร่ครับ',
  'patient.mobilityLevel': 'ผู้ป่วยเดินได้เองไหมครับ',
  'patient.needsEscort': 'ต้องมีคนพาไหมครับ',
  'patient.needsWheelchair': 'ใช้รถเข็นไหมครับ',
  'patient.oxygenRequired': 'ต้องใช้ออกซิเจนไหมครับ',
  'patient.stretcherRequired': 'ต้องใช้เปลไหมครับ',
  'locations.pickup.floor': 'อยู่ชั้นไหนครับ',
  'service.department': 'นัดแผนกไหนครับ',
};

const FIELD_QUICK_REPLIES: Record<string, QuickReplyOption[]> = {
  'contact.relationship': [
    { label: 'ลูก', value: 'child' },
    { label: 'คู่สมรส', value: 'spouse' },
    { label: 'พ่อแม่', value: 'parent' },
    { label: 'ญาติ', value: 'relative' },
    { label: 'เพื่อน', value: 'friend' },
    { label: 'ตนเอง', value: 'self' },
  ],
  'service.serviceType': [
    { label: '🏥 พบแพทย์', value: 'hospital-visit' },
    { label: '🔄 ติดตามอาการ', value: 'follow-up' },
    { label: '💪 กายภาพ', value: 'physical-therapy' },
    { label: '💉 ล้างไต', value: 'dialysis' },
    { label: '🩺 ตรวจสุขาพ', value: 'checkup' },
    { label: '💊 วัคซีน', value: 'vaccination' },
    { label: 'อื่นๆ', value: 'other' },
  ],
  'schedule.timeFlexibility': [
    { label: 'เวลานัดเป๊ะ', value: 'strict' },
    { label: '± 30 นาที', value: '30min' },
    { label: '± 1 ชั่วโมง', value: '1hour' },
    { label: 'ได้ทั้งวัน', value: 'anytime' },
  ],
  'patient.mobilityLevel': [
    { label: '🚶 เดินได้เอง', value: 'independent' },
    { label: '🤝 ต้องช่วยพยุง', value: 'assisted' },
    { label: '♿ ใช้รถเข็น', value: 'wheelchair' },
    { label: '🛏️ ติดเตียง', value: 'bedridden' },
  ],
  'patient.needsEscort': [
    { label: '✅ ใช่', value: 'true' },
    { label: '❌ ไม่ใช่', value: 'false' },
  ],
  'patient.needsWheelchair': [
    { label: '✅ ใช่', value: 'true' },
    { label: '❌ ไม่ใช่', value: 'false' },
  ],
  'patient.oxygenRequired': [
    { label: '✅ ใช่', value: 'true' },
    { label: '❌ ไม่ใช่', value: 'false' },
  ],
  'patient.stretcherRequired': [
    { label: '✅ ใช่', value: 'true' },
    { label: '❌ ไม่ใช่', value: 'false' },
  ],
};

const PRIORITY_ORDER = [
  'contact.contactName',
  'contact.contactPhone',
  'service.serviceType',
  'schedule.appointmentDate',
  'schedule.appointmentTime',
  'locations.pickup.address',
  'locations.dropoff.address',
  'patient.name',
  'patient.mobilityLevel',
  'contact.relationship',
  'schedule.timeFlexibility',
  'patient.needsEscort',
  'patient.needsWheelchair',
  'patient.age',
  'locations.pickup.floor',
  'service.department',
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current timestamp
 */
function now(): number {
  return Date.now();
}

/**
 * Create a chat message
 */
function createMessage(
  role: 'assistant' | 'user' | 'system',
  text: string,
  options?: {
    quickReplies?: QuickReplyOption[];
    meta?: ChatMessageMeta;
  }
): ChatMessage {
  return {
    id: generateMessageId(),
    role,
    text,
    timestamp: now(),
    quickReplies: options?.quickReplies,
    meta: options?.meta,
  };
}

/**
 * Get question for field
 */
function getFieldQuestion(field: string): string {
  return FIELD_QUESTIONS[field] || `ขอข้อมูล ${field} ด้วยครับ`;
}

/**
 * Get quick replies for field
 */
function getFieldQuickReplies(field: string): QuickReplyOption[] | undefined {
  return FIELD_QUICK_REPLIES[field];
}

/**
 * Find next field to ask based on priority
 */
function findNextField(
  missingFields: string[],
  formData: PartialIntakeInput
): string | null {
  // Sort by priority
  const sorted = missingFields.sort((a, b) => {
    const indexA = PRIORITY_ORDER.indexOf(a);
    const indexB = PRIORITY_ORDER.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  return sorted[0] || null;
}

/**
 * Generate confirmation summary
 */
function generateConfirmationSummary(formData: PartialIntakeInput): string {
  const parts: string[] = ['📋 สรุปข้อมูลการนัดหมาย\n'];
  
  if (formData.contact?.contactName) {
    parts.push(`👤 ผู้ติดต่อ: ${formData.contact.contactName}`);
  }
  if (formData.contact?.contactPhone) {
    parts.push(`📞 โทร: ${formData.contact.contactPhone}`);
  }
  if (formData.patient?.name) {
    parts.push(`🏥 ผู้ป่วย: ${formData.patient.name}`);
  }
  if (formData.service?.serviceType) {
    const serviceLabels: Record<string, string> = {
      'hospital-visit': 'พบแพทย์',
      'follow-up': 'ติดตามอาการ',
      'physical-therapy': 'กายภาพบำบัด',
      'dialysis': 'ล้างไต',
      'chemotherapy': 'เคมีบำบัด',
      'radiation': 'รังสีรักษา',
      'checkup': 'ตรวจสุขภาพ',
      'vaccination': 'ฉีดวัคซีน',
      'other': 'อื่นๆ',
    };
    parts.push(`🩺 บริการ: ${serviceLabels[formData.service.serviceType] || formData.service.serviceType}`);
  }
  if (formData.schedule?.appointmentDate) {
    parts.push(`📅 วันที่: ${formData.schedule.appointmentDate}`);
  }
  if (formData.schedule?.appointmentTime) {
    parts.push(`🕐 เวลา: ${formData.schedule.appointmentTime}`);
  }
  if (formData.locations?.pickup?.address) {
    parts.push(`📍 รับ: ${formData.locations.pickup.address}`);
  }
  if (formData.locations?.dropoff?.address) {
    parts.push(`📍 ส่ง: ${formData.locations.dropoff.address}`);
  }
  
  parts.push('\nกรุณาตรวจสอบความถูกต้อง แล้วยืนยันเพื่อดำเนินการต่อครับ');
  
  return parts.join('\n');
}

/**
 * Generate success message
 */
function generateSuccessMessage(jobId: string): string {
  return `✅ บันทึกการนัดหมายเรียบร้อยแล้วครับ\n\nรหัสอ้างอิง: **${jobId}**\n\nทีมงานจะติดต่อกลับเพื่อยืนยันอีกครั้ง ขอบคุณครับ 🙏`;
}

/**
 * Generate error message
 */
function generateErrorMessage(error: string): string {
  return `❌ เกิดข้อผิดพลาด: ${error}\n\nกรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่ครับ`;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Generate welcome messages
 */
export function generateWelcomeMessages(): ChatMessage[] {
  return WELCOME_MESSAGES.map((text, index) => {
    const msg = createMessage('assistant', text);
    // First message gets quick replies for service type
    if (index === 1) {
      msg.quickReplies = FIELD_QUICK_REPLIES['service.serviceType'];
    }
    return msg;
  });
}

/**
 * Generate next question based on validation result
 */
export function generateNextQuestion(
  validation: ValidateFormDataResult,
  formData: PartialIntakeInput
): ChatMessage | null {
  const nextField = findNextField(validation.missingFields, formData);
  
  if (!nextField) {
    return null;
  }
  
  const question = getFieldQuestion(nextField);
  const quickReplies = getFieldQuickReplies(nextField);
  
  return createMessage('assistant', question, {
    quickReplies,
    meta: {
      type: 'question',
      field: nextField,
    },
  });
}

/**
 * Generate acknowledgment message after user input
 */
export function generateAcknowledgment(
  field: string,
  value: unknown,
  formData: PartialIntakeInput
): ChatMessage {
  const fieldLabels: Record<string, string> = {
    'contact.contactName': 'ชื่อผู้ติดต่อ',
    'contact.contactPhone': 'เบอร์โทร',
    'contact.relationship': 'ความสัมพันธ์',
    'service.serviceType': 'บริการ',
    'schedule.appointmentDate': 'วันนัด',
    'schedule.appointmentTime': 'เวลานัด',
    'locations.pickup.address': 'จุดรับ',
    'locations.dropoff.address': 'จุดส่ง',
    'patient.name': 'ชื่อผู้ป่วย',
    'patient.age': 'อายุ',
    'patient.mobilityLevel': 'การเคลื่อนไหว',
    'patient.needsEscort': 'ต้องการผู้ดูแล',
    'patient.needsWheelchair': 'ใช้รถเข็น',
    'patient.oxygenRequired': 'ใช้ออกซิเจน',
    'patient.stretcherRequired': 'ใช้เปล',
  };
  
  const label = fieldLabels[field] || field;
  let displayValue = String(value);
  
  // Format value for display
  if (typeof value === 'boolean') {
    displayValue = value ? 'ใช่' : 'ไม่ใช่';
  }
  
  return createMessage('assistant', `✓ บันทึก ${label}: ${displayValue}`, {
    meta: { type: 'info' },
  });
}

/**
 * Generate confirmation message
 */
export function generateConfirmationMessage(
  formData: PartialIntakeInput
): ChatMessage {
  const summary = generateConfirmationSummary(formData);
  
  return createMessage('assistant', summary, {
    quickReplies: [
      { label: '✅ ยืนยัน', value: 'confirm' },
      { label: '✏️ แก้ไข', value: 'edit' },
    ],
    meta: {
      type: 'confirmation',
    },
  });
}

/**
 * Generate success message after submission
 */
export function generateSubmissionSuccess(jobId: string): ChatMessage {
  return createMessage('assistant', generateSuccessMessage(jobId), {
    meta: { type: 'success' },
  });
}

/**
 * Generate error message after submission failure
 */
export function generateSubmissionError(error: string): ChatMessage {
  return createMessage('assistant', generateErrorMessage(error), {
    quickReplies: [
      { label: '🔄 ลองใหม่', value: 'retry' },
      { label: '✏️ แก้ไขข้อมูล', value: 'edit' },
    ],
    meta: { type: 'error' },
  });
}

/**
 * Generate validation error message
 */
export function generateValidationError(
  field: string,
  message: string
): ChatMessage {
  return createMessage('assistant', `⚠️ ${message}`, {
    meta: {
      type: 'error',
      field,
      validationError: message,
    },
  });
}

/**
 * Create user message
 */
export function createUserMessage(text: string): ChatMessage {
  return createMessage('user', text);
}

/**
 * Determine conversation state
 */
export function determineConversationState(
  validation: ValidateFormDataResult,
  formData: PartialIntakeInput
): {
  isComplete: boolean;
  awaitingConfirmation: boolean;
  nextField: string | null;
} {
  const isComplete = validation.isComplete;
  const nextField = findNextField(validation.missingFields, formData);
  
  return {
    isComplete,
    awaitingConfirmation: isComplete,
    nextField,
  };
}

/**
 * Get conversation step for field
 */
export function getConversationStep(field: string): ConversationStep {
  const typeMap: Record<string, ConversationStep['type']> = {
    'contact.contactName': 'text',
    'contact.contactPhone': 'text',
    'contact.relationship': 'choice',
    'service.serviceType': 'choice',
    'schedule.appointmentDate': 'date',
    'schedule.appointmentTime': 'time',
    'locations.pickup.address': 'location',
    'locations.dropoff.address': 'location',
    'patient.name': 'text',
    'patient.age': 'number',
    'patient.mobilityLevel': 'choice',
    'patient.needsEscort': 'boolean',
    'patient.needsWheelchair': 'boolean',
    'patient.oxygenRequired': 'boolean',
    'patient.stretcherRequired': 'boolean',
  };
  
  return {
    field,
    question: getFieldQuestion(field),
    type: typeMap[field] || 'text',
    required: true,
    options: FIELD_QUICK_REPLIES[field]?.map(o => o.label),
  };
}

// ============================================================================
// REQUIRED FUNCTIONS (from task specification)
// ============================================================================

import type {
  FormData,
  ConversationState,
  ParserResult,
  ChatActionResult,
} from './conversation-new-types';

// Re-export types for backward compatibility
export type { FormData, ConversationState, ParserResult, ChatActionResult };

// Required field order
const REQUIRED_FIELD_ORDER = [
  'contactName',
  'contactPhone',
  'serviceType',
  'appointmentDate',
  'appointmentTime',
  'pickup.address',
  'dropoff.address',
  'patient.name',
] as const;

// Service types
export const SERVICE_TYPES = [
  { value: 'hospital-visit', label: 'พาผู้ป่วยไปโรงพยาบาล' },
  { value: 'clinic-visit', label: 'พาผู้ป่วยไปคลินิก' },
  { value: 'checkup', label: 'ตรวจสุขภาพ' },
  { value: 'rehabilitation', label: 'กายภาพบำบัด' },
  { value: 'dialysis', label: 'ฟอกไต' },
  { value: 'chemotherapy', label: 'เคมีบำบัด' },
  { value: 'other', label: 'อื่นๆ' },
];

// Mobility levels
export const MOBILITY_LEVELS = [
  { value: 'independent', label: 'เดินได้เอง' },
  { value: 'assistance', label: 'ต้องการคนช่วยพยุง' },
  { value: 'wheelchair', label: 'นั่งรถเข็น' },
  { value: 'stretcher', label: 'นอนเปล' },
];

/**
 * 1. Get initial messages for conversation start
 */
export function getInitialMessages(): Array<{ role: 'assistant'; content: string }> {
  return [
    {
      role: 'assistant',
      content: 'สวัสดีค่ะ ยินดีต้อนรับสู่ WelCares 🚗💨\n\nฉันคือผู้ช่วยจัดการการจองบริการรถรับ-ส่งผู้ป่วยและผู้สูงอายุค่ะ ขออนุญาตสอบถามข้อมูลเพื่อจัดการบริการให้เหมาะสมนะคะ',
    },
  ];
}

/**
 * 2. Get required field order
 */
export function getRequiredFieldOrder(): string[] {
  return [...REQUIRED_FIELD_ORDER];
}

/**
 * 3. Get next field to ask
 */
export function getNextField(state: ConversationState): string | null {
  const { formData, askedFields, currentField } = state;

  // Get conditional fields based on current form data
  const conditionalFields = getConditionalQuestions(formData);

  // First, check if current field (if any) triggered conditional fields
  // that should be asked immediately after
  if (currentField === 'serviceType' && formData.serviceType === 'hospital-visit') {
    if (!askedFields.includes('department') && !formData.department) {
      return 'department';
    }
  }

  // Combine all fields in proper order
  // Required fields first, then conditional fields that haven't been asked
  const allFieldsToAsk: string[] = [];
  
  // Add required fields in order
  for (const field of REQUIRED_FIELD_ORDER) {
    if (!allFieldsToAsk.includes(field)) {
      allFieldsToAsk.push(field);
    }
  }
  
  // Add conditional fields
  for (const field of conditionalFields) {
    if (!allFieldsToAsk.includes(field)) {
      allFieldsToAsk.push(field);
    }
  }

  // Check all fields in order
  for (const field of allFieldsToAsk) {
    // Skip if already asked
    if (askedFields.includes(field)) {
      continue;
    }
    
    // Skip if already has value
    const value = getNestedValue(formData, field);
    if (value !== undefined && value !== null && value !== '') {
      continue;
    }

    // Check conditional logic
    if (field === 'department' && formData.serviceType !== 'hospital-visit') {
      continue;
    }

    if (field === 'needsEscort') {
      const mobility = formData.patient?.mobilityLevel;
      if (!mobility || mobility === 'independent') {
        continue;
      }
    }

    if (field.startsWith('pickup.floor') || field.startsWith('pickup.room')) {
      if (!formData.pickup?.buildingName) {
        continue;
      }
    }

    if (field.startsWith('dropoff.floor') || field.startsWith('dropoff.room')) {
      if (!formData.dropoff?.buildingName) {
        continue;
      }
    }

    if (field === 'equipmentNeeds') {
      const mobility = formData.patient?.mobilityLevel;
      if (mobility !== 'wheelchair' && mobility !== 'stretcher') {
        continue;
      }
    }

    return field;
  }

  return null;
}

/**
 * 4. Build question text for field (in Thai)
 */
export function buildQuestionForField(field: string, formData: FormData): string {
  const questions: Record<string, string> = {
    contactName: 'กรุณาบอกชื่อผู้ติดต่อหลักค่ะ',
    contactPhone: 'เบอร์โทรศัพท์ติดต่อกลับคือเบอร์อะไรคะ?',
    serviceType: 'ต้องการใช้บริการอะไรคะ?',
    department: 'ต้องการไปพบแผนกไหนคะ? (เช่น อายุรกรรม, ศัลยกรรม, ห้องฉุกเฉิน)',
    appointmentDate: 'ต้องการนัดหมายวันที่เท่าไหร่คะ?',
    appointmentTime: 'เวลาประมาณกี่โมงคะ?',
    'pickup.address': 'ต้องการให้ไปรับที่ไหนคะ? (ที่อยู่เต็มหรือชื่อสถานที่)',
    'pickup.buildingName': 'อาคาร/โครงการชื่ออะไรคะ?',
    'pickup.floor': 'ชั้นกี่คะ?',
    'pickup.room': 'ห้องเลขที่เท่าไหร่คะ?',
    'dropoff.address': 'ต้องการให้ไปส่งที่ไหนคะ?',
    'dropoff.buildingName': 'อาคาร/โครงการชื่ออะไรคะ?',
    'dropoff.floor': 'ชั้นกี่คะ?',
    'dropoff.room': 'ห้องเลขที่เท่าไหร่คะ?',
    'patient.name': 'ชื่อผู้ป่วย/ผู้โดยสารคืออะไรคะ?',
    'patient.mobilityLevel': 'ผู้ป่วยเดินได้เองหรือไม่คะ?',
    needsEscort: 'ต้องการให้พนักงานช่วยประคองไหมคะ?',
    equipmentNeeds: 'ต้องการอุปกรณ์พิเศษเพิ่มเติมไหมคะ? (เช่น ออกซิเจน, ที่นอนเสริม)',
  };

  // Context-aware questions
  if (field === 'serviceType' && formData.contactName) {
    return `คุณ${formData.contactName} ต้องการใช้บริการอะไรคะ?`;
  }

  return questions[field] || `กรุณาบอกข้อมูล ${field} ค่ะ`;
}

/**
 * 5. Get conditional questions based on form data
 */
export function getConditionalQuestions(formData: FormData): string[] {
  const conditionalFields: string[] = [];

  // serviceType = hospital-visit -> ask department
  if (formData.serviceType === 'hospital-visit') {
    conditionalFields.push('department');
  }

  // mobilityLevel != independent -> ask needsEscort
  if (formData.patient?.mobilityLevel && formData.patient.mobilityLevel !== 'independent') {
    conditionalFields.push('needsEscort');
  }

  // Has buildingName at pickup -> ask floor/room
  if (formData.pickup?.buildingName) {
    if (!formData.pickup.floor) conditionalFields.push('pickup.floor');
    if (!formData.pickup.room) conditionalFields.push('pickup.room');
  }

  // Has buildingName at dropoff -> ask floor/room
  if (formData.dropoff?.buildingName) {
    if (!formData.dropoff.floor) conditionalFields.push('dropoff.floor');
    if (!formData.dropoff.room) conditionalFields.push('dropoff.room');
  }

  // wheelchair/stretcher -> ask equipmentNeeds
  if (
    formData.patient?.mobilityLevel === 'wheelchair' ||
    formData.patient?.mobilityLevel === 'stretcher'
  ) {
    conditionalFields.push('equipmentNeeds');
  }

  return conditionalFields;
}

/**
 * 6. Check if field should be asked
 */
export function shouldAskField(field: string, formData: FormData): boolean {
  // Don't ask if already has value
  const value = getNestedValue(formData, field);
  if (value !== undefined && value !== null && value !== '') {
    return false;
  }

  // Conditional field checks
  if (field === 'department' && formData.serviceType !== 'hospital-visit') {
    return false;
  }

  if (field === 'needsEscort') {
    const mobility = formData.patient?.mobilityLevel;
    if (!mobility || mobility === 'independent') {
      return false;
    }
  }

  if (field.startsWith('pickup.floor') || field.startsWith('pickup.room')) {
    if (!formData.pickup?.buildingName) {
      return false;
    }
  }

  if (field.startsWith('dropoff.floor') || field.startsWith('dropoff.room')) {
    if (!formData.dropoff?.buildingName) {
      return false;
    }
  }

  if (field === 'equipmentNeeds') {
    const mobility = formData.patient?.mobilityLevel;
    if (mobility !== 'wheelchair' && mobility !== 'stretcher') {
      return false;
    }
  }

  return true;
}

/**
 * 7. Build confirmation summary
 */
export function buildConfirmationSummary(
  formData: FormData,
  preview?: { duration?: string; priceEstimate?: string }
): string {
  const lines: string[] = ['📋 สรุปรายละเอียดการจอง\n'];

  if (formData.contactName) {
    lines.push(`👤 ผู้ติดต่อ: ${formData.contactName}`);
  }
  if (formData.contactPhone) {
    lines.push(`📞 เบอร์โทร: ${formData.contactPhone}`);
  }

  lines.push('');

  if (formData.serviceType) {
    const serviceLabel = SERVICE_TYPES.find((s) => s.value === formData.serviceType)?.label || formData.serviceType;
    lines.push(`🚗 บริการ: ${serviceLabel}`);
  }
  if (formData.department) {
    lines.push(`🏥 แผนก: ${formData.department}`);
  }

  lines.push('');

  if (formData.appointmentDate) {
    lines.push(`📅 วันที่: ${formData.appointmentDate}`);
  }
  if (formData.appointmentTime) {
    lines.push(`⏰ เวลา: ${formData.appointmentTime}`);
  }

  lines.push('');

  if (formData.pickup?.address) {
    let pickupText = `📍 จุดรับ: ${formData.pickup.address}`;
    if (formData.pickup.buildingName) {
      pickupText += ` (${formData.pickup.buildingName}`;
      if (formData.pickup.floor) pickupText += ` ชั้น ${formData.pickup.floor}`;
      if (formData.pickup.room) pickupText += ` ห้อง ${formData.pickup.room}`;
      pickupText += ')';
    }
    lines.push(pickupText);
  }

  if (formData.dropoff?.address) {
    let dropoffText = `🏁 จุดส่ง: ${formData.dropoff.address}`;
    if (formData.dropoff.buildingName) {
      dropoffText += ` (${formData.dropoff.buildingName}`;
      if (formData.dropoff.floor) dropoffText += ` ชั้น ${formData.dropoff.floor}`;
      if (formData.dropoff.room) dropoffText += ` ห้อง ${formData.dropoff.room}`;
      dropoffText += ')';
    }
    lines.push(dropoffText);
  }

  lines.push('');

  if (formData.patient?.name) {
    lines.push(`🧑‍⚕️ ผู้ป่วย: ${formData.patient.name}`);
  }
  if (formData.patient?.mobilityLevel) {
    const mobilityLabel = MOBILITY_LEVELS.find((m) => m.value === formData.patient?.mobilityLevel)?.label;
    if (mobilityLabel) {
      lines.push(`🚶 การเคลื่อนไหว: ${mobilityLabel}`);
    }
  }
  if (formData.needsEscort !== undefined) {
    lines.push(`🤝 ต้องการผู้ช่วย: ${formData.needsEscort ? 'ใช่' : 'ไม่ใช่'}`);
  }
  if (formData.equipmentNeeds) {
    lines.push(`🦽 อุปกรณ์เพิ่มเติม: ${formData.equipmentNeeds}`);
  }

  // Preview info
  if (preview) {
    lines.push('');
    lines.push('💰 ประมาณการ:');
    if (preview.duration) lines.push(`   เวลาเดินทาง: ${preview.duration}`);
    if (preview.priceEstimate) lines.push(`   ค่าบริการโดยประมาณ: ${preview.priceEstimate}`);
  }

  lines.push('');
  lines.push('✅ กรุณาตรวจสอบข้อมูลและพิมพ์ "ยืนยัน" เพื่อจอง หรือแจ้งแก้ไขหากต้องการเปลี่ยนแปลงค่ะ');

  return lines.join('\n');
}

/**
 * 8. Handle user turn
 */
export function handleUserTurn(
  state: ConversationState,
  userText: string,
  parserResult?: ParserResult
): ChatActionResult {
  const { formData, askedFields, confirmed } = state;

  // Already confirmed
  if (confirmed) {
    return {
      response: 'ขอบคุณค่ะ การจองเสร็จสมบูรณ์แล้ว เราจะติดต่อกลับเพื่อยืนยันอีกครั้งนะคะ 🙏',
      updatedState: state,
      isComplete: true,
    };
  }

  // Check for confirmation
  const confirmWords = ['ยืนยัน', 'confirm', 'ok', 'โอเค', 'ตกลง', 'yes', 'ใช่'];
  const isConfirming = confirmWords.some((word) => userText.toLowerCase().includes(word.toLowerCase()));

  // Check if form is complete
  const { isComplete } = deriveConversationState(formData);

  if (isComplete && isConfirming) {
    return {
      response:
        'ขอบคุณค่ะ การจองเสร็จสมบูรณ์แล้ว เราจะติดต่อกลับเพื่อยืนยันอีกครั้งนะคะ 🙏\n\nหมายเลขการจอง: WC-' +
        Date.now().toString(36).toUpperCase(),
      updatedState: { ...state, confirmed: true },
      isComplete: true,
    };
  }

  // Update form data from parser result
  let updatedFormData = { ...formData };
  let updatedAskedFields = [...askedFields];
  let updatedCurrentField = state.currentField;

  if (parserResult?.field && parserResult.confidence > 0.5) {
    updatedFormData = setNestedValue(updatedFormData, parserResult.field, parserResult.value);
    if (!updatedAskedFields.includes(parserResult.field)) {
      updatedAskedFields.push(parserResult.field);
    }
    updatedCurrentField = parserResult.field;
  }

  // If form is complete, show summary
  const newState = deriveConversationState(updatedFormData);

  if (newState.isComplete) {
    return {
      response: buildConfirmationSummary(updatedFormData),
      updatedState: { ...state, formData: updatedFormData, askedFields: updatedAskedFields },
      quickReplies: [
        { label: '✅ ยืนยัน', value: 'ยืนยัน' },
        { label: '✏️ แก้ไข', value: 'แก้ไข' },
      ],
      needsConfirmation: true,
    };
  }

  // Find next field
  const nextState: ConversationState = {
    ...state,
    formData: updatedFormData,
    askedFields: updatedAskedFields,
    currentField: updatedCurrentField,
  };
  const nextField = getNextField(nextState);

  if (nextField) {
    const question = buildQuestionForField(nextField, updatedFormData);
    const quickReplies = getQuickRepliesForField(nextField);

    return {
      response: question,
      updatedState: {
        ...state,
        formData: updatedFormData,
        askedFields: updatedAskedFields,
        currentField: nextField,
      },
      quickReplies,
    };
  }

  return {
    response: 'ขออภัยค่ะ ไม่เข้าใจคำถาม กรุณาลองใหม่อีกครั้งนะคะ',
    updatedState: state,
  };
}

/**
 * 9. Derive conversation state
 */
export function deriveConversationState(formData: FormData): {
  missingFields: string[];
  completedFields: string[];
  isComplete: boolean;
} {
  const missingFields: string[] = [];
  const completedFields: string[] = [];

  // Check required fields
  for (const field of REQUIRED_FIELD_ORDER) {
    if (shouldAskField(field, formData)) {
      missingFields.push(field);
    } else {
      completedFields.push(field);
    }
  }

  // Check conditional fields
  const conditionalFields = getConditionalQuestions(formData);
  for (const field of conditionalFields) {
    const value = getNestedValue(formData, field);
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    } else {
      completedFields.push(field);
    }
  }

  return {
    missingFields,
    completedFields,
    isComplete: missingFields.length === 0,
  };
}

/**
 * 10. Get quick replies for field
 */
export function getQuickRepliesForField(field: string): Array<{ label: string; value: string }> | undefined {
  switch (field) {
    case 'serviceType':
      return SERVICE_TYPES.map((s) => ({ label: s.label, value: s.value }));

    case 'patient.mobilityLevel':
      return MOBILITY_LEVELS.map((m) => ({ label: m.label, value: m.value }));

    case 'needsEscort':
      return [
        { label: '✅ ใช่ ต้องการ', value: 'true' },
        { label: '❌ ไม่ต้องการ', value: 'false' },
      ];

    case 'appointmentDate': {
      // Suggested dates
      const today = new Date();
      const dates: Array<{ label: string; value: string }> = [];
      for (let i = 0; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const label =
          i === 0 ? 'วันนี้' : i === 1 ? 'พรุ่งนี้' : d.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' });
        dates.push({ label, value: dateStr });
      }
      return dates;
    }

    case 'appointmentTime':
      return [
        { label: '08:00', value: '08:00' },
        { label: '09:00', value: '09:00' },
        { label: '10:00', value: '10:00' },
        { label: '11:00', value: '11:00' },
        { label: '13:00', value: '13:00' },
        { label: '14:00', value: '14:00' },
        { label: '15:00', value: '15:00' },
      ];

    default:
      return undefined;
  }
}

// Helper functions
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function setNestedValue(obj: FormData, path: string, value: unknown): FormData {
  const keys = path.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

// Export constants
export { REQUIRED_FIELD_ORDER };

// ============================================================================
// END REQUIRED FUNCTIONS
// ============================================================================
