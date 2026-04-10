/**
 * Agent System — ReAct Loop
 *
 * Thought → Action (tool call) → Observation (tool result) → repeat
 * until the LLM produces a final text response with no more tool calls.
 *
 * @module server/agent/loop
 */

import type { AgentSession, AgentChatResponse, LLMMessage, LLMToolCall } from './types.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { TOOL_DEFINITIONS, executeTool } from './tools.js';
import { REQUIRED_FIELDS } from './types.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Prefer a model with reliable function-calling support
const AGENT_MODEL = process.env.AGENT_MODEL ?? 'openai/gpt-4o-mini';
const MAX_ITERATIONS = 8; // safety guard against infinite loops

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function runAgentLoop(
  session: AgentSession,
  userMessage: string,
  apiKey: string
): Promise<AgentChatResponse> {
  // Add user turn to history
  session.history.push({ role: 'user', content: userMessage });

  let finalContent = '';
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const llmResponse = await callLLM(session.history, apiKey);

    if (!llmResponse) {
      finalContent = 'ขออภัยค่ะ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง';
      break;
    }

    const { content, tool_calls } = llmResponse;

    // No tool calls → final answer
    if (!tool_calls || tool_calls.length === 0) {
      finalContent = content ?? 'ขออภัยค่ะ ไม่สามารถประมวลผลได้';
      session.history.push({ role: 'assistant', content: finalContent });
      break;
    }

    // Add assistant turn with tool_calls to history
    session.history.push({
      role: 'assistant',
      content: content ?? null,
      tool_calls,
    });

    // Execute all tool calls in sequence (order matters for state mutation)
    for (const call of tool_calls) {
      const toolResult = await executeTool(call.function.name, call.function.arguments, session);

      session.history.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: toolResult,
      });
    }
  }

  if (iterations >= MAX_ITERATIONS && !finalContent) {
    finalContent = 'ขออภัยค่ะ ระบบทำงานนานเกินไป กรุณาลองใหม่';
  }

  session.updatedAt = new Date().toISOString();

  return buildResponse(session, finalContent);
}

// ============================================================================
// LLM CALL
// ============================================================================

interface LLMChoice {
  content?: string | null;
  tool_calls?: LLMToolCall[];
}

async function callLLM(history: LLMMessage[], apiKey: string): Promise<LLMChoice | null> {
  const messages: LLMMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
  ];

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://welcares.com',
        'X-Title': 'WelCares Chat Agent',
      },
      body: JSON.stringify({
        model: AGENT_MODEL,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[agent/loop] LLM error:', response.status, errText);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) return null;

    return {
      content: msg.content ?? null,
      tool_calls: msg.tool_calls ?? undefined,
    };
  } catch (err) {
    console.error('[agent/loop] fetch error:', err);
    return null;
  }
}

// ============================================================================
// BUILD RESPONSE
// ============================================================================

function getMissingFields(session: AgentSession): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = session.bookingData as any;
  return REQUIRED_FIELDS.filter(f => {
    let obj = d;
    for (const part of f.split('.')) {
      if (obj == null) return true;
      obj = obj[part];
    }
    return obj === undefined || obj === null || obj === '';
  });
}

function getQuickReplies(session: AgentSession): string[] {
  switch (session.status) {
    case 'confirming':
      return ['ยืนยัน ✅', 'แก้ไขข้อมูล ✏️', 'ยกเลิก ❌'];
    case 'submitted':
      return ['จองบริการอีกครั้ง', 'ดูรายละเอียดการจอง'];
    case 'cancelled':
      return ['จองบริการใหม่'];
    default: {
      const missing = getMissingFields(session);
      // Suggest common responses for the next missing field
      if (missing.includes('service.type')) {
        return ['พบแพทย์ทั่วไป', 'ล้างไต', 'กายภาพบำบัด', 'ตรวจสุขภาพ'];
      }
      if (missing.includes('patient.mobilityLevel')) {
        return ['เดินได้เอง', 'ต้องช่วยพยุง', 'ใช้รถเข็น', 'ติดเตียง'];
      }
      return [];
    }
  }
}

function buildResponse(session: AgentSession, message: string): AgentChatResponse {
  return {
    sessionId: session.sessionId,
    message,
    bookingData: session.bookingData,
    status: session.status,
    jobId: session.jobId,
    quickReplies: getQuickReplies(session),
    missingFields: getMissingFields(session),
  };
}
