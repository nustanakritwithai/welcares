/**
 * Family Update Agent — Types
 * V1: Template-based Thai messages, no actual sending
 *
 * @module src/agents/family-update/types
 */

import type { JobState } from '../../server/store/types';

export type NotificationChannel = 'LINE' | 'SMS' | 'APP_PUSH' | 'NONE';
export type MessageTone = 'REASSURING' | 'INFORMATIVE' | 'URGENT';

export interface FamilyUpdateInput {
  jobId: string;
  newState: JobState;
  /** ชื่อผู้ป่วย (ดึงจาก JobSpec) */
  patientName?: string;
  /** ชื่อ provider ที่ได้รับมอบหมาย */
  providerName?: string;
  /** ETA เป็นนาที */
  etaMinutes?: number;
  /** หมายเหตุเพิ่มเติม */
  notes?: string;
}

export interface FamilyUpdateMessage {
  /** state ที่ trigger message นี้ */
  triggerState: JobState;
  /** ข้อความภาษาไทย */
  messageTh: string;
  /** ช่องทางที่แนะนำ */
  recommendedChannel: NotificationChannel;
  /** โทนของข้อความ */
  tone: MessageTone;
  /** timestamp ที่สร้าง */
  createdAt: string;
}

export interface FamilyUpdateResult {
  success: boolean;
  jobId: string;
  message?: FamilyUpdateMessage;
  /** กรณีที่ state นี้ไม่ต้องส่ง message */
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}
