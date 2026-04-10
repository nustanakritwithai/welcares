/**
 * useAgentChat — React hook for the server-side ReAct agent
 *
 * Replaces useIntakeChatAgent. Instead of doing rule-based parsing in the
 * browser, every user message is sent to POST /api/agent/chat where the LLM
 * runs a full reasoning loop (tool calls → observations → answer).
 *
 * @module src/hooks/useAgentChat
 */

import { useState, useCallback, useRef } from 'react';

// ── Types (mirroring server/agent/types.ts) ────────────────────────────────

export interface BookingData {
  contact?: { name?: string; phone?: string };
  service?: { type?: string; department?: string; doctorName?: string };
  schedule?: { date?: string; time?: string; flexibility?: string };
  locations?: { pickup?: string; dropoff?: string };
  patient?: {
    name?: string;
    mobilityLevel?: string;
    needsWheelchair?: boolean;
    needsEscort?: boolean;
    oxygenRequired?: boolean;
    stretcherRequired?: boolean;
  };
  addons?: { medicinePickup?: boolean; homeCare?: boolean };
  notes?: string;
}

export type AgentStatus = 'collecting' | 'confirming' | 'submitted' | 'cancelled';

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
  sessionId: string | null;
}

export interface AgentChatActions {
  sendMessage: (text: string) => Promise<void>;
  selectQuickReply: (text: string) => Promise<void>;
  resetChat: () => void;
}

// ── API call ───────────────────────────────────────────────────────────────

async function postToAgent(
  message: string,
  sessionId: string | null
): Promise<{
  sessionId: string;
  message: string;
  bookingData: BookingData;
  status: AgentStatus;
  jobId?: string;
  quickReplies?: string[];
  missingFields?: string[];
}> {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Welcome message ────────────────────────────────────────────────────────

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'สวัสดีค่ะ 👋 หนูน้องแคร์ยินดีให้บริการค่ะ\n\nต้องการจองบริการอะไรคะ? บอกได้เลยค่ะ เช่น "จองรถพาแม่ไปหาหมอวันพรุ่งนี้" หรือ "อยากล้างไต" ก็ได้ค่ะ 😊',
  timestamp: new Date().toISOString(),
};

// ============================================================================
// HOOK
// ============================================================================

export function useAgentChat(): AgentChatState & AgentChatActions {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [bookingData, setBookingData] = useState<BookingData>({});
  const [status, setStatus] = useState<AgentStatus>('collecting');
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    setError(null);
    setQuickReplies([]);

    // Append user message immediately
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const data = await postToAgent(trimmed, sessionIdRef.current);

      // Store session ID from server
      sessionIdRef.current = data.sessionId;

      // Append agent response
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Update booking state
      setBookingData(data.bookingData);
      setStatus(data.status);
      setJobId(data.jobId);
      setQuickReplies(data.quickReplies ?? []);
      setMissingFields(data.missingFields ?? []);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      setError(errMsg);

      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ขออภัยค่ะ เกิดข้อผิดพลาด: ${errMsg}\n\nกรุณาลองใหม่อีกครั้งค่ะ`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [isThinking]);

  const resetChat = useCallback(() => {
    sessionIdRef.current = null;
    setMessages([WELCOME]);
    setBookingData({});
    setStatus('collecting');
    setJobId(undefined);
    setQuickReplies([]);
    setMissingFields([]);
    setIsThinking(false);
    setError(null);
  }, []);

  return {
    messages,
    bookingData,
    status,
    jobId,
    quickReplies,
    missingFields,
    isThinking,
    error,
    sessionId: sessionIdRef.current,
    sendMessage: handleSend,
    selectQuickReply: handleSend,
    resetChat,
  };
}
