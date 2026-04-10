/**
 * Family Update Agent — Message Generator (V1, Template-based)
 *
 * สร้างข้อความแจ้งสถานะครอบครัว ตาม state ของ job
 * V1: ใช้ template คงที่ ไม่ใช้ LLM
 *
 * @module src/agents/family-update/generator
 */

import type { JobState } from '../../server/store/types';
import type {
  FamilyUpdateInput,
  FamilyUpdateMessage,
  FamilyUpdateResult,
  NotificationChannel,
  MessageTone,
} from './types';

// ============================================================================
// MESSAGE TEMPLATES
// State ที่ไม่อยู่ในนี้ = ไม่ส่ง message (ไม่จำเป็น)
// ============================================================================

interface TemplateContext {
  patientName: string;
  providerName: string;
  eta: string;
  notes: string;
}

type TemplateFunction = (ctx: TemplateContext) => {
  messageTh: string;
  channel: NotificationChannel;
  tone: MessageTone;
};

const TEMPLATES: Partial<Record<JobState, TemplateFunction>> = {

  DISPATCH: ({ patientName }) => ({
    messageTh: `🔍 [WelCares] กำลังจัดหาผู้ดูแล${patientName ? `สำหรับ ${patientName}` : ''} อยู่ครับ/ค่ะ จะแจ้งให้ทราบทันทีที่ยืนยันแล้ว`,
    channel: 'LINE',
    tone: 'INFORMATIVE',
  }),

  ASSIGNED: ({ patientName, providerName, eta }) => ({
    messageTh: `✅ [WelCares] ยืนยันแล้วครับ/ค่ะ\n${providerName ? `👤 ${providerName}` : 'ผู้ดูแล'} กำลังเดินทางไปรับ${patientName ? ` ${patientName}` : ''}\n⏱ ประมาณ ${eta} นาที`,
    channel: 'LINE',
    tone: 'REASSURING',
  }),

  PREPARING: ({ patientName, providerName }) => ({
    messageTh: `🚗 [WelCares] ${providerName ? providerName : 'ผู้ดูแล'}ใกล้ถึงแล้วครับ/ค่ะ กำลังเดินทางไปรับ${patientName ? ` ${patientName}` : ''} โปรดเตรียมพร้อม`,
    channel: 'LINE',
    tone: 'INFORMATIVE',
  }),

  ACTIVE: ({ patientName }) => ({
    messageTh: `🏥 [WelCares] รับตัว${patientName ? ` ${patientName}` : 'ผู้ป่วย'}เรียบร้อยแล้วครับ/ค่ะ กำลังเดินทางไปยังปลายทาง`,
    channel: 'LINE',
    tone: 'REASSURING',
  }),

  DELAYED: ({ patientName, notes }) => ({
    messageTh: `⏳ [WelCares] มีความล่าช้าเล็กน้อยในการให้บริการ${patientName ? ` ${patientName}` : ''} ครับ/ค่ะ${notes ? `\nสาเหตุ: ${notes}` : ''} กำลังดำเนินการแก้ไขอยู่นะครับ/ค่ะ`,
    channel: 'LINE',
    tone: 'REASSURING',
  }),

  INCIDENT: () => ({
    messageTh: `⚠️ [WelCares] เกิดเหตุไม่คาดคิดระหว่างให้บริการ ทีมงานกำลังดูแลอยู่ครับ/ค่ะ จะรีบแจ้งความคืบหน้า กรุณาตรวจสอบสายโทรศัพท์ไว้`,
    channel: 'SMS',  // urgent → SMS มั่นใจกว่า
    tone: 'URGENT',
  }),

  COMPLETED: ({ patientName }) => ({
    messageTh: `🎉 [WelCares] เสร็จเรียบร้อยแล้วครับ/ค่ะ${patientName ? ` ${patientName}` : 'ผู้รับบริการ'}ถึงปลายทางปลอดภัย ขอบคุณที่ไว้วางใจ WelCares นะครับ/ค่ะ`,
    channel: 'LINE',
    tone: 'REASSURING',
  }),

  CANCELLED: ({ patientName }) => ({
    messageTh: `❌ [WelCares] การนัดหมาย${patientName ? `สำหรับ ${patientName}` : ''} ถูกยกเลิกแล้วครับ/ค่ะ หากต้องการจองใหม่ กรุณาติดต่อเราได้เลย`,
    channel: 'LINE',
    tone: 'INFORMATIVE',
  }),
};

/** States ที่ไม่ต้องส่ง message (silent transitions) */
const SILENT_STATES: JobState[] = ['INTAKE', 'VALIDATE', 'REJECTED'];

// ============================================================================
// HELPER
// ============================================================================

function buildContext(input: FamilyUpdateInput): TemplateContext {
  return {
    patientName: input.patientName ?? '',
    providerName: input.providerName ?? '',
    eta: input.etaMinutes !== undefined ? String(input.etaMinutes) : '30',
    notes: input.notes ?? '',
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * สร้าง FamilyUpdateMessage จาก job state
 * Pure function — ไม่ส่ง message จริง (caller รับผิดชอบ)
 */
export function generateFamilyUpdate(input: FamilyUpdateInput): FamilyUpdateResult {
  const { jobId, newState } = input;

  // State ที่ไม่ต้องแจ้ง
  if (SILENT_STATES.includes(newState)) {
    return {
      success: true,
      jobId,
      skipped: true,
      skipReason: `State ${newState} ไม่จำเป็นต้องแจ้งครอบครัว`,
    };
  }

  const template = TEMPLATES[newState];
  if (!template) {
    return {
      success: true,
      jobId,
      skipped: true,
      skipReason: `ไม่มี template สำหรับ state ${newState}`,
    };
  }

  try {
    const ctx = buildContext(input);
    const { messageTh, channel, tone } = template(ctx);

    const message: FamilyUpdateMessage = {
      triggerState: newState,
      messageTh,
      recommendedChannel: channel,
      tone,
      createdAt: new Date().toISOString(),
    };

    return { success: true, jobId, message };
  } catch (err) {
    return {
      success: false,
      jobId,
      error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างข้อความ',
    };
  }
}

/**
 * ดึง states ที่จะส่ง message (ใช้ใน test / docs)
 */
export function getNotifiableStates(): JobState[] {
  return Object.keys(TEMPLATES) as JobState[];
}
