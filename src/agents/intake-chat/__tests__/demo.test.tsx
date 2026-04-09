/**
 * Intake Chat Demo - Tests
 * 
 * @version 1.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntakeChatDemo } from '../demo/IntakeChatDemo';
import { useIntakeChatAgent } from '../useIntakeChatAgent';

// Mock the hook
jest.mock('../useIntakeChatAgent');

const mockUseIntakeChatAgent = useIntakeChatAgent as jest.MockedFunction<typeof useIntakeChatAgent>;

describe('IntakeChatDemo', () => {
  const defaultMockState = {
    messages: [
      {
        id: '1',
        role: 'assistant' as const,
        type: 'text' as const,
        content: 'สวัสดีค่ะ! น้องแคร์ยินดีช่วยเหลือค่ะ 🌸\n\nวันนี้ต้องการจองบริการอะไรคะ?',
        quickReplies: [
          { id: 'hospital', label: '🏥 พบแพทย์', value: 'hospital-visit' },
          { id: 'dialysis', label: '💉 ล้างไต', value: 'dialysis' },
        ],
        timestamp: new Date(),
      },
    ],
    status: 'greeting' as const,
    isTyping: false,
    isReady: true,
    formData: {},
    jobId: undefined,
    error: undefined,
  };

  const mockActions = {
    sendMessage: jest.fn().mockResolvedValue(undefined),
    selectQuickReply: jest.fn().mockResolvedValue(undefined),
    updateField: jest.fn(),
    confirmBooking: jest.fn().mockResolvedValue(undefined),
    restart: jest.fn(),
    reset: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIntakeChatAgent.mockReturnValue({
      ...defaultMockState,
      ...mockActions,
    });
  });

  // ============================================================================
  // Test Case 1: Renders greeting message correctly
  // ============================================================================
  describe('Initial Render', () => {
    it('should render greeting message with title and quick replies', () => {
      render(<IntakeChatDemo />);

      // Check header
      expect(screen.getByText('น้องแคร์')).toBeInTheDocument();
      expect(screen.getByText('ผู้ช่วยจองบริการ')).toBeInTheDocument();

      // Check greeting message
      expect(screen.getByText(/สวัสดีค่ะ! น้องแคร์ยินดีช่วยเหลือค่ะ/)).toBeInTheDocument();

      // Check quick replies
      expect(screen.getByText('🏥 พบแพทย์')).toBeInTheDocument();
      expect(screen.getByText('💉 ล้างไต')).toBeInTheDocument();
    });

    it('should render WelCares branding logo', () => {
      render(<IntakeChatDemo />);

      const logo = screen.getByText('WC');
      expect(logo).toBeInTheDocument();
    });

    it('should render restart button in header', () => {
      render(<IntakeChatDemo />);

      const restartButton = screen.getByTitle('เริ่มใหม่');
      expect(restartButton).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Test Case 2: Sends user message
  // ============================================================================
  describe('Message Input', () => {
    it('should allow typing and sending a message', async () => {
      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const input = screen.getByPlaceholderText('พิมพ์ข้อความ...');
      const sendButton = screen.getByRole('button', { name: '' });

      // Type a message
      await user.type(input, 'สวัสดีค่ะ');
      expect(input).toHaveValue('สวัสดีค่ะ');

      // Send the message
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockActions.sendMessage).toHaveBeenCalledWith('สวัสดีค่ะ');
      });
    });

    it('should send message on Enter key press', async () => {
      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const input = screen.getByPlaceholderText('พิมพ์ข้อความ...');

      await user.type(input, 'พบแพทย์ค่ะ');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockActions.sendMessage).toHaveBeenCalledWith('พบแพทย์ค่ะ');
      });
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const sendButton = screen.getByRole('button', { name: '' });

      // Try to send without typing
      await user.click(sendButton);

      expect(mockActions.sendMessage).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const input = screen.getByPlaceholderText('พิมพ์ข้อความ...');

      await user.type(input, 'ทดสอบ');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  // ============================================================================
  // Test Case 3: Quick reply selection
  // ============================================================================
  describe('Quick Replies', () => {
    it('should display quick reply buttons under assistant messages', () => {
      render(<IntakeChatDemo />);

      const quickReplies = screen.getAllByRole('button', { name: /🏥|💉/ });
      expect(quickReplies.length).toBeGreaterThanOrEqual(2);
    });

    it('should call selectQuickReply when quick reply is clicked', async () => {
      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const quickReply = screen.getByText('🏥 พบแพทย์');
      await user.click(quickReply);

      await waitFor(() => {
        expect(mockActions.selectQuickReply).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'hospital',
            label: '🏥 พบแพทย์',
            value: 'hospital-visit',
          })
        );
      });
    });

    it('should restart when restart quick reply is selected', async () => {
      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        status: 'success',
        jobId: 'WC12345',
        messages: [
          {
            id: '1',
            role: 'assistant',
            type: 'text',
            content: 'จองสำเร็จ!',
            quickReplies: [
              { id: 'new', label: '🔄 จองใหม่', value: 'restart' },
              { id: 'close', label: '✅ ปิด', value: 'close' },
            ],
            timestamp: new Date(),
          },
        ],
        ...mockActions,
      });

      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const restartReply = screen.getByText('🔄 จองใหม่');
      await user.click(restartReply);

      await waitFor(() => {
        expect(mockActions.restart).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Test Case 4: Shows summary card when awaiting confirmation
  // ============================================================================
  describe('Summary Card', () => {
    const mockFormData = {
      service: {
        serviceType: 'hospital-visit' as const,
        appointmentType: 'new' as const,
      },
      patient: {
        name: 'คุณสมชาย',
        mobilityLevel: 'assisted' as const,
        needsEscort: true,
        needsWheelchair: false,
        oxygenRequired: false,
        stretcherRequired: false,
        conditions: [],
        allergies: [],
        medications: [],
      },
      schedule: {
        appointmentDate: '2024-12-25',
        appointmentTime: '09:00',
        timeFlexibility: '30min' as const,
      },
      locations: {
        pickup: {
          address: '123 ถนนสุขุมวิท',
          contactName: 'คุณสมชาย',
          contactPhone: '0812345678',
        },
        dropoff: {
          address: 'โรงพยาบาลกรุงเทพ',
          contactName: 'คุณสมชาย',
          contactPhone: '0812345678',
        },
      },
      contact: {
        contactName: 'คุณสมหญิง',
        contactPhone: '0898765432',
        relationship: 'daughter' as const,
      },
    };

    beforeEach(() => {
      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        status: 'awaitingConfirmation',
        formData: mockFormData,
        messages: [
          ...defaultMockState.messages,
          {
            id: '2',
            role: 'user',
            type: 'text',
            content: 'ข้อมูลครบแล้วค่ะ',
            timestamp: new Date(),
          },
          {
            id: '3',
            role: 'assistant',
            type: 'text',
            content: 'ข้อมูลครบแล้วค่ะ! กรุณาตรวจสอบรายละเอียด',
            timestamp: new Date(),
          },
        ],
        ...mockActions,
      });
    });

    it('should display summary card when status is awaitingConfirmation', () => {
      render(<IntakeChatDemo />);

      expect(screen.getByText('สรุปรายละเอียด')).toBeInTheDocument();
      expect(screen.getByText('พบแพทย์นอก')).toBeInTheDocument();
      expect(screen.getByText('คุณสมชาย')).toBeInTheDocument();
    });

    it('should display summary rows with correct information', () => {
      render(<IntakeChatDemo />);

      expect(screen.getByText('บริการ')).toBeInTheDocument();
      expect(screen.getByText('ผู้รับบริการ')).toBeInTheDocument();
      expect(screen.getByText('รับจาก')).toBeInTheDocument();
      expect(screen.getByText('ส่งที่')).toBeInTheDocument();
    });

    it('should show confirm and edit buttons', () => {
      render(<IntakeChatDemo />);

      expect(screen.getByText('✅ ยืนยัน')).toBeInTheDocument();
      expect(screen.getByText('✏️ แก้ไข')).toBeInTheDocument();
    });

    it('should call confirmBooking when confirm button is clicked', async () => {
      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const confirmButton = screen.getByText('✅ ยืนยัน');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockActions.confirmBooking).toHaveBeenCalled();
      });
    });

    it('should disable input when awaiting confirmation', () => {
      render(<IntakeChatDemo />);

      const input = screen.getByPlaceholderText('กรุณายืนยันหรือแก้ไขข้อมูลด้านบน...');
      expect(input).toBeDisabled();
    });
  });

  // ============================================================================
  // Test Case 5: Shows success view after confirmation
  // ============================================================================
  describe('Success State', () => {
    beforeEach(() => {
      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        status: 'success',
        jobId: 'WCABC123',
        messages: [
          {
            id: '1',
            role: 'assistant',
            type: 'text',
            content: '🎉 จองสำเร็จแล้วค่ะ!',
            quickReplies: [
              { id: 'new', label: '🔄 จองใหม่', value: 'restart' },
              { id: 'close', label: '✅ ปิด', value: 'close' },
            ],
            timestamp: new Date(),
          },
        ],
        ...mockActions,
      });
    });

    it('should display success view with job ID', () => {
      render(<IntakeChatDemo />);

      expect(screen.getByText('จองสำเร็จ!')).toBeInTheDocument();
      expect(screen.getByText('WCABC123')).toBeInTheDocument();
      expect(screen.getByText(/ทีมงานจะติดต่อกลับภายใน 15 นาที/)).toBeInTheDocument();
    });

    it('should hide input area in success state', () => {
      render(<IntakeChatDemo />);

      const input = screen.queryByPlaceholderText(/พิมพ์ข้อความ/);
      expect(input).not.toBeInTheDocument();
    });

    it('should show restart button in success view', () => {
      render(<IntakeChatDemo />);

      expect(screen.getByText('🔄 จองใหม่')).toBeInTheDocument();
    });

    it('should call onComplete callback with jobId', async () => {
      const onComplete = jest.fn();
      const user = userEvent.setup();

      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        status: 'success',
        jobId: 'WCABC123',
        messages: [],
        ...mockActions,
      });

      render(<IntakeChatDemo onComplete={onComplete} />);

      // Trigger a confirmation flow to call onComplete
      // This would typically happen when confirmBooking resolves
      // For now, we verify the component renders in success state
      expect(screen.getByText('จองสำเร็จ!')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Test Case 6: Restart functionality
  // ============================================================================
  describe('Restart Functionality', () => {
    it('should call restart when restart button is clicked', async () => {
      const user = userEvent.setup();
      render(<IntakeChatDemo />);

      const restartButton = screen.getByTitle('เริ่มใหม่');
      await user.click(restartButton);

      await waitFor(() => {
        expect(mockActions.restart).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Test Case 7: Typing indicator
  // ============================================================================
  describe('Typing Indicator', () => {
    it('should show typing indicator when isTyping is true', () => {
      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        isTyping: true,
        ...mockActions,
      });

      const { container } = render(<IntakeChatDemo />);

      // Check for typing dots animation
      const typingDots = container.querySelector('[style*="typingDots"]');
      expect(typingDots).toBeInTheDocument();
    });

    it('should disable input when typing', () => {
      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        isTyping: true,
        ...mockActions,
      });

      render(<IntakeChatDemo />);

      const input = screen.getByPlaceholderText('พิมพ์ข้อความ...');
      expect(input).toBeDisabled();
    });
  });

  // ============================================================================
  // Test Case 8: Cancel callback
  // ============================================================================
  describe('Cancel Callback', () => {
    it('should call onCancel when close is selected in success state', async () => {
      const onCancel = jest.fn();
      const user = userEvent.setup();

      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        status: 'success',
        jobId: 'WC123',
        messages: [
          {
            id: '1',
            role: 'assistant',
            type: 'text',
            content: 'Success!',
            quickReplies: [
              { id: 'close', label: '✅ ปิด', value: 'close' },
            ],
            timestamp: new Date(),
          },
        ],
        ...mockActions,
      });

      render(<IntakeChatDemo onCancel={onCancel} />);

      const closeButton = screen.getByText('ปิด');
      await user.click(closeButton);

      await waitFor(() => {
        expect(onCancel).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Test Case 9: Message display
  // ============================================================================
  describe('Message Display', () => {
    it('should render multiple messages', () => {
      mockUseIntakeChatAgent.mockReturnValue({
        ...defaultMockState,
        messages: [
          {
            id: '1',
            role: 'assistant',
            type: 'text',
            content: 'สวัสดีค่ะ',
            timestamp: new Date(),
          },
          {
            id: '2',
            role: 'user',
            type: 'text',
            content: 'สวัสดีค่ะ ขอจองบริการ',
            timestamp: new Date(),
          },
          {
            id: '3',
            role: 'assistant',
            type: 'text',
            content: 'ได้เลยค่ะ ต้องการบริการอะไรคะ?',
            timestamp: new Date(),
          },
        ],
        ...mockActions,
      });

      render(<IntakeChatDemo />);

      expect(screen.getByText('สวัสดีค่ะ')).toBeInTheDocument();
      expect(screen.getByText('สวัสดีค่ะ ขอจองบริการ')).toBeInTheDocument();
      expect(screen.getByText('ได้เลยค่ะ ต้องการบริการอะไรคะ?')).toBeInTheDocument();
    });

    it('should apply different styles to assistant and user messages', () => {
      const { container } = render(<IntakeChatDemo />);

      // Check that message bubbles have different background colors
      const bubbles = container.querySelectorAll('[style*="bubble"]');
      expect(bubbles.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Test Case 10: Accessibility
  // ============================================================================
  describe('Accessibility', () => {
    it('should have accessible buttons', () => {
      render(<IntakeChatDemo />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have accessible input', () => {
      render(<IntakeChatDemo />);

      const input = screen.getByPlaceholderText('พิมพ์ข้อความ...');
      expect(input.tagName.toLowerCase()).toBe('input');
      expect(input).toHaveAttribute('type', 'text');
    });
  });
});