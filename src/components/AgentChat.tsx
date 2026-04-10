/**
 * AgentChat — LINE-style chat UI backed by the server-side ReAct agent
 *
 * Replaces IntakeChatDemo. Key difference:
 *  - No rule-based parsing in browser
 *  - No hardcoded field order
 *  - Agent reasons with tools, handles corrections, multi-info turns
 *
 * @module src/components/AgentChat
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAgentChat, getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../hooks/useAgentChat';
import type { BookingData, AgentStatus } from '../hooks/useAgentChat';

// ============================================================================
// BOOKING PROGRESS CARD
// ============================================================================

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

const SERVICE_LABELS: Record<string, string> = {
  'hospital-visit': 'พบแพทย์',
  'dialysis': 'ล้างไต',
  'chemotherapy': 'เคมีบำบัด',
  'radiation': 'รังสีรักษา',
  'physical-therapy': 'กายภาพบำบัด',
  'checkup': 'ตรวจสุขภาพ',
  'vaccination': 'วัคซีน',
  'other': 'อื่นๆ',
};

const MOBILITY_LABELS: Record<string, string> = {
  independent: 'เดินได้เอง',
  assisted: 'ต้องช่วยพยุง',
  wheelchair: 'ใช้รถเข็น',
  bedridden: 'ติดเตียง',
};

function getFieldDisplay(data: BookingData, field: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = data;
  for (const part of field.split('.')) {
    if (obj == null) return undefined;
    obj = obj[part];
  }
  if (obj === undefined || obj === null || obj === '') return undefined;
  // Apply label maps
  if (field === 'service.type') return SERVICE_LABELS[obj] ?? obj;
  if (field === 'patient.mobilityLevel') return MOBILITY_LABELS[obj] ?? obj;
  return String(obj);
}

const REQUIRED_FIELDS = [
  'contact.name', 'contact.phone', 'service.type',
  'schedule.date', 'schedule.time', 'locations.pickup',
  'locations.dropoff', 'patient.name', 'patient.mobilityLevel',
];

interface BookingProgressProps {
  data: BookingData;
  missingFields: string[];
  status: AgentStatus;
  jobId?: string;
}

// ============================================================================
// WORKFLOW CARD — shown after submission
// ============================================================================

type StepStatus = 'pending' | 'running' | 'done';
interface WFStep { id: string; icon: string; label: string; detail: string; status: StepStatus; }

function WorkflowCard({ jobId, data }: { jobId: string; data: BookingData }) {
  const phone = data.contact?.phone ?? '';
  const dateTime = [data.schedule?.date, data.schedule?.time].filter(Boolean).join(' ');

  const initial: WFStep[] = [
    { id: 'intake',   icon: '📋', label: 'รับการจอง',        detail: jobId,                           status: 'done'    },
    { id: 'dispatch', icon: '🚗', label: 'จัดหาเจ้าหน้าที่', detail: 'กำลังจับคู่...',               status: 'running' },
    { id: 'notify',   icon: '📱', label: 'แจ้งครอบครัว',     detail: `SMS → ${phone}`,               status: 'pending' },
    { id: 'confirm',  icon: '✅', label: 'ยืนยันการเดินทาง', detail: dateTime || 'ตามเวลาที่จอง',    status: 'pending' },
  ];
  const [steps, setSteps] = useState<WFStep[]>(initial);

  useEffect(() => {
    const advance = (idx: number, detail: string, delay: number) =>
      setTimeout(() => setSteps(prev => prev.map((s, i) => {
        if (i === idx)     return { ...s, status: 'done', detail };
        if (i === idx + 1) return { ...s, status: 'running' };
        return s;
      })), delay);

    const t1 = advance(1, 'จับคู่เจ้าหน้าที่แล้ว',   1600);
    const t2 = advance(2, `แจ้ง SMS → ${phone}`,      3000);
    const t3 = advance(3, 'ยืนยันแล้ว — พร้อมรับบริการ', 4400);
    return () => [t1, t2, t3].forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const stepColor = (s: StepStatus) =>
    s === 'done' ? '#059669' : s === 'running' ? '#D97706' : '#94A3B8';

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>🎉</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>จองสำเร็จ!</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#065F46', borderRadius: 4, padding: '2px 7px' }}>{jobId}</span>
      </div>
      {/* Booking summary */}
      <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 10, color: '#1E293B', lineHeight: 1.8 }}>
        <div>👤 <b>{data.contact?.name}</b> · 📞 {data.contact?.phone}</div>
        <div>🏥 {SERVICE_LABELS[data.service?.type ?? ''] ?? data.service?.type} · 🗓 {dateTime}</div>
        <div>📍 จาก: {data.locations?.pickup}</div>
        <div>📍 ถึง: {data.locations?.dropoff}</div>
        <div>🧑‍🦽 {data.patient?.name} · {MOBILITY_LABELS[data.patient?.mobilityLevel ?? ''] ?? data.patient?.mobilityLevel}</div>
      </div>
      {/* Workflow steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: stepColor(s.status) }}>{s.label}</span>
              <span style={{ fontSize: 9, color: '#64748B', marginLeft: 4 }}>{s.detail}</span>
            </div>
            <span style={{ fontSize: 10 }}>
              {s.status === 'done' ? '✅' : s.status === 'running' ? '⏳' : '○'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingProgress({ data, missingFields, status, jobId }: BookingProgressProps) {
  const filled = REQUIRED_FIELDS.filter(f => !missingFields.includes(f));
  const pct = Math.round((filled.length / REQUIRED_FIELDS.length) * 100);

  if (status === 'submitted' && jobId) {
    return <WorkflowCard jobId={jobId} data={data} />;
  }

  if (filled.length === 0) return null;

  return (
    <div style={styles.progressCard}>
      <div style={styles.progressTitle}>
        📋 ข้อมูลการจอง ({pct}%)
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
      </div>
      <div style={styles.fieldGrid}>
        {REQUIRED_FIELDS.map(f => {
          const val = getFieldDisplay(data, f);
          const isFilled = !!val;
          return (
            <div key={f} style={styles.fieldRow}>
              <span style={{ ...styles.fieldDot, background: isFilled ? '#10B981' : '#CBD5E1' }} />
              <span style={styles.fieldLabel}>{FIELD_LABELS[f]}:</span>
              <span style={{ ...styles.fieldValue, color: isFilled ? '#1E293B' : '#94A3B8' }}>
                {val ?? '...'}
              </span>
            </div>
          );
        })}
      </div>
      {status === 'confirming' && (
        <div style={styles.confirmBadge}>กรุณายืนยันข้อมูลด้านบน</div>
      )}
    </div>
  );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

function TypingIndicator() {
  return (
    <div style={styles.messageRow}>
      <div style={styles.avatar}>💚</div>
      <div style={styles.bubbleAgent}>
        <div style={styles.typingDots}>
          <span style={{ ...styles.dot, animationDelay: '0ms' }} />
          <span style={{ ...styles.dot, animationDelay: '160ms' }} />
          <span style={{ ...styles.dot, animationDelay: '320ms' }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgentChat() {
  // API Key state
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiPanel, setShowApiPanel] = useState(() => !getStoredApiKey());

  const handleSaveKey = () => {
    const k = apiKeyInput.trim();
    if (!k) return;
    setStoredApiKey(k);
    setApiKey(k);
    setApiKeyInput('');
    setShowApiPanel(false);
  };

  const handleClearKey = () => {
    clearStoredApiKey();
    setApiKey('');
    setApiKeyInput('');
    setShowApiPanel(true);
  };

  const {
    messages,
    bookingData,
    status,
    jobId,
    quickReplies,
    missingFields,
    isThinking,
    sendMessage,
    selectQuickReply,
    resetChat,
  } = useAgentChat(apiKey);

  const [inputText, setInputText] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Show progress card after first data arrives, or always on submitted
  useEffect(() => {
    const hasSomeData = REQUIRED_FIELDS.some(f => !missingFields.includes(f));
    if (hasSomeData || status === 'submitted') setShowProgress(true);
  }, [missingFields, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerAvatar}>💚</div>
        <div>
          <div style={styles.headerName}>น้องแคร์</div>
          <div style={styles.headerSub}>WelCares Booking Agent</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {/* API Key toggle */}
          <button
            onClick={() => setShowApiPanel(v => !v)}
            style={{
              ...styles.resetBtn,
              background: apiKey ? 'rgba(255,255,255,0.25)' : 'rgba(255,80,80,0.5)',
              fontSize: 13,
            }}
            title={apiKey ? 'API Key ตั้งค่าแล้ว — แตะเพื่อแก้ไข' : 'ยังไม่มี API Key — แตะเพื่อตั้งค่า'}
          >
            🔐
          </button>
          <button
            onClick={() => { resetChat(); setShowProgress(false); }}
            style={styles.resetBtn}
            title="เริ่มใหม่"
          >
            🔄
          </button>
        </div>
      </div>

      {/* API Key Panel */}
      {showApiPanel && (
        <div style={styles.apiPanel}>
          <div style={styles.apiPanelTitle}>🔐 OpenRouter API Key</div>
          <input
            style={styles.apiInput}
            type="password"
            placeholder="sk-or-v1-..."
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              style={{ ...styles.apiBtn, background: '#06C755', color: 'white', flex: 1 }}
              onClick={handleSaveKey}
              disabled={!apiKeyInput.trim()}
            >
              บันทึก
            </button>
            {apiKey && (
              <button
                style={{ ...styles.apiBtn, background: '#fee2e2', color: '#dc2626' }}
                onClick={handleClearKey}
              >
                ล้าง
              </button>
            )}
            <button
              style={{ ...styles.apiBtn, background: '#f1f5f9', color: '#64748b' }}
              onClick={() => setShowApiPanel(false)}
            >
              ปิด
            </button>
          </div>
          <div style={styles.apiHelp}>
            รับ API Key ฟรีได้ที่{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: '#06C755' }}>
              openrouter.ai/keys
            </a>
          </div>
        </div>
      )}

      {/* Progress card (collapsible) */}
      {showProgress && (
        <div style={styles.progressWrap}>
          <button
            onClick={() => setShowProgress(v => !v)}
            style={styles.progressToggle}
          >
            {status === 'submitted' ? '🎉 สรุปการจอง — แตะเพื่อดู/ซ่อน' : '📋 ข้อมูลการจอง — แตะเพื่อดู/ซ่อน'}
          </button>
          <BookingProgress
            data={bookingData}
            missingFields={missingFields}
            status={status}
            jobId={jobId}
          />
        </div>
      )}

      {/* Messages */}
      <div style={styles.messageList}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={msg.role === 'user' ? styles.messageRowUser : styles.messageRow}
          >
            {msg.role === 'assistant' && <div style={styles.avatar}>💚</div>}
            <div
              style={msg.role === 'user' ? styles.bubbleUser : styles.bubbleAgent}
            >
              {msg.content.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < msg.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}

        {isThinking && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {quickReplies.length > 0 && !isThinking && (
        <div style={styles.quickReplies}>
          {quickReplies.map(qr => (
            <button
              key={qr}
              onClick={() => selectQuickReply(qr)}
              style={styles.quickReplyBtn}
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={styles.inputRow}>
        <input
          style={styles.input}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={isThinking ? 'น้องแคร์กำลังคิด...' : 'พิมพ์ข้อความ...'}
          disabled={isThinking}
        />
        <button
          type="submit"
          style={{
            ...styles.sendBtn,
            opacity: (!inputText.trim() || isThinking) ? 0.5 : 1,
          }}
          disabled={!inputText.trim() || isThinking}
        >
          ส่ง
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const LINE_GREEN = '#06C755';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 500,
    maxHeight: 700,
    background: '#E8F5E9',
    borderRadius: 18,
    overflow: 'hidden',
    border: '4px solid #1E293B',
    fontFamily: 'sans-serif',
  },
  header: {
    background: LINE_GREEN,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    background: 'white',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
  headerName: { color: 'white', fontWeight: 700, fontSize: 13 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
  resetBtn: {
    marginLeft: 'auto',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 14,
  },

  progressWrap: {
    background: 'white',
    borderBottom: '1px solid #E2E8F0',
    flexShrink: 0,
  },
  progressToggle: {
    width: '100%',
    background: '#F8FAFC',
    border: 'none',
    borderBottom: '1px solid #E2E8F0',
    padding: '6px 12px',
    fontSize: 10,
    color: '#64748B',
    cursor: 'pointer',
    textAlign: 'left',
  },
  progressCard: {
    padding: '8px 12px',
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    background: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: LINE_GREEN,
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2px 8px',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 9,
  },
  fieldDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  fieldLabel: { color: '#64748B', flexShrink: 0 },
  fieldValue: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  confirmBadge: {
    marginTop: 6,
    background: '#FEF3C7',
    border: '1px solid #F59E0B',
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 10,
    color: '#92400E',
    fontWeight: 700,
    textAlign: 'center',
  },

  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 10px 4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  messageRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    background: LINE_GREEN,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
  },
  bubbleAgent: {
    background: 'white',
    borderRadius: '0 10px 10px 10px',
    padding: '8px 12px',
    fontSize: 12,
    color: '#1E293B',
    maxWidth: '78%',
    lineHeight: 1.6,
    border: '1px solid #E2E8F0',
  },
  bubbleUser: {
    background: LINE_GREEN,
    borderRadius: '10px 0 10px 10px',
    padding: '8px 12px',
    fontSize: 12,
    color: 'white',
    maxWidth: '78%',
    lineHeight: 1.6,
  },

  typingDots: {
    display: 'flex',
    gap: 4,
    padding: '4px 0',
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#94A3B8',
    animation: 'bounce 1.2s infinite',
    display: 'inline-block',
  },

  quickReplies: {
    display: 'flex',
    gap: 6,
    padding: '6px 10px',
    overflowX: 'auto',
    background: 'white',
    borderTop: '1px solid #E2E8F0',
    flexShrink: 0,
  },
  quickReplyBtn: {
    background: 'white',
    border: `1.5px solid ${LINE_GREEN}`,
    borderRadius: 16,
    padding: '4px 12px',
    fontSize: 11,
    color: LINE_GREEN,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },

  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '8px 10px',
    background: 'white',
    borderTop: '1px solid #E2E8F0',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    border: '1px solid #CBD5E1',
    borderRadius: 20,
    padding: '8px 14px',
    fontSize: 12,
    outline: 'none',
    background: '#F8FAFC',
    color: '#1E293B',
    color: '#1E293B',
  },
  sendBtn: {
    background: LINE_GREEN,
    color: 'white',
    border: 'none',
    borderRadius: 20,
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },

  // API key panel
  apiPanel: {
    background: 'white',
    borderBottom: '1px solid #E2E8F0',
    padding: '10px 14px',
    flexShrink: 0,
  },
  apiPanelTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 6,
  },
  apiInput: {
    width: '100%',
    border: '1px solid #CBD5E1',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box' as const,
    background: '#F8FAFC',
  },
  apiBtn: {
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  apiHelp: {
    marginTop: 6,
    fontSize: 10,
    color: '#94A3B8',
  },
};

// ── CSS animation for typing dots ─────────────────────────────────────────
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-5px); }
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('agent-chat-styles')) {
  styleTag.id = 'agent-chat-styles';
  document.head.appendChild(styleTag);
}
