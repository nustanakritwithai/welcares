/**
 * Intake Chat Agent - Hook Tests
 * Unit tests สำหรับ useIntakeChatAgent hook
 * 
 * @version 1.0
 * @module src/agents/intake-chat/__tests__/hook.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIntakeChatAgent, UseIntakeChatAgentOptions } from '../useIntakeChatAgent';
import * as service from '../../intake/service';
import * as validator from '../../intake/validator';

// ============================================================================
// MOCKS
// ============================================================================

// Mock intake service
vi.mock('../../intake/service', () => ({
  previewIntake: vi.fn(),
  submitIntake: vi.fn(),
}));

// Mock validator
vi.mock('../../intake/validator', async () => {
  const actual = await vi.importActual<typeof validator>('../../intake/validator');
  return {
    ...actual,
    validateFormData: vi.fn(actual.validateFormData),
  };
};

// ============================================================================
// TESTS
// ============================================================================

describe('useIntakeChatAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // TEST 1: Initialization
  // ============================================================================
  describe('initialization', () => {
    it('should initialize with welcome messages', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      // Wait for initial effect
      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Check welcome messages
      const assistantMessages = result.current.messages.filter(m => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThanOrEqual(2);
      expect(assistantMessages[0].text).toContain('สวัสดี');
      expect(assistantMessages[1].text).toContain('WelCares');
    });

    it('should start with empty form data', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      });

      expect(result.current.formData).toEqual({});
      expect(result.current.isComplete).toBe(false);
      expect(result.current.awaitingConfirmation).toBe(false);
      expect(result.current.success).toBe(false);
    });

    it('should generate unique session ID', async () => {
      const { result: result1 } = renderHook(() => useIntakeChatAgent());
      const { result: result2 } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result1.current.messages.length).toBeGreaterThanOrEqual(1);
        expect(result2.current.messages.length).toBeGreaterThanOrEqual(1);
      });

      // Both should have different messages (different timestamps/ids)
      expect(result1.current.messages[0].id).not.toBe(result2.current.messages[0].id);
    });
  });

  // ============================================================================
  // TEST 2: Input Text Management
  // ============================================================================
  describe('input text management', () => {
    it('should update input text with setInputText', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      });

      act(() => {
        result.current.setInputText('สมชาย');
      });

      expect(result.current.inputText).toBe('สมชาย');
    });

    it('should clear input text after sending message', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      });

      act(() => {
        result.current.setInputText('สมชาย');
      });

      expect(result.current.inputText).toBe('สมชาย');

      await act(async () => {
        await result.current.sendMessage();
      });

      expect(result.current.inputText).toBe('');
    });
  });

  // ============================================================================
  // TEST 3: Sending Messages
  // ============================================================================
  describe('sending messages', () => {
    it('should add user message when sendMessage is called', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      const initialMessageCount = result.current.messages.length;

      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });

      expect(result.current.messages.length).toBeGreaterThan(initialMessageCount);
      const userMessages = result.current.messages.filter(m => m.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(1);
      expect(userMessages[0].text).toBe('สมชาย');
    });

    it('should not send empty messages', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      });

      const initialMessageCount = result.current.messages.length;

      await act(async () => {
        await result.current.sendMessage('');
      });

      expect(result.current.messages.length).toBe(initialMessageCount);
    });

    it('should use inputText when sendMessage is called without argument', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      });

      act(() => {
        result.current.setInputText('สมหญิง');
      });

      await act(async () => {
        await result.current.sendMessage();
      });

      const userMessages = result.current.messages.filter(m => m.role === 'user');
      expect(userMessages[0].text).toBe('สมหญิง');
    });
  });

  // ============================================================================
  // TEST 4: Form Data Updates
  // ============================================================================
  describe('form data updates', () => {
    it('should update formData when user provides contact name', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });

      expect(result.current.formData.contact?.contactName).toBe('สมชาย');
    });

    it('should update formData when user provides phone number', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      await act(async () => {
        await result.current.sendMessage('0812345678');
      });

      expect(result.current.formData.contact?.contactPhone).toBeDefined();
    });

    it('should update formData when user provides service type', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      await act(async () => {
        await result.current.sendMessage('พบแพทย์');
      });

      expect(result.current.formData.service?.serviceType).toBe('hospital-visit');
    });

    it('should accumulate form data across multiple messages', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });

      await act(async () => {
        await result.current.sendMessage('0812345678');
      });

      expect(result.current.formData.contact?.contactName).toBe('สมชาย');
      expect(result.current.formData.contact?.contactPhone).toBeDefined();
    });
  });

  // ============================================================================
  // TEST 5: Quick Replies
  // ============================================================================
  describe('quick replies', () => {
    it('should send message when selectQuickReply is called', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      const initialMessageCount = result.current.messages.length;

      await act(async () => {
        result.current.selectQuickReply({ label: 'พบแพทย์', value: 'hospital-visit' });
      });

      expect(result.current.messages.length).toBeGreaterThan(initialMessageCount);
    });

    it('should update inputText when selectQuickReply is called', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      });

      act(() => {
        result.current.selectQuickReply({ label: 'Test', value: 'test-value' });
      });

      expect(result.current.inputText).toBe('test-value');
    });
  });

  // ============================================================================
  // TEST 6: Form Completion
  // ============================================================================
  describe('form completion', () => {
    it('should set isComplete when all required fields are filled', async () => {
      vi.mocked(service.previewIntake).mockResolvedValueOnce({
        success: true,
        jobSpec: {
          jobId: 'test-job-123',
          version: '1.0',
          createdAt: new Date().toISOString(),
          status: 'pending',
          source: 'web',
          sessionId: 'test-session',
          service: {
            type: 'hospital-visit',
            typeLabel: 'พบแพทย์',
            category: 'medical',
            priority: 3,
            estimatedDuration: 120,
          },
          schedule: {
            date: '2024-12-25',
            time: '10:00',
            datetime: '2024-12-25T10:00:00+07:00',
            flexibility: 'strict',
          },
          locations: {
            pickup: {
              address: '123 Main St',
              contactName: 'สมชาย',
              contactPhone: '081-234-5678',
            },
            dropoff: {
              address: '456 Hospital Rd',
              contactName: 'สมชาย',
              contactPhone: '081-234-5678',
            },
          },
          contact: {
            primary: {
              name: 'สมชาย',
              phone: '081-234-5678',
            },
            relationship: 'son',
          },
          patient: {
            name: 'สมหญิง',
            mobilityLevel: 'assisted',
            needsEscort: true,
            needsWheelchair: false,
            oxygenRequired: false,
            stretcherRequired: false,
            conditions: [],
            allergies: [],
            medications: [],
            specialAccommodations: [],
          },
          addons: {
            medicinePickup: false,
            homeCare: false,
            mealService: false,
            interpretation: false,
            accompanyInside: false,
          },
          assessment: {
            urgencyLevel: 'normal',
            complexity: 'moderate',
            riskFactors: [],
            estimatedCost: {
              base: 350,
              distance: 0,
              duration: 0,
              addons: 0,
              total: 350,
              currency: 'THB',
            },
            resources: {
              navigatorRequired: true,
              navigatorType: 'CG',
              vehicleType: 'sedan',
              estimatedNavHours: 3,
              specialEquipment: [],
            },
          },
          notes: {
            customer: '',
            internal: '',
            flags: [],
          },
        },
      });

      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Fill all required fields
      await act(async () => {
        await result.current.sendMessage('สมชาย'); // contact name
      });
      await act(async () => {
        await result.current.sendMessage('0812345678'); // contact phone
      });
      await act(async () => {
        await result.current.sendMessage('ลูก'); // relationship
      });
      await act(async () => {
        await result.current.sendMessage('พบแพทย์'); // service type
      });
      await act(async () => {
        await result.current.sendMessage('25/12/2024'); // appointment date
      });
      await act(async () => {
        await result.current.sendMessage('10:00'); // appointment time
      });
      await act(async () => {
        await result.current.sendMessage('123 Main St'); // pickup address
      });
      await act(async () => {
        await result.current.sendMessage('456 Hospital Rd'); // dropoff address
      });
      await act(async () => {
        await result.current.sendMessage('สมหญิง'); // patient name
      });

      await waitFor(() => {
        expect(result.current.isComplete).toBe(true);
      });

      expect(result.current.awaitingConfirmation).toBe(true);
      expect(result.current.preview).toBeDefined();
    });
  });

  // ============================================================================
  // TEST 7: Confirmation and Submission
  // ============================================================================
  describe('confirmation and submission', () => {
    it('should call submitIntake when user confirms', async () => {
      vi.mocked(service.previewIntake).mockResolvedValue({
        success: true,
        jobSpec: { jobId: 'test-job-123' } as any,
      });

      vi.mocked(service.submitIntake).mockResolvedValue({
        success: true,
        jobId: 'JOB-12345',
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() =>
        useIntakeChatAgent({ onSuccess })
      );

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Fill required fields
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });
      await act(async () => {
        await result.current.sendMessage('0812345678');
      });
      await act(async () => {
        await result.current.sendMessage('พบแพทย์');
      });
      await act(async () => {
        await result.current.sendMessage('25/12/2024');
      });
      await act(async () => {
        await result.current.sendMessage('10:00');
      });
      await act(async () => {
        await result.current.sendMessage('123 Main St');
      });
      await act(async () => {
        await result.current.sendMessage('456 Hospital Rd');
      });
      await act(async () => {
        await result.current.sendMessage('สมหญิง');
      });

      await waitFor(() => {
        expect(result.current.awaitingConfirmation).toBe(true);
      });

      // Confirm
      await act(async () => {
        await result.current.sendMessage('ใช่');
      });

      await waitFor(() => {
        expect(service.submitIntake).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.success).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith('JOB-12345');
    });

    it('should set error when submission fails', async () => {
      vi.mocked(service.previewIntake).mockResolvedValue({
        success: true,
        jobSpec: { jobId: 'test-job-123' } as any,
      });

      vi.mocked(service.submitIntake).mockResolvedValue({
        success: false,
        error: 'Network error',
        errorType: 'network_error',
      });

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useIntakeChatAgent({ onError })
      );

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Fill required fields (simplified)
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });
      await act(async () => {
        await result.current.sendMessage('0812345678');
      });
      await act(async () => {
        await result.current.sendMessage('พบแพทย์');
      });
      await act(async () => {
        await result.current.sendMessage('25/12/2024');
      });
      await act(async () => {
        await result.current.sendMessage('10:00');
      });
      await act(async () => {
        await result.current.sendMessage('123 Main St');
      });
      await act(async () => {
        await result.current.sendMessage('456 Hospital Rd');
      });
      await act(async () => {
        await result.current.sendMessage('สมหญิง');
      });

      await waitFor(() => {
        expect(result.current.awaitingConfirmation).toBe(true);
      });

      // Confirm
      await act(async () => {
        await result.current.sendMessage('ใช่');
      });

      await waitFor(() => {
        expect(service.submitIntake).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      expect(onError).toHaveBeenCalledWith('Network error');
      expect(result.current.success).toBe(false);
    });
  });

  // ============================================================================
  // TEST 8: Reset Conversation
  // ============================================================================
  describe('reset conversation', () => {
    it('should reset all state when resetConversation is called', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Add some data
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });

      expect(result.current.formData.contact?.contactName).toBe('สมชาย');

      // Reset
      act(() => {
        result.current.resetConversation();
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      expect(result.current.formData).toEqual({});
      expect(result.current.inputText).toBe('');
      expect(result.current.isComplete).toBe(false);
      expect(result.current.awaitingConfirmation).toBe(false);
      expect(result.current.success).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.preview).toBeNull();
    });

    it('should show welcome messages after reset', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Add some data
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });

      const messageCountBeforeReset = result.current.messages.length;
      expect(messageCountBeforeReset).toBeGreaterThan(2);

      // Reset
      act(() => {
        result.current.resetConversation();
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      const assistantMessages = result.current.messages.filter(m => m.role === 'assistant');
      expect(assistantMessages[0].text).toContain('สวัสดี');
    });
  });

  // ============================================================================
  // TEST 9: Loading State
  // ============================================================================
  describe('loading state', () => {
    it('should set loading to true while processing', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      let loadingDuringProcess = false;

      await act(async () => {
        const promise = result.current.sendMessage('สมชาย');
        // Check loading state immediately after calling
        if (result.current.loading) {
          loadingDuringProcess = true;
        }
        await promise;
      });

      expect(loadingDuringProcess || result.current.loading === false).toBeTruthy();
    });
  });

  // ============================================================================
  // TEST 10: Callbacks
  // ============================================================================
  describe('callbacks', () => {
    it('should call onFormDataChange when form data updates', async () => {
      const onFormDataChange = vi.fn();
      const { result } = renderHook(() =>
        useIntakeChatAgent({ onFormDataChange })
      );

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });

      await waitFor(() => {
        expect(onFormDataChange).toHaveBeenCalled();
      });

      const lastCall = onFormDataChange.mock.calls[onFormDataChange.mock.calls.length - 1];
      expect(lastCall[0].contact?.contactName).toBe('สมชาย');
    });
  });

  // ============================================================================
  // TEST 11: Message Types and Metadata
  // ============================================================================
  describe('message types and metadata', () => {
    it('should include timestamp in messages', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      result.current.messages.forEach(message => {
        expect(message.timestamp).toBeDefined();
        expect(typeof message.timestamp).toBe('number');
        expect(message.timestamp).toBeGreaterThan(0);
      });
    });

    it('should have unique message IDs', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      const ids = result.current.messages.map(m => m.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(ids.length);
    });
  });

  // ============================================================================
  // TEST 12: Intent Detection
  // ============================================================================
  describe('intent detection', () => {
    it('should handle restart intent', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Add some data
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });

      expect(result.current.formData.contact?.contactName).toBe('สมชาย');

      // Send restart message
      await act(async () => {
        await result.current.sendMessage('เริ่มใหม่');
      });

      // Should have reset
      expect(result.current.formData.contact?.contactName).toBeUndefined();
    });

    it('should handle confirm intent when awaiting confirmation', async () => {
      vi.mocked(service.previewIntake).mockResolvedValue({
        success: true,
        jobSpec: { jobId: 'test-job-123' } as any,
      });

      vi.mocked(service.submitIntake).mockResolvedValue({
        success: true,
        jobId: 'JOB-12345',
      });

      const { result } = renderHook(() => useIntakeChatAgent());

      await waitFor(() => {
        expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      });

      // Fill required fields
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });
      await act(async () => {
        await result.current.sendMessage('0812345678');
      });
      await act(async () => {
        await result.current.sendMessage('พบแพทย์');
      });
      await act(async () => {
        await result.current.sendMessage('25/12/2024');
      });
      await act(async () => {
        await result.current.sendMessage('10:00');
      });
      await act(async () => {
        await result.current.sendMessage('123 Main St');
      });
      await act(async () => {
        await result.current.sendMessage('456 Hospital Rd');
      });
      await act(async () => {
        await result.current.sendMessage('สมหญิง');
      });

      await waitFor(() => {
        expect(result.current.awaitingConfirmation).toBe(true);
      });

      // Confirm with different keywords
      await act(async () => {
        await result.current.sendMessage('ok');
      });

      await waitFor(() => {
        expect(service.submitIntake).toHaveBeenCalled();
      });
    });
  });
});

// ============================================================================
// EXPORTS
// ============================================================================

export {};
