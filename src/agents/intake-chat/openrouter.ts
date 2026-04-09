/**
 * OpenRouter AI Service
 * OpenAI-compatible SDK pattern สำหรับ WelCares Intake Agent
 * 
 * @version 2.0 - OpenAI SDK Pattern
 * @module src/agents/intake-chat/openrouter
 */

import type { PartialIntakeInput } from '../intake/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Model definitions - OpenRouter format: provider/model-name
export const MODELS = {
  NEMOTRON: 'nvidia/nemotron-3-super-120b-a12b:free',
  GPT4O_MINI: 'openai/gpt-4o-mini',
  GPT4O: 'openai/gpt-4o',
  CLAUDE_HAIKU: 'anthropic/claude-3.5-haiku',
  DEEPSEEK: 'deepseek/deepseek-chat',
  EMBED: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
} as const;

// Default model for chat completions
const DEFAULT_MODEL = MODELS.NEMOTRON;

// ============================================================================
// TYPES - OpenAI-compatible
// ============================================================================

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIClient {
  chat: {
    completions: {
      create: (params: ChatCompletionRequest) => Promise<ChatCompletionResponse>;
    };
  };
  embeddings?: {
    create: (params: { model: string; input: string | string[] }) => Promise<{ data: Array<{ embedding: number[] }> }>;
  };
}

export interface ParsedIntent {
  intent: 'fill_field' | 'confirm' | 'reject' | 'edit' | 'greeting' | 'question' | 'unknown';
  field?: string;
  value?: unknown;
  confidence: number;
  response?: string;
  missingInfo?: string[];
}

// ============================================================================
// CLIENT FACTORY - OpenAI SDK Pattern
// ============================================================================

/**
 * Get AI Client - Factory function คล้าย OpenAI SDK
 * 
 * Usage:
 * const client = getAIClient();
 * const response = await client.chat.completions.create({
 *   model: MODELS.NEMOTRON,
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 */
export function getAIClient(): AIClient {
  // Support both naming conventions: Nemotron_API (backend pattern) or VITE_OPENROUTER_API_KEY (frontend)
  const apiKey = import.meta.env.Nemotron_API || import.meta.env.VITE_OPENROUTER_API_KEY || '';
  const baseURL = import.meta.env.VITE_OPENROUTER_BASE_URL || OPENROUTER_BASE_URL;

  if (!apiKey) {
    console.warn('[OpenRouter] No API key configured. AI features disabled.');
  }

  return {
    chat: {
      completions: {
        create: async (params: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
          if (!apiKey) {
            throw new Error('OpenRouter API key not configured');
          }

          const response = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'WelCares Intake Chat',
            },
            body: JSON.stringify({
              ...params,
              temperature: params.temperature ?? 0.3,
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
          }

          return await response.json();
        },
      },
    },
  };
}

/**
 * Check if AI is configured
 */
export function isAIConfigured(): boolean {
  return !!(import.meta.env.Nemotron_API || import.meta.env.VITE_OPENROUTER_API_KEY);
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const INTAKE_PARSER_SYSTEM = `คุณคือผู้ช่วย AI สำหรับระบบจองบริการรถรับ-ส่งผู้ป่วย WelCares

หน้าที่ของคุณ:
1. วิเคราะห์ข้อความจากผู้ใช้
2. สกัดข้อมูลที่จำเป็น (extract information)
3. ตอบกลับเป็นภาษาไทยแบบเป็นกันเอง

ข้อมูลที่ต้องสกัด:
- contactName: ชื่อผู้ติดต่อ
- contactPhone: เบอร์โทรศัพท์
- serviceType: ประเภทบริการ (hospital-visit, follow-up, physical-therapy, dialysis, checkup, vaccination, other)
- appointmentDate: วันนัด (YYYY-MM-DD)
- appointmentTime: เวลานัด (HH:MM)
- pickupAddress: ที่อยู่รับ
- dropoffAddress: ที่อยู่ส่ง
- patientName: ชื่อผู้ป่วย
- mobilityLevel: การเคลื่อนไหว (independent, assisted, wheelchair, bedridden)

รูปแบบการตอบ (JSON เท่านั้น):
{
  "intent": "fill_field|confirm|reject|edit|greeting|question|unknown",
  "field": "ชื่อฟิลด์ที่กรอก (ถ้ามี)",
  "value": "ค่าที่สกัดได้",
  "confidence": 0.0-1.0,
  "response": "ข้อความตอบกลับผู้ใช้"
}`;

const CHAT_RESPONSE_SYSTEM = `คุณคือ "น้องแคร์" ผู้ช่วยจองบริการรถรับ-ส่งผู้ป่วย WelCares

บุคลิก:
- เป็นกันเอง อ่อนโยน ใส่ใจ
- ใช้ภาษาไทยสุภาพ ไม่ใช้คำยาก
- ตอบสั้น กระชับ ได้ใจความ
- ใช้ emoji ได้เล็กน้อย 💜

กฎการตอบ:
1. ตอบตรงประเด็น ไม่เวิ่นเว้อ
2. ถ้าข้อมูลไม่ครบ ถามต่อเนื่อง
3. ถ้าข้อมูลครบ สรุปให้ยืนยัน
4. ไม่แนะนำโรงพยาบาลหรือการรักษา
5. ไม่ขอข้อมูลส่วนตัวที่ไม่จำเป็น`;

// ============================================================================
// HIGH-LEVEL FUNCTIONS
// ============================================================================

/**
 * Parse user message using AI
 * OpenAI SDK pattern: client.chat.completions.create()
 */
export async function parseMessageWithAI(
  userMessage: string,
  currentFormData: PartialIntakeInput,
  _context: string[] = []
): Promise<ParsedIntent> {
  if (!isAIConfigured()) {
    return { intent: 'unknown', confidence: 0 };
  }

  const client = getAIClient();

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: INTAKE_PARSER_SYSTEM },
        {
          role: 'user',
          content: `ข้อมูลปัจจุบัน: ${JSON.stringify(currentFormData)}\n\nข้อความผู้ใช้: "${userMessage}"\n\nตอบกลับในรูปแบบ JSON:`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { intent: 'unknown', confidence: 0 };
    }

    const parsed = JSON.parse(content);

    return {
      intent: parsed.intent || 'unknown',
      field: parsed.field,
      value: parsed.value,
      confidence: parsed.confidence || 0.5,
      response: parsed.response,
      missingInfo: parsed.missingInfo,
    };
  } catch (error) {
    console.error('[parseMessageWithAI] Error:', error);
    return { intent: 'unknown', confidence: 0 };
  }
}

/**
 * Generate AI chat response
 * OpenAI SDK pattern: client.chat.completions.create()
 */
export async function generateAIResponse(
  userMessage: string,
  currentFormData: PartialIntakeInput,
  missingFields: string[],
  _context: string[] = []
): Promise<{ content: string; quickReplies?: Array<{ label: string; value: string }> }> {
  if (!isAIConfigured()) {
    return { content: '' };
  }

  const client = getAIClient();

  try {
    const systemPrompt = `${CHAT_RESPONSE_SYSTEM}

ข้อมูลปัจจุบันที่มี:
${JSON.stringify(currentFormData, null, 2)}

ฟิลด์ที่ยังขาด: ${missingFields.join(', ')}

คุณคือน้องแคร์ กำลังคุยกับลูกค้า`;

    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';

    return { content };
  } catch (error) {
    console.error('[generateAIResponse] Error:', error);
    return { content: '' };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { OPENROUTER_BASE_URL, DEFAULT_MODEL };

export default {
  getAIClient,
  parseMessageWithAI,
  generateAIResponse,
  isAIConfigured,
  MODELS,
};