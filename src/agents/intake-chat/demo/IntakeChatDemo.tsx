/**
 * Intake Chat Demo - Mobile-First Chat UI
 * 
 * @version 1.0
 * @mobile-first
 */

import React, { useRef, useEffect, useState } from 'react';
import type {
  ChatMessage,
  QuickReply,
  SummaryCardData,
} from '../types';
import { useIntakeChatAgent } from '../useIntakeChatAgent';
import type { IntakeInput } from '../../intake/types';
import {
  SERVICE_TYPE_LABELS,
  MOBILITY_LEVEL_LABELS,
  RELATIONSHIP_LABELS,
} from '../../intake/schema';

// ============================================================================
// Constants
// ============================================================================

const WELCARES_PRIMARY = '#7F77DD';
const WELCARES_SECONDARY = '#9B94E6';
const WELCARES_LIGHT = '#F0EEFC';

// ============================================================================
// Components
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
  onQuickReply?: (reply: QuickReply) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onQuickReply }) => {
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={styles.systemMessage}>
        {message.content}
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.messageContainer,
        justifyContent: isAssistant ? 'flex-start' : 'flex-end',
      }}
    >
      <div
        style={{
          ...styles.bubble,
          ...(isAssistant ? styles.assistantBubble : styles.userBubble),
        }}
      >
        <p style={styles.messageText}>{message.content}</p>
        
        {message.quickReplies && message.quickReplies.length > 0 && onQuickReply && (
          <div style={styles.quickRepliesContainer}>
            {message.quickReplies.map((reply) => (
              <button
                key={reply.id}
                style={styles.quickReplyButton}
                onClick={() => onQuickReply(reply)}
                type="button"
              >
                {reply.icon && <span style={styles.quickReplyIcon}>{reply.icon}</span>}
                {reply.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div style={styles.messageContainer}>
    <div style={{ ...styles.bubble, ...styles.assistantBubble, ...styles.typingBubble }}>
      <div style={styles.typingDots}>
        <span style={{ ...styles.dot, animationDelay: '0ms' }} />
        <span style={{ ...styles.dot, animationDelay: '150ms' }} />
        <span style={{ ...styles.dot, animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

interface SummaryCardProps {
  formData: Partial<IntakeInput>;
  onConfirm: () => void;
  onEdit: () => void;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ formData, onConfirm, onEdit }) => {
  const serviceType = formData.service?.serviceType;
  const serviceLabel = serviceType
    ? SERVICE_TYPE_LABELS[serviceType] || serviceType
    : '-';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-';
    return timeStr;
  };

  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryHeader}>
        <span style={styles.summaryIcon}>📋</span>
        <span style={styles.summaryTitle}>สรุปรายละเอียด</span>
      </div>

      <div style={styles.summaryContent}>
        <SummaryRow label="บริการ" value={serviceLabel} icon="🏥" />
        <SummaryRow
          label="ผู้รับบริการ"
          value={formData.patient?.name || '-'}
          icon="👤"
        />
        <SummaryRow
          label="วันที่"
          value={formatDate(formData.schedule?.appointmentDate)}
          icon="📅"
        />
        <SummaryRow
          label="เวลา"
          value={formatTime(formData.schedule?.appointmentTime)}
          icon="🕐"
        />
        <SummaryRow
          label="รับจาก"
          value={formData.locations?.pickup?.address || '-'}
          icon="📍"
          truncate
        />
        <SummaryRow
          label="ส่งที่"
          value={formData.locations?.dropoff?.address || '-'}
          icon="🏥"
          truncate
        />

        {formData.patient?.mobilityLevel && (
          <SummaryRow
            label="การเคลื่อนไหว"
            value={MOBILITY_LEVEL_LABELS[formData.patient.mobilityLevel] || formData.patient.mobilityLevel}
            icon="♿"
          />
        )}

        <SummaryRow
          label="ผู้ติดต่อ"
          value={formData.contact?.contactName || '-'}
          icon="📞"
        />
        <SummaryRow
          label="เบอร์โทร"
          value={formData.contact?.contactPhone || '-'}
          icon="☎️"
        />
      </div>

      <div style={styles.summaryActions}>
        <button
          style={{ ...styles.summaryButton, ...styles.editButton }}
          onClick={onEdit}
          type="button"
        >
          ✏️ แก้ไข
        </button>
        <button
          style={{ ...styles.summaryButton, ...styles.confirmButton }}
          onClick={onConfirm}
          type="button"
        >
          ✅ ยืนยัน
        </button>
      </div>
    </div>
  );
};

interface SummaryRowProps {
  label: string;
  value: string;
  icon?: string;
  truncate?: boolean;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ label, value, icon, truncate }) => (
  <div style={styles.summaryRow}>
    <span style={styles.summaryLabel}>
      {icon && <span style={styles.summaryRowIcon}>{icon}</span>}
      {label}
    </span>
    <span style={{ ...styles.summaryValue, ...(truncate ? styles.truncate : {}) }}>
      {value}
    </span>
  </div>
);

const SuccessView: React.FC<{ jobId: string; onRestart: () => void; onClose?: () => void }> = ({
  jobId,
  onRestart,
  onClose,
}) => (
  <div style={styles.successContainer}>
    <div style={styles.successIcon}>🎉</div>
    <h2 style={styles.successTitle}>จองสำเร็จ!</h2>
    <p style={styles.successMessage}>
      รหัสการจองของคุณ
    </p>
    <div style={styles.jobIdBox}>
      <span style={styles.jobId}>{jobId}</span>
    </div>
    <p style={styles.successSubMessage}>
      ทีมงานจะติดต่อกลับภายใน 15 นาที
      <br />
      ขอบคุณที่ใช้บริการ WelCares 💜
    </p>
    <div style={styles.successActions}>
      <button
        style={{ ...styles.summaryButton, ...styles.editButton }}
        onClick={onClose}
        type="button"
      >
        ปิด
      </button>
      <button
        style={{ ...styles.summaryButton, ...styles.confirmButton }}
        onClick={onRestart}
        type="button"
      >
        🔄 จองใหม่
      </button>
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export interface IntakeChatDemoProps {
  onComplete?: (jobId: string) => void;
  onCancel?: () => void;
  className?: string;
}

export const IntakeChatDemo: React.FC<IntakeChatDemoProps> = ({
  onComplete,
  onCancel,
  className,
}) => {
  const {
    messages,
    status,
    isTyping,
    formData,
    jobId,
    sendMessage,
    selectQuickReply,
    confirmBooking,
    restart,
  } = useIntakeChatAgent();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = async (reply: QuickReply) => {
    if (reply.value === 'restart') {
      restart();
      return;
    }
    if (reply.value === 'close') {
      onCancel?.();
      return;
    }
    await selectQuickReply(reply);
  };

  const handleConfirm = async () => {
    await confirmBooking();
    if (jobId) {
      onComplete?.(jobId);
    }
  };

  const isAwaitingConfirmation = status === 'awaitingConfirmation';
  const isSuccess = status === 'success';

  return (
    <div style={styles.container} className={className}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.branding}>
            <div style={styles.logo}>WC</div>
            <div style={styles.headerText}>
              <h1 style={styles.title}>น้องแคร์</h1>
              <span style={styles.subtitle}>ผู้ช่วยจองบริการ</span>
            </div>
          </div>
          {!isSuccess && (
            <button
              style={styles.restartButton}
              onClick={restart}
              title="เริ่มใหม่"
              type="button"
            >
              🔄
            </button>
          )}
        </div>
      </header>

      {/* Message Area */}
      <div style={styles.messageArea}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onQuickReply={handleQuickReply}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Summary Card */}
      {isAwaitingConfirmation && !isTyping && (
        <div style={styles.summaryCardContainer}>
          <SummaryCard
            formData={formData}
            onConfirm={handleConfirm}
            onEdit={() => sendMessage('แก้ไข')}
          />
        </div>
      )}

      {/* Success View */}
      {isSuccess && jobId && (
        <div style={styles.successOverlay}>
          <SuccessView
            jobId={jobId}
            onRestart={restart}
            onClose={onCancel}
          />
        </div>
      )}

      {/* Input Area */}
      {!isSuccess && (
        <div style={styles.inputArea}>
          <div style={styles.inputContainer}>
            <input
              ref={inputRef}
              type="text"
              style={styles.input}
              placeholder={
                isAwaitingConfirmation
                  ? 'กรุณายืนยันหรือแก้ไขข้อมูลด้านบน...'
                  : 'พิมพ์ข้อความ...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping || isAwaitingConfirmation}
            />
            <button
              style={{
                ...styles.sendButton,
                ...(inputText.trim() ? styles.sendButtonActive : {}),
              }}
              onClick={handleSend}
              disabled={!inputText.trim() || isTyping || isAwaitingConfirmation}
              type="button"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntakeChatDemo;

// ============================================================================
// Styles
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '480px',
    height: '100vh',
    maxHeight: '900px',
    margin: '0 auto',
    backgroundColor: '#F8F9FA',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },

  // Header
  header: {
    backgroundColor: WELCARES_PRIMARY,
    padding: '12px 16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branding: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'white',
    color: WELCARES_PRIMARY,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: '13px',
  },
  restartButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },

  // Message Area
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageContainer: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '18px',
    wordBreak: 'break-word',
  },
  assistantBubble: {
    backgroundColor: 'white',
    color: '#333',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
  },
  userBubble: {
    backgroundColor: WELCARES_PRIMARY,
    color: 'white',
    borderBottomRightRadius: '4px',
  },
  messageText: {
    margin: 0,
    fontSize: '15px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  systemMessage: {
    textAlign: 'center',
    color: '#888',
    fontSize: '13px',
    padding: '8px 0',
  },

  // Quick Replies
  quickRepliesContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(0, 0, 0, 0.08)',
  },
  quickReplyButton: {
    backgroundColor: WELCARES_LIGHT,
    color: WELCARES_PRIMARY,
    border: `1px solid ${WELCARES_SECONDARY}`,
    borderRadius: '20px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minHeight: '36px',
  },
  quickReplyIcon: {
    fontSize: '16px',
  },

  // Typing Indicator
  typingBubble: {
    padding: '16px 20px',
  },
  typingDots: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    height: '8px',
  },
  dot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#999',
    borderRadius: '50%',
    animation: 'typingBounce 1.4s infinite ease-in-out both',
  },

  // Input Area
  inputArea: {
    backgroundColor: 'white',
    padding: '12px 16px',
    borderTop: '1px solid #E5E5E5',
  },
  inputContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    border: '1px solid #E5E5E5',
    borderRadius: '24px',
    padding: '12px 16px',
    fontSize: '15px',
    outline: 'none',
    backgroundColor: '#F8F9FA',
    transition: 'border-color 0.2s',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#E5E5E5',
    color: 'white',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  sendButtonActive: {
    backgroundColor: WELCARES_PRIMARY,
    cursor: 'pointer',
  },

  // Summary Card
  summaryCardContainer: {
    position: 'absolute',
    bottom: '80px',
    left: '16px',
    right: '16px',
    zIndex: 5,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
  },
  summaryHeader: {
    backgroundColor: WELCARES_PRIMARY,
    color: 'white',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  summaryIcon: {
    fontSize: '20px',
  },
  summaryTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: 0,
  },
  summaryContent: {
    padding: '16px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '8px 0',
    borderBottom: '1px solid #F0F0F0',
  },
  summaryLabel: {
    color: '#666',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  summaryRowIcon: {
    fontSize: '14px',
  },
  summaryValue: {
    color: '#333',
    fontSize: '14px',
    fontWeight: 500,
    textAlign: 'right',
    maxWidth: '60%',
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  summaryActions: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #F0F0F0',
  },
  summaryButton: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '15px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  editButton: {
    backgroundColor: '#F0F0F0',
    color: '#666',
  },
  confirmButton: {
    backgroundColor: WELCARES_PRIMARY,
    color: 'white',
  },

  // Success View
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  successContainer: {
    textAlign: 'center',
    maxWidth: '320px',
  },
  successIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  successTitle: {
    color: '#333',
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
  },
  successMessage: {
    color: '#666',
    fontSize: '15px',
    margin: '0 0 16px 0',
  },
  jobIdBox: {
    backgroundColor: WELCARES_LIGHT,
    border: `2px dashed ${WELCARES_PRIMARY}`,
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  jobId: {
    color: WELCARES_PRIMARY,
    fontSize: '20px',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
  successSubMessage: {
    color: '#666',
    fontSize: '14px',
    lineHeight: 1.6,
    margin: '0 0 24px 0',
  },
  successActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
};

// Add keyframes for typing animation via CSS-in-JS
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes typingBounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(styleSheet);
}