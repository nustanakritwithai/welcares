/**
 * OpenRouter AI Service
 * จัดการการเชื่อมต่อกับ OpenRouter API สำหรับ WelCares Intake Agent
 * 
 * @version 1.0
 * @module src/agents/intake-chat/openrouter
 */

import type { PartialIntakeInput } from '../intake/types';

// ============================================================================
// TYPES
// ============================================================================

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ParsedIntent {
  intent: 'fill_field' | 'confirm' | 'reject' | 'edit' | 'greeting' | 'question' | 'unknown';
  field?: string;
  value?: unknown;
  confidence: number;
  response?: string;
  missingInfo?: string[];
}

export interface AIResponse {
  content: string;
  quickReplies?: Array<{ label: string; value: string }>;
  parsedIntent?: ParsedIntent;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: OpenRouterConfig = {
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'openai/gpt-4o-mini', // Default: cheap and fast
  temperature: 0.3, // Low temperature for consistent parsing
  maxTokens: 500,
};

function getConfig(): OpenRouterConfig {
  return {
    apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || DEFAULT_CONFIG.apiKey,
    baseUrl: import.meta.env.VITE_OPENROUTER_BASE_URL || DEFAULT_CONFIG.baseUrl,
    model: import.meta.env.VITE_OPENROUTER_MODEL || DEFAULT_CONFIG.model,
    temperature: parseFloat(import.meta.env.VITE_OPENROUTER_TEMPERATURE || '') || DEFAULT_CONFIG.temperature,
    maxTokens: parseInt(import.meta.env.VITE_OPENROUTER_MAX_TOKENS || '', 10) || DEFAULT_CONFIG.maxTokens,
  };
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const INTAKE_PARSER_PROMPT = `คุณคือผู้ช่วย AI สำหรับระบบจองบริการรถรับ-ส่งผู้ป่วย WelCares

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
  "response": "ข้อความตอบกลับผู้ใช้",
  "quickReplies": [{"label": "ตัวเลือก", "value": "ค่า"}]
}`;

const CHAT_RESPONSE_PROMPT = `คุณคือ "น้องแคร์" ผู้ช่วยจองบริการรถรับ-ส่งผู้ป่วย WelCares

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
// API CALL
// ============================================================================

async function callOpenRouter(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  config: OpenRouterConfig,
  jsonMode: boolean = false
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': window.location.origin, // Required by OpenRouter
      'X-Title': 'WelCares Intake Chat',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      ...(jsonMode && { response_format: { type: 'json_object' } }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Parse user message using AI
 * วิเคราะห์ข้อความผู้ใช้และสกัด intent + ข้อมูล
 */
export async function parseMessageWithAI(
  userMessage: string,
  currentFormData: PartialIntakeInput,
  context: string[] = []
): Promise<ParsedIntent> {
  const config = getConfig();
  
  if (!config.apiKey) {
    // Fallback to rule-based if no API key
    return { intent: 'unknown', confidence: 0 };
  }

  try {
    const messages = [
      { role: 'system' as const, content: INTAKE_PARSER_PROMPT },
      { 
        role: 'user' as const, 
        content: `ข้อมูลปัจจุบัน: ${JSON.stringify(currentFormData)}\n\nข้อความผู้ใช้: "${userMessage}"\n\nตอบกลับในรูปแบบ JSON ตามที่กำหนด:` 
      },
    ];

    const response = await callOpenRouter(messages, config, true);
    const parsed = JSON.parse(response);

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
 * สร้างข้อความตอบกลับแบบ natural
 */
export async function generateAIResponse(
  userMessage: string,
  currentFormData: PartialIntakeInput,
  missingFields: string[],
  context: string[] = []
): Promise<AIResponse> {
  const config = getConfig();
  
  if (!config.apiKey) {
    // Fallback: return empty to use rule-based
    return { content: '' };
  }

  try {
    const systemPrompt = `${CHAT_RESPONSE_PROMPT}

ข้อมูลปัจจุบันที่มี:
${JSON.stringify(currentFormData, null, 2)}

ฟิลด์ที่ยังขาด: ${missingFields.join(', ')}

คุณคือน้องแคร์ กำลังคุยกับลูกค้า`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...context.slice(-6).map((msg, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const content = await callOpenRouter(messages, config);

    return {
      content: content.trim(),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, // OpenRouter returns this
    };
  } catch (error) {
    console.error('[generateAIResponse] Error:', error);
    return { content: '' }; // Fallback to rule-based
  }
}

/**
 * Check if OpenRouter is configured
 */
export function isAIConfigured(): boolean {
  const config = getConfig();
  return !!config.apiKey;
}

/**
 * Get available models from OpenRouter
 */
export function getAvailableModels(): Array<{ id: string; name: string; description: string }> {
  return [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'เร็ว ถูก เหมาะกับงานทั่วไป' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'แม่นยำ รองรับภาษาไทยดี' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', description: 'เร็ว ประหยัด' },
    { id: 'google/gemini-flash-1.5', name: 'Gemini Flash', description: 'ฟรีสำหรับงานเล็ก' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', description: 'ราคาถูก ภาษาไทยดี' },
  ];
}

// ============================================================================
// EXPORTS
// ============================================================================

export { getConfig };
export default {
  parseMessageWithAI,
  generateAIResponse,
  isAIConfigured,
  getAvailableModels,
};
