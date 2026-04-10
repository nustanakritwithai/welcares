/**
 * MemoryJobStore — In-Memory implementation ของ JobStore
 *
 * เหมาะสำหรับ MVP และ testing
 * Swap เป็น RedisJobStore / PostgresJobStore ได้ทันทีโดยไม่ต้องแก้โค้ดส่วนอื่น
 * เพราะ implement ตาม JobStore interface ครบถ้วน
 *
 * @module server/store/MemoryJobStore
 */

import type {
  Job,
  JobState,
  JobStore,
  JobFilter,
  CreateJobInput,
  UpdateJobInput,
  StateTransition,
} from './types.js';

import {
  VALID_TRANSITIONS,
  JobNotFoundError,
  InvalidStateTransitionError,
} from './types.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * สร้าง Job ID ในรูปแบบ WC-YYYYMMDD-XXXX
 * ซิงค์กับ format ใน Intake transformer
 */
function generateJobId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WC-${date}-${rand}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * กรอง Job ตาม JobFilter
 */
function matchesFilter(job: Job, filter: JobFilter): boolean {
  if (filter.state !== undefined) {
    const states = Array.isArray(filter.state) ? filter.state : [filter.state];
    if (!states.includes(job.state)) return false;
  }
  if (filter.source !== undefined && job.meta.source !== filter.source) {
    return false;
  }
  if (filter.since !== undefined && job.meta.createdAt < filter.since) {
    return false;
  }
  return true;
}

// ============================================================================
// MEMORY JOB STORE
// ============================================================================

export class MemoryJobStore implements JobStore {
  /** storage หลัก: jobId → Job */
  private readonly store = new Map<string, Job>();

  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------

  async create(input: CreateJobInput): Promise<Job> {
    const id = input.jobSpec.metadata?.jobId ?? generateJobId();
    const ts = now();

    const job: Job = {
      id,
      state: 'INTAKE',
      jobSpec: input.jobSpec,
      history: [
        {
          from: 'INTAKE',
          to: 'INTAKE',
          at: ts,
          reason: 'Job created from intake',
          agentId: 'IntakeAgent',
        },
      ],
      meta: {
        source: input.source ?? 'api',
        sessionId: input.sessionId,
        createdAt: ts,
        updatedAt: ts,
      },
    };

    this.store.set(id, job);
    return this.clone(job);
  }

  // --------------------------------------------------------------------------
  // FIND BY ID
  // --------------------------------------------------------------------------

  async findById(id: string): Promise<Job | null> {
    const job = this.store.get(id);
    return job ? this.clone(job) : null;
  }

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------

  async update(id: string, input: UpdateJobInput): Promise<Job> {
    const job = this.store.get(id);
    if (!job) throw new JobNotFoundError(id);

    const ts = now();

    // ตรวจสอบ state transition
    if (input.state !== undefined && input.state !== job.state) {
      const allowed = VALID_TRANSITIONS[job.state] ?? [];
      if (!allowed.includes(input.state)) {
        throw new InvalidStateTransitionError(job.state, input.state);
      }

      const transition: StateTransition = {
        from: job.state,
        to: input.state,
        at: ts,
        reason: input.reason,
        agentId: input.agentId,
      };

      job.history.push(transition);
      job.state = input.state;
    }

    // อัปเดต assigned provider
    if (input.assignedProvider !== undefined) {
      job.assignedProvider = input.assignedProvider;
    }

    job.meta.updatedAt = ts;
    this.store.set(id, job);
    return this.clone(job);
  }

  // --------------------------------------------------------------------------
  // LIST
  // --------------------------------------------------------------------------

  async list(filter?: JobFilter): Promise<Job[]> {
    let results = Array.from(this.store.values());

    if (filter) {
      results = results.filter(job => matchesFilter(job, filter));
    }

    // เรียงจากใหม่ → เก่า
    results.sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt));

    if (filter?.offset) {
      results = results.slice(filter.offset);
    }
    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results.map(job => this.clone(job));
  }

  // --------------------------------------------------------------------------
  // DELETE
  // --------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) throw new JobNotFoundError(id);
    this.store.delete(id);
  }

  // --------------------------------------------------------------------------
  // COUNT
  // --------------------------------------------------------------------------

  async count(filter?: JobFilter): Promise<number> {
    if (!filter) return this.store.size;
    let count = 0;
    for (const job of this.store.values()) {
      if (matchesFilter(job, filter)) count++;
    }
    return count;
  }

  // --------------------------------------------------------------------------
  // INTERNAL HELPERS
  // --------------------------------------------------------------------------

  /**
   * deep clone เพื่อป้องกัน mutation จากภายนอก
   * ใช้ JSON serialize เพราะ Job มีแค่ plain objects
   */
  private clone(job: Job): Job {
    return JSON.parse(JSON.stringify(job));
  }

  /**
   * ล้าง store ทั้งหมด — ใช้ใน tests เท่านั้น
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * ดู store size โดยตรง — ใช้ใน tests เท่านั้น
   */
  get size(): number {
    return this.store.size;
  }
}
