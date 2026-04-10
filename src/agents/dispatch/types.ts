/**
 * Dispatch Agent — Types
 * V1: Rule-based provider matching, no LLM
 *
 * @module src/agents/dispatch/types
 */

// ============================================================================
// PROVIDER
// ============================================================================

export type ProviderType = 'DRIVER' | 'CAREGIVER' | 'NURSE';

export type VehicleType = 'sedan' | 'MPV' | 'wheelchair-van' | 'ambulance';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  /** ทักษะ/ใบอนุญาตพิเศษ */
  skills: ProviderSkill[];
  /** ยานพาหนะที่มี */
  vehicle?: VehicleType;
  /** พิกัดปัจจุบัน */
  location?: { lat: number; lng: number };
  /** พร้อมรับงานหรือไม่ */
  available: boolean;
  /** rating เฉลี่ย 0-5 */
  rating: number;
}

export type ProviderSkill =
  | 'wheelchair'
  | 'stretcher'
  | 'oxygen'
  | 'escort'
  | 'medicine-delivery'
  | 'home-care'
  | 'nurse-license'
  | 'thai'
  | 'english';

// ============================================================================
// DISPATCH INPUT / OUTPUT
// ============================================================================

export interface DispatchInput {
  jobId: string;
  /** override provider pool สำหรับ testing */
  providerPool?: Provider[];
}

export interface DispatchResult {
  success: boolean;
  jobId: string;
  /** provider ที่เลือก */
  provider?: Provider;
  /** เหตุผลที่เลือก */
  reasoning?: string;
  /** ประมาณ ETA (นาที) */
  estimatedArrivalMinutes?: number;
  /** ต้องรอ human approve */
  requiresHumanApproval: boolean;
  error?: string;
}

// ============================================================================
// MATCHING
// ============================================================================

/** คะแนนความเหมาะสมของ provider กับงาน */
export interface SuitabilityScore {
  providerId: string;
  score: number;        // 0-100
  matchedSkills: ProviderSkill[];
  missingSkills: ProviderSkill[];
  reasoning: string;
}
