/**
 * Intake Agent - Types & Interfaces
 * กำหนดโครงสร้างข้อมูลสำหรับ Job Specification
 */

// ==================== INPUT TYPES ====================

export interface IntakeFormData {
  // บริการที่ต้องการ
  serviceType: ServiceType | '';
  
  // วันและเวลา
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm
  
  // สถานที่
  pickupLocation: LocationInfo;
  dropoffLocation: LocationInfo;
  
  // ผู้ป่วย
  patientNeedsEscort: boolean | null;
  needsWheelchair: boolean | null;
  
  // บริการเสริม
  needsMedicinePickup: boolean | null;
  needsHomeCare: boolean | null;
  
  // ข้อมูลเพิ่มเติม
  specialNotes: string;
  urgency: UrgencyLevel;
}

export type ServiceType = 
  | 'hospital-visit'      // พบแพทย์นอก
  | 'follow-up'           // ติดตามอาการ
  | 'physical-therapy'    // กายภาพบำบัด
  | 'dialysis'            // ล้างไต
  | 'chemotherapy'        // เคมีบำบัด
  | 'checkup'             // ตรวจสุขภาพ
  | 'other';              // อื่นๆ

export type UrgencyLevel = 
  | 'low'      // นัดล่วงหน้า 3+ วัน
  | 'normal'   // นัดล่วงหน้า 1-2 วัน
  | 'high'     // พรุ่งนี้
  | 'urgent';  // วันนี้ / ฉุกเฉิน

export interface LocationInfo {
  address: string;
  lat?: number;
  lng?: number;
  contactName: string;
  contactPhone: string;
  buildingName?: string;
  floor?: string;
  roomNumber?: string;
  landmarks?: string;
}

// ==================== JOB SPEC (OUTPUT) ====================

export interface JobSpec {
  jobId: string;
  version: string;
  createdAt: string;
  status: 'draft' | 'pending' | 'confirmed' | 'cancelled';
  
  // ข้อมูลบริการ
  service: ServiceDetails;
  
  // ข้อมูลเวลา
  schedule: ScheduleDetails;
  
  // ข้อมูลสถานที่
  locations: LocationPair;
  
  // ข้อมูลผู้ป่วย
  patient: PatientRequirements;
  
  // บริการเสริม
  addons: ServiceAddons;
  
  // การประเมิน
  assessment: JobAssessment;
}

export interface ServiceDetails {
  type: ServiceType;
  typeLabel: string;
  category: 'medical' | 'therapy' | 'checkup' | 'other';
  estimatedDuration: number; // นาที
  priority: 1 | 2 | 3 | 4 | 5; // 1 = สูงสุด
}

export interface ScheduleDetails {
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm
  datetime: string;  // ISO 8601
  flexibility: 'strict' | '30min' | '1hour' | 'anytime';
}

export interface LocationPair {
  pickup: LocationInfo;
  dropoff: LocationInfo;
  estimatedDistance?: number; // km
  estimatedDuration?: number; // นาที
}

export interface PatientRequirements {
  needsEscort: boolean;
  needsWheelchair: boolean;
  mobilityLevel: 'independent' | 'assisted' | 'wheelchair' | 'bedridden';
  specialAccommodations: string[];
}

export interface ServiceAddons {
  medicinePickup: boolean;
  homeCare: boolean;
  mealService: boolean;
  interpretation: boolean;
}

export interface JobAssessment {
  urgencyLevel: UrgencyLevel;
  complexity: 'simple' | 'moderate' | 'complex' | 'critical';
  estimatedCost: CostEstimate;
  resourceRequirements: ResourceNeeds;
  riskFactors: string[];
}

export interface CostEstimate {
  base: number;           // ฿
  distance: number;       // ฿
  duration: number;       // ฿
  addons: number;         // ฿
  total: number;          // ฿
  currency: 'THB';
}

export interface ResourceNeeds {
  navigatorRequired: boolean;
  vehicleType: 'sedan' | 'mpv' | 'wheelchair-van' | 'ambulance';
  estimatedNavHours: number;
  specialEquipment: string[];
}

// ==================== VALIDATION ====================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: ValidationError[];
  missingFields: string[];
  followUpQuestions: FollowUpQuestion[];
}

export interface FollowUpQuestion {
  field: string;
  question: string;
  type: 'boolean' | 'text' | 'choice' | 'date' | 'time';
  options?: string[];
  required: boolean;
}

// ==================== API TYPES ====================

export interface IntakeResponse {
  success: boolean;
  jobSpec?: JobSpec;
  validation?: ValidationResult;
  error?: string;
}

export interface IntakeRequest {
  formData: Partial<IntakeFormData>;
  sessionId: string;
  previousQuestions?: FollowUpQuestion[];
}
