/**
 * Intake Agent - Transformer
 * แปลงข้อมูลภาษาคน (IntakeFormData) ให้เป็น Structured Job Specification
 */

import type {
  IntakeFormData,
  JobSpec,
  ServiceDetails,
  ScheduleDetails,
  LocationPair,
  PatientRequirements,
  ServiceAddons,
  JobAssessment,
  CostEstimate,
  ResourceNeeds,
  ServiceType,
  UrgencyLevel,
} from './types';

// ==================== CONFIGURATION ====================

const SERVICE_CONFIG: Record<ServiceType, {
  label: string;
  category: ServiceDetails['category'];
  baseDuration: number; // นาที
  basePriority: 1 | 2 | 3 | 4 | 5;
}> = {
  'hospital-visit': {
    label: 'พบแพทย์นอก',
    category: 'medical',
    baseDuration: 120,
    basePriority: 3,
  },
  'follow-up': {
    label: 'ติดตามอาการ',
    category: 'medical',
    baseDuration: 60,
    basePriority: 3,
  },
  'physical-therapy': {
    label: 'กายภาพบำบัด',
    category: 'therapy',
    baseDuration: 90,
    basePriority: 3,
  },
  'dialysis': {
    label: 'ล้างไต',
    category: 'medical',
    baseDuration: 240,
    basePriority: 2,
  },
  'chemotherapy': {
    label: 'เคมีบำบัด',
    category: 'medical',
    baseDuration: 300,
    basePriority: 1,
  },
  'checkup': {
    label: 'ตรวจสุขภาพ',
    category: 'checkup',
    baseDuration: 180,
    basePriority: 4,
  },
  'other': {
    label: 'อื่นๆ',
    category: 'other',
    baseDuration: 90,
    basePriority: 3,
  },
};

const COST_RATES = {
  base: 350,           // ฿ ค่าบริการพื้นฐาน
  perKm: 15,           // ฿/km
  navHourly: 200,      // ฿/ชั่วโมง สำหรับ navigator
  wheelchairExtra: 150, // ฿
  medicinePickup: 100, // ฿
  homeCareHourly: 250, // ฿/ชั่วโมง
};

// ==================== TRANSFORMER ====================

export class IntakeTransformer {
  
  /**
   * แปลง IntakeFormData เป็น JobSpec เต็มรูปแบบ
   */
  static transform(formData: IntakeFormData): JobSpec {
    const now = new Date().toISOString();
    const jobId = this.generateJobId();

    return {
      jobId,
      version: '1.0',
      createdAt: now,
      status: 'draft',
      service: this.transformService(formData),
      schedule: this.transformSchedule(formData),
      locations: this.transformLocations(formData),
      patient: this.transformPatient(formData),
      addons: this.transformAddons(formData),
      assessment: this.transformAssessment(formData),
    };
  }

  /**
   * สร้าง Job ID
   */
  private static generateJobId(): string {
    const prefix = 'WC';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${date}-${random}`;
  }

  /**
   * แปลงข้อมูลบริการ
   */
  private static transformService(formData: IntakeFormData): ServiceDetails {
    const config = SERVICE_CONFIG[formData.serviceType];
    
    return {
      type: formData.serviceType,
      typeLabel: config.label,
      category: config.category,
      estimatedDuration: config.baseDuration,
      priority: this.calculatePriority(formData, config.basePriority),
    };
  }

  /**
   * คำนวณ priority โดยคำนึงถึง urgency และ service type
   */
  private static calculatePriority(
    formData: IntakeFormData, 
    basePriority: number
  ): 1 | 2 | 3 | 4 | 5 {
    const urgencyModifier: Record<UrgencyLevel, number> = {
      'urgent': -2,
      'high': -1,
      'normal': 0,
      'low': 1,
    };

    const adjusted = basePriority + urgencyModifier[formData.urgency];
    return Math.max(1, Math.min(5, adjusted)) as 1 | 2 | 3 | 4 | 5;
  }

  /**
   * แปลงข้อมูลเวลา
   */
  private static transformSchedule(formData: IntakeFormData): ScheduleDetails {
    const dateTime = `${formData.appointmentDate}T${formData.appointmentTime}:00`;
    
    // คำนวณ flexibility จาก urgency
    let flexibility: ScheduleDetails['flexibility'] = 'strict';
    switch (formData.urgency) {
      case 'urgent':
        flexibility = 'anytime';
        break;
      case 'high':
        flexibility = '1hour';
        break;
      case 'normal':
        flexibility = '30min';
        break;
      case 'low':
        flexibility = 'strict';
        break;
    }

    return {
      date: formData.appointmentDate,
      time: formData.appointmentTime,
      datetime: dateTime,
      flexibility,
    };
  }

  /**
   * แปลงข้อมูลสถานที่
   */
  private static transformLocations(formData: IntakeFormData): LocationPair {
    return {
      pickup: formData.pickupLocation,
      dropoff: formData.dropoffLocation,
      // จะคำนวณ distance/duration จาก Google Maps API
      estimatedDistance: undefined,
      estimatedDuration: undefined,
    };
  }

  /**
   * แปลงข้อมูลผู้ป่วย
   */
  private static transformPatient(formData: IntakeFormData): PatientRequirements {
    let mobilityLevel: PatientRequirements['mobilityLevel'] = 'independent';
    const accommodations: string[] = [];

    if (formData.needsWheelchair) {
      mobilityLevel = 'wheelchair';
      accommodations.push('รถเข็น');
    } else if (formData.patientNeedsEscort) {
      mobilityLevel = 'assisted';
    }

    if (formData.needsMedicinePickup) {
      accommodations.push('รับยา');
    }

    if (formData.needsHomeCare) {
      accommodations.push('ดูแลที่บ้าน');
    }

    return {
      needsEscort: formData.patientNeedsEscort,
      needsWheelchair: formData.needsWheelchair,
      mobilityLevel,
      specialAccommodations: accommodations,
    };
  }

  /**
   * แปลงข้อมูลบริการเสริม
   */
  private static transformAddons(formData: IntakeFormData): ServiceAddons {
    return {
      medicinePickup: formData.needsMedicinePickup || false,
      homeCare: formData.needsHomeCare || false,
      mealService: false, // ยังไม่ได้ถาม
      interpretation: false, // ยังไม่ได้ถาม
    };
  }

  /**
   * แปลงการประเมิน
   */
  private static transformAssessment(formData: IntakeFormData): JobAssessment {
    const complexity = this.assessComplexity(formData);
    const estimatedCost = this.estimateCost(formData, complexity);
    const resourceRequirements = this.assessResources(formData, complexity);
    const riskFactors = this.identifyRisks(formData);

    return {
      urgencyLevel: formData.urgency,
      complexity,
      estimatedCost,
      resourceRequirements,
      riskFactors,
    };
  }

  /**
   * ประเมินความซับซ้อนของงาน
   */
  private static assessComplexity(formData: IntakeFormData): JobAssessment['complexity'] {
    let score = 0;

    // Service type complexity
    if (['chemotherapy', 'dialysis'].includes(formData.serviceType)) score += 2;
    if (formData.serviceType === 'hospital-visit') score += 1;

    // Patient needs
    if (formData.needsWheelchair) score += 1;
    if (formData.patientNeedsEscort) score += 1;

    // Add-ons
    if (formData.needsMedicinePickup) score += 1;
    if (formData.needsHomeCare) score += 2;

    // Urgency
    if (formData.urgency === 'urgent') score += 2;
    if (formData.urgency === 'high') score += 1;

    if (score >= 6) return 'critical';
    if (score >= 4) return 'complex';
    if (score >= 2) return 'moderate';
    return 'simple';
  }

  /**
   * ประมาณการค่าใช้จ่าย
   */
  private static estimateCost(
    formData: IntakeFormData, 
    complexity: JobAssessment['complexity']
  ): CostEstimate {
    const base = COST_RATES.base;
    
    // คำนวณระยะทาง (จะต้องมีการคำนวณจริงจาก Google Maps)
    const distance = 0; // placeholder
    const distanceCost = distance * COST_RATES.perKm;

    // ค่าบริการ navigator
    const serviceConfig = SERVICE_CONFIG[formData.serviceType];
    const navHours = serviceConfig.baseDuration / 60;
    const durationCost = navHours * COST_RATES.navHourly;

    // บริการเสริม
    let addons = 0;
    if (formData.needsWheelchair) addons += COST_RATES.wheelchairExtra;
    if (formData.needsMedicinePickup) addons += COST_RATES.medicinePickup;
    if (formData.needsHomeCare) addons += COST_RATES.homeCareHourly * 2; // สมมติ 2 ชั่วโมง

    // Complexity multiplier
    const complexityMultiplier: Record<typeof complexity, number> = {
      'simple': 1.0,
      'moderate': 1.2,
      'complex': 1.5,
      'critical': 2.0,
    };

    const total = Math.round((base + distanceCost + durationCost + addons) * complexityMultiplier[complexity]);

    return {
      base,
      distance: Math.round(distanceCost),
      duration: Math.round(durationCost),
      addons,
      total,
      currency: 'THB',
    };
  }

  /**
   * ประเมินทรัพยากรที่ต้องการ
   */
  private static assessResources(
    formData: IntakeFormData,
    complexity: JobAssessment['complexity']
  ): ResourceNeeds {
    let vehicleType: ResourceNeeds['vehicleType'] = 'sedan';
    const specialEquipment: string[] = [];

    if (formData.needsWheelchair) {
      vehicleType = 'wheelchair-van';
      specialEquipment.push('ลิฟต์รถเข็น');
    }

    if (complexity === 'critical') {
      vehicleType = 'ambulance';
      specialEquipment.push('เครื่องวัดชีพจร');
    }

    const serviceConfig = SERVICE_CONFIG[formData.serviceType];

    return {
      navigatorRequired: formData.patientNeedsEscort || complexity !== 'simple',
      vehicleType,
      estimatedNavHours: serviceConfig.baseDuration / 60,
      specialEquipment,
    };
  }

  /**
   * ระบุปัจจัยเสี่ยง
   */
  private static identifyRisks(formData: IntakeFormData): string[] {
    const risks: string[] = [];

    if (formData.urgency === 'urgent') {
      risks.push('นัดเร่งด่วน อาจหา navigator ยาก');
    }

    if (formData.needsWheelchair) {
      risks.push('ต้องการรถเข็น จำกัดจำนวนรถที่ใช้ได้');
    }

    if (formData.serviceType === 'chemotherapy') {
      risks.push('ผู้ป่วยอาจมีอาการข้างเคียงระหว่างเดินทางกลับ');
    }

    if (formData.needsHomeCare) {
      risks.push('ต้องจัดสรรบุคลากรดูแลต่อเนื่อง');
    }

    // เช็ควันเวลา (weekend, holiday)
    const date = new Date(formData.appointmentDate);
    if (date.getDay() === 0 || date.getDay() === 6) {
      risks.push('นัดวันหยุด ค่าบริการอาจสูงขึ้น');
    }

    return risks;
  }

  /**
   * อัพเดต JobSpec ด้วยข้อมูลจาก Google Maps (ระยะทาง, เวลาเดินทาง)
   */
  static async enrichWithMapData(
    jobSpec: JobSpec,
    getDistanceFn: (from: string, to: string) => Promise<{ distance: number; duration: number }>
  ): Promise<JobSpec> {
    try {
      const mapData = await getDistanceFn(
        jobSpec.locations.pickup.address,
        jobSpec.locations.dropoff.address
      );

      return {
        ...jobSpec,
        locations: {
          ...jobSpec.locations,
          estimatedDistance: mapData.distance,
          estimatedDuration: mapData.duration,
        },
        assessment: {
          ...jobSpec.assessment,
          estimatedCost: {
            ...jobSpec.assessment.estimatedCost,
            distance: Math.round(mapData.distance * COST_RATES.perKm),
            total: Math.round(
              jobSpec.assessment.estimatedCost.base +
              (mapData.distance * COST_RATES.perKm) +
              jobSpec.assessment.estimatedCost.duration +
              jobSpec.assessment.estimatedCost.addons
            ),
          },
        },
      };
    } catch (error) {
      console.error('Failed to enrich with map data:', error);
      return jobSpec;
    }
  }
}

export default IntakeTransformer;
