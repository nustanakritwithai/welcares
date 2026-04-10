/**
 * JobStore — Factory & Singleton
 *
 * ใช้ getJobStore() เพื่อเข้าถึง store instance
 * เปลี่ยน implementation ได้ที่ไฟล์นี้ไฟล์เดียว
 *
 * @module server/store
 *
 * @example
 * ```ts
 * import { getJobStore } from './store/index.js';
 *
 * const store = getJobStore();
 * const job = await store.create({ jobSpec, source: 'form' });
 * ```
 */

import { MemoryJobStore } from './MemoryJobStore.js';
import type { JobStore } from './types.js';

// Re-export types ทั้งหมดเพื่อให้ผู้ใช้ import จากที่เดียว
export type {
  Job,
  JobState,
  JobStore,
  JobFilter,
  CreateJobInput,
  UpdateJobInput,
  AssignedProvider,
  StateTransition,
} from './types.js';

export {
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  JobNotFoundError,
  InvalidStateTransitionError,
} from './types.js';

export { MemoryJobStore } from './MemoryJobStore.js';

// ============================================================================
// SINGLETON
// ============================================================================

let _instance: JobStore | null = null;

/**
 * คืน singleton instance ของ JobStore
 *
 * ตอนนี้ใช้ MemoryJobStore
 * เมื่อ swap ไป Redis/Postgres แค่เปลี่ยน implementation ที่นี่
 */
export function getJobStore(): JobStore {
  if (!_instance) {
    _instance = new MemoryJobStore();
  }
  return _instance;
}

/**
 * สำหรับ testing เท่านั้น — inject mock store
 */
export function setJobStore(store: JobStore): void {
  _instance = store;
}

/**
 * สำหรับ testing เท่านั้น — reset singleton
 */
export function resetJobStore(): void {
  _instance = null;
}
