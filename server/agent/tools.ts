/**
 * Agent System — Tool Definitions + Implementations
 *
 * Tools are the "hands" of the agent. The LLM decides which tool to call;
 * this module executes them and returns structured results.
 *
 * @module server/agent/tools
 */

import type { AgentSession, BookingData, BookingDataFlat } from './types.js';
import { REQUIRED_FIELDS } from './types.js';
import { getJobStore } from '../store/index.js';

// ============================================================================
// TOOL DEFINITIONS (sent to LLM as tool schema)
// ============================================================================

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'update_booking_field',
      description: 'บันทึกข้อมูลการจองที่ผู้ใช้ให้มา สามารถอัปเดตหลาย field ในการเรียกครั้งเดียว',
      parameters: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            description: 'รายการข้อมูลที่ต้องการบันทึก',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  enum: [
                    'contact.name', 'contact.phone',
                    'service.type', 'service.department', 'service.doctorName',
                    'schedule.date', 'schedule.time', 'schedule.flexibility',
                    'locations.pickup', 'locations.dropoff',
                    'patient.name', 'patient.mobilityLevel',
                    'patient.needsWheelchair', 'patient.needsEscort',
                    'patient.oxygenRequired', 'patient.stretcherRequired',
                    'addons.medicinePickup', 'addons.homeCare',
                    'notes',
                  ],
                  description: 'ชื่อ field ที่ต้องการอัปเดต',
                },
                value: {
                  description: 'ค่าที่ต้องการบันทึก (string หรือ boolean)',
                },
              },
              required: ['field', 'value'],
            },
          },
        },
        required: ['updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_status',
      description: 'ดูสถานะการจองปัจจุบัน ข้อมูลที่มีแล้วและที่ยังขาดอยู่',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_booking',
      description: 'ส่งการจองเมื่อผู้ใช้ยืนยันข้อมูลครบถ้วนแล้ว',
      parameters: {
        type: 'object',
        properties: {
          confirmed: {
            type: 'boolean',
            description: 'ผู้ใช้ยืนยันข้อมูลและต้องการส่งการจองจริงๆ',
          },
        },
        required: ['confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_job',
      description: 'ค้นหาการจองที่มีอยู่แล้วด้วยรหัสงาน',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'รหัสงาน เช่น WC-20260410-0001',
          },
        },
        required: ['jobId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_job',
      description: 'ยกเลิกการจองที่มีอยู่',
      parameters: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'รหัสงานที่ต้องการยกเลิก' },
          reason: { type: 'string', description: 'เหตุผลในการยกเลิก' },
        },
        required: ['jobId'],
      },
    },
  },
];

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/** Apply a flat field path update to BookingData (mutates in place) */
function applyFieldUpdate(data: BookingData, field: string, value: unknown): void {
  const BOOLEAN_FIELDS = new Set([
    'needsWheelchair', 'needsEscort', 'oxygenRequired',
    'stretcherRequired', 'medicinePickup', 'homeCare',
  ]);

  const parts = field.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: Record<string, any> = data as any;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
      obj[parts[i]] = {};
    }
    obj = obj[parts[i]];
  }

  const leaf = parts[parts.length - 1];

  if (BOOLEAN_FIELDS.has(leaf)) {
    obj[leaf] = value === true || value === 'true' || value === 'ใช่' || value === 'yes' || value === '1';
  } else {
    obj[leaf] = String(value ?? '').trim();
  }
}

/** Get a flat field path value from BookingData */
function getFieldValue(data: BookingData, field: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = data;
  for (const part of field.split('.')) {
    if (obj == null) return undefined;
    obj = obj[part];
  }
  return obj;
}

/** Compute which required fields are missing */
function getMissingFields(data: BookingData): string[] {
  return REQUIRED_FIELDS.filter(f => {
    const v = getFieldValue(data, f);
    return v === undefined || v === null || v === '';
  });
}

/** Compute which required fields are filled */
function getFilledFields(data: BookingData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const f of REQUIRED_FIELDS) {
    const v = getFieldValue(data, f);
    if (v !== undefined && v !== null && v !== '') result[f] = v;
  }
  return result;
}

// ── Tool: update_booking_field ──────────────────────────────────────────────

interface UpdateArg {
  updates: Array<{ field: string; value: unknown }>;
}

export function toolUpdateBookingField(session: AgentSession, args: UpdateArg): object {
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const { field, value } of args.updates) {
    try {
      applyFieldUpdate(session.bookingData, field, value);
      applied.push(field);
    } catch {
      skipped.push(field);
    }
  }

  const missing = getMissingFields(session.bookingData);
  const isComplete = missing.length === 0;

  // Auto-advance status to 'confirming' when all required fields filled
  if (isComplete && session.status === 'collecting') {
    session.status = 'confirming';
  }

  session.updatedAt = new Date().toISOString();

  return {
    success: true,
    applied,
    skipped,
    missingFields: missing,
    isComplete,
    status: session.status,
  };
}

// ── Tool: get_booking_status ────────────────────────────────────────────────

export function toolGetBookingStatus(session: AgentSession): object {
  const missing = getMissingFields(session.bookingData);
  const filled = getFilledFields(session.bookingData);
  const progress = Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100);

  const FIELD_LABELS: Record<string, string> = {
    'contact.name': 'ชื่อผู้ติดต่อ',
    'contact.phone': 'เบอร์โทรผู้ติดต่อ',
    'service.type': 'ประเภทบริการ',
    'schedule.date': 'วันที่นัด',
    'schedule.time': 'เวลานัด',
    'locations.pickup': 'จุดรับ',
    'locations.dropoff': 'จุดส่ง',
    'patient.name': 'ชื่อผู้ป่วย',
    'patient.mobilityLevel': 'ระดับการเคลื่อนไหว',
  };

  return {
    status: session.status,
    progress: `${progress}%`,
    filled,
    missingFields: missing.map(f => ({ field: f, label: FIELD_LABELS[f] ?? f })),
    isComplete: missing.length === 0,
    jobId: session.jobId,
  };
}

// ── Tool: submit_booking ────────────────────────────────────────────────────

export async function toolSubmitBooking(
  session: AgentSession,
  args: { confirmed: boolean }
): Promise<object> {
  if (!args.confirmed) {
    return { success: false, error: 'ผู้ใช้ยังไม่ยืนยัน' };
  }

  const missing = getMissingFields(session.bookingData);
  if (missing.length > 0) {
    return {
      success: false,
      error: 'ข้อมูลยังไม่ครบ',
      missingFields: missing,
    };
  }

  const store = getJobStore();
  const jobSpec = buildJobSpec(session);

  try {
    const job = await store.create({
      jobSpec,
      source: 'chat',
      sessionId: session.sessionId,
    });

    session.jobId = job.id;
    session.status = 'submitted';
    session.updatedAt = new Date().toISOString();

    return {
      success: true,
      jobId: job.id,
      message: 'บันทึกการจองเรียบร้อยแล้ว',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
    };
  }
}

// ── Tool: lookup_job ────────────────────────────────────────────────────────

export async function toolLookupJob(args: { jobId: string }): Promise<object> {
  const store = getJobStore();
  const job = await store.findById(args.jobId);

  if (!job) {
    return { found: false, error: `ไม่พบการจอง ${args.jobId}` };
  }

  return {
    found: true,
    jobId: job.id,
    state: job.state,
    service: job.jobSpec.service?.type,
    date: job.jobSpec.schedule?.date,
    time: job.jobSpec.schedule?.time,
    patient: job.jobSpec.patient?.name,
    createdAt: job.meta.createdAt,
  };
}

// ── Tool: cancel_job ────────────────────────────────────────────────────────

export async function toolCancelJob(args: { jobId: string; reason?: string }): Promise<object> {
  const store = getJobStore();
  const job = await store.findById(args.jobId);

  if (!job) {
    return { success: false, error: `ไม่พบการจอง ${args.jobId}` };
  }

  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(job.state)) {
    return { success: false, error: `การจอง ${args.jobId} อยู่ใน state ${job.state} ไม่สามารถยกเลิกได้` };
  }

  try {
    await store.update(args.jobId, {
      state: 'CANCELLED',
      addHistory: {
        from: job.state,
        to: 'CANCELLED',
        reason: args.reason ?? 'ยกเลิกโดย agent',
        performedBy: 'chat-agent',
      },
    });

    return { success: true, jobId: args.jobId, message: 'ยกเลิกการจองเรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
}

// ============================================================================
// TOOL DISPATCHER — called by the loop
// ============================================================================

export async function executeTool(
  name: string,
  argsJson: string,
  session: AgentSession
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson);
  } catch {
    return JSON.stringify({ error: 'Invalid tool arguments' });
  }

  try {
    let result: unknown;

    switch (name) {
      case 'update_booking_field':
        result = toolUpdateBookingField(session, args as Parameters<typeof toolUpdateBookingField>[1]);
        break;
      case 'get_booking_status':
        result = toolGetBookingStatus(session);
        break;
      case 'submit_booking':
        result = await toolSubmitBooking(session, args as { confirmed: boolean });
        break;
      case 'lookup_job':
        result = await toolLookupJob(args as { jobId: string });
        break;
      case 'cancel_job':
        result = await toolCancelJob(args as { jobId: string; reason?: string });
        break;
      default:
        result = { error: `Unknown tool: ${name}` };
    }

    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : 'Tool execution failed' });
  }
}

// ============================================================================
// JOBSPEC BUILDER — convert BookingData → JobSpec format
// ============================================================================

function generateJobId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `WC-${date}-${rand}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildJobSpec(session: AgentSession): any {
  const d = session.bookingData;
  const jobId = generateJobId();
  const now = new Date().toISOString();

  return {
    metadata: {
      jobId,
      version: '1.0',
      createdAt: now,
      source: 'chat',
      priority: 3,
      urgencyLevel: 'normal',
      flags: [],
    },
    service: {
      type: d.service?.type ?? 'hospital-visit',
      appointmentType: 'new',
      department: d.service?.department,
      doctorName: d.service?.doctorName,
    },
    schedule: {
      date: d.schedule?.date ?? '',
      time: d.schedule?.time ?? '',
      flexibility: d.schedule?.flexibility ?? 'strict',
      estimatedDuration: 180,
    },
    locations: {
      pickup: {
        address: d.locations?.pickup ?? '',
        contactName: d.contact?.name ?? '',
        contactPhone: d.contact?.phone ?? '',
      },
      dropoff: {
        address: d.locations?.dropoff ?? '',
        contactName: '',
        contactPhone: '',
      },
      estimatedDistance: 10,
    },
    contact: {
      name: d.contact?.name ?? '',
      phone: d.contact?.phone ?? '',
      relationship: 'relative',
    },
    patient: {
      name: d.patient?.name ?? '',
      mobilityLevel: d.patient?.mobilityLevel ?? 'independent',
      needsEscort: d.patient?.needsEscort ?? false,
      needsWheelchair: d.patient?.needsWheelchair ?? false,
      oxygenRequired: d.patient?.oxygenRequired ?? false,
      stretcherRequired: d.patient?.stretcherRequired ?? false,
      conditions: [],
      allergies: [],
      medications: [],
    },
    addons: {
      medicinePickup: d.addons?.medicinePickup ?? false,
      homeCare: d.addons?.homeCare ?? false,
      mealService: false,
      interpretation: false,
      hospitalEscort: false,
    },
    assessment: {
      complexity: 'simple',
      riskFactors: [],
      specialAccommodations: [],
      resourceRequirements: {
        vehicleType: d.patient?.needsWheelchair ? 'wheelchair-van' : 'sedan',
        navigatorType: 'none',
        specialEquipment: [],
      },
      costEstimate: { base: 350, distance: 150, navigator: 0, addons: 0, total: 500, currency: 'THB' },
    },
    notes: {
      special: d.notes ?? '',
      internal: `Created via chat agent — session ${session.sessionId}`,
    },
  };
}
