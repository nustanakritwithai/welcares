/**
 * JobStore — Types & Interfaces
 *
 * ออกแบบให้ swap implementation ได้ง่าย:
 *   MemoryJobStore (MVP) → RedisJobStore / PostgresJobStore (Production)
 *
 * @module server/store/types
 */

// ============================================================================
// RE-EXPORT JobSpec จาก Intake Agent (source of truth)
// ============================================================================

// Import แบบ path alias เพื่อให้ server อ่าน schema ของ intake ได้โดยตรง
export type { JobSpec } from '../../src/agents/intake/schema.js';

// ============================================================================
// JOB STATE — ตรงกับ State Machine ใน docs/ai-architecture/02-workflow-state-machine.md
// ============================================================================

export type JobState =
  | 'INTAKE'       // รับข้อมูลจาก Intake Agent แล้ว รอ validate
  | 'VALIDATE'     // กำลัง validate business rules
  | 'DISPATCH'     // กำลังหา provider
  | 'ASSIGNED'     // เจอ provider แล้ว รอการยืนยัน
  | 'PREPARING'    // provider กำลังเดินทางไปรับ
  | 'ACTIVE'       // กำลังให้บริการ
  | 'DELAYED'      // เกิดความล่าช้า
  | 'INCIDENT'     // เกิดเหตุผิดปกติ
  | 'COMPLETED'    // จบงานสำเร็จ
  | 'CANCELLED'    // ยกเลิก
  | 'REJECTED';    // ไม่สามารถให้บริการได้

/** State ที่ถือว่าจบการทำงาน (terminal states) */
export const TERMINAL_STATES: JobState[] = ['COMPLETED', 'CANCELLED', 'REJECTED'];

/** State transitions ที่ถูกต้อง — ป้องกัน state ย้อนกลับผิด */
export const VALID_TRANSITIONS: Record<JobState, JobState[]> = {
  INTAKE:     ['VALIDATE', 'REJECTED'],
  VALIDATE:   ['DISPATCH', 'REJECTED'],
  DISPATCH:   ['ASSIGNED', 'REJECTED'],
  ASSIGNED:   ['PREPARING', 'DISPATCH'],   // DISPATCH = provider declined → หาใหม่
  PREPARING:  ['ACTIVE', 'CANCELLED'],
  ACTIVE:     ['COMPLETED', 'DELAYED', 'INCIDENT', 'CANCELLED'],
  DELAYED:    ['ACTIVE', 'INCIDENT', 'CANCELLED'],
  INCIDENT:   ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED:  [],
  CANCELLED:  [],
  REJECTED:   [],
};

// ============================================================================
// JOB RECORD — ข้อมูลงานทั้งหมดใน store
// ============================================================================

/** บันทึกการเปลี่ยน state แต่ละครั้ง */
export interface StateTransition {
  from: JobState;
  to: JobState;
  at: string;        // ISO8601
  reason?: string;   // เหตุผลการเปลี่ยน state (optional)
  agentId?: string;  // agent ที่ trigger การเปลี่ยน
}

/** ข้อมูล provider ที่ได้รับการ assign */
export interface AssignedProvider {
  providerId: string;
  providerType: 'DRIVER' | 'CAREGIVER' | 'NURSE';
  name?: string;
  estimatedArrival?: string;  // ISO8601
  confidence?: number;        // 0.0–1.0
}

/** Job record เต็มใน store */
export interface Job {
  /** รหัสงาน เช่น WC-20260410-0001 (ตรงกับ JobSpec.metadata.jobId) */
  id: string;

  /** state ปัจจุบัน */
  state: JobState;

  /** ข้อมูลงานจาก Intake Agent */
  jobSpec: import('../../src/agents/intake/schema.js').JobSpec;

  /** ผู้ให้บริการที่ assign (มีหลัง state = ASSIGNED) */
  assignedProvider?: AssignedProvider;

  /** ประวัติการเปลี่ยน state ทั้งหมด */
  history: StateTransition[];

  /** metadata ของ record นี้ */
  meta: {
    source: 'form' | 'chat' | 'api';
    sessionId?: string;
    createdAt: string;   // ISO8601
    updatedAt: string;   // ISO8601
  };
}

// ============================================================================
// INPUT TYPES — สำหรับ create / update
// ============================================================================

/** ข้อมูลที่ต้องส่งมาเพื่อสร้าง Job ใหม่ */
export interface CreateJobInput {
  jobSpec: import('../../src/agents/intake/schema.js').JobSpec;
  source?: 'form' | 'chat' | 'api';
  sessionId?: string;
}

/** ข้อมูลที่ต้องส่งมาเพื่ออัปเดต Job */
export interface UpdateJobInput {
  /** เปลี่ยน state (ต้องเป็น valid transition) */
  state?: JobState;
  /** เหตุผลการเปลี่ยน state */
  reason?: string;
  /** agent ที่ trigger การเปลี่ยน */
  agentId?: string;
  /** อัปเดต assigned provider */
  assignedProvider?: AssignedProvider;
}

// ============================================================================
// FILTER / QUERY
// ============================================================================

export interface JobFilter {
  state?: JobState | JobState[];
  source?: 'form' | 'chat' | 'api';
  /** createdAt >= since (ISO8601) */
  since?: string;
  /** จำนวนสูงสุดที่ return */
  limit?: number;
  /** skip N รายการแรก (pagination) */
  offset?: number;
}

// ============================================================================
// JOBSTORE INTERFACE — Repository pattern
// ============================================================================

/**
 * Interface ที่ทุก implementation ต้องทำตาม
 *
 * ```
 * MemoryJobStore   → ใช้ตอนนี้ (MVP)
 * RedisJobStore    → swap ตอน scale
 * PostgresJobStore → swap ตอน production จริง
 * ```
 */
export interface JobStore {
  /**
   * สร้าง Job ใหม่จาก JobSpec
   * state เริ่มต้นที่ 'INTAKE' เสมอ
   */
  create(input: CreateJobInput): Promise<Job>;

  /**
   * ค้นหา Job ด้วย ID
   * คืน null ถ้าไม่พบ
   */
  findById(id: string): Promise<Job | null>;

  /**
   * อัปเดต Job — เปลี่ยน state / assign provider
   * ตรวจสอบ valid transition อัตโนมัติ
   * โยน error ถ้า transition ไม่ถูกต้อง
   */
  update(id: string, input: UpdateJobInput): Promise<Job>;

  /**
   * ดึง Job ทั้งหมด (พร้อม filter)
   */
  list(filter?: JobFilter): Promise<Job[]>;

  /**
   * ลบ Job ออกจาก store
   * โยน error ถ้าไม่พบ
   */
  delete(id: string): Promise<void>;

  /**
   * จำนวน Job ทั้งหมดใน store
   */
  count(filter?: JobFilter): Promise<number>;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class JobNotFoundError extends Error {
  constructor(id: string) {
    super(`Job not found: ${id}`);
    this.name = 'JobNotFoundError';
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(from: JobState, to: JobState) {
    super(`Invalid state transition: ${from} → ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}
