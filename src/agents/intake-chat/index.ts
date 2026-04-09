/**
 * Intake Chat Agent - Index
 * 
 * Conversational intake module สำหรับ WelCares
 * จัดการ flow การสนทนาเพื่อรวบรวมข้อมูลการจองบริการ
 * 
 * @module src/agents/intake-chat
 * @version 1.0.0
 */

// ============================================================================
// Main Hook (Primary API)
// ============================================================================

export { useIntakeChatAgent } from './useIntakeChatAgent';
export type { 
  UseIntakeChatAgentReturn, 
  UseIntakeChatAgentOptions 
} from './useIntakeChatAgent';

// ============================================================================
// Types
// ============================================================================

export type {
  // Core types
  ChatMessage,
  QuickReply,
  QuickReplyOption,
  MessageRole,
  MessageType,
  ConversationStatus,
  ConversationState as AgentConversationState,
  IntakeChatAgentState,
  IntakeChatAgentActions,
  IntakeFormData,
  JobSpec,
  ChatMessageMeta,
  ChatRole,
  ValidationResult,
  ChatError,
  UserIntent,
  ParsedAnswer,
  ConversationStep,
  IntakeChatDemoProps,
  SummaryCardData,
  // Re-exports from intake
  IntakeInput,
  PartialIntakeInput,
} from './types';

// ============================================================================
// Parser Functions
// ============================================================================

export {
  // Main parser
  parseUserAnswer,
  // Intent detection
  parseGlobalIntent,
  detectIntent,
  // Individual field parsers
  parseServiceType,
  parseRelationship,
  parseDate,
  parseTime,
  parsePhone,
  parseBoolean,
  parseMobilityLevel,
  parseUrgencyLevel,
  parseTimeFlexibility,
  // Advanced parsers
  parseInput,
  applyParsedAnswer,
  autoDetectField,
  extractAddressLikeText,
  // Utilities
  containsAny,
  extractPhone,
  extractAge,
  extractDate,
  extractTime,
} from './parser';

export type { 
  GlobalIntent,
  IntentDetectionResult,
} from './parser';

// ============================================================================
// Conversation Engine
// ============================================================================

export {
  // Legacy functions
  generateWelcomeMessages,
  generateNextQuestion,
  generateAcknowledgment,
  generateConfirmationMessage,
  generateSubmissionSuccess,
  generateSubmissionError,
  generateValidationError,
  createUserMessage,
  determineConversationState,
  getConversationStep,
  // Required functions (from AGENT-3)
  getInitialMessages,
  getRequiredFieldOrder,
  getNextField,
  buildQuestionForField,
  getConditionalQuestions,
  shouldAskField,
  buildConfirmationSummary,
  handleUserTurn,
  deriveConversationState,
  getQuickRepliesForField,
  // Constants
  SERVICE_TYPES,
  MOBILITY_LEVELS,
} from './conversation';

export type {
  FormData,
  ConversationState,
  ParserResult,
  ChatActionResult,
} from './conversation';

// ============================================================================
// UI Components
// ============================================================================

export { IntakeChatDemo } from './demo/IntakeChatDemo';
export type { IntakeChatDemoProps as DemoProps } from './types';
