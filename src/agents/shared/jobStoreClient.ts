/**
 * JobStore Client — Frontend utility สำหรับคุยกับ /api/jobs
 *
 * ใช้ใน ChatBookingAgent และ agents อื่นๆ ที่ต้องการ save job
 * โดยตรงโดยไม่ผ่าน submitIntake()
 *
 * @module src/agents/shared/jobStoreClient
 */

// ============================================================================
// TYPES (minimal — ไม่ import ทั้ง schema เพื่อลด bundle size)
// ============================================================================

export interface DraftJobSpec {
  metadata: {
    jobId: string;
    version: string;
    createdAt: string;
    source: 'form' | 'chat' | 'api';
    priority: number;
    urgencyLevel: string;
    flags: string[];
  };
  service: {
    type: string;
    appointmentType: string;
    department?: string;
  };
  schedule: {
    date: string;
    time: string;
    flexibility: string;
    estimatedDuration: number;
  };
  locations: {
    pickup: { address: string; lat?: number; lng?: number };
    dropoff: { address: string; lat?: number; lng?: number };
    estimatedDistance: number;
  };
  contact: {
    name: string;
    phone: string;
    relationship: string;
  };
  patient: {
    name: string;
    mobilityLevel: string;
    needsEscort: boolean;
    needsWheelchair: boolean;
    oxygenRequired: boolean;
    stretcherRequired: boolean;
    conditions: string[];
    allergies: string[];
    medications: string[];
  };
  addons: {
    medicinePickup: boolean;
    homeCare: boolean;
    mealService: boolean;
    interpretation: boolean;
    hospitalEscort: boolean;
  };
  assessment: {
    complexity: string;
    riskFactors: string[];
    specialAccommodations: string[];
    resourceRequirements: {
      vehicleType: string;
      navigatorType: string;
      specialEquipment: string[];
    };
    costEstimate: {
      base: number;
      distance: number;
      navigator: number;
      addons: number;
      total: number;
      currency: string;
    };
  };
  notes: { special: string; internal: string };
  [key: string]: unknown;
}

export interface SaveJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

// ============================================================================
// URL HELPER
// ============================================================================

function getApiBase(): string {
  // browser: ใช้ Vite proxy → /api
  // Node/test: ใช้ env var
  if (typeof window !== 'undefined') {
    return (window as any).__VITE_INTAKE_API_URL__ || '/api';
  }
  return process.env.INTAKE_API_URL || 'http://localhost:3000/api';
}

// ============================================================================
// GENERATE DRAFT JOB ID
// ============================================================================

function generateJobId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WC-${date}-${rand}`;
}

// ============================================================================
// BUILD DRAFT JOB SPEC FROM CHAT ENTITIES
// ============================================================================

export interface ChatBookingEntities {
  service_type?: string;
  datetime?: string;
  location?: { lat?: number; lng?: number; address: string };
  destination?: { lat?: number; lng?: number; address: string };
  special_requirements?: string[];
  urgency_level?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  patient_id?: string;
}

/**
 * แปลง extracted_entities จาก ChatBookingAgent → DraftJobSpec
 * ข้อมูลที่ขาด (contact, patient details) จะใช้ placeholder
 * สามารถ update ทีหลังผ่าน PATCH /api/jobs/:id
 */
export function buildDraftJobSpec(
  intent: string,
  entities: ChatBookingEntities,
  sessionId: string
): DraftJobSpec {
  const now = new Date().toISOString();
  const jobId = generateJobId();

  // แปลง intent → service type
  const serviceTypeMap: Record<string, string> = {
    BOOK_TRIP:      'hospital-visit',
    BOOK_MEDICINE:  'other',
    BOOK_HOME_CARE: 'other',
  };

  // แปลง urgency
  const urgencyMap: Record<string, string> = {
    EMERGENCY: 'urgent',
    URGENT:    'high',
    ROUTINE:   'normal',
  };

  // แยก date / time จาก ISO8601 datetime
  let date = new Date().toISOString().slice(0, 10);
  let time = '09:00';
  if (entities.datetime) {
    try {
      const d = new Date(entities.datetime);
      date = d.toISOString().slice(0, 10);
      time = d.toTimeString().slice(0, 5);
    } catch (_) { /* ใช้ default */ }
  }

  const specialReqs = entities.special_requirements ?? [];
  const needsWheelchair = specialReqs.some(r => r.includes('WHEELCHAIR'));
  const oxygenRequired  = specialReqs.some(r => r.includes('OXYGEN'));

  return {
    metadata: {
      jobId,
      version: '1.0',
      createdAt: now,
      source: 'chat',
      priority: 3,
      urgencyLevel: urgencyMap[entities.urgency_level ?? 'ROUTINE'] ?? 'normal',
      flags: specialReqs,
    },
    service: {
      type: serviceTypeMap[intent] ?? 'other',
      appointmentType: 'new',
    },
    schedule: {
      date,
      time,
      flexibility: 'strict',
      estimatedDuration: 120,
    },
    locations: {
      pickup: {
        address: entities.location?.address ?? 'ไม่ระบุ',
        lat: entities.location?.lat,
        lng: entities.location?.lng,
      },
      dropoff: {
        address: entities.destination?.address ?? 'ไม่ระบุ',
        lat: entities.destination?.lat,
        lng: entities.destination?.lng,
      },
      estimatedDistance: 5,
    },
    contact: {
      name: 'รอข้อมูลเพิ่มเติม',
      phone: '000-000-0000',
      relationship: 'self',
    },
    patient: {
      name: entities.patient_id ?? 'รอข้อมูลเพิ่มเติม',
      mobilityLevel: needsWheelchair ? 'wheelchair' : 'independent',
      needsEscort: false,
      needsWheelchair,
      oxygenRequired,
      stretcherRequired: false,
      conditions: [],
      allergies: [],
      medications: [],
    },
    addons: {
      medicinePickup: intent === 'BOOK_MEDICINE',
      homeCare: intent === 'BOOK_HOME_CARE',
      mealService: false,
      interpretation: false,
      hospitalEscort: false,
    },
    assessment: {
      complexity: needsWheelchair || oxygenRequired ? 'moderate' : 'simple',
      riskFactors: [],
      specialAccommodations: specialReqs,
      resourceRequirements: {
        vehicleType: needsWheelchair ? 'wheelchair-van' : 'sedan',
        navigatorType: 'none',
        specialEquipment: needsWheelchair ? ['wheelchair'] : [],
      },
      costEstimate: {
        base: 350,
        distance: 75,
        navigator: 0,
        addons: 0,
        total: 425,
        currency: 'THB',
      },
    },
    notes: {
      special: '',
      internal: `Draft จาก ChatBookingAgent session:${sessionId}`,
    },
  };
}

// ============================================================================
// SAVE JOB TO STORE
// ============================================================================

/**
 * บันทึก job ลง JobStore ผ่าน /api/jobs
 * ใช้โดย ChatBookingAgent เมื่อ intent + entities ชัดเจนแล้ว
 */
export async function saveJobToStore(
  jobSpec: DraftJobSpec,
  options: { source?: 'form' | 'chat' | 'api'; sessionId?: string } = {}
): Promise<SaveJobResult> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobSpec,
        source: options.source ?? 'chat',
        sessionId: options.sessionId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message ?? `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { success: true, jobId: data.job?.id ?? data.jobId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
