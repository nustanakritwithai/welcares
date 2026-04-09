/**
 * Intake Agent - Demo Component (MVP)
 * React component สำหรับทดสอบ Intake Agent
 * 
 * @version 1.0
 * @module src/agents/intake/demo/IntakeAgentDemo
 */

import React from 'react';
import { useIntakeAgent } from '../useIntakeAgent';
import type { 
  ServiceType, 
  MobilityLevel, 
  RelationshipType, 
  TimeFlexibility,
  UrgencyLevel,
  AppointmentType 
} from '../schema';

// ============================================================================
// CONSTANTS
// ============================================================================

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'hospital-visit', label: 'พบแพทย์นอก' },
  { value: 'follow-up', label: 'ติดตามอาการ' },
  { value: 'physical-therapy', label: 'กายภาพบำบัด' },
  { value: 'dialysis', label: 'ล้างไต' },
  { value: 'chemotherapy', label: 'เคมีบำบัด' },
  { value: 'radiation', label: 'รังสีรักษา' },
  { value: 'checkup', label: 'ตรวจสุขภาพ' },
  { value: 'vaccination', label: 'ฉีดวัคซีน' },
  { value: 'other', label: 'อื่นๆ' },
];

const MOBILITY_LEVELS: { value: MobilityLevel; label: string }[] = [
  { value: 'independent', label: 'เดินได้เอง' },
  { value: 'assisted', label: 'ต้องช่วยพยุง' },
  { value: 'wheelchair', label: 'ใช้รถเข็น' },
  { value: 'bedridden', label: 'ติดเตียง' },
];

const RELATIONSHIPS: { value: RelationshipType; label: string }[] = [
  { value: 'daughter', label: 'ลูกสาว' },
  { value: 'son', label: 'ลูกชาย' },
  { value: 'spouse', label: 'คู่สมรส' },
  { value: 'parent', label: 'พ่อแม่' },
  { value: 'sibling', label: 'พี่น้อง' },
  { value: 'relative', label: 'ญาติ' },
  { value: 'friend', label: 'เพื่อน' },
  { value: 'self', label: 'ตนเอง' },
  { value: 'other', label: 'อื่นๆ' },
];

const TIME_FLEXIBILITY: { value: TimeFlexibility; label: string }[] = [
  { value: 'strict', label: 'ตรงเวลา' },
  { value: '30min', label: 'ยืดหยุ่น ±30 นาที' },
  { value: '1hour', label: 'ยืดหยุ่น ±1 ชั่วโมง' },
  { value: 'anytime', label: 'ยืดหยุ่นได้ทั้งวัน' },
];

const URGENCY_LEVELS: { value: UrgencyLevel; label: string }[] = [
  { value: 'low', label: 'ปกติ' },
  { value: 'normal', label: '1-2 วัน' },
  { value: 'high', label: 'พรุ่งนี้' },
  { value: 'urgent', label: 'วันนี้/ฉุกเฉิน' },
];

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: 'new', label: 'นัดใหม่' },
  { value: 'follow-up', label: 'ติดตามอาการ' },
  { value: 'procedure', label: 'ทำหัตถการ' },
  { value: 'emergency', label: 'ฉุกเฉิน' },
];

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #e5e7eb',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    gap: '24px',
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 16px 0',
    paddingBottom: '8px',
    borderBottom: '1px solid #f3f4f6',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  required: {
    color: '#dc2626',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  checkboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  statusTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 12px 0',
  },
  progressContainer: {
    marginBottom: '16px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: (percentage: number) => ({
    width: `${percentage}%`,
    height: '100%',
    backgroundColor: percentage === 100 ? '#10b981' : percentage >= 70 ? '#3b82f6' : '#f59e0b',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  }),
  progressText: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    textAlign: 'right',
  },
  missingList: {
    margin: '0',
    paddingLeft: '16px',
    fontSize: '13px',
    color: '#dc2626',
  },
  missingItem: {
    marginBottom: '4px',
  },
  nextQuestion: {
    backgroundColor: '#eff6ff',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
  },
  nextQuestionLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1d4ed8',
    margin: '0 0 4px 0',
  },
  nextQuestionText: {
    fontSize: '14px',
    color: '#1e40af',
    margin: 0,
  },
  previewCard: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #10b981',
    borderRadius: '8px',
    padding: '16px',
  },
  previewTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#047857',
    margin: '0 0 12px 0',
  },
  previewSection: {
    marginBottom: '12px',
  },
  previewLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    margin: '0 0 4px 0',
  },
  previewValue: {
    fontSize: '13px',
    color: '#111827',
    margin: 0,
  },
  costBreakdown: {
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '8px',
  },
  costRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '4px',
  },
  costLabel: {
    color: '#6b7280',
  },
  costValue: {
    color: '#111827',
    fontWeight: '500',
  },
  costTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    fontWeight: '600',
    borderTop: '1px solid #e5e7eb',
    paddingTop: '8px',
    marginTop: '8px',
  },
  badge: (color: string) => ({
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: color,
    color: '#ffffff',
  }),
  actionButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  submitButton: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  resetButton: {
    padding: '12px 24px',
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #ffffff',
    borderTop: '2px solid transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorMessage: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    color: '#dc2626',
    fontSize: '13px',
  },
  successMessage: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    color: '#15803d',
    fontSize: '13px',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatFieldName(field: string): string {
  const fieldLabels: Record<string, string> = {
    'contact.contactName': 'ชื่อผู้ติดต่อ',
    'contact.contactPhone': 'เบอร์โทรติดต่อ',
    'contact.relationship': 'ความสัมพันธ์',
    'service.serviceType': 'ประเภทบริการ',
    'service.department': 'แผนก/คลินิก',
    'service.doctorName': 'ชื่อแพทย์',
    'service.appointmentType': 'ประเภทการนัด',
    'schedule.appointmentDate': 'วันนัด',
    'schedule.appointmentTime': 'เวลานัด',
    'schedule.timeFlexibility': 'ความยืดหยุ่นเวลา',
    'locations.pickup.address': 'ที่อยู่จุดรับ',
    'locations.pickup.buildingName': 'อาคาร/คอนโด',
    'locations.pickup.floor': 'ชั้น',
    'locations.pickup.roomNumber': 'ห้อง',
    'locations.dropoff.address': 'ที่อยู่จุดส่ง',
    'locations.dropoff.name': 'ชื่อสถานที่',
    'locations.dropoff.department': 'แผนก',
    'patient.name': 'ชื่อผู้ป่วย',
    'patient.age': 'อายุ',
    'patient.mobilityLevel': 'ระดับการเคลื่อนไหว',
    'patient.needsEscort': 'ต้องการผู้พา',
    'patient.needsWheelchair': 'ใช้รถเข็น',
    'patient.oxygenRequired': 'ต้องการออกซิเจน',
    'patient.stretcherRequired': 'ใช้เปล',
    'patient.conditions': 'โรคประจำตัว',
    'urgencyLevel': 'ระดับความเร่งด่วน',
  };
  return fieldLabels[field] || field;
}

function getComplexityColor(complexity: string): string {
  switch (complexity) {
    case 'simple': return '#10b981';
    case 'moderate': return '#3b82f6';
    case 'complex': return '#f59e0b';
    case 'critical': return '#dc2626';
    default: return '#6b7280';
  }
}

function getComplexityLabel(complexity: string): string {
  switch (complexity) {
    case 'simple': return 'ง่าย';
    case 'moderate': return 'ปานกลาง';
    case 'complex': return 'ซับซ้อน';
    case 'critical': return 'วิกฤติ';
    default: return complexity;
  }
}

function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'sedan': return 'รถเก๋ง';
    case 'mpv': return 'รถตู้';
    case 'wheelchair-van': return 'รถเข็น';
    case 'ambulance': return 'รถพยาบาล';
    default: return type;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function IntakeAgentDemo(): JSX.Element {
  const {
    formData,
    isComplete,
    missingFields,
    nextQuestion,
    preview,
    loading,
    error,
    success,
    updateField,
    updateFields,
    submitForm,
    resetForm,
  } = useIntakeAgent();

  // Calculate progress
  const totalFields = 15;
  const completedFields = Math.max(0, totalFields - missingFields.length);
  const progressPercentage = Math.round((completedFields / totalFields) * 100);

  const handleSubmit = async () => {
    await submitForm();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🚑 Intake Agent - Demo</h1>
        <p style={styles.subtitle}>ทดสอบระบบรับข้อมูลการนัดหมาย WelCares</p>
      </div>

      <div style={styles.grid}>
        {/* Form Section */}
        <div style={styles.formSection}>
          {/* Contact Info */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>👤 ข้อมูลผู้ติดต่อ</h2>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ชื่อผู้ติดต่อ <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.contact?.contactName || ''}
                  onChange={(e) => updateField('contact.contactName', e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  เบอร์โทร <span style={styles.required}>*</span>
                </label>
                <input
                  type="tel"
                  style={styles.input}
                  value={formData.contact?.contactPhone || ''}
                  onChange={(e) => updateField('contact.contactPhone', e.target.value)}
                  placeholder="0xx-xxx-xxxx"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ความสัมพันธ์ <span style={styles.required}>*</span>
                </label>
                <select
                  style={styles.select}
                  value={formData.contact?.relationship || ''}
                  onChange={(e) => updateField('contact.relationship', e.target.value)}
                >
                  <option value="">-- เลือก --</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>อีเมล</label>
                <input
                  type="email"
                  style={styles.input}
                  value={formData.contact?.contactEmail || ''}
                  onChange={(e) => updateField('contact.contactEmail', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>

          {/* Service Info */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏥 ข้อมูลบริการ</h2>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ประเภทบริการ <span style={styles.required}>*</span>
                </label>
                <select
                  style={styles.select}
                  value={formData.service?.serviceType || ''}
                  onChange={(e) => updateField('service.serviceType', e.target.value)}
                >
                  <option value="">-- เลือก --</option>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ประเภทการนัด <span style={styles.required}>*</span>
                </label>
                <select
                  style={styles.select}
                  value={formData.service?.appointmentType || ''}
                  onChange={(e) => updateField('service.appointmentType', e.target.value)}
                >
                  <option value="">-- เลือก --</option>
                  {APPOINTMENT_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>แผนก/คลินิก</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.service?.department || ''}
                  onChange={(e) => updateField('service.department', e.target.value)}
                  placeholder="เช่น อายุรกรรม"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>ชื่อแพทย์</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.service?.doctorName || ''}
                  onChange={(e) => updateField('service.doctorName', e.target.value)}
                  placeholder="ชื่อแพทย์ (ถ้าทราบ)"
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📅 กำหนดการ</h2>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  วันนัด <span style={styles.required}>*</span>
                </label>
                <input
                  type="date"
                  style={styles.input}
                  value={formData.schedule?.appointmentDate || ''}
                  onChange={(e) => updateField('schedule.appointmentDate', e.target.value)}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  เวลา <span style={styles.required}>*</span>
                </label>
                <input
                  type="time"
                  style={styles.input}
                  value={formData.schedule?.appointmentTime || ''}
                  onChange={(e) => updateField('schedule.appointmentTime', e.target.value)}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ความยืดหยุ่น <span style={styles.required}>*</span>
                </label>
                <select
                  style={styles.select}
                  value={formData.schedule?.timeFlexibility || ''}
                  onChange={(e) => updateField('schedule.timeFlexibility', e.target.value)}
                >
                  <option value="">-- เลือก --</option>
                  {TIME_FLEXIBILITY.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>ระดับความเร่งด่วน</label>
                <select
                  style={styles.select}
                  value={formData.urgencyLevel || ''}
                  onChange={(e) => updateField('urgencyLevel', e.target.value)}
                >
                  <option value="">-- เลือก --</option>
                  {URGENCY_LEVELS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pickup Location */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📍 จุดรับ</h2>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ที่อยู่ <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.locations?.pickup?.address || ''}
                  onChange={(e) => updateField('locations.pickup.address', e.target.value)}
                  placeholder="บ้านเลขที่ ถนน ซอย"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>อาคาร/คอนโด</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.locations?.pickup?.buildingName || ''}
                  onChange={(e) => updateField('locations.pickup.buildingName', e.target.value)}
                  placeholder="ชื่ออาคาร"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>ชั้น</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.locations?.pickup?.floor || ''}
                  onChange={(e) => updateField('locations.pickup.floor', e.target.value)}
                  placeholder="เช่น 5"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>ห้อง</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.locations?.pickup?.roomNumber || ''}
                  onChange={(e) => updateField('locations.pickup.roomNumber', e.target.value)}
                  placeholder="เช่น 512"
                />
              </div>
            </div>
          </div>

          {/* Dropoff Location */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏥 จุดส่ง</h2>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ที่อยู่ <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.locations?.dropoff?.address || ''}
                  onChange={(e) => updateField('locations.dropoff.address', e.target.value)}
                  placeholder="ชื่อโรงพยาบาล หรือ ที่อยู่"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>ชื่อสถานที่</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.locations?.dropoff?.name || ''}
                  onChange={(e) => updateField('locations.dropoff.name', e.target.value)}
                  placeholder="ชื่อโรงพยาบาล/คลินิก"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>แผนก (สำหรับ รพ.)</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.locations?.dropoff?.department || ''}
                  onChange={(e) => updateField('locations.dropoff.department', e.target.value)}
                  placeholder="เช่น ตึก A"
                />
              </div>
            </div>
          </div>

          {/* Patient Info */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🧑‍🦽 ข้อมูลผู้ป่วย</h2>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ชื่อผู้ป่วย <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.patient?.name || ''}
                  onChange={(e) => updateField('patient.name', e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>อายุ</label>
                <input
                  type="number"
                  style={styles.input}
                  value={formData.patient?.age || ''}
                  onChange={(e) => updateField('patient.age', parseInt(e.target.value) || 0)}
                  placeholder="ปี"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  ระดับการเคลื่อนไหว <span style={styles.required}>*</span>
                </label>
                <select
                  style={styles.select}
                  value={formData.patient?.mobilityLevel || ''}
                  onChange={(e) => updateField('patient.mobilityLevel', e.target.value)}
                >
                  <option value="">-- เลือก --</option>
                  {MOBILITY_LEVELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>น้ำหนัก (kg)</label>
                <input
                  type="number"
                  style={styles.input}
                  value={formData.patient?.weight || ''}
                  onChange={(e) => updateField('patient.weight', parseInt(e.target.value) || 0)}
                  placeholder="กิโลกรัม"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>โรคประจำตัว</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.patient?.conditions?.join(', ') || ''}
                  onChange={(e) => updateField('patient.conditions', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="เช่น เบาหวาน, ความดัน"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>แพ้ยา/อาหาร</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.patient?.allergies?.join(', ') || ''}
                  onChange={(e) => updateField('patient.allergies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="เช่น แพ้ penicillin"
                />
              </div>
            </div>

            {/* Patient Checkboxes */}
            <div style={{ ...styles.checkboxGroup, marginTop: '16px' }}>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.patient?.needsEscort || false}
                  onChange={(e) => updateField('patient.needsEscort', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>ต้องการผู้พาไปด้วย</span>
              </label>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.patient?.needsWheelchair || false}
                  onChange={(e) => updateField('patient.needsWheelchair', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>ใช้รถเข็น</span>
              </label>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.patient?.oxygenRequired || false}
                  onChange={(e) => updateField('patient.oxygenRequired', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>ต้องการออกซิเจน</span>
              </label>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.patient?.stretcherRequired || false}
                  onChange={(e) => updateField('patient.stretcherRequired', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>ใช้เปลนอน</span>
              </label>
            </div>
          </div>

          {/* Add-ons */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>➕ บริการเสริม</h2>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.addons?.medicinePickup || false}
                  onChange={(e) => updateField('addons.medicinePickup', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>รับยากลับบ้าน</span>
              </label>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.addons?.homeCare || false}
                  onChange={(e) => updateField('addons.homeCare', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>ดูแลต่อที่บ้าน</span>
              </label>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.addons?.mealService || false}
                  onChange={(e) => updateField('addons.mealService', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>จัดอาหาร</span>
              </label>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.addons?.interpretation || false}
                  onChange={(e) => updateField('addons.interpretation', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>ล่าม/ตีความ</span>
              </label>
              <label style={styles.checkboxItem}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={formData.addons?.accompanyInside || false}
                  onChange={(e) => updateField('addons.accompanyInside', e.target.checked)}
                />
                <span style={styles.checkboxLabel}>พี่เลี้ยงเข้าไปด้วยใน รพ.</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📝 หมายเหตุ</h2>
            <div style={styles.formGroup}>
              <textarea
                style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                value={formData.specialNotes || ''}
                onChange={(e) => updateField('specialNotes', e.target.value)}
                placeholder="ข้อมูลเพิ่มเติมที่ต้องการแจ้ง"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={styles.actionButtons}>
            <button
              style={{
                ...styles.submitButton,
                ...(loading || !isComplete ? styles.submitButtonDisabled : {}),
              }}
              onClick={handleSubmit}
              disabled={loading || !isComplete}
            >
              {loading ? (
                <>
                  <span style={styles.spinner} />
                  กำลังส่ง...
                </>
              ) : (
                <>ยืนยันการจอง</>
              )}
            </button>
            <button style={styles.resetButton} onClick={resetForm}>
              ล้างฟอร์ม
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div style={styles.errorMessage}>
              ❌ {error}
            </div>
          )}
          {success && (
            <div style={styles.successMessage}>
              ✅ ส่งข้อมูลสำเร็จ! Job ID: {preview?.jobId}
            </div>
          )}
        </div>

        {/* Sidebar - Validation Status */}
        <div style={styles.sidebar}>
          {/* Progress Card */}
          <div style={styles.statusCard}>
            <h3 style={styles.statusTitle}>📊 ความคืบหน้า</h3>
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div style={styles.progressFill(progressPercentage)} />
              </div>
              <p style={styles.progressText}>
                {completedFields} / {totalFields} fields ({progressPercentage}%)
              </p>
            </div>

            {missingFields.length > 0 && (
              <>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '12px 0 8px 0' }}>
                  ข้อมูลที่ยังขาด:
                </p>
                <ul style={styles.missingList}>
                  {missingFields.slice(0, 5).map((field) => (
                    <li key={field} style={styles.missingItem}>
                      {formatFieldName(field)}
                    </li>
                  ))}
                  {missingFields.length > 5 && (
                    <li style={styles.missingItem}>...และอีก {missingFields.length - 5} รายการ</li>
                  )}
                </ul>
              </>
            )}

            {nextQuestion && (
              <div style={styles.nextQuestion}>
                <p style={styles.nextQuestionLabel}>คำถามถัดไป:</p>
                <p style={styles.nextQuestionText}>{nextQuestion.question}</p>
              </div>
            )}

            {isComplete && (
              <div style={{ ...styles.nextQuestion, backgroundColor: '#f0fdf4', borderColor: '#10b981' }}>
                <p style={{ ...styles.nextQuestionLabel, color: '#047857' }}>
                  ✅ ข้อมูลครบถ้วนแล้ว!
                </p>
                <p style={{ ...styles.nextQuestionText, color: '#065f46' }}>
                  สามารถยืนยันการจองได้
                </p>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {isComplete && preview && (
            <div style={styles.previewCard}>
              <h3 style={styles.previewTitle}>👁️ ตัวอย่าง Job Spec</h3>

              <div style={styles.previewSection}>
                <p style={styles.previewLabel}>Job ID</p>
                <p style={styles.previewValue}>{preview.jobId}</p>
              </div>

              <div style={styles.previewSection}>
                <p style={styles.previewLabel}>ความซับซ้อน</p>
                <p style={styles.previewValue}>
                  <span style={styles.badge(getComplexityColor(preview.assessment.complexity))}>
                    {getComplexityLabel(preview.assessment.complexity)}
                  </span>
                </p>
              </div>

              <div style={styles.previewSection}>
                <p style={styles.previewLabel}>ยานพาหนะ</p>
                <p style={styles.previewValue}>
                  {getVehicleTypeLabel(preview.assessment.resources.vehicleType)}
                </p>
              </div>

              <div style={styles.previewSection}>
                <p style={styles.previewLabel}>ระยะทางประมาณ</p>
                <p style={styles.previewValue}>
                  {preview.locations.estimatedDistance?.toFixed(1)} km
                  {' '}
                  ({preview.locations.estimatedDuration} นาที)
                </p>
              </div>

              <div style={styles.previewSection}>
                <p style={styles.previewLabel}>ค่าใช้จ่ายประมาณ</p>
                <div style={styles.costBreakdown}>
                  <div style={styles.costRow}>
                    <span style={styles.costLabel}>ค่าบริการพื้นฐาน</span>
                    <span style={styles.costValue}>
                      ฿{preview.assessment.estimatedCost.base.toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.costRow}>
                    <span style={styles.costLabel}>ค่าระยะทาง</span>
                    <span style={styles.costValue}>
                      ฿{preview.assessment.estimatedCost.distance.toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.costRow}>
                    <span style={styles.costLabel}>ค่าพี่เลี้ยง</span>
                    <span style={styles.costValue}>
                      ฿{preview.assessment.estimatedCost.duration.toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.costRow}>
                    <span style={styles.costLabel}>บริการเสริม</span>
                    <span style={styles.costValue}>
                      ฿{preview.assessment.estimatedCost.addons.toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.costTotal}>
                    <span>รวมทั้งสิ้น</span>
                    <span>฿{preview.assessment.estimatedCost.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div style={styles.previewSection}>
                <p style={styles.previewLabel}>Flags</p>
                <p style={styles.previewValue}>
                  {preview.notes.flags.map((flag) => (
                    <span key={flag} style={{ ...styles.badge('#6b7280'), marginRight: '4px' }}>
                      {flag}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default IntakeAgentDemo;
