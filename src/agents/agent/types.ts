/**
 * Shared types for client-side agent
 * @module src/agents/agent/types
 */

export interface BookingData {
  contact?: { name?: string; phone?: string };
  service?: { type?: string; department?: string; doctorName?: string };
  schedule?: { date?: string; time?: string; flexibility?: string };
  locations?: { pickup?: string; dropoff?: string };
  patient?: {
    name?: string;
    mobilityLevel?: string;
    needsWheelchair?: boolean;
    needsEscort?: boolean;
    oxygenRequired?: boolean;
    stretcherRequired?: boolean;
  };
  addons?: { medicinePickup?: boolean; homeCare?: boolean };
  notes?: string;
}

export type AgentStatus = 'collecting' | 'confirming' | 'submitted' | 'cancelled';

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
  function: { name: string; arguments: string };
}

export const REQUIRED_FIELDS = [
  'contact.name',
  'contact.phone',
  'service.type',
  'schedule.date',
  'schedule.time',
  'locations.pickup',
  'locations.dropoff',
  'patient.name',
  'patient.mobilityLevel',
] as const;
