/**
 * Intake Chat Agent - Types
 * Type definitions สำหรับ conversational layer
 * 
 * @version 1.0
 */

import type { IntakeInput, JobSpec, FollowUpQuestion, ValidationResult } from '../intake/types';

// Re-export types from intake for convenience
export type { IntakeInput, JobSpec, FollowUpQuestion, ValidationResult } from '../intake/types';
export type { PartialIntakeInput } from '../intake/types';

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'assistant' | 'user' | 'system';

export type MessageType = 
  | 'text' 
  | 'quick_replies' 
  | 'summary' 
  | 'confirmation' 
  | 'error' 
  | 'success';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  quickReplies?: QuickReply[];
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface QuickReply {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

// ============================================================================
// Conversation State
// ============================================================================

export type ConversationStatus = 
  | 'idle'
  | 'greeting'
  | 'collecting'
  | 'clarifying'
  | 'awaitingConfirmation'
  | 'submitting'
  | 'success'
  | 'error';

export interface ConversationState {
  messages: ChatMessage[];
  status: ConversationStatus;
  isTyping: boolean;
  formData: Partial<IntakeInput>;
  validationResult?: ValidationResult;
  jobSpec?: JobSpec;
  currentQuestion?: FollowUpQuestion;
  error?: string;
}

// ============================================================================
// Agent State
// ============================================================================

export interface IntakeChatAgentState {
  // Messages
  messages: ChatMessage[];
  
  // Status
  status: ConversationStatus;
  isTyping: boolean;
  isReady: boolean;
  
  // Form Data - SOURCE OF TRUTH
  formData: PartialIntakeInput;
  
  // Current field being asked
  currentField: string | null;
  
  // Missing fields
  missingFields: string[];
  
  // Validation
  validationResult?: ValidationResult;
  
  // Job
  jobSpec?: JobSpec;
  jobId?: string;
  
  // Error
  error?: string;
}

export interface IntakeChatAgentActions {
  // Message actions
  sendMessage: (text: string) => Promise<void>;
  selectQuickReply: (reply: QuickReply) => Promise<void>;
  
  // Control actions
  confirmBooking: () => Promise<void>;
  restart: () => void;
  reset: () => void;
}

export type UseIntakeChatAgentReturn = IntakeChatAgentState & IntakeChatAgentActions;

// ============================================================================
// Props Types
// ============================================================================

export interface IntakeChatDemoProps {
  onComplete?: (jobId: string) => void;
  onCancel?: () => void;
  initialMessage?: string;
  className?: string;
}

// ============================================================================
// Summary Card Types
// ============================================================================

export interface SummaryCardData {
  serviceType: string;
  patientName: string;
  date: string;
  time: string;
  pickup: string;
  dropoff: string;
  estimatedCost?: number;
}

// ============================================================================
// Additional Types (used by hook and conversation)
// ============================================================================

/** Alias for IntakeInput used by hook */
export type IntakeFormData = Partial<IntakeInput>;

/** Quick reply option for hook */
export interface QuickReplyOption {
  label: string;
  value: string;
}

/** Chat message metadata */
export interface ChatMessageMeta {
  type?: 'question' | 'info' | 'confirmation' | 'error' | 'success';
  field?: string;
  validationError?: string;
}

/** Chat role alias */
export type ChatRole = MessageRole;

/** Chat error type */
export interface ChatError {
  field?: string;
  message: string;
  code?: string;
}

/** User intent type */
export type UserIntent = 'confirm' | 'reject' | 'edit' | 'restart' | 'skip' | 'unknown';

/** Parsed answer type (re-export from parser) */
export type { ParsedAnswer, GlobalIntent } from './parser';

/** Conversation step for UI */
export interface ConversationStep {
  field: string;
  question: string;
  type: 'text' | 'choice' | 'boolean' | 'date' | 'time' | 'number' | 'location';
  required: boolean;
  options?: string[];
}