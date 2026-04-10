/**
 * useAgentChat — React hook for the client-side ReAct agent
 * Runs the full agent loop in the browser, calling OpenRouter directly.
 * Works on GitHub Pages with no backend required.
 *
 * @module src/hooks/useAgentChat
 */

import { useState, useCallback, useRef } from 'react';
import { runClientAgentLoop } from '../agents/agent/clientLoop';
import type { BookingData, AgentStatus, LLMMessage } from '../agents/agent/types';

export type { BookingData, AgentStatus };

// ── localStorage helpers ───────────────────────────────────────────────────

const STORAGE_KEY = 'welcares_api_key';

export function getStoredApiKey(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
}
export function setStoredApiKey(key: string): void {
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* noop */ }
}
export function clearStoredApiKey(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentChatState {
  messages: ChatMessage[];
  bookingData: BookingData;
  status: AgentStatus;
  jobId?: string;
  quickReplies: string[];
  missingFields: string[];
  isThinking: boolean;
  error: string | null;
}

export interface AgentChatActions {
  sendMessage: (text: string) => Promise<void>;
  selectQuickReply: (text: string) => Promise<void>;
  resetChat: () => void;
}

// ── Welcome message ────────────────────────────────────────────────────────

function makeWelcome(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: 'สวัสดีค่ะ 👋 หนูน้องแคร์ยินดีให้บริการค่ะ\n\nต้องการจองบริการอะไรคะ? บอกได้เลยค่ะ เช่น "จองรถพาแม่ไปหาหมอวันพรุ่งนี้" หรือ "อยากล้างไต" ก็ได้ค่ะ 😊',
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useAgentChat(apiKey: string): AgentChatState & AgentChatActions {
  const [messages, setMessages] = useState<ChatMessage[]>([makeWelcome()]);
  const [bookingData, setBookingData] = useState<BookingData>({});
  const [status, setStatus] = useState<AgentStatus>('collecting');
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep LLM history (not shown in UI) as a ref so it doesn't cause re-renders
  const historyRef = useRef<LLMMessage[]>([]);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    if (!apiKey) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '⚠️ กรุณาใส่ OpenRouter API Key ก่อนนะคะ กด 🔐 ที่มุมขวาบนได้เลยค่ะ',
        timestamp: new Date().toISOString(),
      }]);
      return;
    }

    setError(null);
    setQuickReplies([]);

    // Show user message immediately
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }]);
    setIsThinking(true);

    try {
      const result = await runClientAgentLoop(
        historyRef.current,
        bookingData,
        trimmed,
        apiKey,
      );

      // Update history ref with the full updated history from the loop
      historyRef.current = result.updatedHistory;

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: result.message,
        timestamp: new Date().toISOString(),
      }]);

      setBookingData(result.bookingData);
      setStatus(result.status);
      setJobId(result.jobId);
      setQuickReplies(result.quickReplies);
      setMissingFields(result.missingFields);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setError(msg);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ขออภัยค่ะ: ${msg}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, apiKey, bookingData]);

  const resetChat = useCallback(() => {
    historyRef.current = [];
    setMessages([makeWelcome()]);
    setBookingData({});
    setStatus('collecting');
    setJobId(undefined);
    setQuickReplies([]);
    setMissingFields([]);
    setIsThinking(false);
    setError(null);
  }, []);

  return {
    messages, bookingData, status, jobId,
    quickReplies, missingFields, isThinking, error,
    sendMessage: handleSend,
    selectQuickReply: handleSend,
    resetChat,
  };
}
