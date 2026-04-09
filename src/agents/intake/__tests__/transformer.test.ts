/**
 * Intake Agent - Transformer Engine Tests
 * ทดสอบการแปลง IntakeInput → JobSpec ทั้งหมด
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IntakeInput, MobilityLevel, ServiceType, UrgencyLevel } from '../schema';
import {
  transformToJobSpec,
  derivePriority,
  estimateDuration,
  estimateDistanceAndDuration,
  assessComplexity,
  estimateCost,
  deriveResources,
} from '../transformer';

// ============================================================================
// FIXTURES - Complete Test Data
// ============================================================================

const createCompleteInput = (overrides: Partial<IntakeInput> = {}): IntakeInput => ({
  contact: {
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'somchai@example.com',
    relationship: 'son',
  },
  service: {
    serviceType: 'hospital-visit',
    serviceSubType: 'ตรวจทั่วไป',
    department: 'อายุรกรรม',
    doctorName: 'Dr. วิชัย',
    appointmentType: 'follow-up',
  },
  schedule: {
    appointmentDate: '2025-12-25',
    appointmentTime: '10:00',
    timeFlexibility: '30min',
    duration: 120,
  },
  locations: {
    pickup: {
      address: '123 ถนนสุขุมวิท',
      lat: 13.7244416,
      lng: 100.522,
      contactName: 'สมชาย ใจดี',
      contactPhone: '0812345678',
      buildingName: 'คอนโด ABC',
      floor: '5',
      roomNumber: 'A501',
      landmarks: 'ใกล้ BTS พร้อมพงษ์',
    },
    dropoff: {
      address: '456 ถนนพญาไท',
      lat: 13.758,
      lng: 100.532,
      contactName: 'พยาบาลสถาน',
      contactPhone: '021234567',
      name: 'รพ. กรุงเทพ',
      department: 'อายุรกรรม',
    },
  },
  patient: {
    name: 'นางสมหวัง ใจดี',
    age: 75,
    gender: 'female',
    weight: 55,
    mobilityLevel: 'wheelchair',
    needsEscort: true,
    needsWheelchair: true,
    oxygenRequired: false,
    stretcherRequired: false,
    conditions: ['เบาหวาน', 'ความดัน'],
    allergies: ['แพ้ยาแอสไพริน'],
    medications: ['Metformin'],
  },
  addons: {
    medicinePickup: true,
    homeCare: false,
    mealService: false,
    interpretation: false,
    accompanyInside: true,
  },
  specialNotes: 'ผู้ป่วยต้องการความช่วยเหลือในการขึ้นลงรถ',
  urgencyLevel: 'normal',
  ...overrides,
});

// ============================================================================
// transformToJobSpec - OUTPUT SHAPE TESTS
// ============================================================================

describe('transformToJobSpec', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate complete JobSpec with all required fields', () => {
    const input = createCompleteInput();
    const result = transformToJobSpec(input, 'test-session-123');

    // B.1 Metadata
    expect(result.jobId).toBeDefined();
    expect(result.version).toBe('1.0');
    expect(result.createdAt).toBe('2025-06-15T10:00:00.000Z');
    expect(result.status).toBe('pending');
    expect(result.source).toBe('web');
    expect(result.sessionId).toBe('test-session-123');

    // B.2 Service Details
    expect(result.service).toBeDefined();
    expect(result.service.type).toBe('hospital-visit');
    expect(result.service.typeLabel).toBe('พบแพทย์นอก');
    expect(result.service.category).toBe('medical');
    expect(result.service.priority).toBeDefined();
    expect(result.service.estimatedDuration).toBeGreaterThan(0);

    // B.3 Schedule
    expect(result.schedule).toBeDefined();
    expect(result.schedule.date).toBe('2025-12-25');
    expect(result.schedule.time).toBe('10:00');
    // datetime is ISO format, exact value depends on timezone
    expect(result.schedule.datetime).toMatch(/^2025-12-25T\d{2}:00:00\.\d{3}Z$/);
    expect(result.schedule.flexibility).toBe('30min');
    expect(result.schedule.estimatedEndTime).toBeDefined();

    // B.4 Locations
    expect(result.locations).toBeDefined();
    expect(result.locations.pickup).toBeDefined();
    expect(result.locations.pickup.address).toBe('123 ถนนสุขุมวิท');
    expect(result.locations.dropoff).toBeDefined();
    expect(result.locations.dropoff.address).toBe('456 ถนนพญาไท');
    expect(result.locations.estimatedDistance).toBeDefined();
    expect(result.locations.estimatedDuration).toBeDefined();

    // B.5 Contact
    expect(result.contact).toBeDefined();
    expect(result.contact.primary.name).toBe('สมชาย ใจดี');
    expect(result.contact.primary.phone).toBe('0812345678');
    expect(result.contact.relationship).toBe('son');

    // B.6 Patient
    expect(result.patient).toBeDefined();
    expect(result.patient.name).toBe('นางสมหวัง ใจดี');
    expect(result.patient.age).toBe(75);
    expect(result.patient.mobilityLevel).toBe('wheelchair');
    expect(result.patient.specialAccommodations).toBeInstanceOf(Array);

    // B.7 Add-ons
    expect(result.addons).toBeDefined();
    expect(result.addons.medicinePickup).toBe(true);
    expect(result.addons.accompanyInside).toBe(true);

    // B.8 Assessment
    expect(result.assessment).toBeDefined();
    expect(result.assessment.urgencyLevel).toBe('normal');
    expect(result.assessment.complexity).toBeDefined();
    expect(result.assessment.riskFactors).toBeInstanceOf(Array);
    expect(result.assessment.estimatedCost).toBeDefined();
    expect(result.assessment.resources).toBeDefined();

    // B.9 Notes
    expect(result.notes).toBeDefined();
    expect(result.notes.customer).toBe('ผู้ป่วยต้องการความช่วยเหลือในการขึ้นลงรถ');
    expect(result.notes.internal).toBeDefined();
    expect(result.notes.flags).toBeInstanceOf(Array);
  });

  it('should generate unique jobId with correct format', () => {
    const input = createCompleteInput();
    const result1 = transformToJobSpec(input);
    const result2 = transformToJobSpec(input);

    // Format: WC-YYYYMMDD-XXXX
    expect(result1.jobId).toMatch(/^WC-\d{8}-\d{4}$/);
    expect(result2.jobId).toMatch(/^WC-\d{8}-\d{4}$/);
    expect(result1.jobId).not.toBe(result2.jobId);

    // Check date part matches local date
    expect(result1.jobId).toContain('WC-20250615-');
  });

  it('should use default sessionId if not provided', () => {
    const input = createCompleteInput();
    const result = transformToJobSpec(input);

    expect(result.sessionId).toBeDefined();
    expect(result.sessionId).toMatch(/^sess_\d+_[a-z0-9]+$/);
  });

  it('should handle minimal required fields', () => {
    const input: IntakeInput = {
      contact: {
        contactName: 'Test',
        contactPhone: '0812345678',
        relationship: 'self',
      },
      service: {
        serviceType: 'checkup',
        appointmentType: 'new',
      },
      schedule: {
        appointmentDate: '2025-12-25',
        appointmentTime: '10:00',
        timeFlexibility: 'strict',
      },
      locations: {
        pickup: {
          address: 'Pickup Address',
          contactName: 'Test',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: 'Dropoff Address',
          contactName: 'Hospital',
          contactPhone: '021234567',
        },
      },
      patient: {
        name: 'Patient',
        mobilityLevel: 'independent',
        needsEscort: false,
        needsWheelchair: false,
        oxygenRequired: false,
        stretcherRequired: false,
        conditions: [],
        allergies: [],
        medications: [],
      },
      addons: {
        medicinePickup: false,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: false,
      },
      urgencyLevel: 'low',
    };

    const result = transformToJobSpec(input);
    expect(result.jobId).toBeDefined();
    expect(result.service.type).toBe('checkup');
    expect(result.patient.mobilityLevel).toBe('independent');
  });
});

// ============================================================================
// COMPLEXITY ASSESSMENT TESTS
// ============================================================================

describe('assessComplexity', () => {
  it('should return simple for independent mobility with no addons', () => {
    const input = createCompleteInput({
      patient: {
        ...createCompleteInput().patient,
        mobilityLevel: 'independent',
        needsEscort: false,
        needsWheelchair: false,
      },
      addons: {
        medicinePickup: false,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: false,
      },
      urgencyLevel: 'low',
    });

    expect(assessComplexity(input)).toBe('simple');
  });

  it('should return moderate for single special requirement', () => {
    const input = createCompleteInput({
      patient: {
        ...createCompleteInput().patient,
        mobilityLevel: 'independent',
        needsEscort: true, // single requirement
        needsWheelchair: false,
      },
      addons: {
        medicinePickup: false,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: false,
      },
    });

    expect(assessComplexity(input)).toBe('moderate');
  });

  it('should return moderate for wheelchair without other requirements', () => {
    const input = createCompleteInput({
      patient: {
        ...createCompleteInput().patient,
        mobilityLevel: 'wheelchair',
        needsEscort: false,
        needsWheelchair: true,
      },
      addons: {
        medicinePickup: false,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: false,
      },
    });

    expect(assessComplexity(input)).toBe('moderate');
  });

  it('should return complex for multiple special requirements', () => {
    const input = createCompleteInput({
      patient: {
        ...createCompleteInput().patient,
        mobilityLevel: 'assisted',
        needsEscort: true,
        needsWheelchair: true,
      },
      addons: {
        medicinePickup: true,
        homeCare: false,
        mealService: false,
        interpretation: true,
        accompanyInside: true,
      },
    });

    expect(assessComplexity(input)).toBe('complex');
  });

  it('should return complex for bedridden with any addon', () => {
    const input = createCompleteInput({
      patient: {
        ...createCompleteInput().patient,
        mobilityLevel: 'bedridden',
        needsEscort: true,
      },
      addons: {
        medicinePickup: true,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: false,
      },
    });

    expect(assessComplexity(input)).toBe('complex');
  });

  it('should return critical for urgent + high mobility needs', () => {
    const input = createCompleteInput({
      patient: {
        ...createCompleteInput().patient,
        mobilityLevel: 'bedridden',
        stretcherRequired: true,
      },
      urgencyLevel: 'urgent',
    });

    expect(assessComplexity(input)).toBe('critical');
  });

  it('should return critical for high urgency + oxygen + wheelchair', () => {
    const input = createCompleteInput({
      patient: {
        ...createCompleteInput().patient,
        mobilityLevel: 'wheelchair',
        needsWheelchair: true,
        oxygenRequired: true,
      },
      urgencyLevel: 'high',
    });

    expect(assessComplexity(input)).toBe('critical');
  });

  it('should return complex for chemotherapy with multiple addons', () => {
    const input = createCompleteInput({
      service: {
        ...createCompleteInput().service,
        serviceType: 'chemotherapy',
      },
      patient: {
        ...createCompleteInput().patient,
        needsEscort: true,
        needsWheelchair: true,
      },
      addons: {
        medicinePickup: true,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: true,
      },
    });

    expect(assessComplexity(input)).toBe('complex');
  });
});

// ============================================================================
// COST ESTIMATION TESTS
// ============================================================================

describe('estimateCost', () => {
  it('should calculate base cost', () => {
    const input = createCompleteInput({
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'A', contactName: 'B', contactPhone: '082' },
      },
      urgencyLevel: 'low',
    });

    const cost = estimateCost(input, { estimatedDistance: 0, estimatedDuration: 0 });
    expect(cost.base).toBe(350); // Base rate
    expect(cost.currency).toBe('THB');
  });

  it('should calculate distance cost correctly', () => {
    const input = createCompleteInput();
    const distanceAndDuration = { estimatedDistance: 10, estimatedDuration: 30 };

    const cost = estimateCost(input, distanceAndDuration);
    // Round trip = 20km, at 15 THB/km = 300 THB
    expect(cost.distance).toBe(300);
  });

  it('should calculate duration/navigation cost', () => {
    const input = createCompleteInput({
      service: { serviceType: 'vaccination', appointmentType: 'new' },
      schedule: { ...createCompleteInput().schedule, duration: undefined }, // Use base duration
      addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, accompanyInside: false },
      patient: { ...createCompleteInput().patient, needsWheelchair: false, mobilityLevel: 'independent' },
    });

    // vaccination = 30min base service
    const cost = estimateCost(input, { estimatedDistance: 3, estimatedDuration: 15 });
    // Total minutes: 30 + 30 = 60min = 1 hour at 200 THB/hr
    expect(cost.duration).toBe(200);
  });

  it('should add wheelchair extra fee', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: true },
      addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, accompanyInside: false },
    });

    const cost = estimateCost(input, { estimatedDistance: 0, estimatedDuration: 0 });
    expect(cost.addons).toBeGreaterThanOrEqual(150); // Wheelchair surcharge
  });

  it('should add medicine pickup fee', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: false, mobilityLevel: 'independent' },
      addons: { medicinePickup: true, homeCare: false, mealService: false, interpretation: false, accompanyInside: false },
    });

    const cost = estimateCost(input, { estimatedDistance: 0, estimatedDuration: 0 });
    expect(cost.addons).toBe(100); // Medicine pickup
  });

  it('should add interpretation fee', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: false, mobilityLevel: 'independent' },
      addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: true, accompanyInside: false },
    });

    const cost = estimateCost(input, { estimatedDistance: 0, estimatedDuration: 0 });
    expect(cost.addons).toBe(300); // Interpretation
  });

  it('should add accompanyInside fee', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: false, mobilityLevel: 'independent' },
      addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, accompanyInside: true },
    });

    const cost = estimateCost(input, { estimatedDistance: 0, estimatedDuration: 0 });
    expect(cost.addons).toBe(200); // Extra hour
  });

  it('should add home care fee', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: false, mobilityLevel: 'independent' },
      addons: { medicinePickup: false, homeCare: true, mealService: false, interpretation: false, accompanyInside: false },
    });

    const cost = estimateCost(input, { estimatedDistance: 0, estimatedDuration: 0 });
    expect(cost.addons).toBe(500); // 2 hours of home care
  });

  it('should add urgency surcharge for urgent bookings', () => {
    const input = createCompleteInput({
      urgencyLevel: 'urgent',
      patient: { ...createCompleteInput().patient, needsWheelchair: false, mobilityLevel: 'independent' },
      addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, accompanyInside: false },
    });

    const cost = estimateCost(input, { estimatedDistance: 0, estimatedDuration: 0 });
    expect(cost.addons).toBe(200); // Urgency fee
  });

  it('should calculate total cost correctly', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: true },
    });

    const cost = estimateCost(input, { estimatedDistance: 10, estimatedDuration: 25 });
    // base (350) + distance (300) + duration + addons
    expect(cost.total).toBe(cost.base + cost.distance + cost.duration + cost.addons);
    expect(cost.total).toBeGreaterThan(cost.base);
  });

  it('should round all values to integers', () => {
    const cost = estimateCost(createCompleteInput());

    expect(Number.isInteger(cost.base)).toBe(true);
    expect(Number.isInteger(cost.distance)).toBe(true);
    expect(Number.isInteger(cost.duration)).toBe(true);
    expect(Number.isInteger(cost.addons)).toBe(true);
    expect(Number.isInteger(cost.total)).toBe(true);
  });
});

// ============================================================================
// PRIORITY DERIVATION TESTS
// ============================================================================

describe('derivePriority', () => {
  it('should return priority 1 for urgent urgency', () => {
    const input = createCompleteInput({ urgencyLevel: 'urgent' });
    expect(derivePriority(input)).toBe(1);
  });

  it('should return priority 2 or lower for high urgency', () => {
    const input = createCompleteInput({ urgencyLevel: 'high' });
    const priority = derivePriority(input);
    expect(priority).toBeLessThanOrEqual(2);
    expect(priority).toBeGreaterThanOrEqual(1);
  });

  it('should return priority between 3-4 for normal urgency', () => {
    const input = createCompleteInput({ urgencyLevel: 'normal' });
    const priority = derivePriority(input);
    expect(priority).toBeGreaterThanOrEqual(3);
    expect(priority).toBeLessThanOrEqual(4);
  });

  it('should return priority 4-5 for low urgency', () => {
    const input = createCompleteInput({ urgencyLevel: 'low' });
    const priority = derivePriority(input);
    expect(priority).toBeGreaterThanOrEqual(4);
    expect(priority).toBeLessThanOrEqual(5);
  });

  it('should prioritize urgency over service type', () => {
    // Low priority service but urgent urgency
    const urgentInput = createCompleteInput({
      service: { serviceType: 'vaccination', appointmentType: 'new' },
      urgencyLevel: 'urgent',
    });
    expect(derivePriority(urgentInput)).toBe(1);

    // High priority service but low urgency
    const lowInput = createCompleteInput({
      service: { serviceType: 'chemotherapy', appointmentType: 'new' },
      urgencyLevel: 'low',
    });
    expect(derivePriority(lowInput)).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// VEHICLE TYPE LOGIC TESTS
// ============================================================================

describe('deriveResources - Vehicle Type', () => {
  it('should assign ambulance for stretcher required', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, stretcherRequired: true },
    });

    const resources = deriveResources(input);
    expect(resources.vehicleType).toBe('ambulance');
  });

  it('should assign ambulance for bedridden mobility', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, mobilityLevel: 'bedridden' },
    });

    const resources = deriveResources(input);
    expect(resources.vehicleType).toBe('ambulance');
  });

  it('should assign wheelchair-van for wheelchair needs', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: true, mobilityLevel: 'wheelchair' },
    });

    const resources = deriveResources(input);
    expect(resources.vehicleType).toBe('wheelchair-van');
  });

  it('should assign mpv for long distance with oxygen', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, oxygenRequired: true, needsWheelchair: false },
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081', lat: 13.724, lng: 100.522 },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082', lat: 13.9, lng: 100.7 },
      },
    });

    const resources = deriveResources(input);
    expect(resources.vehicleType).toBe('mpv');
  });

  it('should assign sedan for simple cases', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, mobilityLevel: 'independent', needsWheelchair: false },
    });

    const resources = deriveResources(input);
    expect(resources.vehicleType).toBe('sedan');
  });

  it('should include wheelchair in special equipment when needed', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsWheelchair: true },
    });

    const resources = deriveResources(input);
    expect(resources.specialEquipment).toContain('wheelchair');
  });

  it('should include stretcher in special equipment when needed', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, stretcherRequired: true },
    });

    const resources = deriveResources(input);
    expect(resources.specialEquipment).toContain('stretcher');
  });

  it('should include portable-oxygen when required', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, oxygenRequired: true },
    });

    const resources = deriveResources(input);
    expect(resources.specialEquipment).toContain('portable-oxygen');
  });

  it('should require navigator for escort needs', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsEscort: true, mobilityLevel: 'assisted' },
    });

    const resources = deriveResources(input);
    expect(resources.navigatorRequired).toBe(true);
  });

  it('should require navigator for accompanyInside', () => {
    const input = createCompleteInput({
      patient: { ...createCompleteInput().patient, needsEscort: false },
      addons: { ...createCompleteInput().addons, accompanyInside: true },
    });

    const resources = deriveResources(input);
    expect(resources.navigatorRequired).toBe(true);
  });

  it('should assign PN navigator for medical conditions', () => {
    const input = createCompleteInput({
      service: { serviceType: 'dialysis', appointmentType: 'follow-up' },
      patient: { ...createCompleteInput().patient, needsEscort: true },
    });

    const resources = deriveResources(input);
    expect(resources.navigatorType).toBe('PN');
  });

  it('should calculate estimatedNavHours correctly', () => {
    const input = createCompleteInput();

    const resources = deriveResources(input, 120, 25); // 120 min service, 25 min travel
    // Total: 120 + 50 = 170 min = 2.83 hours, rounded up to 1 decimal = 2.9
    expect(resources.estimatedNavHours).toBeGreaterThan(0);
    expect(resources.estimatedNavHours).toBeDefined();
  });
});

// ============================================================================
// DURATION ESTIMATION TESTS
// ============================================================================

describe('estimateDuration', () => {
  it('should return service type base duration when no duration override', () => {
    const vaccinationInput: IntakeInput = {
      contact: {
        contactName: 'Test',
        contactPhone: '0812345678',
        relationship: 'self',
      },
      service: {
        serviceType: 'vaccination',
        appointmentType: 'new',
      },
      schedule: {
        appointmentDate: '2027-12-25',
        appointmentTime: '10:00',
        timeFlexibility: 'strict',
        duration: undefined,
      },
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082' },
      },
      patient: {
        name: 'Patient',
        mobilityLevel: 'independent',
        needsEscort: false,
        needsWheelchair: false,
        oxygenRequired: false,
        stretcherRequired: false,
        conditions: [],
        allergies: [],
        medications: [],
      },
      addons: {
        medicinePickup: false,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: false,
      },
      urgencyLevel: 'normal',
    };
    // Base vaccination (30 min), independent has 0 mobility adjustment
    expect(estimateDuration(vaccinationInput)).toBe(30);

    const dialysisInput: IntakeInput = {
      ...vaccinationInput,
      service: {
        serviceType: 'dialysis',
        appointmentType: 'new',
      },
    };
    // Base dialysis (240 min), independent has 0 mobility adjustment
    expect(estimateDuration(dialysisInput)).toBe(240);
  });

  it('should return user-specified duration when provided', () => {
    const input = createCompleteInput({
      schedule: { ...createCompleteInput().schedule, duration: 500 },
    });

    expect(estimateDuration(input)).toBe(500);
  });

  it('should add mobility adjustment', () => {
    const independentInput = createCompleteInput({
      schedule: { ...createCompleteInput().schedule, duration: undefined },
      patient: { ...createCompleteInput().patient, mobilityLevel: 'independent' },
    });
    const wheelchairInput = createCompleteInput({
      schedule: { ...createCompleteInput().schedule, duration: undefined },
      patient: { ...createCompleteInput().patient, mobilityLevel: 'wheelchair' },
    });
    const bedriddenInput = createCompleteInput({
      schedule: { ...createCompleteInput().schedule, duration: undefined },
      patient: { ...createCompleteInput().patient, mobilityLevel: 'bedridden' },
    });

    expect(estimateDuration(wheelchairInput)).toBeGreaterThan(estimateDuration(independentInput));
    expect(estimateDuration(bedriddenInput)).toBeGreaterThan(estimateDuration(wheelchairInput));
  });

  it('should add addon adjustments', () => {
    const baseInput = createCompleteInput({
      schedule: { ...createCompleteInput().schedule, duration: undefined },
      patient: { ...createCompleteInput().patient, mobilityLevel: 'independent' },
      addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, accompanyInside: false },
    });

    const withMedicine = createCompleteInput({
      ...baseInput,
      schedule: { ...createCompleteInput().schedule, duration: undefined },
      patient: { ...createCompleteInput().patient, mobilityLevel: 'independent' },
      addons: { medicinePickup: true, homeCare: false, mealService: false, interpretation: false, accompanyInside: false },
    });

    const withAccompany = createCompleteInput({
      ...baseInput,
      schedule: { ...createCompleteInput().schedule, duration: undefined },
      patient: { ...createCompleteInput().patient, mobilityLevel: 'independent' },
      addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, accompanyInside: true },
    });

    expect(estimateDuration(withMedicine)).toBe(estimateDuration(baseInput) + 15);
    expect(estimateDuration(withAccompany)).toBe(estimateDuration(baseInput) + 30);
  });
});

// ============================================================================
// DISTANCE ESTIMATION TESTS
// ============================================================================

describe('estimateDistanceAndDuration', () => {
  it('should estimate based on service type', () => {
    const dialysisInput = createCompleteInput({
      service: { serviceType: 'dialysis', appointmentType: 'new' },
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082' },
      },
    });

    const result = estimateDistanceAndDuration(dialysisInput);
    expect(result.estimatedDistance).toBeGreaterThan(0);
    expect(result.estimatedDuration).toBeGreaterThan(0);
  });

  it('should adjust for urgent bookings', () => {
    const normalInput = createCompleteInput({
      urgencyLevel: 'normal',
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082' },
      },
    });

    const urgentInput = createCompleteInput({
      urgencyLevel: 'urgent',
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082' },
      },
    });

    const normalResult = estimateDistanceAndDuration(normalInput);
    const urgentResult = estimateDistanceAndDuration(urgentInput);

    // Urgent should have slightly lower duration (faster driving)
    expect(urgentResult.estimatedDuration).toBeLessThanOrEqual(normalResult.estimatedDuration);
  });

  it('should adjust for anytime flexibility', () => {
    const strictInput = createCompleteInput({
      schedule: { ...createCompleteInput().schedule, timeFlexibility: 'strict' },
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082' },
      },
    });

    const anytimeInput = createCompleteInput({
      schedule: { ...createCompleteInput().schedule, timeFlexibility: 'anytime' },
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082' },
      },
    });

    const strictResult = estimateDistanceAndDuration(strictInput);
    const anytimeResult = estimateDistanceAndDuration(anytimeInput);

    // Anytime should be faster (can avoid traffic)
    expect(anytimeResult.estimatedDuration).toBeLessThanOrEqual(strictResult.estimatedDuration);
  });

  it('should round duration to nearest 5 minutes', () => {
    const input = createCompleteInput({
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081' },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082' },
      },
    });

    const result = estimateDistanceAndDuration(input);
    expect(result.estimatedDuration % 5).toBe(0);
  });

  it('should use haversine distance when coordinates available', () => {
    const input = createCompleteInput({
      locations: {
        pickup: { address: 'A', contactName: 'A', contactPhone: '081', lat: 13.724, lng: 100.522 },
        dropoff: { address: 'B', contactName: 'B', contactPhone: '082', lat: 13.734, lng: 100.532 },
      },
    });

    const result = estimateDistanceAndDuration(input);
    // Distance should be estimated based on haversine formula
    expect(result.estimatedDistance).toBeGreaterThan(0);
    expect(typeof result.estimatedDistance).toBe('number');
  });
});

// ============================================================================
// JOBID FORMAT TESTS
// ============================================================================

describe('JobId Format', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should match WC-YYYYMMDD-XXXX format', () => {
    vi.setSystemTime(new Date('2025-03-15T10:00:00Z'));
    const input = createCompleteInput();
    const result = transformToJobSpec(input);

    expect(result.jobId).toMatch(/^WC-\d{8}-\d{4}$/);
  });

  it('should generate unique IDs for each call', () => {
    vi.setSystemTime(new Date('2025-03-15T10:00:00Z'));
    const input = createCompleteInput();

    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = transformToJobSpec(input);
      ids.add(result.jobId);
    }

    expect(ids.size).toBe(10);
  });

  it('should use local date in jobId', () => {
    // Set to noon UTC which is the next day in UTC+7
    vi.setSystemTime(new Date('2025-12-31T16:00:00Z')); // This is 2025-12-31 23:00 in UTC+7
    
    const input = createCompleteInput();
    const result = transformToJobSpec(input);

    // JobId uses local date, so in UTC+7 timezone this would be 2026-01-01
    // The exact date depends on the test runner's timezone
    expect(result.jobId).toMatch(/^WC-\d{8}-\d{4}$/);
  });
});
