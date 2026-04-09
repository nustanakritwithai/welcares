/**
 * OpenRouter AI Service (DISABLED for GitHub Pages deployment)
 * Using rule-based fallback only - no backend required
 * 
 * @version 3.1 - Static Site Mode (GitHub Pages)
 * @module src/agents/intake-chat/openrouter
 */

import type { PartialIntakeInput } from '../intake/types';

// ============================================================================
// CONFIGURATION - DISABLED
// ============================================================================

// Model definitions kept for reference but not used
export const MODELS = {
  NEMOTRON: 'nvidia/nemotron-3-super-120b-a12b:free',
  GPT4O_MINI: 'openai/gpt-4o-mini',
  GPT4O: 'openai/gpt-4o',
  CLAUDE_HAIKU: 'anthropic/claude-3.5-haiku',
  DEEPSEEK: 'deepseek/deepseek-chat',
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedIntent {
  intent: 'fill_field' | 'confirm' | 'reject' | 'edit' | 'greeting' | 'question' | 'unknown';
  field?: string;
  value?: unknown;
  confidence: number;
  response?: string;
  missingInfo?: string[];
}

// ============================================================================
// DISABLED FUNCTIONS - Always return fallback
// ============================================================================

/**
 * AI is disabled in static site mode (GitHub Pages)
 * Always returns false
 */
export function isAIConfigured(): boolean {
  return false;
}

/**
 * Parse user message using AI - DISABLED
 * Always returns unknown intent (fallback to rule-based)
 */
export async function parseMessageWithAI(
  _userMessage: string,
  _currentFormData: PartialIntakeInput,
  _context: string[] = []
): Promise<ParsedIntent> {
  // AI disabled - use rule-based parser instead
  return { intent: 'unknown', confidence: 0 };
}

/**
 * Generate AI chat response - DISABLED
 * Always returns empty (fallback to rule-based)
 */
export async function generateAIResponse(
  _userMessage: string,
  _currentFormData: PartialIntakeInput,
  _missingFields: string[],
  _context: string[] = []
): Promise<{ content: string; quickReplies?: Array<{ label: string; value: string }> }> {
  // AI disabled - use rule-based generator instead
  return { content: '' };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MODELS };

export default {
  parseMessageWithAI,
  generateAIResponse,
  isAIConfigured,
  MODELS,
};
