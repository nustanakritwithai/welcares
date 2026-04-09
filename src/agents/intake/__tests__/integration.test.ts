/**
 * Intake Agent - Integration Tests
 * End-to-end tests สำหรับ Intake Agent flow
 * 
 * Test Cases:
 * 1. Happy path (ข้อมูลครบ ส่งสำเร็จ)
 * 2. Partial form (ข้อมูลไม่ครบ ได้คำถามถัดไป)
 * 3. Validation error (เบอร์ผิด format)
 * 4. Network error (retry แล้วสำเร็จ)
 * 5. Complex case (wheelchair + medicine + accompany)
 * 
 * @version 1.0
 * @module src/agents/intake/__tests__/integration.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IntakeInput, PartialIntakeInput, ServiceType, MobilityLevel, UrgencyLevel } from '../schema';
import {
  previewIntake,
  submitIntake,
} from '../service';
import {
  validateFormData,
} from '../validator';
import {
  transformToJobSpec,
} from '../transformer';

// ============================================================================
// FIXTURES - Test Data
// ============================================================================

const createCompleteInput = (overrides: Partial<IntakeInput> = {}): IntakeInput => ({
  contact: {
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'somchai@example.com',
    relationship: 'son',
  },
  service: {
    serviceType: 'checkup',
    appointmentType: 'new',
  },
  schedule: {
    appointmentDate: '2027-12-25',
    appointmentTime: '10:00',
    timeFlexibility: 'strict',
  },
  locations: {
    pickup: {
      address: '123 ถนนสุขุมวิท',
      contactName: 'สมชาย ใจดี',
      contactPhone: '0812345678',
    },
    dropoff: {
      address: '456 ถนนพญาไท',
      contactName: 'พยาบาลสถาน',
      contactPhone: '021234567',
    },
  },
  patient: {
    name: 'นางสมหวัง ใจดี',
    age: 75,
    gender: 'female',
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
  specialNotes: '',
  ...overrides,
});

const createPartialInput = (): PartialIntakeInput => ({
  contact: {
    contactName: 'สมชาย',
    contactPhone: '0812345678',
    relationship: 'self',
  },
  // Missing: service, schedule, locations, patient, addons, urgencyLevel
});

// ============================================================================
// TEST CASE 1: Happy Path (ข้อมูลครบ ส่งสำเร็จ)
// ============================================================================

describe('Integration Test 1: Happy Path', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('should complete full flow: form → validate → preview → submit', async () => {
    // Arrange
    const input = createCompleteInput();
    const mockResponse = { jobId: 'WC-20271225-1234', status: 'confirmed' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    // Step 1: Validate form data
    const validation = validateFormData(input);
    expect(validation.isComplete).toBe(true);
    expect(validation.missingFields).toHaveLength(0);
    expect(validation.warnings).toHaveLength(0);

    // Step 2: Preview JobSpec
    const preview = await previewIntake(input);
    expect(preview.success).toBe(true);
    expect(preview.jobSpec).toBeDefined();
    expect(preview.jobSpec?.service.type).toBe('checkup');
    expect(preview.jobSpec?.patient.name).toBe('นางสมหวัง ใจดี');
    expect(preview.jobSpec?.contact.primary.phone).toBe('081-234-5678');

    // Step 3: Submit form
    const submit = await submitIntake(input);
    expect(submit.success).toBe(true);
    expect(submit.jobId).toBe('WC-20271225-1234');
    expect(submit.jobSpec).toBeDefined();

    // Verify all steps maintain data consistency
    expect(preview.jobSpec?.patient.name).toBe(submit.jobSpec?.patient.name);
    expect(preview.jobSpec?.service.type).toBe(submit.jobSpec?.service.type);
  });

  it('should generate correct JobSpec with all calculated fields', async () => {
    const input = createCompleteInput();
    const jobSpec = transformToJobSpec(input, 'test-session');

    // Metadata
    expect(jobSpec.jobId).toMatch(/^WC-\d{8}-\d{4}$/);
    expect(jobSpec.version).toBe('1.0');
    expect(jobSpec.status).toBe('pending');

    // Service
    expect(jobSpec.service.typeLabel).toBe('ตรวจสุขภาพ');
    expect(jobSpec.service.category).toBe('checkup');
    expect(jobSpec.service.priority).toBeGreaterThanOrEqual(1);
    expect(jobSpec.service.priority).toBeLessThanOrEqual(5);

    // Cost
    expect(jobSpec.assessment.estimatedCost.base).toBe(350);
    expect(jobSpec.assessment.estimatedCost.currency).toBe('THB');
    expect(jobSpec.assessment.estimatedCost.total).toBeGreaterThan(0);

    // Resources
    expect(jobSpec.assessment.resources.vehicleType).toBe('sedan');
    expect(jobSpec.assessment.resources.navigatorRequired).toBe(false);
  });

  it('should return success result with jobId after submit', async () => {
    const input = createCompleteInput();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'WC-20271225-9999' }),
    });

    const result = await submitIntake(input);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.errorType).toBeUndefined();
    expect(result.jobId).toBeDefined();
    expect(result.jobSpec).toBeDefined();
  });
});

// ============================================================================
// TEST CASE 2: Partial Form (ข้อมูลไม่ครบ ได้คำถามถัดไป)
// ============================================================================

describe('Integration Test 2: Partial Form', () => {
  it('should return next question when required fields are missing', async () => {
    // Arrange
    const partialInput = createPartialInput();

    // Act
    const validation = validateFormData(partialInput);
    const preview = await previewIntake(partialInput);

    // Assert
    expect(validation.isComplete).toBe(false);
    expect(validation.missingFields.length).toBeGreaterThan(0);
    expect(validation.nextQuestion).toBeTruthy();

    expect(preview.success).toBe(false);
    expect(preview.validation).toBeDefined();
    expect(preview.validation?.isComplete).toBe(false);
    expect(preview.validation?.missingFields.length).toBeGreaterThan(0);
    expect(preview.validation?.followUpQuestions.length).toBeGreaterThan(0);
    expect(preview.jobSpec).toBeUndefined();
  });

  it('should progressively fill form and get updated questions', async () => {
    // Start with minimal data
    let formData: PartialIntakeInput = {
      contact: {
        contactName: 'สมชาย',
        contactPhone: '0812345678',
        relationship: 'self',
      },
    };

    // Step 1: Should ask for patient name
    let validation = validateFormData(formData);
    expect(validation.isComplete).toBe(false);
    expect(validation.missingFields).toContain('patient.name');
    expect(validation.nextQuestion).toContain('ชื่อผู้ป่วย');

    // Add patient name
    formData = {
      ...formData,
      patient: {
        name: 'นางสมหวัง',
        mobilityLevel: 'independent',
        needsEscort: false,
        needsWheelchair: false,
        oxygenRequired: false,
        stretcherRequired: false,
        conditions: [],
        allergies: [],
        medications: [],
      },
    };

    // Step 2: Should ask for service type
    validation = validateFormData(formData);
    expect(validation.isComplete).toBe(false);
    expect(validation.missingFields).toContain('service.serviceType');
    expect(validation.nextQuestion).toContain('บริการ');

    // Add service type
    formData = {
      ...formData,
      service: {
        serviceType: 'checkup' as ServiceType,
        appointmentType: 'new',
      },
    };

    // Step 3: Should ask for schedule
    validation = validateFormData(formData);
    expect(validation.isComplete).toBe(false);
    expect(validation.missingFields).toContain('schedule.appointmentDate');
    expect(validation.nextQuestion).toContain('วัน');

    // Continue filling...
    formData = {
      ...formData,
      schedule: {
        appointmentDate: '2027-12-25',
        appointmentTime: '10:00',
        timeFlexibility: 'strict',
      },
    };

    // Step 4: Should ask for locations
    validation = validateFormData(formData);
    expect(validation.isComplete).toBe(false);
    expect(validation.missingFields).toContain('locations.pickup.address');
    expect(validation.nextQuestion).toContain('รับ');

    // Add locations
    formData = {
      ...formData,
      locations: {
        pickup: {
          address: '123 Main St',
          contactName: 'Test',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: '456 Hospital',
          contactName: 'Hospital',
          contactPhone: '021234567',
        },
      },
    };

    formData = {
      ...formData,
      addons: {
        medicinePickup: false,
        homeCare: false,
        mealService: false,
        interpretation: false,
        accompanyInside: false,
      },
      urgencyLevel: 'normal' as UrgencyLevel,
    };

    // Final step: Should be complete
    validation = validateFormData(formData);
    expect(validation.isComplete).toBe(true);
    expect(validation.missingFields).toHaveLength(0);
  });

  it('should include progress information in validation result', async () => {
    const partialInput = createPartialInput();
    const preview = await previewIntake(partialInput);

    expect(preview.validation?.progress).toBeDefined();
    expect(preview.validation?.progress.total).toBeGreaterThan(0);
    expect(preview.validation?.progress.completed).toBeGreaterThanOrEqual(0);
    expect(preview.validation?.progress.percentage).toBeGreaterThanOrEqual(0);
    expect(preview.validation?.progress.percentage).toBeLessThanOrEqual(100);
    expect(preview.validation?.progress.percentage).toBeLessThan(100); // Not complete
  });
});

// ============================================================================
// TEST CASE 3: Validation Error (เบอร์ผิด format)
// ============================================================================

describe('Integration Test 3: Validation Error - Invalid Phone', () => {
  it('should detect invalid phone format and return error', async () => {
    const input = createCompleteInput({
      contact: {
        contactName: 'สมชาย',
        contactPhone: '123456789', // Invalid: doesn't start with 0
        relationship: 'self',
      },
    });

    const validation = validateFormData(input);

    expect(validation.warnings).toHaveLength(1);
    expect(validation.warnings[0].field).toBe('contact.contactPhone');
    expect(validation.warnings[0].severity).toBe('error');
    expect(validation.isComplete).toBe(false); // Has error = not complete
  });

  it('should reject phone that is too short', async () => {
    const input = createCompleteInput({
      contact: {
        contactName: 'สมชาย',
        contactPhone: '08123456', // Too short (8 digits)
        relationship: 'self',
      },
    });

    const validation = validateFormData(input);

    expect(validation.warnings.some(w => w.field === 'contact.contactPhone')).toBe(true);
    expect(validation.warnings.some(w => w.severity === 'error')).toBe(true);
  });

  it('should reject phone that is too long', async () => {
    const input = createCompleteInput({
      contact: {
        contactName: 'สมชาย',
        contactPhone: '081234567890', // Too long (12 digits)
        relationship: 'self',
      },
    });

    const validation = validateFormData(input);

    expect(validation.warnings.some(w => w.field === 'contact.contactPhone')).toBe(true);
  });

  it('should reject submission with invalid phone', async () => {
    const input = createCompleteInput({
      contact: {
        contactName: 'สมชาย',
        contactPhone: 'invalid-phone',
        relationship: 'self',
      },
    });

    const submit = await submitIntake(input);

    expect(submit.success).toBe(false);
    expect(submit.errorType).toBe('validation_error');
  });

  it('should validate all phone fields (contact, pickup, dropoff)', async () => {
    const input = createCompleteInput({
      contact: {
        contactName: 'สมชาย',
        contactPhone: '0812345678', // Valid
        relationship: 'self',
      },
      locations: {
        pickup: {
          address: '123 Main',
          contactName: 'Test',
          contactPhone: 'invalid', // Invalid
        },
        dropoff: {
          address: '456 Hospital',
          contactName: 'Hospital',
          contactPhone: '021234567', // Valid
        },
      },
    });

    const validation = validateFormData(input);
    const pickupPhoneError = validation.warnings.find(w => w.field === 'locations.pickup.contactPhone');

    expect(pickupPhoneError).toBeDefined();
    expect(pickupPhoneError?.severity).toBe('error');
  });
});

// ============================================================================
// TEST CASE 4: Network Error (retry แล้วสำเร็จ)
// ============================================================================

describe('Integration Test 4: Network Error - Retry Success', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry on network error and eventually succeed', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed')) // First attempt fails
      .mockRejectedValueOnce(new Error('network error')) // Second attempt fails
      .mockResolvedValueOnce({ // Third attempt succeeds
        ok: true,
        json: () => Promise.resolve({ jobId: 'WC-20271225-8888' }),
      });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const resultPromise = submitIntake(input);

    // Fast-forward through retry delays
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.jobId).toBe('WC-20271225-8888');
  });

  it('should retry on timeout error', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'WC-20271225-7777' }),
      });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const resultPromise = submitIntake(input);
    await vi.advanceTimersByTimeAsync(3000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('should retry on 5xx server error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'WC-20271225-6666' }),
      });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const resultPromise = submitIntake(input);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.jobId).toBe('WC-20271225-6666');
  });

  it('should not retry on 4xx client error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const result = await submitIntake(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation_error');
  });

  it('should give up after max retries and return error', async () => {
    vi.useRealTimers(); // Use real timers for this test
    
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('fetch failed'));
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const result = await submitIntake(input);

    expect(fetchMock).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(result.success).toBe(false);
    expect(result.errorType).toBe('network_error');
  });
});

// ============================================================================
// TEST CASE 5: Complex Case (wheelchair + medicine + accompany)
// ============================================================================

describe('Integration Test 5: Complex Case', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  const createComplexInput = (): IntakeInput => ({
    contact: {
      contactName: 'สมชาย ใจดี',
      contactPhone: '0812345678',
      contactEmail: 'somchai@example.com',
      relationship: 'son',
    },
    service: {
      serviceType: 'chemotherapy',
      serviceSubType: 'รอบที่ 3',
      department: 'มะเร็งวิทยา',
      doctorName: 'Dr. วิชัย',
      appointmentType: 'follow-up',
    },
    schedule: {
      appointmentDate: '2027-12-25',
      appointmentTime: '09:00',
      timeFlexibility: '30min',
    },
    locations: {
      pickup: {
        address: '123 ถนนสุขุมวิท',
        lat: 13.7244416,
        lng: 100.522,
        contactName: 'สมชาย ใจดี',
        contactPhone: '0812345678',
        buildingName: 'คอนโด ABC',
        floor: '15',
        roomNumber: 'A1501',
        landmarks: 'ใกล้ BTS พร้อมพงษ์',
        parkingNote: 'จอดรถชั้นใต้ดิน',
      },
      dropoff: {
        address: '456 ถนนพญาไท รพ. จุฬาลงกรณ์',
        lat: 13.758,
        lng: 100.532,
        contactName: 'พยาบาลสถาน',
        contactPhone: '021234567',
        name: 'รพ. จุฬาลงกรณ์',
        department: 'ศูนย์มะเร็ง',
      },
    },
    patient: {
      name: 'นางสมหวัง ใจดี',
      age: 68,
      gender: 'female',
      weight: 55,
      mobilityLevel: 'wheelchair',
      needsEscort: true,
      needsWheelchair: true,
      oxygenRequired: false,
      stretcherRequired: false,
      conditions: ['มะเร็งเต้านม', 'เบาหวาน', 'ความดันโลหิตสูง'],
      allergies: ['แพ้ยาแอสไพริน', 'แพ้แมลงสต๊อฟ'],
      medications: ['Metformin 500mg', 'Amlodipine 5mg', 'Tamoxifen 20mg'],
    },
    addons: {
      medicinePickup: true, // ต้องรับยากลับ
      homeCare: false,
      mealService: false,
      interpretation: false,
      accompanyInside: true, // พี่เลี้ยงเข้าไปด้วย
    },
    urgencyLevel: 'high',
    specialNotes: 'ผู้ป่วยต้องการความช่วยเหลือในการขึ้นลงรถเข็น ต้องใช้ลิฟต์ขนย้ายผู้ป่วย',
  });

  it('should handle complex case with wheelchair + medicine + accompany', async () => {
    const input = createComplexInput();

    // Mock API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'WC-20271225-COMPLEX' }),
    });

    // Validate
    const validation = validateFormData(input);
    expect(validation.isComplete).toBe(true);

    // Transform
    const preview = await previewIntake(input);
    expect(preview.success).toBe(true);
    expect(preview.jobSpec).toBeDefined();

    // Verify complex case handling
    const jobSpec = preview.jobSpec!;

    // Check complexity assessment
    expect(jobSpec.assessment.complexity).toBe('complex');

    // Check vehicle type for wheelchair
    expect(jobSpec.assessment.resources.vehicleType).toBe('wheelchair-van');

    // Check special equipment
    expect(jobSpec.assessment.resources.specialEquipment).toContain('wheelchair');

    // Check navigator required
    expect(jobSpec.assessment.resources.navigatorRequired).toBe(true);

    // Check flags
    expect(jobSpec.notes.flags).toContain('COMPLEX');
    expect(jobSpec.notes.flags).toContain('WHEELCHAIR');
  });

  it('should calculate correct cost for complex case', async () => {
    const input = createComplexInput();
    const jobSpec = transformToJobSpec(input);

    // Complex case should have higher cost
    expect(jobSpec.assessment.estimatedCost.total).toBeGreaterThan(500);

    // Should include wheelchair extra
    expect(jobSpec.assessment.estimatedCost.addons).toBeGreaterThan(0);

    // Cost breakdown should be complete
    expect(jobSpec.assessment.estimatedCost.base).toBe(350);
    expect(jobSpec.assessment.estimatedCost.currency).toBe('THB');
  });

  it('should generate special accommodations for wheelchair patient', async () => {
    const input = createComplexInput();
    const jobSpec = transformToJobSpec(input);

    expect(jobSpec.patient.specialAccommodations).toContain('WHEELCHAIR_ACCESSIBLE');
  });

  it('should include all patient conditions in internal notes', async () => {
    const input = createComplexInput();
    const jobSpec = transformToJobSpec(input);

    expect(jobSpec.notes.internal).toContain('มะเร็งเต้านม');
    expect(jobSpec.notes.internal).toContain('เบาหวาน');
    expect(jobSpec.notes.internal).toContain('ความดันโลหิตสูง');
    expect(jobSpec.notes.internal).toContain('COMPLEX');
  });

  it('should handle high urgency chemotherapy correctly', async () => {
    const input = createComplexInput();
    const jobSpec = transformToJobSpec(input);

    expect(jobSpec.service.type).toBe('chemotherapy');
    expect(jobSpec.assessment.urgencyLevel).toBe('high');
    expect(jobSpec.service.priority).toBeLessThanOrEqual(2); // High priority for chemo + high urgency
  });

  it('should include building/floor/room info in locations', async () => {
    const input = createComplexInput();
    const jobSpec = transformToJobSpec(input);

    expect(jobSpec.locations.pickup.buildingName).toBe('คอนโด ABC');
    expect(jobSpec.locations.pickup.floor).toBe('15');
    expect(jobSpec.locations.pickup.roomNumber).toBe('A1501');
    expect(jobSpec.locations.dropoff.name).toBe('รพ. จุฬาลงกรณ์');
  });

  it('should add medicine pickup and accompany inside to duration', async () => {
    const input = createComplexInput();
    const jobSpec = transformToJobSpec(input);

    // Chemotherapy base is 300 min
    // + 15 min for medicinePickup
    // + 30 min for accompanyInside
    // + 15 min for wheelchair
    expect(jobSpec.service.estimatedDuration).toBeGreaterThanOrEqual(300);
  });

  it('should successfully submit complex case', async () => {
    const input = createComplexInput();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'WC-20271225-COMPLEX2' }),
    });

    const result = await submitIntake(input);

    expect(result.success).toBe(true);
    expect(result.jobId).toBe('WC-20271225-COMPLEX2');
    expect(result.jobSpec).toBeDefined();
  });
});

// ============================================================================
// END-TO-END WORKFLOW TESTS
// ============================================================================

describe('End-to-End Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('should handle complete user journey: empty → partial → complete → submit', async () => {
    // Mock API
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'WC-20271225-FINAL' }),
    });

    // Start empty
    let formData: PartialIntakeInput = {};
    let validation = validateFormData(formData);
    expect(validation.isComplete).toBe(false);

    // Step-by-step completion
    const steps = [
      { contact: { contactName: 'สมชาย', contactPhone: '0812345678', relationship: 'self' } },
      { patient: { name: 'นางสมหวัง', mobilityLevel: 'independent', needsEscort: false, needsWheelchair: false, oxygenRequired: false, stretcherRequired: false, conditions: [], allergies: [], medications: [] } },
      { service: { serviceType: 'checkup', appointmentType: 'new' } },
      { schedule: { appointmentDate: '2027-12-25', appointmentTime: '10:00', timeFlexibility: 'strict' } },
      { locations: { pickup: { address: '123 Main', contactName: 'Test', contactPhone: '0812345678' }, dropoff: { address: '456 Hospital', contactName: 'Hospital', contactPhone: '021234567' } } },
      { addons: { medicinePickup: false, homeCare: false, mealService: false, interpretation: false, accompanyInside: false }, urgencyLevel: 'normal' },
    ];

    for (const step of steps) {
      formData = { ...formData, ...step };
      validation = validateFormData(formData);
    }

    // Should be complete now
    expect(validation.isComplete).toBe(true);

    // Preview
    const preview = await previewIntake(formData);
    expect(preview.success).toBe(true);

    // Submit
    const submit = await submitIntake(formData);
    expect(submit.success).toBe(true);
    expect(submit.jobId).toBe('WC-20271225-FINAL');
  });

  it('should maintain data integrity throughout the flow', async () => {
    const input = createCompleteInput({
      patient: { name: 'ทดสอบ ข้อมูล', age: 80, gender: 'male', weight: 70, mobilityLevel: 'assisted', needsEscort: true, needsWheelchair: false, oxygenRequired: false, stretcherRequired: false, conditions: ['หัวใจ'], allergies: [], medications: ['ยาหัวใจ'] },
      service: { serviceType: 'dialysis', appointmentType: 'follow-up' },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'WC-20271225-INTEGRITY' }),
    });

    const validation = validateFormData(input);
    const preview = await previewIntake(input);
    const submit = await submitIntake(input);

    expect(validation.isComplete).toBe(true);
    expect(preview.success).toBe(true);
    expect(submit.success).toBe(true);

    // Verify data consistency
    expect(preview.jobSpec?.patient.name).toBe('ทดสอบ ข้อมูล');
    expect(submit.jobSpec?.patient.name).toBe('ทดสอบ ข้อมูล');
    expect(preview.jobSpec?.service.type).toBe('dialysis');
    expect(submit.jobSpec?.service.type).toBe('dialysis');
  });
});
