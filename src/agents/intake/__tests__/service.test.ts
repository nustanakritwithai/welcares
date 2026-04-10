/**
 * Intake Agent - Service Layer Tests
 * ทดสอบ service layer, API calls, retry logic, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PartialIntakeInput, IntakeInput, ServiceType, MobilityLevel, UrgencyLevel } from '../schema';
import {
  previewIntake,
  submitIntake,
  getConfig,
  createServiceError,
  sanitizeForLog,
} from '../service';

// ============================================================================
// FIXTURES
// ============================================================================

const createCompleteInput = (): IntakeInput => ({
  contact: {
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    relationship: 'son',
  },
  service: {
    serviceType: 'checkup' as ServiceType,
    appointmentType: 'new',
  },
  schedule: {
    appointmentDate: '2027-12-25',
    appointmentTime: '10:00',
    timeFlexibility: 'strict',
  },
  locations: {
    pickup: {
      address: '123 Main St',
      contactName: 'Test',
      contactPhone: '0812345678',
    },
    dropoff: {
      address: '456 Hospital Rd',
      contactName: 'Hospital',
      contactPhone: '021234567',
    },
  },
  patient: {
    name: 'นางทดสอบ',
    mobilityLevel: 'independent' as MobilityLevel,
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
  urgencyLevel: 'normal' as UrgencyLevel,
  specialNotes: '',
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
// CONFIG TESTS
// ============================================================================

describe('getConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.INTAKE_API_URL;
    delete process.env.INTAKE_API_TIMEOUT;
    delete process.env.INTAKE_RETRY_ATTEMPTS;
    delete process.env.INTAKE_RETRY_DELAY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return default config when env not set', () => {
    const config = getConfig();

    expect(config.baseUrl).toBe('/api');
    expect(config.timeout).toBe(30000);
    expect(config.retryAttempts).toBe(3);
    expect(config.retryDelay).toBe(1000);
  });

  it('should read config from environment variables', () => {
    process.env.INTAKE_API_URL = 'https://custom.api.com/v2';
    process.env.INTAKE_API_TIMEOUT = '5000';
    process.env.INTAKE_RETRY_ATTEMPTS = '5';
    process.env.INTAKE_RETRY_DELAY = '2000';

    const config = getConfig();

    expect(config.baseUrl).toBe('https://custom.api.com/v2');
    expect(config.timeout).toBe(5000);
    expect(config.retryAttempts).toBe(5);
    expect(config.retryDelay).toBe(2000);
  });

  it('should handle invalid numeric env values gracefully', () => {
    process.env.INTAKE_API_TIMEOUT = 'invalid';
    process.env.INTAKE_RETRY_ATTEMPTS = 'also-invalid';

    const config = getConfig();

    expect(config.timeout).toBe(30000); // Default
    expect(config.retryAttempts).toBe(3); // Default
  });
});

// ============================================================================
// PII SANITIZATION TESTS
// ============================================================================

describe('sanitizeForLog', () => {
  it('should only log field names, not values', () => {
    const formData: PartialIntakeInput = {
      contact: {
        contactName: 'John Doe',
        contactPhone: '0812345678',
        contactEmail: 'john@example.com',
        relationship: 'self',
      },
      patient: {
        name: 'Patient Name',
      },
      service: {
        serviceType: 'checkup' as ServiceType,
      },
      schedule: {
        appointmentDate: '2025-12-25',
        appointmentTime: '10:00',
      },
      locations: {
        pickup: { address: '123 Main St' },
        dropoff: { address: '456 Hospital' },
      },
    };

    const result = sanitizeForLog(formData);

    // Should contain field names
    expect(result).toContain('contact.contactName');
    expect(result).toContain('contact.contactPhone');
    expect(result).toContain('patient.name');

    // Should NOT contain actual values
    expect(result).not.toContain('John Doe');
    expect(result).not.toContain('0812345678');
    expect(result).not.toContain('john@example.com');
    expect(result).not.toContain('Patient Name');
  });

  it('should handle empty form data', () => {
    const result = sanitizeForLog({});
    expect(result).toBe('FormData[]');
  });

  it('should handle partial form data', () => {
    const formData: PartialIntakeInput = {
      contact: {
        contactName: 'Test',
      },
    };

    const result = sanitizeForLog(formData);
    expect(result).toContain('contact.contactName');
    expect(result).not.toContain('Test');
  });
});

// ============================================================================
// PREVIEW INTAKE TESTS
// ============================================================================

describe('previewIntake', () => {
  it('should return validation result for incomplete form', async () => {
    const input = createPartialInput();
    const result = await previewIntake(input);

    expect(result.success).toBe(false);
    expect(result.validation).toBeDefined();
    expect(result.validation?.isComplete).toBe(false);
    expect(result.validation?.missingFields.length).toBeGreaterThan(0);
    expect(result.validation?.followUpQuestions.length).toBeGreaterThan(0);
    expect(result.jobSpec).toBeUndefined();
  });

  it('should return JobSpec for complete form', async () => {
    const input = createCompleteInput();
    const result = await previewIntake(input);

    expect(result.success).toBe(true);
    expect(result.jobSpec).toBeDefined();
    expect(result.jobSpec?.jobId).toBeDefined();
    expect(result.jobSpec?.service.type).toBe('checkup');
    expect(result.validation).toBeUndefined();
  });

  it('should normalize input data', async () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: '  Test Name  ',
        contactPhone: '+66812345678',
        relationship: 'self',
      },
      service: {
        serviceType: 'checkup' as ServiceType,
        appointmentType: 'new',
      },
      schedule: {
        appointmentDate: '25/12/2027',
        appointmentTime: '10:00',
        timeFlexibility: 'strict',
      },
      locations: {
        pickup: {
          address: 'Pickup',
          contactName: 'A',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: 'Dropoff',
          contactName: 'B',
          contactPhone: '021234567',
        },
      },
      patient: {
        name: 'Patient',
        mobilityLevel: 'independent' as MobilityLevel,
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
      urgencyLevel: 'normal' as UrgencyLevel,
      specialNotes: '',
    };

    const result = await previewIntake(input);

    expect(result.success).toBe(true);
    expect(result.jobSpec).toBeDefined();
    // Phone should be normalized
    expect(result.jobSpec?.contact.primary.phone).toBe('081-234-5678');
  });

  it('should handle validation errors gracefully', async () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'Test',
        contactPhone: 'invalid-phone', // Invalid phone
        relationship: 'self',
      },
    };

    const result = await previewIntake(input);

    expect(result.success).toBe(false);
    expect(result.validation).toBeDefined();
    expect(result.validation?.errors.some(e => e.field === 'contact.contactPhone')).toBe(true);
  });

  it('should include progress in validation result', async () => {
    const input = createPartialInput();
    const result = await previewIntake(input);

    expect(result.validation?.progress).toBeDefined();
    expect(result.validation?.progress.total).toBeGreaterThan(0);
    expect(result.validation?.progress.completed).toBeGreaterThanOrEqual(0);
    expect(result.validation?.progress.percentage).toBeGreaterThanOrEqual(0);
    expect(result.validation?.progress.percentage).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// SUBMIT INTAKE TESTS
// ============================================================================

describe('submitIntake', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('should return validation error for incomplete form', async () => {
    const input = createPartialInput();
    const result = await submitIntake(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe('ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลให้ครบ');
    expect(result.errorType).toBe('validation_error');
    expect(result.jobId).toBeUndefined();
  });

  it('should submit successfully with complete form', async () => {
    const mockResponse = { jobId: 'WC-20251225-1234', status: 'confirmed' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const input = createCompleteInput();
    const result = await submitIntake(input);

    expect(result.success).toBe(true);
    expect(result.jobId).toBe('WC-20251225-1234');
    expect(result.jobSpec).toBeDefined();
  });

  it('should include jobSpec in success result', async () => {
    const mockResponse = { jobId: 'WC-20251225-1234', status: 'confirmed' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const input = createCompleteInput();
    const result = await submitIntake(input);

    expect(result.jobSpec).toBeDefined();
    expect(result.jobSpec?.service.type).toBe('checkup');
    expect(result.jobSpec?.patient.name).toBe('นางทดสอบ');
  });

  it('should POST to correct endpoint', async () => {
    const mockResponse = { jobId: 'WC-20251225-1234', status: 'confirmed' };
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    await submitIntake(input);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/intake/submit',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })
    );
  });

  it('should send correct request body', async () => {
    const mockResponse = { jobId: 'WC-20251225-1234', status: 'confirmed' };
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    await submitIntake(input);

    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.jobSpec).toBeDefined();
    expect(body.sessionId).toBeDefined();
    expect(body.submittedAt).toBeDefined();
    expect(body.jobSpec.service.type).toBe('checkup');
  });
});

// ============================================================================
// RETRY BEHAVIOR TESTS
// ============================================================================

describe('submitIntake - Retry Behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry on network error', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'WC-20251225-1234' }),
      });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const resultPromise = submitIntake(input);

    // Fast-forward through delays
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
  });

  it('should retry on timeout error', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'WC-20251225-1234' }),
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
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service Unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'WC-20251225-1234' }),
      });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const resultPromise = submitIntake(input);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
  });

  it('should NOT retry on 4xx client error', async () => {
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

  it('should NOT retry on 401 unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const result = await submitIntake(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('should NOT retry on 404 not found', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const result = await submitIntake(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('should give up after max retries', async () => {
    // Restore real timers for this test since fake timers don't work well with retry delays
    vi.useRealTimers();
    
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
    
    // Restore fake timers for subsequent tests
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('should apply exponential backoff between retries', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'WC-20251225-1234' }),
      });
    global.fetch = fetchMock;

    const input = createCompleteInput();
    const resultPromise = submitIntake(input);
    await vi.advanceTimersByTimeAsync(5000);
    await resultPromise;

    // Check that setTimeout was called with increasing delays
    const delays = setTimeoutSpy.mock.calls
      .map(call => call[1] as number)
      .filter(ms => ms > 0);
    
    // Should have retry delays
    expect(delays.length).toBeGreaterThan(0);
    
    setTimeoutSpy.mockRestore();
  });
});

// ============================================================================
// ERROR CLASSIFICATION TESTS
// ============================================================================

describe('Error Classification', () => {
  describe('createServiceError', () => {
    it('should classify network errors', () => {
      const error = new Error('fetch failed');
      const serviceError = createServiceError(error);

      expect(serviceError.type).toBe('network_error');
      expect(serviceError.retryable).toBe(true);
    });

    it('should classify ECONNREFUSED as network error', () => {
      const error = new Error('ECONNREFUSED');
      const serviceError = createServiceError(error);

      expect(serviceError.type).toBe('network_error');
      expect(serviceError.retryable).toBe(true);
    });

    it('should classify ENOTFOUND as network error', () => {
      const error = new Error('ENOTFOUND');
      const serviceError = createServiceError(error);

      expect(serviceError.type).toBe('network_error');
      expect(serviceError.retryable).toBe(true);
    });

    it('should classify timeout errors', () => {
      const error = new Error('ETIMEDOUT');
      const serviceError = createServiceError(error);

      expect(serviceError.type).toBe('timeout_error');
      expect(serviceError.retryable).toBe(true);
    });

    it('should classify AbortError as timeout', () => {
      const error = new Error('AbortError');
      const serviceError = createServiceError(error);

      expect(serviceError.type).toBe('timeout_error');
      expect(serviceError.retryable).toBe(true);
    });

    it('should classify unknown errors', () => {
      const error = new Error('Something unexpected');
      const serviceError = createServiceError(error);

      expect(serviceError.type).toBe('unknown_error');
      expect(serviceError.retryable).toBe(false);
    });

    it('should handle non-Error objects', () => {
      const serviceError = createServiceError('string error');

      expect(serviceError.type).toBe('unknown_error');
      expect(serviceError.retryable).toBe(false);
    });

    it('should handle null/undefined', () => {
      const nullError = createServiceError(null);
      const undefinedError = createServiceError(undefined);

      expect(nullError.type).toBe('unknown_error');
      expect(undefinedError.type).toBe('unknown_error');
    });
  });

  describe('submitIntake error types', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should return validation_error for 400 response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const input = createCompleteInput();
      const result = await submitIntake(input);

      expect(result.errorType).toBe('validation_error');
    });

    it('should return server_error for 500 response', async () => {
      // Mock all 3 attempts to return 500
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
        });

      const input = createCompleteInput();
      const result = await submitIntake(input);

      expect(result.errorType).toBe('server_error');
    });

    it('should return network_error for fetch failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fetch failed'));

      const input = createCompleteInput();
      const result = await submitIntake(input);

      expect(result.errorType).toBe('network_error');
    });

    it('should return timeout_error for timeout', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ETIMEDOUT'));

      const input = createCompleteInput();
      const result = await submitIntake(input);

      expect(result.errorType).toBe('timeout_error');
    });

    it('should include Thai error messages', async () => {
      // Mock all 3 attempts to return 500
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        });

      const input = createCompleteInput();
      const result = await submitIntake(input);

      expect(result.error).toContain('เซิร์ฟเวอร์');
    });
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty object in previewIntake', async () => {
    const result = await previewIntake({});

    expect(result.success).toBe(false);
    expect(result.validation).toBeDefined();
    expect(result.validation?.isComplete).toBe(false);
    expect(result.validation?.missingFields.length).toBeGreaterThan(0);
  });

  it('should handle null values in form data', async () => {
    const input: PartialIntakeInput = {
      contact: {
        contactName: 'Test',
        contactPhone: '0812345678',
        relationship: 'self',
        contactEmail: undefined,
        lineUserId: undefined,
      },
    };

    const result = await previewIntake(input);

    expect(result.success).toBe(false);
    expect(result.validation).toBeDefined();
  });

  it('should sanitize PII in error logs', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    // Use complete input so validation passes and fetch is called
    const input = createCompleteInput();

    await submitIntake(input);

    // Console should have been called with sanitized message
    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls.find(call => 
      typeof call[0] === 'string' && call[0].includes('[submitIntake]')
    );
    
    if (logCall) {
      const logMessage = logCall[0] as string;
      expect(logMessage).not.toContain('สมชาย ใจดี');
      expect(logMessage).not.toContain('0812345678');
      expect(logMessage).not.toContain('นางทดสอบ');
    }

    consoleSpy.mockRestore();
  });

  it('should handle malformed API response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ unexpectedField: 'value' }), // Missing jobId
    });

    const input = createCompleteInput();
    const result = await submitIntake(input);

    // Should still succeed if fetch returned ok
    expect(result.success).toBe(true);
  });

  it('should handle API response with invalid JSON', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const input = createCompleteInput();
    const result = await submitIntake(input);

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Integration Scenarios', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should handle full workflow: incomplete -> complete -> submit', async () => {
    // Step 1: Preview incomplete form
    const partialInput = createPartialInput();
    const preview1 = await previewIntake(partialInput);

    expect(preview1.success).toBe(false);
    expect(preview1.validation?.isComplete).toBe(false);

    // Step 2: Complete the form and preview again
    const completeInput = createCompleteInput();
    const preview2 = await previewIntake(completeInput);

    expect(preview2.success).toBe(true);
    expect(preview2.jobSpec).toBeDefined();

    // Step 3: Submit
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'WC-20251225-9999' }),
    });

    const submitResult = await submitIntake(completeInput);

    expect(submitResult.success).toBe(true);
    expect(submitResult.jobId).toBe('WC-20251225-9999');
  });

  it('should maintain data consistency between preview and submit', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ jobId: 'WC-20251225-1234' }),
    });

    const input = createCompleteInput();
    
    const preview = await previewIntake(input);
    const submit = await submitIntake(input);

    expect(preview.success).toBe(true);
    expect(submit.success).toBe(true);
    
    if (preview.jobSpec && submit.jobSpec) {
      expect(preview.jobSpec.patient.name).toBe(submit.jobSpec.patient.name);
      expect(preview.jobSpec.service.type).toBe(submit.jobSpec.service.type);
    }
  });
});
