/**
 * Intake Agent - Schema Definitions
 * Source of Truth สำหรับ Input/Output และ Validation Rules
 * 
 * @version 1.0
 * @see docs/agents/intake-schema.md สำหรับรายละเอียดเต็ม
 */

// ==================== A. INPUT SCHEMA ====================

/**
 * A.1 Contact Info - ข้อมูลผู้ติดต่อ
 * Required: contactName, contactPhone
 */
export interface ContactInfo {
  contactName: string;           // 🔴 Required - ชื่อผู้ติดต่อหลัก
  contactPhone: string;          // 🔴 Required - เบอร์โทรติดต่อ
  contactEmail?: string;         // Optional - อีเมล
  lineUserId?: string;           // Optional - LINE User ID
  relationship: RelationshipType; // 🔴 Required - ความสัมพันธ์กับผู้ป่วย
}

export type RelationshipType = 
  | 'daughter' 
  | 'son' 
  | 'spouse' 
  | 'parent'
  | 'sibling'
  | 'relative'
  | 'friend'
  | 'self'
  | 'other';

/**
 * A.2 Service Type - ประเภทบริการ
 * Required: serviceType
 */
export interface ServiceInfo {
  serviceType: ServiceType;      // 🔴 Required - ประเภทบริการหลัก
  serviceSubType?: string;       // Optional - รายละเอียดเพิ่มเติม
  department?: string;           // Conditional - แผนก/คลินิก
  doctorName?: string;           // Optional - ชื่อแพทย์
  appointmentType: AppointmentType; // 🔴 Required
}

export type ServiceType =
  | 'hospital-visit'      // พบแพทย์นอก
  | 'follow-up'           // ติดตามอาการ
  | 'physical-therapy'    // กายภาพบำบัด
  | 'dialysis'            // ล้างไต
  | 'chemotherapy'        // เคมีบำบัด
  | 'radiation'           // รังสีรักษา
  | 'checkup'             // ตรวจสุขภาพ
  | 'vaccination'         // ฉีดวัคซีน
  | 'other';              // อื่นๆ

export type AppointmentType = 'new' | 'follow-up' | 'procedure' | 'emergency';

/**
 * A.3 Schedule - วันและเวลา
 * Required: appointmentDate, appointmentTime
 */
export interface ScheduleInfo {
  appointmentDate: string;       // 🔴 Required - YYYY-MM-DD
  appointmentTime: string;       // 🔴 Required - HH:mm
  timeFlexibility: TimeFlexibility; // 🔴 Required
  duration?: number;             // Optional - นาที
}

export type TimeFlexibility = 'strict' | '30min' | '1hour' | 'anytime';
export type UrgencyLevel = 'low' | 'normal' | 'high' | 'urgent';

/**
 * A.4 Location - สถานที่
 * Required: address, contactName, contactPhone
 */
export interface LocationInfo {
  address: string;               // 🔴 Required - ที่อยู่เต็ม
  lat?: number;                  // Optional - พิกัด
  lng?: number;                  // Optional - พิกัด
  contactName: string;           // 🔴 Required - ชื่อผู้ติดต่อ
  contactPhone: string;          // 🔴 Required - เบอร์โทร
  buildingName?: string;         // Optional - ชื่ออาคาร/คอนโด
  floor?: string;                // Conditional - ชั้น
  roomNumber?: string;           // Conditional - ห้อง
  landmarks?: string;            // Optional - จุดสังเกต
  parkingNote?: string;          // Optional - ข้อมูลที่จอดรถ
  // Dropoff specific
  name?: string;                 // Optional - ชื่อสถานที่ (สำหรับ dropoff)
  department?: string;           // Conditional - แผนก (สำหรับ dropoff)
}

export interface LocationsInput {
  pickup: LocationInfo;          // 🔴 Required
  dropoff: LocationInfo;         // 🔴 Required
}

/**
 * A.5 Patient Info - ข้อมูลผู้ป่วย
 * Required: name, mobilityLevel
 */
export interface PatientInfo {
  name: string;                  // 🔴 Required - ชื่อผู้ป่วย
  age?: number;                  // Optional - อายุ
  gender?: 'female' | 'male' | 'other'; // Optional
  weight?: number;               // Optional - kg
  mobilityLevel: MobilityLevel;  // 🔴 Required
  needsEscort: boolean;          // 🔴 Required
  needsWheelchair: boolean;      // 🔴 Required
  oxygenRequired: boolean;       // 🔴 Required
  stretcherRequired: boolean;    // 🔴 Required
  conditions: string[];          // Optional - โรคประจำตัว
  allergies: string[];           // Optional - แพ้ยา/อาหาร
  medications: string[];         // Optional - ยาประจำ
}

export type MobilityLevel = 
  | 'independent'    // เดินได้เอง
  | 'assisted'       // ต้องช่วยพยุง
  | 'wheelchair'     // ใช้รถเข็น
  | 'bedridden';     // ติดเตียง

/**
 * A.6 Special Requirements - ความต้องการพิเศษ
 * All Optional
 */
export interface AddonsInfo {
  medicinePickup: boolean;       // รับยากลับบ้าน
  homeCare: boolean;             // ดูแลต่อที่บ้าน
  mealService: boolean;          // จัดอาหาร
  interpretation: boolean;       // ล่าม/ตีความ
  accompanyInside: boolean;      // พี่เลี้ยงเข้าไปด้วยใน รพ.
}

/**
 * Complete Input Schema
 */
export interface IntakeInput {
  contact: ContactInfo;
  service: ServiceInfo;
  schedule: ScheduleInfo;
  locations: LocationsInput;
  patient: PatientInfo;
  addons: AddonsInfo;
  specialNotes?: string;
  urgencyLevel: UrgencyLevel;
}

// ==================== B. OUTPUT SCHEMA (Job Spec) ====================

export interface JobSpec {
  // B.1 Metadata
  jobId: string;
  version: string;
  createdAt: string;             // ISO 8601
  status: JobStatus;
  source: 'web' | 'line' | 'phone' | 'app';
  sessionId: string;

  // B.2 Service Details
  service: JobServiceDetails;

  // B.3 Schedule
  schedule: JobScheduleDetails;

  // B.4 Locations
  locations: JobLocations;

  // B.5 Contact
  contact: JobContact;

  // B.6 Patient
  patient: JobPatient;

  // B.7 Add-ons
  addons: JobAddons;

  // B.8 Assessment
  assessment: JobAssessment;

  // B.9 Notes
  notes: JobNotes;
}

export type JobStatus = 'draft' | 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';

export interface JobServiceDetails {
  type: ServiceType;
  typeLabel: string;             // ภาษาไทย
  category: 'medical' | 'therapy' | 'checkup' | 'other';
  subType?: string;
  department?: string;
  doctorName?: string;
  priority: 1 | 2 | 3 | 4 | 5;   // 1 = highest
  estimatedDuration: number;     // นาที
}

export interface JobScheduleDetails {
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:mm
  datetime: string;              // ISO 8601
  flexibility: TimeFlexibility;
  estimatedEndTime?: string;     // ISO 8601
}

export interface LocationDetails {
  address: string;
  lat?: number;
  lng?: number;
  contactName: string;
  contactPhone: string;
  buildingName?: string;
  floor?: string;
  roomNumber?: string;
  landmarks?: string;
  parkingNote?: string;
  // Dropoff specific
  name?: string;
  department?: string;
}

export interface JobLocations {
  pickup: LocationDetails;
  dropoff: LocationDetails;
  estimatedDistance?: number;    // km
  estimatedDuration?: number;    // นาที
  routePolyline?: string;        // Encoded polyline
}

export interface JobContact {
  primary: {
    name: string;
    phone: string;
    email?: string;
    lineUserId?: string;
  };
  relationship: RelationshipType;
  emergency?: {
    name: string;
    phone: string;
  };
}

export interface JobPatient {
  name: string;
  age?: number;
  gender?: 'female' | 'male' | 'other';
  weight?: number;
  mobilityLevel: MobilityLevel;
  needsEscort: boolean;
  needsWheelchair: boolean;
  oxygenRequired: boolean;
  stretcherRequired: boolean;
  conditions: string[];
  allergies: string[];
  medications: string[];
  specialAccommodations: string[];
}

export interface JobAddons {
  medicinePickup: boolean;
  homeCare: boolean;
  mealService: boolean;
  interpretation: boolean;
  accompanyInside: boolean;
}

export interface CostEstimate {
  base: number;                  // ฿
  distance: number;              // ฿
  duration: number;              // ฿
  addons: number;                // ฿
  total: number;                 // ฿
  currency: 'THB';
}

export interface ResourceRequirements {
  navigatorRequired: boolean;
  navigatorType?: 'PN' | 'RN' | 'CG';  // Practical Nurse / Registered Nurse / Caregiver
  vehicleType: 'sedan' | 'mpv' | 'wheelchair-van' | 'ambulance';
  estimatedNavHours: number;
  specialEquipment: string[];
}

export interface JobAssessment {
  urgencyLevel: UrgencyLevel;
  complexity: 'simple' | 'moderate' | 'complex' | 'critical';
  riskFactors: string[];
  estimatedCost: CostEstimate;
  resources: ResourceRequirements;
}

export interface JobNotes {
  customer: string;
  internal: string;
  flags: string[];               // ["VIP", "URGENT", "WHEELCHAIR"]
}

// ==================== C. VALIDATION SCHEMA ====================

/**
 * Field Validation Rule
 */
export interface FieldRule {
  field: string;
  required: boolean;
  condition?: string;            // Condition for conditional required
  message: string;               // Error/follow-up message
  priority: number;              // 1 = ask first
  validate?: (value: unknown) => boolean;
}

/**
 * Required Fields (ขาดไม่ได้)
 */
export const REQUIRED_FIELDS: FieldRule[] = [
  { field: 'contact.contactName', required: true, message: 'ชื่อผู้ติดต่อครับ?', priority: 1 },
  { field: 'contact.contactPhone', required: true, message: 'เบอร์โทรครับ?', priority: 2 },
  { field: 'service.serviceType', required: true, message: 'ต้องการบริการอะไรครับ?', priority: 3 },
  { field: 'schedule.appointmentDate', required: true, message: 'นัดวันไหนครับ?', priority: 4 },
  { field: 'schedule.appointmentTime', required: true, message: 'กี่โมงครับ?', priority: 5 },
  { field: 'locations.pickup.address', required: true, message: 'รับจากที่ไหนครับ?', priority: 6 },
  { field: 'locations.dropoff.address', required: true, message: 'ไปที่ไหนครับ?', priority: 7 },
  { field: 'patient.name', required: true, message: 'ชื่อผู้ป่วยครับ?', priority: 8 },
];

/**
 * Conditionally Required Fields
 */
export const CONDITIONAL_FIELDS: FieldRule[] = [
  { 
    field: 'patient.needsEscort', 
    required: true, 
    condition: 'patient.mobilityLevel !== independent',
    message: 'ต้องมีคนพาไหมครับ?',
    priority: 9
  },
  { 
    field: 'patient.needsWheelchair', 
    required: true, 
    condition: 'true', // Always ask
    message: 'ใช้รถเข็นไหมครับ?',
    priority: 10
  },
  { 
    field: 'locations.pickup.floor', 
    required: true, 
    condition: 'locations.pickup.buildingName exists',
    message: 'อยู่ชั้นไหนครับ?',
    priority: 11
  },
  { 
    field: 'service.department', 
    required: true, 
    condition: 'service.serviceType === hospital-visit',
    message: 'นัดแผนกไหนครับ?',
    priority: 12
  },
];

/**
 * Optional Fields (ถามเพิ่มได้)
 */
export const OPTIONAL_FIELDS: FieldRule[] = [
  { field: 'patient.age', required: false, message: 'อายุเท่าไหร่ครับ?', priority: 20 },
  { field: 'patient.conditions', required: false, message: 'มีโรคประจำตัวไหมครับ?', priority: 21 },
  { field: 'service.doctorName', required: false, message: 'นัดหมออะไรครับ?', priority: 22 },
  { field: 'addons.medicinePickup', required: false, message: 'ต้องรับยากลับไหมครับ?', priority: 23 },
  { field: 'specialNotes', required: false, message: 'มีอะไรเพิ่มเติมไหมครับ?', priority: 30 },
];

// ==================== D. VALIDATION RESULT ====================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FollowUpQuestion {
  field: string;
  question: string;
  type: 'text' | 'boolean' | 'choice' | 'date' | 'time' | 'number';
  options?: string[];
  required: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: ValidationError[];
  missingFields: string[];
  followUpQuestions: FollowUpQuestion[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

// ==================== E. SERVICE LAYER API ====================

export interface IntakeRequest {
  input: Partial<IntakeInput>;
  sessionId: string;
  previousQuestions?: FollowUpQuestion[];
}

export interface IntakeResponse {
  success: boolean;
  jobSpec?: JobSpec;
  validation?: ValidationResult;
  error?: string;
}

// ==================== F. CONSTANTS ====================

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  'hospital-visit': 'พบแพทย์นอก',
  'follow-up': 'ติดตามอาการ',
  'physical-therapy': 'กายภาพบำบัด',
  'dialysis': 'ล้างไต',
  'chemotherapy': 'เคมีบำบัด',
  'radiation': 'รังสีรักษา',
  'checkup': 'ตรวจสุขภาพ',
  'vaccination': 'ฉีดวัคซีน',
  'other': 'อื่นๆ',
};

export const MOBILITY_LEVEL_LABELS: Record<MobilityLevel, string> = {
  'independent': 'เดินได้เอง',
  'assisted': 'ต้องช่วยพยุง',
  'wheelchair': 'ใช้รถเข็น',
  'bedridden': 'ติดเตียง',
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  'daughter': 'ลูกสาว',
  'son': 'ลูกชาย',
  'spouse': 'คู่สมรส',
  'parent': 'พ่อแม่',
  'sibling': 'พี่น้อง',
  'relative': 'ญาติ',
  'friend': 'เพื่อน',
  'self': 'ตนเอง',
  'other': 'อื่นๆ',
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  'low': 'ปกติ',
  'normal': '1-2 วัน',
  'high': 'พรุ่งนี้',
  'urgent': 'วันนี้/ฉุกเฉิน',
};

// Cost calculation constants
export const COST_RATES = {
  base: 350,                   // ฿
  perKm: 15,                   // ฿/km
  navHourly: 200,              // ฿/hr
  wheelchairExtra: 150,        // ฿
  medicinePickup: 100,         // ฿
  homeCareHourly: 250,         // ฿/hr
};

// Service duration estimates (minutes)
export const SERVICE_DURATIONS: Record<ServiceType, number> = {
  'hospital-visit': 120,
  'follow-up': 60,
  'physical-therapy': 90,
  'dialysis': 240,
  'chemotherapy': 300,
  'radiation': 180,
  'checkup': 180,
  'vaccination': 30,
  'other': 90,
};

// Priority mapping (1 = highest, 5 = lowest)
export const SERVICE_PRIORITY: Record<ServiceType, 1 | 2 | 3 | 4 | 5> = {
  'hospital-visit': 3,
  'follow-up': 3,
  'physical-therapy': 3,
  'dialysis': 2,
  'chemotherapy': 1,
  'radiation': 2,
  'checkup': 4,
  'vaccination': 5,
  'other': 3,
};
