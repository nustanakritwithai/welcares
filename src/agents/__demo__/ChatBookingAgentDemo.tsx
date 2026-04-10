/**
 * ChatBookingAgent Demo - UI สำหรับทดสอบ Agent
 */

import React, { useState } from 'react';
import { ChatBookingAgent, ChatBookingInput, ChatBookingOutput } from '../ChatBookingAgent';

// Agent Config
const agentConfig = {
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  temperature: 0.3,
  maxTokens: 500,
  timeoutMs: 10000,
  retryAttempts: 2
};

// Intent Labels
const INTENT_LABELS: Record<string, string> = {
  BOOK_TRIP: '🚗 จองรถ',
  BOOK_MEDICINE: '💊 สั่งยา',
  BOOK_HOME_CARE: '🏠 ดูแลที่บ้าน',
  MODIFY_BOOKING: '✏️ แก้ไขการจอง',
  CANCEL_BOOKING: '❌ ยกเลิกการจอง',
  INQUIRY_STATUS: '❓ สอบถามสถานะ',
  GENERAL_QUERY: '💬 คำถามทั่วไป'
};

// Example Messages
const EXAMPLES = [
  { text: 'อยากจองรถไปโรงพยาบาลพรุ่งนี้ 9 โมง', type: 'TRIP' },
  { text: 'ต้องการสั่งยาความดัน ส่งที่บ้าน', type: 'MEDICINE' },
  { text: 'ต้องการพยาบาลมาดูแลคุณยายที่บ้าน', type: 'HOME_CARE' },
  { text: 'สถานะการจอง REQ-001 เป็นอย่างไรแล้ว', type: 'STATUS' },
  { text: 'ฉันมีไฟล์รูปแผนที่ให้ดูด้วย', type: 'FILE' },
];

// Styles
const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: 480,
    margin: '0 auto',
    padding: 16,
    background: '#f8fafc',
    minHeight: '100vh',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid #e2e8f0',
  },
  agentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #7F77DD 0%, #9F97FF 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1e293b',
  } as React.CSSProperties,
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    minHeight: 80,
    resize: 'vertical' as const,
    outline: 'none',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    background: '#fff',
    cursor: 'pointer',
  },
  button: {
    primary: {
      width: '100%',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #7F77DD 0%, #9F97FF 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'transform 0.1s',
    },
    secondary: {
      padding: '6px 12px',
      background: '#f1f5f9',
      color: '#475569',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      fontSize: 11,
      cursor: 'pointer',
    },
  },
  examplesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  resultBox: {
    background: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  intentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: '#EEF2FF',
    color: '#7F77DD',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
  },
  entityRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 13,
  },
  entityKey: {
    color: '#64748b',
  },
  entityValue: {
    color: '#1e293b',
    fontWeight: 500,
    textAlign: 'right' as const,
    maxWidth: 200,
    wordBreak: 'break-word' as const,
  },
  statusSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#10b981',
    fontSize: 13,
    fontWeight: 600,
  },
  statusError: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 600,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    color: '#64748b',
  },
  clarificationBox: {
    background: '#FEF3C7',
    border: '1px solid #F59E0B',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  skillsUsed: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  skillTag: {
    padding: '2px 8px',
    background: '#DBEAFE',
    color: '#3b82f6',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 500,
  },
};

// Demo Component
export const ChatBookingAgentDemo: React.FC = () => {
  const [message, setMessage] = useState('');
  const [bookingType, setBookingType] = useState<'TRIP' | 'MEDICINE' | 'HOME_CARE' | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ChatBookingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create agent instance
  const agent = new ChatBookingAgent(agentConfig);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const input: ChatBookingInput = {
        requestId: `req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        message: message.trim(),
        context: bookingType ? { bookingType } : undefined
      };

      const output = await agent.process(input);
      setResult(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (text: string) => {
    setMessage(text);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.agentIcon}>🤖</div>
          <div>
            <div style={styles.title}>ChatBookingAgent Demo</div>
            <div style={styles.subtitle}>Agent จองบริการสุขภาพอัจฉริยะ</div>
          </div>
        </div>

        {/* Config Display */}
        <div style={{ ...styles.resultBox, background: '#EEF2FF' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>⚙️ Configuration</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11 }}>
            <span style={styles.skillTag}>Model: {agentConfig.model.split('/')[1]}</span>
            <span style={styles.skillTag}>Temp: {agentConfig.temperature}</span>
            <span style={styles.skillTag}>MaxTokens: {agentConfig.maxTokens}</span>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div style={styles.card}>
        <form onSubmit={handleSubmit}>
          {/* Booking Type */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>ประเภทบริการ (ถ้ารู้)</label>
            <select
              style={styles.select}
              value={bookingType || ''}
              onChange={(e) => setBookingType(e.target.value as 'TRIP' | 'MEDICINE' | 'HOME_CARE' || undefined)}
            >
              <option value="">-- ไม่ระบุ (ให้ Agent วิเคราะห์) --</option>
              <option value="TRIP">🚗 จองรถ</option>
              <option value="MEDICINE">💊 สั่งยา</option>
              <option value="HOME_CARE">🏠 ดูแลที่บ้าน</option>
            </select>
          </div>

          {/* Message Input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>ข้อความ</label>
            <textarea
              style={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="พิมพ์ข้อความ เช่น 'อยากจองรถไปโรงพยาบาลพรุ่งนี้ 9 โมง'"
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            style={{ ...styles.button.primary, opacity: isLoading ? 0.6 : 1 }}
            disabled={isLoading || !message.trim()}
          >
            {isLoading ? '⏳ กำลังประมวลผล...' : '🚀 ประมวลผล'}
          </button>
        </form>

        {/* Example Messages */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>💡 ตัวอย่างข้อความ</div>
          <div style={styles.examplesGrid}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                style={styles.button.secondary}
                onClick={() => handleExampleClick(ex.text)}
                type="button"
              >
                {ex.text.substring(0, 25)}...
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={styles.card}>
          <div style={styles.loading}>
            <span className="spinner">⏳</span>
            <span>Agent กำลังวิเคราะห์...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.card}>
          <div style={styles.statusError}>
            <span>❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={styles.card}>
          {/* Status */}
          <div style={{ marginBottom: 12 }}>
            {result.success ? (
              <div style={styles.statusSuccess}>
                <span>✅</span>
                <span>ประมวลผลสำเร็จ</span>
              </div>
            ) : (
              <div style={styles.statusError}>
                <span>❌</span>
                <span>{result.error || 'เกิดข้อผิดพลาด'}</span>
              </div>
            )}
          </div>

          {/* Intent Badge */}
          <div style={{ marginBottom: 12 }}>
            <span style={styles.intentBadge}>
              {INTENT_LABELS[result.intent] || result.intent}
            </span>
            <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>
              ความมั่นใจ: {Math.round((result.confidence_score || 0) * 100)}%
            </span>
          </div>

          {/* Clarification Needed */}
          {result.clarification_needed && result.clarification_question && (
            <div style={styles.clarificationBox}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>❓ ต้องการข้อมูลเพิ่มเติม</div>
              <div style={{ fontSize: 13 }}>{result.clarification_question}</div>
            </div>
          )}

          {/* Missing Fields */}
          {result.missing_required_fields && result.missing_required_fields.length > 0 && (
            <div style={{ ...styles.resultBox, background: '#FEF3C7' }}>
              <div style={{ fontSize: 11, color: '#92400e', marginBottom: 4 }}>⚠️ ข้อมูลที่ขาด</div>
              <div style={{ fontSize: 12, color: '#78350f' }}>
                {result.missing_required_fields.join(', ')}
              </div>
            </div>
          )}

          {/* Extracted Entities */}
          {result.extracted_entities && Object.keys(result.extracted_entities).length > 0 && (
            <div style={styles.resultBox}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                📊 ข้อมูลที่ดึงออกมา
              </div>
              {Object.entries(result.extracted_entities)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([key, value]) => (
                  <div key={key} style={styles.entityRow}>
                    <span style={styles.entityKey}>{key}</span>
                    <span style={styles.entityValue}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Skills Used */}
          {result.skills_used && result.skills_used.length > 0 && (
            <div style={styles.resultBox}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                🛠️ Skills ที่ใช้
              </div>
              <div style={styles.skillsUsed}>
                {result.skills_used.map((skill, i) => (
                  <span
                    key={i}
                    style={{
                      ...styles.skillTag,
                      background: skill.success ? '#D1FAE5' : '#FEE2E2',
                      color: skill.success ? '#059669' : '#DC2626'
                    }}
                  >
                    {skill.success ? '✓' : '✗'} {skill.skill_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {result.suggested_actions && result.suggested_actions.length > 0 && (
            <div style={styles.resultBox}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                📋 การดำเนินการที่แนะนำ
              </div>
              {result.suggested_actions.map((action, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{action.description}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>ประเภท: {action.type}</div>
                </div>
              ))}
            </div>
          )}

          {/* Request ID */}
          <div style={{ marginTop: 12, fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>
            Request ID: {result.requestId}
          </div>
        </div>
      )}

      {/* Agent Info */}
      <div style={styles.card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
          🧠 Skills ที่มีให้ใช้
        </div>
        <div style={styles.skillsUsed}>
          <span style={styles.skillTag}>readFile</span>
          <span style={styles.skillTag}>writeFile</span>
          <span style={styles.skillTag}>extractEntities</span>
          <span style={styles.skillTag}>validateBooking</span>
          <span style={styles.skillTag}>calculateETA</span>
          <span style={styles.skillTag}>findNearbyProviders</span>
          <span style={styles.skillTag}>sendNotification</span>
          <span style={styles.skillTag}>translateText</span>
        </div>
      </div>
    </div>
  );
};

export default ChatBookingAgentDemo;