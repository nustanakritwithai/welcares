/**
 * Client-side ReAct Agent Loop
 * Runs entirely in the browser — calls OpenRouter API directly.
 * Used when no backend server is available (e.g. GitHub Pages).
 *
 * @module src/agents/agent/clientLoop
 */

import { SYSTEM_PROMPT } from './prompts';
import { TOOL_DEFINITIONS } from './toolDefs';
import type { BookingData, AgentStatus, LLMMessage, LLMToolCall } from './types';
import { REQUIRED_FIELDS } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';
const MAX_ITERATIONS = 8;

// ============================================================================
// MAIN LOOP
// ============================================================================

export interface LoopResult {
  message: string;
  bookingData: BookingData;
  status: AgentStatus;
  jobId?: string;
  quickReplies: string[];
  missingFields: string[];
  updatedHistory: LLMMessage[];
}

export async function runClientAgentLoop(
  history: LLMMessage[],
  bookingData: BookingData,
  userMessage: string,
  apiKey: string,
): Promise<LoopResult> {
  const msgs: LLMMessage[] = [...history, { role: 'user', content: userMessage }];

  // Deep-clone so we can mutate freely
  const booking: BookingData = JSON.parse(JSON.stringify(bookingData));
  let status: AgentStatus = deriveStatus(booking);
  let jobId: string | undefined;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const llm = await callOpenRouter(msgs, apiKey);
    if (!llm) {
      return fallback(msgs, booking, status);
    }

    const { content, tool_calls } = llm;

    // Final text answer — no more tool calls
    if (!tool_calls?.length) {
      const finalMsg = content ?? 'ขออภัยค่ะ ไม่สามารถประมวลผลได้';
      msgs.push({ role: 'assistant', content: finalMsg });
      return {
        message: finalMsg,
        bookingData: booking,
        status,
        jobId,
        quickReplies: getQuickReplies(status, getMissing(booking)),
        missingFields: getMissing(booking),
        updatedHistory: msgs,
      };
    }

    // Add assistant turn with tool_calls
    msgs.push({ role: 'assistant', content: content ?? null, tool_calls });

    // Execute each tool
    for (const call of tool_calls) {
      const result = executeTool(call.function.name, call.function.arguments, booking);
      if (result.statusUpdate) status = result.statusUpdate;
      if (result.jobId) jobId = result.jobId;

      msgs.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result.data),
      });
    }

    // Re-derive status after tool execution
    status = deriveStatus(booking, status, jobId);
  }

  return fallback(msgs, booking, status);
}

// ============================================================================
// OPENROUTER CALL
// ============================================================================

async function callOpenRouter(
  history: LLMMessage[],
  apiKey: string,
): Promise<{ content: string | null; tool_calls?: LLMToolCall[] } | null> {
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'WelCares Chat Agent',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[clientLoop] OpenRouter error', res.status, err);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) return null;
    return { content: msg.content ?? null, tool_calls: msg.tool_calls };
  } catch (err) {
    console.error('[clientLoop] fetch error', err);
    return null;
  }
}

// ============================================================================
// CLIENT-SIDE TOOL EXECUTION
// ============================================================================

interface ToolResult {
  data: unknown;
  statusUpdate?: AgentStatus;
  jobId?: string;
}

function executeTool(name: string, argsJson: string, booking: BookingData): ToolResult {
  let args: Record<string, unknown>;
  try { args = JSON.parse(argsJson); } catch { return { data: { error: 'Invalid args' } }; }

  switch (name) {
    case 'update_booking_field': {
      const updates = (args.updates as Array<{ field: string; value: unknown }>) ?? [];
      const applied: string[] = [];
      for (const { field, value } of updates) {
        applyField(booking, field, value);
        applied.push(field);
      }
      const missing = getMissing(booking);
      const isComplete = missing.length === 0;
      return {
        data: { success: true, applied, missingFields: missing, isComplete },
        statusUpdate: isComplete ? 'confirming' : 'collecting',
      };
    }

    case 'get_booking_status': {
      const missing = getMissing(booking);
      const filled: Record<string, unknown> = {};
      for (const f of REQUIRED_FIELDS) {
        const v = getField(booking, f);
        if (v !== undefined && v !== null && v !== '') filled[f] = v;
      }
      return {
        data: {
          filled,
          missingFields: missing.map(f => ({ field: f, label: FIELD_LABELS[f] ?? f })),
          progress: `${Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100)}%`,
          isComplete: missing.length === 0,
        },
      };
    }

    case 'submit_booking': {
      if (!args.confirmed) return { data: { success: false, error: 'ผู้ใช้ยังไม่ยืนยัน' } };
      const missing = getMissing(booking);
      if (missing.length > 0) return { data: { success: false, missingFields: missing } };

      const jobId = generateJobId();
      // Save to localStorage as pending booking
      try {
        const saved = JSON.parse(localStorage.getItem('welcares_bookings') ?? '[]');
        saved.push({ jobId, bookingData: booking, createdAt: new Date().toISOString() });
        localStorage.setItem('welcares_bookings', JSON.stringify(saved));
      } catch { /* noop */ }

      return {
        data: { success: true, jobId, message: 'บันทึกการจองเรียบร้อยแล้ว' },
        statusUpdate: 'submitted',
        jobId,
      };
    }

    case 'lookup_job': {
      try {
        const saved = JSON.parse(localStorage.getItem('welcares_bookings') ?? '[]');
        const found = saved.find((b: { jobId: string }) => b.jobId === args.jobId);
        if (!found) return { data: { found: false, error: `ไม่พบการจอง ${args.jobId}` } };
        return { data: { found: true, ...found } };
      } catch {
        return { data: { found: false, error: 'เกิดข้อผิดพลาดในการค้นหา' } };
      }
    }

    case 'cancel_job': {
      try {
        const saved: Array<{ jobId: string; status?: string }> =
          JSON.parse(localStorage.getItem('welcares_bookings') ?? '[]');
        const idx = saved.findIndex(b => b.jobId === args.jobId);
        if (idx < 0) return { data: { success: false, error: `ไม่พบการจอง ${args.jobId}` } };
        saved[idx].status = 'cancelled';
        localStorage.setItem('welcares_bookings', JSON.stringify(saved));
        return { data: { success: true, jobId: args.jobId }, statusUpdate: 'cancelled' };
      } catch {
        return { data: { success: false, error: 'เกิดข้อผิดพลาด' } };
      }
    }

    default:
      return { data: { error: `Unknown tool: ${name}` } };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

const BOOLEAN_FIELDS = new Set([
  'needsWheelchair', 'needsEscort', 'oxygenRequired',
  'stretcherRequired', 'medicinePickup', 'homeCare',
]);

function applyField(booking: BookingData, field: string, value: unknown): void {
  const parts = field.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: Record<string, any> = booking as any;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  const leaf = parts[parts.length - 1];
  if (BOOLEAN_FIELDS.has(leaf)) {
    obj[leaf] = value === true || value === 'true' || value === 'ใช่' || value === 'yes';
  } else {
    obj[leaf] = String(value ?? '').trim();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getField(booking: BookingData, field: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = booking;
  for (const p of field.split('.')) { if (obj == null) return undefined; obj = obj[p]; }
  return obj;
}

function getMissing(booking: BookingData): string[] {
  return REQUIRED_FIELDS.filter(f => {
    const v = getField(booking, f);
    return v === undefined || v === null || v === '';
  });
}

function deriveStatus(
  booking: BookingData,
  current: AgentStatus = 'collecting',
  jobId?: string,
): AgentStatus {
  if (jobId || current === 'submitted') return 'submitted';
  if (current === 'cancelled') return 'cancelled';
  return getMissing(booking).length === 0 ? 'confirming' : 'collecting';
}

function getQuickReplies(status: AgentStatus, missing: string[]): string[] {
  if (status === 'confirming') return ['ยืนยัน ✅', 'แก้ไขข้อมูล ✏️'];
  if (status === 'submitted') return ['จองบริการอีกครั้ง'];
  if (missing.includes('service.type')) return ['พบแพทย์ทั่วไป', 'ล้างไต', 'กายภาพบำบัด', 'ตรวจสุขภาพ'];
  if (missing.includes('patient.mobilityLevel')) return ['เดินได้เอง', 'ต้องช่วยพยุง', 'ใช้รถเข็น', 'ติดเตียง'];
  return [];
}

function generateJobId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `WC-${date}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

function fallback(msgs: LLMMessage[], booking: BookingData, status: AgentStatus): LoopResult {
  return {
    message: 'ขออภัยค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
    bookingData: booking,
    status,
    quickReplies: [],
    missingFields: getMissing(booking),
    updatedHistory: msgs,
  };
}

const FIELD_LABELS: Record<string, string> = {
  'contact.name': 'ชื่อผู้ติดต่อ',
  'contact.phone': 'เบอร์โทร',
  'service.type': 'ประเภทบริการ',
  'schedule.date': 'วันที่',
  'schedule.time': 'เวลา',
  'locations.pickup': 'จุดรับ',
  'locations.dropoff': 'จุดส่ง',
  'patient.name': 'ผู้ป่วย',
  'patient.mobilityLevel': 'การเคลื่อนไหว',
};
