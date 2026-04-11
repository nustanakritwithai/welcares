/**
 * Client-side job store — reads/writes welcares_bookings in localStorage.
 * Dispatches a custom event so any component can subscribe to changes.
 *
 * @module src/lib/jobStore
 */

const KEY = 'welcares_bookings';
export const JOB_UPDATED_EVENT = 'welcares_jobs_updated';

export type JobStatus = 'pending' | 'assigned' | 'active' | 'completed' | 'cancelled';

export interface BookingData {
  contact?: { name?: string; phone?: string };
  service?: { type?: string };
  schedule?: { date?: string; time?: string };
  locations?: { pickup?: string; dropoff?: string };
  patient?: { name?: string; mobilityLevel?: string };
}

export interface StoredJob {
  jobId: string;
  bookingData: BookingData;
  createdAt: string;
  status?: JobStatus;
  assignedTo?: string;
  checkpoints?: Array<{ label: string; time: string }>;
}

// ── reads ──────────────────────────────────────────────────────────────────

export function getJobs(): StoredJob[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function getJob(jobId: string): StoredJob | undefined {
  return getJobs().find(j => j.jobId === jobId);
}

export function getPendingJobs(): StoredJob[] {
  return getJobs().filter(j => !j.status || j.status === 'pending');
}

export function getAssignedJobs(assignedTo?: string): StoredJob[] {
  return getJobs().filter(j =>
    j.status === 'assigned' || j.status === 'active'
  ).filter(j => !assignedTo || j.assignedTo === assignedTo);
}

/** Job ที่กำลังดำเนินการ (assigned หรือ active) */
export function getActiveJob(): StoredJob | undefined {
  return getJobs().find(j => j.status === 'active' || j.status === 'assigned');
}

/** Jobs ที่ status=active */
export function getRunningJobs(): StoredJob[] {
  return getJobs().filter(j => j.status === 'active');
}

/** นับ jobs แยกตาม status */
export function getJobCounts(): Record<JobStatus | 'total', number> {
  const jobs = getJobs();
  const counts: Record<string, number> = { total: jobs.length };
  for (const j of jobs) {
    const s = j.status ?? 'pending';
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts as Record<JobStatus | 'total', number>;
}

// ── writes ─────────────────────────────────────────────────────────────────

function saveJobs(jobs: StoredJob[]): void {
  localStorage.setItem(KEY, JSON.stringify(jobs));
  window.dispatchEvent(new Event(JOB_UPDATED_EVENT));
}

export function updateJob(jobId: string, updates: Partial<StoredJob>): void {
  const jobs = getJobs();
  const idx = jobs.findIndex(j => j.jobId === jobId);
  if (idx >= 0) {
    jobs[idx] = { ...jobs[idx], ...updates };
    saveJobs(jobs);
  }
}

export function assignJob(jobId: string, assignedTo: string): void {
  updateJob(jobId, { status: 'assigned', assignedTo });
}

export function addCheckpoint(jobId: string, label: string): void {
  const job = getJob(jobId);
  if (!job) return;
  const checkpoints = [...(job.checkpoints ?? []), { label, time: new Date().toISOString() }];
  updateJob(jobId, { checkpoints, status: 'active' });
}
