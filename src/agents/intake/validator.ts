/**
 * Intake Agent - Validation Engine
 * ตรวจสอบข้อมูลว่าครบถ้วนหรือไม่ และสร้างคำถามติดตามที่สั้นและตรงประเด็น
 */

import type {
  IntakeFormData,
  ValidationResult,
  ValidationError,
  FollowUpQuestion,
  ServiceType,
  UrgencyLevel,
} from './types';

// ==================== VALIDATION RULES ====================

const REQUIRED_FIELDS: (keyof IntakeFormData)[] = [
  'serviceType',
  'appointmentDate',
  'appointmentTime',
  'pickupLocation',
  'dropoffLocation',
  'patientNeedsEscort',
  'needsWheelchair',
];

const CONDITIONAL_FIELDS: Record<string, (keyof IntakeFormData)[]> = {
  'needsMedicinePickup': ['patientNeedsEscort'],
  'needsHomeCare': ['patientNeedsEscort'],
};

// ==================== QUESTION TEMPLATES ====================

const QUESTIONS: Record<keyof IntakeFormData, Omit<FollowUpQuestion, 'field'>> = {
  serviceType: {
    question: 'ต้องการบริการอะไรครับ?',
    type: 'choice',
    options: [
      'พบแพทย์นอก',
      'ติดตามอาการ',
      'กายภาพบำบัด',
      'ล้างไต',
      'เคมีบำบัด',
      'ตรวจสุขภาพ',
      'อื่นๆ',
    ],
    required: true,
  },
  appointmentDate: {
    question: 'นัดวันไหนครับ?',
    type: 'date',
    required: true,
  },
  appointmentTime: {
    question: 'กี่โมงครับ?',
    type: 'time',
    required: true,
  },
  pickupLocation: {
    question: 'รับจากที่ไหนครับ?',
    type: 'text',
    required: true,
  },
  dropoffLocation: {
    question: 'ไปที่ไหนครับ?',
    type: 'text',
    required: true,
  },
  patientNeedsEscort: {
    question: 'ต้องมีคนพาผู้ป่วยไหมครับ?',
    type: 'boolean',
    required: true,
  },
  needsWheelchair: {
    question: 'ต้องใช้รถเข็นไหมครับ?',
    type: 'boolean',
    required: true,
  },
  needsMedicinePickup: {
    question: 'ต้องรับยากลับบ้านไหมครับ?',
    type: 'boolean',
    required: false,
  },
  needsHomeCare: {
    question: 'ต้องดูแลต่อที่บ้านไหมครับ?',
    type: 'boolean',
    required: false,
  },
  specialNotes: {
    question: 'มีอะไรเพิ่มเติมไหมครับ?',
    type: 'text',
    required: false,
  },
  urgency: {
    question: 'เร่งด่วนแค่ไหนครับ?',
    type: 'choice',
    options: ['ปกติ', 'พรุ่งนี้', 'วันนี้', 'ฉุกเฉิน'],
    required: true,
  },
};

// ==================== VALIDATION ENGINE ====================

export class IntakeValidator {
  
  /**
   * ตรวจสอบข้อมูลแบบเต็มรูปแบบ
   */
  static validate(formData: Partial<IntakeFormData>): ValidationResult {
    const errors: ValidationError[] = [];
    const missingFields: string[] = [];
    const followUpQuestions: FollowUpQuestion[] = [];

    // ตรวจ required fields
    for (const field of REQUIRED_FIELDS) {
      const value = formData[field];
      
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
        followUpQuestions.push({
          field,
          ...QUESTIONS[field],
        });
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // ตรวจ nested object (location)
        if (Object.values(value).every(v => !v)) {
          missingFields.push(field);
          followUpQuestions.push({
            field,
            ...QUESTIONS[field],
          });
        }
      }
    }

    // ตรวจ conditional fields
    for (const [conditionField, dependentFields] of Object.entries(CONDITIONAL_FIELDS)) {
      const condition = formData[conditionField as keyof IntakeFormData];
      if (condition === true) {
        for (const depField of dependentFields) {
          if (!formData[depField]) {
            errors.push({
              field: depField,
              message: `ต้องระบุ ${QUESTIONS[depField].question} ก่อนที่จะเลือก ${QUESTIONS[conditionField as keyof IntakeFormData].question}`,
              severity: 'warning',
            });
          }
        }
      }
    }

    // ตรวจความสมเหตุสมผลของเวลา
    if (formData.appointmentDate && formData.appointmentTime) {
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
      const now = new Date();
      
      if (appointmentDateTime < now) {
        errors.push({
          field: 'appointmentDate',
          message: 'ไม่สามารถนัดเวลาที่ผ่านมาแล้วได้',
          severity: 'error',
        });
      }
      
      // เตือนถ้านัดเร่งด่วนเกินไป
      const hoursUntil = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil < 2 && formData.urgency !== 'urgent') {
        followUpQuestions.push({
          field: 'urgency',
          question: 'นัดใกล้มาก ควรระบุเป็นเร่งด่วนไหมครับ?',
          type: 'boolean',
          required: false,
        });
      }
    }

    // ตรวจสถานที่ pickup/dropoff ไม่ซ้ำกัน
    if (formData.pickupLocation?.address && formData.dropoffLocation?.address) {
      if (formData.pickupLocation.address === formData.dropoffLocation.address) {
        errors.push({
          field: 'dropoffLocation',
          message: 'จุดรับและจุดส่งต้องไม่เป็นที่เดียวกัน',
          severity: 'error',
        });
      }
    }

    const isComplete = missingFields.length === 0 && errors.filter(e => e.severity === 'error').length === 0;
    const isValid = errors.filter(e => e.severity === 'error').length === 0;

    return {
      isValid,
      isComplete,
      errors,
      missingFields,
      followUpQuestions,
    };
  }

  /**
   * ตรวจสอบแบบเร็ว (real-time validation)
   */
  static quickValidate(field: keyof IntakeFormData, value: unknown): ValidationError | null {
    switch (field) {
      case 'appointmentDate':
        if (typeof value === 'string') {
          const date = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (date < today) {
            return {
              field,
              message: 'กรุณาเลือกวันที่ตั้งแต่วันนี้เป็นต้นไป',
              severity: 'error',
            };
          }
        }
        break;
        
      case 'appointmentTime':
        if (typeof value === 'string') {
          const [hours, minutes] = value.split(':').map(Number);
          if (hours < 6 || hours > 20) {
            return {
              field,
              message: 'บริการเปิดให้จองระหว่าง 06:00 - 20:00',
              severity: 'warning',
            };
          }
        }
        break;
        
      case 'pickupLocation':
      case 'dropoffLocation':
        if (typeof value === 'object' && value !== null) {
          const loc = value as { address?: string; contactPhone?: string };
          if (loc.address && loc.address.length < 10) {
            return {
              field,
              message: 'กรุณาระบุที่อยู่ให้ละเอียดกว่านี้',
              severity: 'warning',
            };
          }
          if (loc.contactPhone && !/^0[0-9]{8,9}$/.test(loc.contactPhone)) {
            return {
              field,
              message: 'เบอร์โทรไม่ถูกต้อง',
              severity: 'error',
            };
          }
        }
        break;
    }
    
    return null;
  }

  /**
   * สร้างคำถามติดตามที่เหมาะสม
   */
  static generateNextQuestion(formData: Partial<IntakeFormData>): FollowUpQuestion | null {
    const validation = this.validate(formData);
    
    if (validation.followUpQuestions.length === 0) {
      return null;
    }

    // เรียงลำดับความสำคัญ
    const priority = [
      'serviceType',
      'appointmentDate',
      'appointmentTime',
      'pickupLocation',
      'dropoffLocation',
      'patientNeedsEscort',
      'needsWheelchair',
      'needsMedicinePickup',
      'needsHomeCare',
    ];

    const sorted = validation.followUpQuestions.sort((a, b) => {
      return priority.indexOf(a.field) - priority.indexOf(b.field);
    });

    return sorted[0];
  }

  /**
   * สรุปสถานะความสมบูรณ์ของข้อมูล
   */
  static getProgress(formData: Partial<IntakeFormData>): {
    total: number;
    completed: number;
    percentage: number;
    nextStep?: string;
  } {
    const total = REQUIRED_FIELDS.length;
    let completed = 0;

    for (const field of REQUIRED_FIELDS) {
      const value = formData[field];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'object') {
          if (Object.values(value).some(v => v)) {
            completed++;
          }
        } else {
          completed++;
        }
      }
    }

    const nextQuestion = this.generateNextQuestion(formData);

    return {
      total,
      completed,
      percentage: Math.round((completed / total) * 100),
      nextStep: nextQuestion?.question,
    };
  }
}

export default IntakeValidator;
