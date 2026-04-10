/**
 * Tests for refactored useIntakeChatAgent
 * 
 * @version 2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIntakeChatAgent } from '../useIntakeChatAgent';

// Mock dependencies
vi.mock('../openrouter', () => ({
  parseMessageWithAI: vi.fn().mockResolvedValue({
    intent: 'fill_field',
    field: 'contact.contactName',
    value: 'สมชาย',
    confidence: 0.9,
  }),
  generateAIResponse: vi.fn().mockResolvedValue({
    content: 'ขอบคุณค่ะ ไปต่อกันเลย',
  }),
  isAIConfigured: vi.fn().mockResolvedValue(false),
}));

vi.mock('../intake/validator', () => ({
  validateFormData: vi.fn().mockReturnValue({
    success: true,
    errors: [],
    missingFields: [],
  }),
}));

vi.mock('../intake/service', () => ({
  previewIntake: vi.fn().mockResolvedValue({
    success: true,
    jobSpec: { id: 'test-job-123' },
  }),
  submitIntake: vi.fn().mockResolvedValue({
    success: true,
    jobId: 'BOOK-12345',
  }),
}));

describe('useIntakeChatAgent v2.0 - FormData Source of Truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should start with empty formData', () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      expect(result.current.formData).toEqual({});
      expect(result.current.currentField).toBe('contact.contactName');
      expect(result.current.missingFields).toHaveLength(10);
    });

    it('should have welcome message and first question', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });
      
      expect(result.current.messages[0].content).toContain('สวัสดี');
      expect(result.current.messages[1].content).toContain('ชื่อผู้ติดต่อ');
    });
  });

  describe('FormData Updates', () => {
    it('should update contactName in formData when user answers', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });
      
      // Check formData updated
      expect(result.current.formData).toHaveProperty('contact');
      expect(result.current.formData.contact).toHaveProperty('contactName', 'สมชาย');
    });

    it('should update contactPhone and move to next field', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      // First answer - contactName
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });
      
      // Second answer - contactPhone
      await act(async () => {
        await result.current.sendMessage('0812345678');
      });
      
      // Check formData has both values
      expect(result.current.formData.contact).toHaveProperty('contactName', 'สมชาย');
      expect(result.current.formData.contact).toHaveProperty('contactPhone', '0812345678');
      
      // Check currentField moved to next
      expect(result.current.currentField).toBe('service.serviceType');
    });

    it('should handle nested paths like pickup.address', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      // Skip to pickup address field by filling previous fields
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      await act(async () => result.current.sendMessage('สมชาย'));
      await act(async () => result.current.sendMessage('0812345678'));
      await act(async () => result.current.sendMessage('hospital-visit'));
      await act(async () => result.current.sendMessage('15/01/2026'));
      await act(async () => result.current.sendMessage('14:30'));
      
      // Now at pickup.address
      expect(result.current.currentField).toBe('locations.pickup.address');
      
      // Answer pickup address
      await act(async () => {
        await result.current.sendMessage('123 ถนนสุขุมวิท กรุงเทพ');
      });
      
      // Check nested path stored correctly
      expect(result.current.formData).toHaveProperty('locations');
      expect(result.current.formData.locations).toHaveProperty('pickup');
      expect(result.current.formData.locations?.pickup).toHaveProperty('address', '123 ถนนสุขุมวิท กรุงเทพ');
    });

    it('should handle patient.name nested path', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      // Fill fields until patient.name
      await act(async () => result.current.sendMessage('สมชาย'));
      await act(async () => result.current.sendMessage('0812345678'));
      await act(async () => result.current.sendMessage('hospital-visit'));
      await act(async () => result.current.sendMessage('15/01/2026'));
      await act(async () => result.current.sendMessage('14:30'));
      await act(async () => result.current.sendMessage('บ้าน'));
      await act(async () => result.current.sendMessage('โรงพยาบาล'));
      
      // Now at patient.name
      expect(result.current.currentField).toBe('patient.name');
      
      await act(async () => {
        await result.current.sendMessage('คุณยายสมศรี');
      });
      
      // Check nested patient.name
      expect(result.current.formData).toHaveProperty('patient');
      expect(result.current.formData.patient).toHaveProperty('name', 'คุณยายสมศรี');
    });
  });

  describe('Validation Flow', () => {
    it('should validate with updated formData after each answer', async () => {
      const { validateFormData } = await import('../intake/validator');
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      await act(async () => {
        await result.current.sendMessage('สมชาย');
      });
      
      // validateFormData should be called with updated formData
      expect(validateFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          contact: expect.objectContaining({ contactName: 'สมชาย' })
        })
      );
    });

    it('should mark isComplete=true when all fields filled', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      // Fill all fields
      await act(async () => result.current.sendMessage('สมชาย'));
      await act(async () => result.current.sendMessage('0812345678'));
      await act(async () => result.current.sendMessage('hospital-visit'));
      await act(async () => result.current.sendMessage('15/01/2026'));
      await act(async () => result.current.sendMessage('14:30'));
      await act(async () => result.current.sendMessage('บ้าน'));
      await act(async () => result.current.sendMessage('โรงพยาบาล'));
      await act(async () => result.current.sendMessage('คุณยายสมศรี'));
      await act(async () => result.current.sendMessage('wheelchair'));
      await act(async () => result.current.sendMessage('none'));
      
      // Should be complete
      expect(result.current.isComplete).toBe(true);
      expect(result.current.awaitingConfirmation).toBe(true);
      expect(result.current.missingFields).toHaveLength(0);
    });
  });

  describe('Current Field Tracking', () => {
    it('should track currentField correctly through flow', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      expect(result.current.currentField).toBe('contact.contactName');
      
      await act(async () => result.current.sendMessage('สมชาย'));
      expect(result.current.currentField).toBe('contact.contactPhone');
      
      await act(async () => result.current.sendMessage('0812345678'));
      expect(result.current.currentField).toBe('service.serviceType');
    });

    it('should update missingFields after each answer', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      expect(result.current.missingFields).toContain('contact.contactName');
      
      await act(async () => result.current.sendMessage('สมชาย'));
      expect(result.current.missingFields).not.toContain('contact.contactName');
      expect(result.current.missingFields).toContain('contact.contactPhone');
    });
  });

  describe('Preview & Confirmation', () => {
    it('should generate preview when data complete', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      // Fill all fields
      await act(async () => result.current.sendMessage('สมชาย'));
      await act(async () => result.current.sendMessage('0812345678'));
      await act(async () => result.current.sendMessage('hospital-visit'));
      await act(async () => result.current.sendMessage('15/01/2026'));
      await act(async () => result.current.sendMessage('14:30'));
      await act(async () => result.current.sendMessage('บ้าน'));
      await act(async () => result.current.sendMessage('โรงพยาบาล'));
      await act(async () => result.current.sendMessage('คุณยายสมศรี'));
      await act(async () => result.current.sendMessage('wheelchair'));
      await act(async () => result.current.sendMessage('none'));
      
      // Should have summary message
      const summaryMessage = result.current.messages.find(
        m => m.type === 'confirmation'
      );
      expect(summaryMessage).toBeDefined();
      expect(summaryMessage?.content).toContain('สรุปข้อมูล');
    });

    it('should submit when user confirms', async () => {
      const { submitIntake } = await import('../intake/service');
      const onSuccess = vi.fn();
      
      const { result } = renderHook(() => useIntakeChatAgent({ onSuccess }));
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      // Fill all fields
      await act(async () => result.current.sendMessage('สมชาย'));
      await act(async () => result.current.sendMessage('0812345678'));
      await act(async () => result.current.sendMessage('hospital-visit'));
      await act(async () => result.current.sendMessage('15/01/2026'));
      await act(async () => result.current.sendMessage('14:30'));
      await act(async () => result.current.sendMessage('บ้าน'));
      await act(async () => result.current.sendMessage('โรงพยาบาล'));
      await act(async () => result.current.sendMessage('คุณยายสมศรี'));
      await act(async () => result.current.sendMessage('wheelchair'));
      await act(async () => result.current.sendMessage('none'));
      
      // Confirm booking
      await act(async () => {
        await result.current.confirmBooking();
      });
      
      expect(submitIntake).toHaveBeenCalled();
      expect(result.current.success).toBe(true);
      expect(result.current.jobId).toBe('BOOK-12345');
      expect(onSuccess).toHaveBeenCalledWith('BOOK-12345');
    });
  });

  describe('Reset', () => {
    it('should reset all state when restart called', async () => {
      const { result } = renderHook(() => useIntakeChatAgent());
      
      await waitFor(() => expect(result.current.messages).toHaveLength(2));
      
      // Fill some data
      await act(async () => result.current.sendMessage('สมชาย'));
      
      // Reset
      act(() => result.current.resetConversation());
      
      await waitFor(() => {
        expect(result.current.formData).toEqual({});
        expect(result.current.currentField).toBe('contact.contactName');
        expect(result.current.isComplete).toBe(false);
      });
    });
  });
});

describe('FormData Shape', () => {
  it('should maintain correct nested structure', async () => {
    const { result } = renderHook(() => useIntakeChatAgent());
    
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    
    // Fill nested fields
    await act(async () => result.current.sendMessage('สมชาย'));
    await act(async () => result.current.sendMessage('0812345678'));
    await act(async () => result.current.sendMessage('hospital-visit'));
    await act(async () => result.current.sendMessage('15/01/2026'));
    await act(async () => result.current.sendMessage('14:30'));
    await act(async () => result.current.sendMessage('123 บ้าน'));
    await act(async () => result.current.sendMessage('โรงพยาบาลรามา'));
    await act(async () => result.current.sendMessage('คุณยาย'));
    await act(async () => result.current.sendMessage('wheelchair'));
    await act(async () => result.current.sendMessage('oxygen'));
    
    // Verify complete structure
    expect(result.current.formData).toEqual({
      contact: {
        contactName: 'สมชาย',
        contactPhone: '0812345678',
      },
      service: {
        serviceType: 'hospital-visit',
      },
      schedule: {
        appointmentDate: '2026-01-15',
        appointmentTime: '14:30',
      },
      locations: {
        pickup: {
          address: '123 บ้าน',
        },
        dropoff: {
          address: 'โรงพยาบาลรามา',
        },
      },
      patient: {
        name: 'คุณยาย',
        mobilityLevel: 'wheelchair',
        equipmentNeeds: 'oxygen',
      },
    });
  });
});
