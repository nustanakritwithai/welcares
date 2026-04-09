/**
 * Conversation Engine Types
 * Types สำหรับ conversation engine
 * 
 * @module src/agents/intake-chat/conversation-new-types
 */

/**
 * Form data structure
 */
export interface FormData {
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  relationship?: string;
  serviceType?: string;
  serviceSubType?: string;
  department?: string;
  doctorName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  timeFlexibility?: string;
  pickup?: {
    address?: string;
    buildingName?: string;
    floor?: string;
    roomNumber?: string;
    contactName?: string;
    contactPhone?: string;
  };
  dropoff?: {
    address?: string;
    buildingName?: string;
    floor?: string;
    roomNumber?: string;
    contactName?: string;
    contactPhone?: string;
    name?: string;
    department?: string;
  };
  patient?: {
    name?: string;
    age?: number;
    gender?: 'female' | 'male' | 'other';
    mobilityLevel?: 'independent' | 'assisted' | 'wheelchair' | 'bedridden';
    needsEscort?: boolean;
    needsWheelchair?: boolean;
    oxygenRequired?: boolean;
    stretcherRequired?: boolean;
    conditions?: string[];
    allergies?: string[];
    medications?: string[];
  };
  needsEscort?: boolean;
  needsWheelchair?: boolean;
  oxygenRequired?: boolean;
  stretcherRequired?: boolean;
  equipmentNeeds?: string;
  notes?: string;
  specialNotes?: string;
  urgencyLevel?: 'low' | 'normal' | 'high' | 'urgent';
  [key: string]: unknown;
}

/**
 * Conversation state
 */
export interface ConversationState {
  formData: FormData;
  currentField: string | null;
  askedFields: string[];
  confirmed: boolean;
}

/**
 * Parser result
 */
export interface ParserResult {
  field?: string;
  value: unknown;
  confidence: number;
  entities?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Chat action result
 */
export interface ChatActionResult {
  response: string;
  updatedState: ConversationState;
  quickReplies?: Array<{
    label: string;
    value: string;
  }>;
  isComplete?: boolean;
  needsConfirmation?: boolean;
}
