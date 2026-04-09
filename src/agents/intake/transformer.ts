/**
 * Intake Agent - Transformer Engine
 * แปลง IntakeInput → JobSpec พร้อมคำนวณทุก field ตาม business rules
 * 
 * @version 1.0
 * @module src/agents/intake/transformer
 */

import {
  // Input Types
  IntakeInput,
  ContactInfo,
  ServiceInfo,
  ScheduleInfo,
  LocationsInput,
  PatientInfo,
  AddonsInfo,
  
  // Output Types
  JobSpec,
  JobServiceDetails,
  JobScheduleDetails,
  JobLocations,
  JobContact,
  JobPatient,
  JobAddons,
  JobAssessment,
  CostEstimate,
  ResourceRequirements,
  JobNotes,
  
  // Enums & Constants
  UrgencyLevel,
  MobilityLevel,
  ServiceType,
  RelationshipType,
  TimeFlexibility,
  
  // Constants
  SERVICE_TYPE_LABELS,
  MOBILITY_LEVEL_LABELS,
  RELATIONSHIP_LABELS,
  URGENCY_LABELS,
  COST_RATES,
  SERVICE_DURATIONS,
  SERVICE_PRIORITY,
} from './schema';

// ============================================================================
// 1. Main Transform Function
// ============================================================================

/**
 * แปลง IntakeInput → JobSpec ครบทุก field
 * Generate jobId: WC-YYYYMMDD-XXXX (อ่านง่าย)
 * 
 * @param formData - ข้อมูล intake form ที่กรอกครบถ้วน
 * @param sessionId - session ID สำหรับ traceability
 * @returns JobSpec ที่สมบูรณ์ พร้อมคำนวณทั้งหมด
 */
export function transformToJobSpec(
  formData: IntakeInput,
  sessionId: string = generateSessionId()
): JobSpec {
  const now = new Date();
  const jobId = generateJobId(now);
  
  // คำนวณ distance & duration แบบ estimated/mock
  const distanceAndDuration = estimateDistanceAndDuration(formData);
  
  // คำนวณ priority
  const priority = derivePriority(formData);
  
  // คำนวณ duration ของ service
  const estimatedDuration = estimateDuration(formData);
  
  // คำนวณ cost
  const estimatedCost = estimateCost(formData, distanceAndDuration);
  
  // ประเมิน complexity
  const complexity = assessComplexity(formData);
  
  // กำหนด resource requirements
  const resources = deriveResources(formData, estimatedDuration, distanceAndDuration.estimatedDuration);
  
  // สร้าง datetime ISO 8601
  const appointmentDateTime = new Date(`${formData.schedule.appointmentDate}T${formData.schedule.appointmentTime}`);
  
  // คำนวณ estimated end time
  const estimatedEndTime = new Date(appointmentDateTime.getTime() + estimatedDuration * 60 * 1000);
  
  // กำหนด risk factors
  const riskFactors = deriveRiskFactors(formData, complexity);
  
  // กำหนด special accommodations
  const specialAccommodations = deriveSpecialAccommodations(formData);
  
  // กำหนด flags
  const flags = deriveFlags(formData, complexity);

  const jobSpec: JobSpec = {
    // B.1 Metadata
    jobId,
    version: '1.0',
    createdAt: now.toISOString(),
    status: 'pending',
    source: 'web',
    sessionId,

    // B.2 Service Details
    service: {
      type: formData.service.serviceType,
      typeLabel: SERVICE_TYPE_LABELS[formData.service.serviceType],
      category: deriveServiceCategory(formData.service.serviceType),
      subType: formData.service.serviceSubType,
      department: formData.service.department,
      doctorName: formData.service.doctorName,
      priority,
      estimatedDuration,
    },

    // B.3 Schedule
    schedule: {
      date: formData.schedule.appointmentDate,
      time: formData.schedule.appointmentTime,
      datetime: appointmentDateTime.toISOString(),
      flexibility: formData.schedule.timeFlexibility,
      estimatedEndTime: estimatedEndTime.toISOString(),
    },

    // B.4 Locations
    locations: {
      pickup: transformLocation(formData.locations.pickup),
      dropoff: transformLocation(formData.locations.dropoff),
      estimatedDistance: distanceAndDuration.estimatedDistance,
      estimatedDuration: distanceAndDuration.estimatedDuration,
      routePolyline: distanceAndDuration.routePolyline,
    },

    // B.5 Contact
    contact: {
      primary: {
        name: formData.contact.contactName,
        phone: formData.contact.contactPhone,
        email: formData.contact.contactEmail,
        lineUserId: formData.contact.lineUserId,
      },
      relationship: formData.contact.relationship,
      emergency: deriveEmergencyContact(formData),
    },

    // B.6 Patient
    patient: {
      name: formData.patient.name,
      age: formData.patient.age,
      gender: formData.patient.gender,
      weight: formData.patient.weight,
      mobilityLevel: formData.patient.mobilityLevel,
      needsEscort: formData.patient.needsEscort,
      needsWheelchair: formData.patient.needsWheelchair,
      oxygenRequired: formData.patient.oxygenRequired,
      stretcherRequired: formData.patient.stretcherRequired,
      conditions: formData.patient.conditions || [],
      allergies: formData.patient.allergies || [],
      medications: formData.patient.medications || [],
      specialAccommodations,
    },

    // B.7 Add-ons
    addons: {
      medicinePickup: formData.addons.medicinePickup,
      homeCare: formData.addons.homeCare,
      mealService: formData.addons.mealService,
      interpretation: formData.addons.interpretation,
      accompanyInside: formData.addons.accompanyInside,
    },

    // B.8 Assessment
    assessment: {
      urgencyLevel: formData.urgencyLevel,
      complexity,
      riskFactors,
      estimatedCost,
      resources,
    },

    // B.9 Notes
    notes: {
      customer: formData.specialNotes || '',
      internal: generateInternalNotes(formData, complexity),
      flags,
    },
  };

  return jobSpec;
}

// ============================================================================
// 2. Priority Derivation
// ============================================================================

/**
 * คำนวณ priority จาก urgency และ service type
 * - urgent/high → priority 1-2
 * - normal/low → priority 3-5
 * 
 * Logic: urgency เป็นหลัก service type เป็นรอง
 * 
 * @param formData - IntakeInput
 * @returns priority 1-5 (1 = highest)
 */
export function derivePriority(formData: IntakeInput): 1 | 2 | 3 | 4 | 5 {
  const { urgencyLevel, service } = formData;
  
  // Base priority from service type
  const basePriority = SERVICE_PRIORITY[service.serviceType];
  
  // Adjust based on urgency
  switch (urgencyLevel) {
    case 'urgent':
      // Urgent คือ priority สูงสุดเสมอ
      return 1;
    case 'high':
      // High urgency ไม่ต่ำกว่า 2
      return Math.min(2, basePriority) as 1 | 2;
    case 'normal':
      // Normal urgency อยู่ระหว่าง 3-4
      return basePriority <= 2 ? 3 : Math.min(basePriority, 4) as 3 | 4;
    case 'low':
      // Low urgency อยู่ระหว่าง 4-5
      return Math.max(4, basePriority) as 4 | 5;
    default:
      return basePriority;
  }
}

// ============================================================================
// 3. Duration Estimation
// ============================================================================

/**
 * ประเมิน duration ของการให้บริการ (นาที)
 * ใช้ SERVICE_DURATIONS จาก schema.ts เป็นฐาน
 * 
 * @param formData - IntakeInput
 * @returns estimated duration in minutes
 */
export function estimateDuration(formData: IntakeInput): number {
  const baseDuration = SERVICE_DURATIONS[formData.service.serviceType];
  
  // ปรับตาม mobility level (เพิ่มเวลาสำหรับ mobility ยาก)
  let mobilityAdjustment = 0;
  switch (formData.patient.mobilityLevel) {
    case 'wheelchair':
      mobilityAdjustment = 15; // ขึ้นลงรถเข็นเพิ่มเวลา
      break;
    case 'bedridden':
    case 'stretcherRequired':
      mobilityAdjustment = 30; // ยก stretcher เพิ่มเวลามาก
      break;
    case 'assisted':
      mobilityAdjustment = 10; // ช่วยพยุงเพิ่มเวลานิดหน่อย
      break;
    default:
      mobilityAdjustment = 0;
  }
  
  // ปรับตาม add-ons
  let addonAdjustment = 0;
  if (formData.addons.medicinePickup) {
    addonAdjustment += 15; // รอรับยา
  }
  if (formData.addons.accompanyInside) {
    addonAdjustment += 30; // พี่เลี้ยงติดตามเข้าไปด้วย
  }
  
  // ใช้ค่าที่ formData กำหนดถ้ามี (user override)
  if (formData.schedule.duration && formData.schedule.duration > 0) {
    return formData.schedule.duration;
  }
  
  return baseDuration + mobilityAdjustment + addonAdjustment;
}

// ============================================================================
// 4. Distance and Duration Estimation
// ============================================================================

/**
 * ประเมินระยะทางและเวลาการเดินทาง
 * 
 * NOTE: ตอนนี้เป็น mock/estimated values
 * ในอนาคตจะ integrate กับ:
 * - Google Maps Distance Matrix API
 * - Mapbox Directions API
 * - หรือ internal routing service
 * 
 * @param formData - IntakeInput
 * @returns estimated distance (km), duration (minutes), and polyline
 */
export function estimateDistanceAndDuration(formData: IntakeInput): {
  estimatedDistance: number;
  estimatedDuration: number;
  routePolyline?: string;
} {
  // TODO: Replace with actual API call when available
  // const origin = { lat: formData.locations.pickup.lat, lng: formData.locations.pickup.lng };
  // const destination = { lat: formData.locations.dropoff.lat, lng: formData.locations.dropoff.lng };
  // const result = await mapsAPI.distanceMatrix(origin, destination);
  
  // Mock estimation based on service type and typical patterns
  // สมมติฐาน: ระยะทางและเวลาเฉลี่ยตามประเภทบริการ
  let estimatedDistance: number;
  let estimatedDuration: number;
  
  switch (formData.service.serviceType) {
    case 'dialysis':
      // ล้างไตมักเป็นการนัดประจำ ระยะทางไม่ไกลนัก
      estimatedDistance = 8;
      estimatedDuration = 25;
      break;
    case 'chemotherapy':
    case 'radiation':
      // เคมี/รังสีมักอยู่โรงพยาบาลใหญ่ อาจไกลกว่า
      estimatedDistance = 15;
      estimatedDuration = 40;
      break;
    case 'hospital-visit':
    case 'checkup':
      // พบแพทย์ทั่วไป ระยะทางเฉลี่ย
      estimatedDistance = 10;
      estimatedDuration = 30;
      break;
    case 'physical-therapy':
      // กายภาพอาจมี clinic ใกล้บ้าน
      estimatedDistance = 5;
      estimatedDuration = 20;
      break;
    case 'vaccination':
      // ฉีดวัคซีนมักใกล้บ้าน
      estimatedDistance = 3;
      estimatedDuration = 15;
      break;
    default:
      // ค่า default
      estimatedDistance = 10;
      estimatedDuration = 25;
  }
  
  // ปรับตาม traffic และ urgency
  if (formData.urgencyLevel === 'urgent') {
    // Urgent ขับเร็วขึ้น แต่ถ้าติดมากอาจช้า
    estimatedDuration = Math.ceil(estimatedDuration * 0.9);
  } else if (formData.schedule.timeFlexibility === 'anytime') {
    // Anytime flexibility สามารถหลีกเลี่ยง traffic ได้
    estimatedDuration = Math.ceil(estimatedDuration * 0.85);
  }
  
  // ถ้ามี coordinates จริง ควรใช้ haversine distance เป็นตัวช่วยประมาณ
  if (formData.locations.pickup.lat && formData.locations.pickup.lng &&
      formData.locations.dropoff.lat && formData.locations.dropoff.lng) {
    const haversineDistance = calculateHaversineDistance(
      formData.locations.pickup.lat,
      formData.locations.pickup.lng,
      formData.locations.dropoff.lat,
      formData.locations.dropoff.lng
    );
    
    // ใช้ haversine ถ้าไม่ห่างจาก estimate มากเกินไป
    if (Math.abs(haversineDistance - estimatedDistance) < 20) {
      estimatedDistance = Math.round(haversineDistance * 1.3); // 1.3x สำหรับ actual road distance
      estimatedDuration = Math.ceil((estimatedDistance / 30) * 60); // สมมติ 30 km/h average
    }
  }
  
  return {
    estimatedDistance: Math.round(estimatedDistance * 10) / 10, // Round to 1 decimal
    estimatedDuration: Math.ceil(estimatedDuration / 5) * 5, // Round up to nearest 5 minutes
    routePolyline: undefined, // TODO: Will be populated by actual routing API
  };
}

// ============================================================================
// 5. Complexity Assessment
// ============================================================================

/**
 * ประเมินความซับซ้อนของงาน
 * 
 * Business Rules:
 * - simple: ไม่มี escort + ไม่มี wheelchair + ไม่มี addon + mobility ง่าย
 * - moderate: มีอย่างใดอย่างหนึ่ง (escort หรือ wheelchair หรือ addon อย่างน้อย 1)
 * - complex: มีหลายอย่างรวมกัน (escort + wheelchair + หลาย addons)
 * - critical: urgency สูง (urgent) + mobility หนัก (bedridden/stretcher/oxygen)
 * 
 * @param formData - IntakeInput
 * @returns complexity level
 */
export function assessComplexity(formData: IntakeInput): 'simple' | 'moderate' | 'complex' | 'critical' {
  const { patient, addons, urgencyLevel, service } = formData;
  
  // นับจำนวน special requirements
  let specialRequirementsCount = 0;
  
  // Escort required
  if (patient.needsEscort) {
    specialRequirementsCount++;
  }
  
  // Wheelchair required
  if (patient.needsWheelchair) {
    specialRequirementsCount++;
  }
  
  // Add-ons (ที่มีผลต่อ complexity)
  if (addons.accompanyInside) specialRequirementsCount++;
  if (addons.medicinePickup) specialRequirementsCount++;
  if (addons.interpretation) specialRequirementsCount++;
  if (addons.homeCare) specialRequirementsCount++;
  
  // Check critical condition first
  const isHighUrgency = urgencyLevel === 'urgent' || urgencyLevel === 'high';
  const isHeavyMobility = 
    patient.mobilityLevel === 'bedridden' || 
    patient.stretcherRequired ||
    (patient.oxygenRequired && patient.needsWheelchair);
  
  if (isHighUrgency && isHeavyMobility) {
    return 'critical';
  }
  
  // Critical service types (chemotherapy, dialysis) อาจเป็น complex ได้
  const isCriticalService = service.serviceType === 'chemotherapy' || 
                            service.serviceType === 'dialysis' ||
                            service.serviceType === 'radiation';
  
  if (isCriticalService && specialRequirementsCount >= 2) {
    return 'complex';
  }
  
  // Classify by count
  if (specialRequirementsCount === 0 && patient.mobilityLevel === 'independent') {
    return 'simple';
  }
  
  if (specialRequirementsCount >= 3 || 
      (patient.mobilityLevel === 'bedridden' && specialRequirementsCount >= 1)) {
    return 'complex';
  }
  
  return 'moderate';
}

// ============================================================================
// 6. Cost Estimation
// ============================================================================

/**
 * ประเมินค่าใช้จ่าย
 * 
 * Cost Structure:
 * - base: ค่าบริการพื้นฐาน
 * - distance: ค่าระยะทาง
 * - duration: ค่าพี่เลี้ยงตามชั่วโมง
 * - addons: ค่า add-on เพิ่มเติม
 * - total: รวมทั้งหมด
 * 
 * @param formData - IntakeInput
 * @param distanceAndDuration - ข้อมูลระยะทางและเวลาเดินทาง (optional)
 * @returns CostEstimate
 */
export function estimateCost(
  formData: IntakeInput,
  distanceAndDuration?: { estimatedDistance: number; estimatedDuration: number }
): CostEstimate {
  // ถ้าไม่ได้ส่ง distanceAndDuration มา ให้ calculate ใหม่
  const distanceDuration = distanceAndDuration || estimateDistanceAndDuration(formData);
  
  // 1. Base cost
  const base = COST_RATES.base;
  
  // 2. Distance cost (ไป-กลับ)
  const roundTripDistance = distanceDuration.estimatedDistance * 2;
  const distance = roundTripDistance * COST_RATES.perKm;
  
  // 3. Navigator/Duration cost
  // ประมาณการ navigator hours จาก service duration
  const serviceDuration = estimateDuration(formData);
  const travelDuration = distanceDuration.estimatedDuration * 2; // ไป-กลับ
  const totalDuration = serviceDuration + travelDuration;
  const navHours = Math.ceil(totalDuration / 60); // ปัดขึ้นเป็นชั่วโมง
  const duration = navHours * COST_RATES.navHourly;
  
  // 4. Add-ons cost
  let addons = 0;
  
  // Wheelchair van surcharge
  if (formData.patient.needsWheelchair) {
    addons += COST_RATES.wheelchairExtra;
  }
  
  // Medicine pickup
  if (formData.addons.medicinePickup) {
    addons += COST_RATES.medicinePickup;
  }
  
  // Home care (คิดชั่วโมง สมมติ 2 ชั่วโมงเบื้องต้น)
  if (formData.addons.homeCare) {
    addons += COST_RATES.homeCareHourly * 2;
  }
  
  // Accompany inside (เพิ่มชั่วโมง navigator)
  if (formData.addons.accompanyInside) {
    addons += COST_RATES.navHourly; // +1 hour
  }
  
  // Meal service (สมมติค่าอาหาร)
  if (formData.addons.mealService) {
    addons += 150;
  }
  
  // Interpretation service
  if (formData.addons.interpretation) {
    addons += 300;
  }
  
  // Urgency surcharge (สำหรับ urgent)
  if (formData.urgencyLevel === 'urgent') {
    addons += 200; // urgent fee
  }
  
  // Calculate total
  const total = base + distance + duration + addons;
  
  return {
    base: Math.round(base),
    distance: Math.round(distance),
    duration: Math.round(duration),
    addons: Math.round(addons),
    total: Math.round(total),
    currency: 'THB',
  };
}

// ============================================================================
// 7. Resource Derivation
// ============================================================================

/**
 * กำหนด resource requirements สำหรับงาน
 * 
 * Business Rules:
 * - navigatorRequired: true ถ้า needsEscort || accompanyInside || serviceType === 'hospital-visit'
 * - vehicleType:
 *   - wheelchair → wheelchair-van
 *   - stretcher/bedridden → ambulance
 *   - อื่นๆ → sedan/mpv (เลือกตาม distance)
 * - navigatorType: เลือกตาม complexity และ patient condition
 * - specialEquipment: อุปกรณ์พิเศษที่ต้องใช้
 * 
 * @param formData - IntakeInput
 * @param serviceDuration - ระยะเวลาให้บริการ (นาที)
 * @param travelDuration - ระยะเวลาเดินทางไป (นาที)
 * @returns ResourceRequirements
 */
export function deriveResources(
  formData: IntakeInput,
  serviceDuration?: number,
  travelDuration?: number
): ResourceRequirements {
  const { patient, addons, service } = formData;
  
  // 1. Navigator Required
  const navigatorRequired = 
    patient.needsEscort || 
    addons.accompanyInside || 
    service.serviceType === 'hospital-visit' ||
    patient.mobilityLevel !== 'independent';
  
  // 2. Vehicle Type
  let vehicleType: 'sedan' | 'mpv' | 'wheelchair-van' | 'ambulance';
  
  if (patient.stretcherRequired || patient.mobilityLevel === 'bedridden') {
    vehicleType = 'ambulance';
  } else if (patient.needsWheelchair) {
    vehicleType = 'wheelchair-van';
  } else {
    // สำหรับผู้ป่วยที่เดินได้หรือต้องการช่วยเหลือเล็กน้อย
    // MPV สำหรับระยะทางไกล หรือมีอุปกรณ์มาก
    const distDur = estimateDistanceAndDuration(formData);
    if (distDur.estimatedDistance > 20 || patient.oxygenRequired) {
      vehicleType = 'mpv';
    } else {
      vehicleType = 'sedan';
    }
  }
  
  // 3. Navigator Type
  let navigatorType: 'PN' | 'RN' | 'CG' | undefined;
  
  if (patient.oxygenRequired || 
      patient.stretcherRequired || 
      patient.mobilityLevel === 'bedridden' ||
      service.serviceType === 'chemotherapy' ||
      service.serviceType === 'dialysis') {
    // ต้องการ Practical Nurse หรือ Registered Nurse
    navigatorType = 'PN';
  } else if (addons.accompanyInside || addons.homeCare) {
    // Caregiver พอสำหรับงานไม่ซับซ้อนแต่ต้องดูแลใกล้ชิด
    navigatorType = 'CG';
  } else if (patient.needsEscort && patient.conditions && patient.conditions.length > 0) {
    // มีโรคประจำตัว + ต้องการ escort
    navigatorType = 'CG';
  }
  
  // 4. Estimated Navigator Hours
  const svcDur = serviceDuration || estimateDuration(formData);
  const trvDur = travelDuration || estimateDistanceAndDuration(formData).estimatedDuration;
  const totalMinutes = svcDur + (trvDur * 2); // ไป-กลับ
  const estimatedNavHours = Math.ceil(totalMinutes / 60 * 10) / 10; // ปัดขึ้น 1 ทศนิยม
  
  // 5. Special Equipment
  const specialEquipment: string[] = [];
  
  if (patient.needsWheelchair) {
    specialEquipment.push('wheelchair');
  }
  if (patient.stretcherRequired) {
    specialEquipment.push('stretcher');
  }
  if (patient.oxygenRequired) {
    specialEquipment.push('portable-oxygen');
  }
  if (patient.weight && patient.weight > 100) {
    specialEquipment.push('patient-lift'); // อุปกรณ์ยกผู้ป่วยหนัก
  }
  if (addons.medicinePickup) {
    specialEquipment.push('cooler-bag'); // ถุงเก็บความเย็นสำหรับยา
  }
  if (patient.mobilityLevel === 'bedridden') {
    specialEquipment.push('transfer-board');
  }
  
  return {
    navigatorRequired,
    navigatorType,
    vehicleType,
    estimatedNavHours,
    specialEquipment,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate Job ID รูปแบบ: WC-YYYYMMDD-XXXX
 * WC = WelCares, YYYYMMDD = วันนี้, XXXX = random 4 digits
 * 
 * อ่านง่าย ไม่ใช้ special characters
 */
function generateJobId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  
  return `WC-${year}${month}${day}-${random}`;
}

/**
 * Generate Session ID สำหรับ traceability
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * แปลง LocationInfo เป็น LocationDetails
 */
function transformLocation(location: {
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
  name?: string;
  department?: string;
}) {
  return {
    address: location.address,
    lat: location.lat,
    lng: location.lng,
    contactName: location.contactName,
    contactPhone: location.contactPhone,
    buildingName: location.buildingName,
    floor: location.floor,
    roomNumber: location.roomNumber,
    landmarks: location.landmarks,
    parkingNote: location.parkingNote,
    name: location.name,
    department: location.department,
  };
}

/**
 * กำหนด service category จาก service type
 */
function deriveServiceCategory(serviceType: ServiceType): 'medical' | 'therapy' | 'checkup' | 'other' {
  switch (serviceType) {
    case 'hospital-visit':
    case 'follow-up':
    case 'dialysis':
    case 'chemotherapy':
    case 'radiation':
      return 'medical';
    case 'physical-therapy':
      return 'therapy';
    case 'checkup':
    case 'vaccination':
      return 'checkup';
    default:
      return 'other';
  }
}

/**
 * กำหนด emergency contact (ถ้ามี)
 */
function deriveEmergencyContact(formData: IntakeInput): { name: string; phone: string } | undefined {
  // ถ้า relationship ไม่ใช่ self ให้ใช้ contact หลักเป็น emergency contact
  if (formData.contact.relationship !== 'self') {
    return {
      name: formData.contact.contactName,
      phone: formData.contact.contactPhone,
    };
  }
  // ถ้าเป็น self ต้องถาม emergency contact เพิ่ม (ยังไม่มีข้อมูล)
  return undefined;
}

/**
 * กำหนด risk factors จากข้อมูลผู้ป่วย
 */
function deriveRiskFactors(
  formData: IntakeInput,
  complexity: 'simple' | 'moderate' | 'complex' | 'critical'
): string[] {
  const risks: string[] = [];
  
  if (formData.urgencyLevel === 'urgent') {
    risks.push('URGENT_BOOKING');
  }
  
  if (formData.patient.mobilityLevel === 'bedridden') {
    risks.push('BEDRIDDEN_PATIENT');
  }
  
  if (formData.patient.stretcherRequired) {
    risks.push('STRETCHER_REQUIRED');
  }
  
  if (formData.patient.oxygenRequired) {
    risks.push('OXYGEN_DEPENDENT');
  }
  
  if (formData.patient.conditions && formData.patient.conditions.some(c => 
    /หัวใจ|heart|เบาหวาน|diabetes|ความดัน|hypertension|stroke|หลอดเลือดสมอง/i.test(c)
  )) {
    risks.push('CHRONIC_CONDITIONS');
  }
  
  if (complexity === 'critical') {
    risks.push('CRITICAL_COMPLEXITY');
  }
  
  if (formData.schedule.timeFlexibility === 'strict') {
    risks.push('STRICT_TIMING');
  }
  
  return risks;
}

/**
 * กำหนด special accommodations ที่ต้องจัดเตรียม
 */
function deriveSpecialAccommodations(formData: IntakeInput): string[] {
  const accommodations: string[] = [];
  
  if (formData.patient.needsWheelchair) {
    accommodations.push('WHEELCHAIR_ACCESSIBLE');
  }
  
  if (formData.patient.oxygenRequired) {
    accommodations.push('OXYGEN_EQUIPMENT');
  }
  
  if (formData.patient.stretcherRequired) {
    accommodations.push('STRETCHER_TRANSPORT');
  }
  
  if (formData.addons.interpretation) {
    accommodations.push('LANGUAGE_INTERPRETATION');
  }
  
  if (formData.patient.weight && formData.patient.weight > 100) {
    accommodations.push('BARIATRIC_EQUIPMENT');
  }
  
  if (formData.locations.pickup.floor && parseInt(formData.locations.pickup.floor) > 5) {
    accommodations.push('HIGH_FLOOR_PICKUP');
  }
  
  return accommodations;
}

/**
 * กำหนด flags สำหรับ internal use
 */
function deriveFlags(
  formData: IntakeInput,
  complexity: 'simple' | 'moderate' | 'complex' | 'critical'
): string[] {
  const flags: string[] = [];
  
  if (complexity === 'critical') {
    flags.push('CRITICAL');
  } else if (complexity === 'complex') {
    flags.push('COMPLEX');
  }
  
  if (formData.urgencyLevel === 'urgent') {
    flags.push('URGENT');
  }
  
  if (formData.patient.needsWheelchair) {
    flags.push('WHEELCHAIR');
  }
  
  if (formData.contact.relationship === 'self') {
    flags.push('SELF_BOOKING');
  }
  
  if (formData.addons.homeCare) {
    flags.push('HOME_CARE');
  }
  
  return flags;
}

/**
 * สร้าง internal notes สำหรับทีม operations
 */
function generateInternalNotes(
  formData: IntakeInput,
  complexity: 'simple' | 'moderate' | 'complex' | 'critical'
): string {
  const notes: string[] = [];
  
  notes.push(`Complexity: ${complexity.toUpperCase()}`);
  notes.push(`Urgency: ${formData.urgencyLevel.toUpperCase()}`);
  notes.push(`Mobility: ${formData.patient.mobilityLevel}`);
  
  if (formData.patient.conditions && formData.patient.conditions.length > 0) {
    notes.push(`Conditions: ${formData.patient.conditions.join(', ')}`);
  }
  
  if (formData.patient.allergies && formData.patient.allergies.length > 0) {
    notes.push(`Allergies: ${formData.patient.allergies.join(', ')}`);
  }
  
  if (formData.patient.medications && formData.patient.medications.length > 0) {
    notes.push(`Medications: ${formData.patient.medications.join(', ')}`);
  }
  
  return notes.join(' | ');
}

/**
 * Calculate Haversine Distance between two coordinates (km)
 * ใช้สำหรับ estimate ระยะทางโดยคร่าวเมื่อมี lat/lng
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// Export Types for Testing
// ============================================================================

export type {
  IntakeInput,
  JobSpec,
  JobServiceDetails,
  JobScheduleDetails,
  JobLocations,
  JobContact,
  JobPatient,
  JobAddons,
  JobAssessment,
  CostEstimate,
  ResourceRequirements,
  JobNotes,
  UrgencyLevel,
  MobilityLevel,
  ServiceType,
  RelationshipType,
  TimeFlexibility,
};
