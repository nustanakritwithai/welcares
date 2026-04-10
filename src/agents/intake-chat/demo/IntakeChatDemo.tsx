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
// Quick Form Component
// ============================================================================

interface QuickFormProps {
  onFillField: (field: string, value: string) => void;
  formData: Partial<IntakeInput>;
}

const QuickForm: React.FC<QuickFormProps> = ({ onFillField, formData }) => {
  const [activeField, setActiveField] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const fields = [
    { key: 'contact.contactName', label: 'ชื่อผู้ติดต่อ', icon: '👤' },
    { key: 'contact.contactPhone', label: 'เบอร์โทร', icon: '📞' },
    { key: 'service.serviceType', label: 'บริการ', icon: '🏥', type: 'select', options: [
      { value: 'hospital-visit', label: 'พบแพทย์' },
      { value: 'follow-up', label: 'ติดตามอาการ' },
      { value: 'physical-therapy', label: 'กายภาพ' },
      { value: 'dialysis', label: 'ล้างไต' },
      { value: 'checkup', label: 'ตรวจสุขภาพ' },
      { value: 'vaccination', label: 'วัคซีน' },
      { value: 'other', label: 'อื่นๆ' },
    ]},
    { key: 'schedule.appointmentDate', label: 'วันที่', icon: '📅', type: 'date' },
    { key: 'schedule.appointmentTime', label: 'เวลา', icon: '🕐', type: 'time' },
    { key: 'locations.pickup.address', label: 'รับจาก', icon: '📍' },
    { key: 'locations.dropoff.address', label: 'ส่งที่', icon: '🏥' },
    { key: 'patient.name', label: 'ชื่อผู้ป่วย', icon: '🧑‍⚕️' },
    { key: 'patient.mobilityLevel', label: 'การเคลื่อนไหว', icon: '♿', type: 'select', options: [
      { value: 'independent', label: 'เดินได้เอง' },
      { value: 'assisted', label: 'ต้องช่วยพยุง' },
      { value: 'wheelchair', label: 'ใช้รถเข็น' },
      { value: 'bedridden', label: 'ติดเตียง' },
    ]},
  ];

  const handleSubmit = () => {
    if (activeField && inputValue.trim()) {
      onFillField(activeField, inputValue.trim());
      setInputValue('');
      setActiveField(null);
    }
  };

  const getCurrentValue = (fieldKey: string) => {
    const parts = fieldKey.split('.');
    let value: unknown = formData;
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }
    return value as string | undefined;
  };

  return (
    <div style={quickFormStyles.container}>
      <div style={quickFormStyles.header}>
        <span style={quickFormStyles.headerIcon}>📝</span>
        <span style={quickFormStyles.headerText}>กรอกข้อมูลเร็ว</span>
      </div>
      <div style={quickFormStyles.fields}>
        {fields.map((field) => {
          const currentValue = getCurrentValue(field.key);
          const isActive = activeField === field.key;
          
          if (isActive && field.type === 'select') {
            return (
              <div key={field.key} style={quickFormStyles.activeField}>
                <span style={quickFormStyles.fieldLabel}>{field.icon} {field.label}</span>
                <div style={quickFormStyles.selectOptions}>
                  {field.options?.map((opt) => (
                    <button
                      key={opt.value}
                      style={quickFormStyles.optionButton}
                      onClick={() => {
                        onFillField(field.key, opt.value);
                        setActiveField(null);
                      }}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    style={quickFormStyles.cancelButton}
                    onClick={() => setActiveField(null)}
                    type="button"
                  >
                    ❌ ยกเลิก
                  </button>
                </div>
              </div>
            );
          }
          
          if (isActive) {
            return (
              <div key={field.key} style={quickFormStyles.activeField}>
                <span style={quickFormStyles.fieldLabel}>{field.icon} {field.label}</span>
                <input
                  type={field.type || 'text'}
                  style={quickFormStyles.input}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                  placeholder={`กรอก${field.label}...`}
                />
                <div style={quickFormStyles.buttons}>
                  <button style={quickFormStyles.submitButton} onClick={handleSubmit} type="button">
                    ✅ บันทึก
                  </button>
                  <button style={quickFormStyles.cancelButton} onClick={() => setActiveField(null)} type="button">
                    ❌ ยกเลิก
                  </button>
                </div>
              </div>
            );
          }
          
          return (
            <button
              key={field.key}
              style={{
                ...quickFormStyles.fieldButton,
                ...(currentValue ? quickFormStyles.filledField : {}),
              }}
              onClick={() => {
                setActiveField(field.key);
                setInputValue(currentValue || '');
              }}
              type="button"
            >
              <span>{field.icon}</span>
              <span style={quickFormStyles.fieldText}>
                {currentValue || field.label}
              </span>
              {currentValue && <span style={quickFormStyles.checkmark}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const quickFormStyles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    margin: '12px 16px',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#7F77DD',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerIcon: {
    fontSize: '18px',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: '15px',
  },
  fields: {
    padding: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  fieldButton: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #E5E5E5',
    backgroundColor: '#F8F9FA',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
  },
  filledField: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  fieldText: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  checkmark: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  activeField: {
    gridColumn: '1 / -1',
    padding: '12px',
    backgroundColor: '#F0EEFC',
    borderRadius: '12px',
  },
  fieldLabel: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500,
    color: '#333',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #7F77DD',
    fontSize: '15px',
    color: '#000',
    WebkitTextFillColor: '#000',
    backgroundColor: '#fff',
    boxSizing: 'border-box' as const,
  },
  buttons: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  submitButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#7F77DD',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  cancelButton: {
    padding: '10px 16px',
    backgroundColor: '#F0F0F0',
    color: '#666',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  selectOptions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  optionButton: {
    padding: '10px 12px',
    backgroundColor: '#fff',
    border: '1px solid #E5E5E5',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
};

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
    updateField,
  } = useIntakeChatAgent();

  const [inputText, setInputText] = useState('');
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiInput, setShowApiInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('welcares_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Save API key to localStorage
  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('welcares_api_key', apiKey.trim());
      setShowApiInput(false);
    }
  };

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

  // Handle direct form field fill from QuickForm
  const handleFillField = (fieldKey: string, value: string) => {
    // Parse field key like "contact.contactName" to nested object path
    const parts = fieldKey.split('.');
    
    if (parts.length === 1) {
      // Simple field at root level
      updateField(parts[0] as keyof IntakeInput, value as IntakeInput[keyof IntakeInput]);
    } else if (parts.length === 2) {
      // Nested field like "contact.contactName"
      const [parent, child] = parts;
      const currentParent = (formData[parent as keyof IntakeInput] as Record<string, unknown>) || {};
      updateField(
        parent as keyof IntakeInput,
        { ...currentParent, [child]: value } as IntakeInput[keyof IntakeInput]
      );
    }
    
    // Also send a confirmation message to the chat
    const fieldLabels: Record<string, string> = {
      'contact.contactName': 'ชื่อผู้ติดต่อ',
      'contact.contactPhone': 'เบอร์โทร',
      'service.serviceType': 'บริการ',
      'schedule.appointmentDate': 'วันนัด',
      'schedule.appointmentTime': 'เวลา',
      'locations.pickup.address': 'จุดรับ',
      'locations.dropoff.address': 'จุดส่ง',
      'patient.name': 'ชื่อผู้ป่วย',
      'patient.mobilityLevel': 'การเคลื่อนไหว',
    };
    
    const label = fieldLabels[fieldKey] || fieldKey;
    sendMessage(`${label}: ${value}`);
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
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* API Key Toggle Button */}
            <button
              style={{
                ...styles.restartButton,
                backgroundColor: apiKey ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)',
              }}
              onClick={() => setShowApiInput(!showApiInput)}
              title={apiKey ? 'API Key ตั้งค่าแล้ว' : 'ตั้งค่า API Key'}
              type="button"
            >
              🔑
            </button>
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
        </div>
      </header>

      {/* API Key Input Panel */}
      {showApiInput && (
        <div style={apiKeyStyles.container}>
          <div style={apiKeyStyles.header}>
            <span style={apiKeyStyles.headerIcon}>🔐</span>
            <span style={apiKeyStyles.headerText}>ตั้งค่า OpenRouter API Key</span>
          </div>
          <div style={apiKeyStyles.content}>
            <input
              type="password"
              style={apiKeyStyles.input}
              placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
            />
            <div style={apiKeyStyles.buttons}>
              <button
                style={apiKeyStyles.saveButton}
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim()}
                type="button"
              >
                💾 บันทึก
              </button>
              <button
                style={apiKeyStyles.clearButton}
                onClick={() => {
                  setApiKey('');
                  localStorage.removeItem('welcares_api_key');
                }}
                type="button"
              >
                🗑️ ล้าง
              </button>
              <button
                style={apiKeyStyles.cancelButton}
                onClick={() => setShowApiInput(false)}
                type="button"
              >
                ❌ ปิด
              </button>
            </div>
            <p style={apiKeyStyles.help}>
              รับ API Key ได้ที่{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                style={apiKeyStyles.link}
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>
        </div>
      )}

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

      {/* Quick Form Toggle */}
      {!isSuccess && !isAwaitingConfirmation && (
        <button
          style={styles.quickFormToggle}
          onClick={() => setShowQuickForm(!showQuickForm)}
          type="button"
        >
          {showQuickForm ? '📋 ซ่อนแบบฟอร์ม' : '📝 กรอกข้อมูลเร็ว'}
        </button>
      )}

      {/* Quick Form */}
      {showQuickForm && !isSuccess && !isAwaitingConfirmation && (
        <QuickForm
          formData={formData}
          onFillField={handleFillField}
        />
      )}

      {/* Input Area */}
      {!isSuccess && (
        <div style={styles.inputArea}>
          <div style={styles.inputContainer}>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              style={{
                flex: 1,
                border: '1px solid #E5E5E5',
                borderRadius: '24px',
                padding: '12px 16px',
                fontSize: '15px',
                color: '#000',
                WebkitTextFillColor: '#000',
                caretColor: '#000',
                outline: 'none',
                backgroundColor: '#fff',
              }}
              placeholder={
                isAwaitingConfirmation
                  ? 'กรุณายืนยันหรือแก้ไขข้อมูลด้านบน...'
                  : 'พิมพ์ข้อความ...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
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
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    caretColor: '#000 !important',
    outline: 'none',
    backgroundColor: '#F8F9FA !important',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
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

  // Quick Form Toggle
  quickFormToggle: {
    margin: '8px 16px 0',
    padding: '10px 16px',
    backgroundColor: '#F0EEFC',
    color: '#7F77DD',
    border: '1px solid #7F77DD',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
};

// API Key Input Styles
const apiKeyStyles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    margin: '12px 16px',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#4CAF50',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerIcon: {
    fontSize: '18px',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: '15px',
  },
  content: {
    padding: '16px',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #4CAF50',
    fontSize: '14px',
    fontFamily: 'monospace',
    color: '#333',  // <-- สีตัวหนังสือเข้ม
    backgroundColor: '#fff',  // <-- พื้นหลังขาว
    boxSizing: 'border-box' as const,
    marginBottom: '12px',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  saveButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    minWidth: '80px',
  },
  clearButton: {
    padding: '10px 16px',
    backgroundColor: '#FF5722',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '10px 16px',
    backgroundColor: '#F0F0F0',
    color: '#666',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  help: {
    margin: '12px 0 0 0',
    fontSize: '12px',
    color: '#666',
    textAlign: 'center' as const,
  },
  link: {
    color: '#7F77DD',
    textDecoration: 'underline',
  },
};

// Add keyframes for typing animation via CSS-in-JS
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes typingBounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
  
  /* FORCE black text on all inputs - override dark mode */
  input[type="text"] {
    color: #000 !important;
    -webkit-text-fill-color: #000 !important;
    background-color: #fff !important;
  }
  
  input::placeholder {
    color: #999 !important;
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(styleSheet);
}