/**
 * Dispatch Agent — Core Logic (V1, Rule-based)
 *
 * หน้าที่: เลือก provider ที่เหมาะสมที่สุดสำหรับ job
 * V1: ไม่ใช้ LLM — ใช้ rule + suitability score
 *
 * @module src/agents/dispatch/dispatcher
 */

import type { Provider, ProviderSkill, ProviderType, SuitabilityScore, DispatchResult } from './types';
import type { Job } from '../../server/store/types';

// ============================================================================
// MOCK PROVIDER POOL (V1)
// ใช้จนกว่าจะมี Provider database จริง
// ============================================================================

export const DEFAULT_PROVIDER_POOL: Provider[] = [
  {
    id: 'DRV-001',
    name: 'สมชาย ขับดี',
    type: 'DRIVER',
    vehicle: 'sedan',
    skills: ['thai', 'escort'],
    available: true,
    rating: 4.8,
    location: { lat: 13.7500, lng: 100.5000 },
  },
  {
    id: 'DRV-002',
    name: 'วิชัย รถเข็น',
    type: 'DRIVER',
    vehicle: 'wheelchair-van',
    skills: ['wheelchair', 'thai', 'escort'],
    available: true,
    rating: 4.7,
    location: { lat: 13.7400, lng: 100.5100 },
  },
  {
    id: 'DRV-003',
    name: 'สุภาพร MPV',
    type: 'DRIVER',
    vehicle: 'MPV',
    skills: ['thai', 'escort', 'medicine-delivery'],
    available: true,
    rating: 4.9,
    location: { lat: 13.7600, lng: 100.4900 },
  },
  {
    id: 'CG-001',
    name: 'นิภา ดูแลดี',
    type: 'CAREGIVER',
    skills: ['wheelchair', 'escort', 'home-care', 'thai'],
    available: true,
    rating: 4.9,
  },
  {
    id: 'CG-002',
    name: 'มาลี เอาใจใส่',
    type: 'CAREGIVER',
    skills: ['oxygen', 'stretcher', 'escort', 'home-care', 'thai'],
    available: true,
    rating: 4.6,
  },
  {
    id: 'RN-001',
    name: 'พยาบาลวิภา',
    type: 'NURSE',
    skills: ['nurse-license', 'oxygen', 'stretcher', 'escort', 'thai', 'english'],
    available: true,
    rating: 4.9,
  },
];

// ============================================================================
// SKILL REQUIREMENTS — แมป job requirements → provider skills
// ============================================================================

/**
 * ดึง skills ที่จำเป็นจาก Job
 */
export function extractRequiredSkills(job: Job): ProviderSkill[] {
  const skills: ProviderSkill[] = [];
  const p = job.jobSpec.patient;
  const a = job.jobSpec.addons;
  const svc = job.jobSpec.service.type;

  if (p.needsWheelchair)  skills.push('wheelchair');
  if (p.oxygenRequired)   skills.push('oxygen');
  if (p.stretcherRequired) skills.push('stretcher');
  if (p.needsEscort)      skills.push('escort');
  if (a.medicinePickup)   skills.push('medicine-delivery');
  if (a.homeCare)         skills.push('home-care');

  // กายภาพบำบัด / เคมีบำบัด → ต้องการ nurse
  if (svc === 'chemotherapy' || svc === 'radiation' || svc === 'dialysis') {
    skills.push('nurse-license');
  }

  return [...new Set(skills)]; // deduplicate
}

/**
 * ประเภท provider ที่เหมาะสม ตาม job requirements
 */
export function getPreferredProviderType(job: Job): ProviderType {
  const skills = extractRequiredSkills(job);
  if (skills.includes('nurse-license'))                 return 'NURSE';
  if (skills.includes('home-care'))                     return 'CAREGIVER';
  if (skills.includes('oxygen') || skills.includes('stretcher')) return 'CAREGIVER';
  return 'DRIVER';
}

// ============================================================================
// SUITABILITY SCORING
// ============================================================================

/**
 * คำนวณคะแนนความเหมาะสมของ provider สำหรับ job
 * Score 0–100:
 *   - skills match: 50 pts
 *   - vehicle match: 20 pts
 *   - rating bonus: 20 pts
 *   - type match: 10 pts
 */
export function scoreSuitability(provider: Provider, job: Job): SuitabilityScore {
  const required = extractRequiredSkills(job);
  const preferredType = getPreferredProviderType(job);
  const needsWheelchairVan = job.jobSpec.patient.needsWheelchair;
  const needsAmbulance = job.jobSpec.patient.stretcherRequired && job.jobSpec.patient.oxygenRequired;

  let score = 0;

  // ทักษะที่ตรงและขาด
  const matchedSkills = required.filter(s => provider.skills.includes(s));
  const missingSkills = required.filter(s => !provider.skills.includes(s));

  // Skills score (50 pts)
  const skillScore = required.length === 0
    ? 50
    : Math.round((matchedSkills.length / required.length) * 50);
  score += skillScore;

  // Vehicle match (20 pts)
  if (needsAmbulance && provider.vehicle === 'ambulance') score += 20;
  else if (needsWheelchairVan && provider.vehicle === 'wheelchair-van') score += 20;
  else if (!needsWheelchairVan && !needsAmbulance && provider.vehicle !== 'ambulance') score += 20;

  // Rating bonus (20 pts) — rating 5.0 = 20pts, 4.0 = 16pts
  score += Math.round((provider.rating / 5) * 20);

  // Provider type match (10 pts)
  if (provider.type === preferredType) score += 10;

  const reasons: string[] = [];
  if (matchedSkills.length > 0) reasons.push(`มีทักษะ: ${matchedSkills.join(', ')}`);
  if (missingSkills.length > 0) reasons.push(`ขาดทักษะ: ${missingSkills.join(', ')}`);
  if (provider.type === preferredType) reasons.push(`ประเภทตรงกับงาน (${preferredType})`);

  return {
    providerId: provider.id,
    score: Math.min(100, score),
    matchedSkills,
    missingSkills,
    reasoning: reasons.join(' | ') || 'ไม่มีข้อกำหนดพิเศษ',
  };
}

// ============================================================================
// MAIN DISPATCH FUNCTION
// ============================================================================

/**
 * เลือก provider ที่เหมาะสมที่สุดสำหรับ job
 *
 * Algorithm V1:
 * 1. กรอง provider ที่ available = true
 * 2. คำนวณ suitability score ทุกคน
 * 3. เรียง score สูง → ต่ำ
 * 4. เลือกอันดับ 1 (ถ้า score >= 40)
 * 5. ถ้าทุก provider score < 40 → requiresHumanApproval = true
 */
export function selectProvider(
  job: Job,
  pool: Provider[] = DEFAULT_PROVIDER_POOL
): { provider: Provider; score: SuitabilityScore } | null {
  const available = pool.filter(p => p.available);
  if (available.length === 0) return null;

  const scored = available
    .map(p => ({ provider: p, score: scoreSuitability(p, job) }))
    .sort((a, b) => b.score.score - a.score.score);

  const best = scored[0];
  if (!best || best.score.score < 40) return null;

  return best;
}

/**
 * คำนวณ estimated arrival (นาที)
 * V1: ใช้ rule-based โดยประมาณตาม service urgency
 */
export function estimateArrivalMinutes(job: Job, provider: Provider): number {
  const urgency = job.jobSpec.metadata.urgencyLevel;
  const base = urgency === 'urgent' ? 15
    : urgency === 'high' ? 20
    : urgency === 'normal' ? 30
    : 45;

  // เพิ่มเวลาถ้า provider ต้องเตรียมอุปกรณ์พิเศษ
  const hasSpecialEquip = job.jobSpec.patient.needsWheelchair
    || job.jobSpec.patient.oxygenRequired
    || job.jobSpec.patient.stretcherRequired;

  return hasSpecialEquip ? base + 10 : base;
}

/**
 * Main entry point: รับ Job → คืน DispatchResult
 * ไม่มี side effect (ไม่แตะ JobStore) — pure function
 */
export function dispatch(job: Job, providerPool?: Provider[]): DispatchResult {
  const pool = providerPool ?? DEFAULT_PROVIDER_POOL;

  // ตรวจสอบ job state
  if (!['INTAKE', 'VALIDATE', 'DISPATCH'].includes(job.state)) {
    return {
      success: false,
      jobId: job.id,
      requiresHumanApproval: false,
      error: `ไม่สามารถ dispatch job ที่อยู่ใน state ${job.state}`,
    };
  }

  const result = selectProvider(job, pool);

  if (!result) {
    return {
      success: false,
      jobId: job.id,
      requiresHumanApproval: true,
      error: 'ไม่พบ provider ที่เหมาะสม กรุณามอบหมายงานให้ผู้ดูแลระบบ',
    };
  }

  const { provider, score } = result;
  const eta = estimateArrivalMinutes(job, provider);

  return {
    success: true,
    jobId: job.id,
    provider,
    reasoning: score.reasoning,
    estimatedArrivalMinutes: eta,
    requiresHumanApproval: score.score < 70, // score ต่ำ → ให้คนตรวจก่อน
  };
}
