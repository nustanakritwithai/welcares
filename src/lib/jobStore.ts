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

export interface Checkpoint {
  label: string;
  time: string;
  photo?: string;   // base64 data URL
  note?: string;
  vitals?: { bp?: string; spo2?: string };
}

export interface StoredJob {
  jobId: string;
  bookingData: BookingData;
  createdAt: string;
  status?: JobStatus;
  assignedTo?: string;
  checkpoints?: Checkpoint[];
  voiceNoteUrl?: string;
  voiceTranscript?: string;
  voiceSentiment?: { score: number; flags: string[]; summary: string };
  rating?: { score: number; timestamp: string; voiceUrl?: string };
  reportApproved?: boolean;
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
  addCheckpointWithData(jobId, label);
}

export function addCheckpointWithData(
  jobId: string,
  label: string,
  extra?: Partial<Omit<Checkpoint, 'label' | 'time'>>,
): void {
  const job = getJob(jobId);
  if (!job) return;
  const cp: Checkpoint = { label, time: new Date().toISOString(), ...extra };
  // If a checkpoint with same label exists, merge extra data into it
  const existing = job.checkpoints ?? [];
  const idx = existing.findIndex(c => c.label === label);
  const checkpoints = idx >= 0
    ? existing.map((c, i) => i === idx ? { ...c, ...extra } : c)
    : [...existing, cp];
  updateJob(jobId, { checkpoints, status: 'active' });
}

export function addRating(jobId: string, score: number, voiceUrl?: string): void {
  updateJob(jobId, { rating: { score, timestamp: new Date().toISOString(), voiceUrl } });
}

export function updateVoiceData(
  jobId: string,
  data: { url?: string; transcript?: string; sentiment?: StoredJob['voiceSentiment'] },
): void {
  updateJob(jobId, {
    ...(data.url !== undefined && { voiceNoteUrl: data.url }),
    ...(data.transcript !== undefined && { voiceTranscript: data.transcript }),
    ...(data.sentiment !== undefined && { voiceSentiment: data.sentiment }),
  });
}
