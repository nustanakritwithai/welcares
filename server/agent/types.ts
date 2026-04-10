/**
 * Agent System — Shared Types
 * Single source of truth for booking data schema used by both
 * the server-side agent loop and the frontend hook.
 *
 * @module server/agent/types
 */

// ============================================================================
// BOOKING DATA — canonical field paths (e.g. "contact.name", "service.type")
// ============================================================================

export interface BookingData {
  contact?: {
    name?: string;
    phone?: string;
  };
  service?: {
    type?: string;           // hospital-visit | dialysis | chemotherapy | radiation | physical-therapy | checkup | vaccination | other
    department?: string;
    doctorName?: string;
  };
  schedule?: {
    date?: string;           // YYYY-MM-DD
    time?: string;           // HH:MM
    flexibility?: string;    // strict | 30min | 1hour | anytime
  };
  locations?: {
    pickup?: string;
    dropoff?: string;
  };
  patient?: {
    name?: string;
    mobilityLevel?: 'independent' | 'assisted' | 'wheelchair' | 'bedridden';
    needsWheelchair?: boolean;
    needsEscort?: boolean;
    oxygenRequired?: boolean;
    stretcherRequired?: boolean;
  };
  addons?: {
    medicinePickup?: boolean;
    homeCare?: boolean;
  };
  notes?: string;
}

// Required fields for a complete booking
export const REQUIRED_FIELDS: (keyof BookingDataFlat)[] = [
  'contact.name',
  'contact.phone',
  'service.type',
  'schedule.date',
  'schedule.time',
  'locations.pickup',
  'locations.dropoff',
  'patient.name',
  'patient.mobilityLevel',
];

// Flat field path type for type-safety
export type BookingDataFlat =
  | 'contact.name'
  | 'contact.phone'
  | 'service.type'
  | 'service.department'
  | 'service.doctorName'
  | 'schedule.date'
  | 'schedule.time'
  | 'schedule.flexibility'
  | 'locations.pickup'
  | 'locations.dropoff'
  | 'patient.name'
  | 'patient.mobilityLevel'
  | 'patient.needsWheelchair'
  | 'patient.needsEscort'
  | 'patient.oxygenRequired'
  | 'patient.stretcherRequired'
  | 'addons.medicinePickup'
  | 'addons.homeCare'
  | 'notes';

// ============================================================================
// SESSION
// ============================================================================

export type AgentStatus = 'collecting' | 'confirming' | 'submitted' | 'cancelled';

export interface AgentSession {
  sessionId: string;
  history: LLMMessage[];
  bookingData: BookingData;
  status: AgentStatus;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// LLM MESSAGE FORMAT (OpenAI-compatible)
// ============================================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ============================================================================
// HTTP REQUEST / RESPONSE
// ============================================================================

export interface AgentChatRequest {
  sessionId?: string;
  message: string;
}

export interface AgentChatResponse {
  sessionId: string;
  message: string;
  bookingData: BookingData;
  status: AgentStatus;
  jobId?: string;
  quickReplies?: string[];
  missingFields?: string[];
}
