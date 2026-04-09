import React from 'react';
import { IntakeAgentDemo } from '../agents/intake/demo/IntakeAgentDemo';

/**
 * Booking Page - หน้าจองบริการ Welcares
 * 
 * ใช้ IntakeAgentDemo component ที่มี:
 * - Form กรอกข้อมูลครบทุกส่วน
 * - Real-time validation
 * - Preview JobSpec
 * - Submit จองบริการ
 */
export default function BookingPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#F8FAFC',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: '#7F77DD',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'white',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>💚</div>
          <div>
            <div style={{
              color: 'white',
              fontWeight: 700,
              fontSize: '18px'
            }}>จองบริการ Welcares</div>
            <div style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '12px'
            }}>กรอกข้อมูลเพื่อจองบริการดูแลผู้สูงอายุ</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          <IntakeAgentDemo />
        </div>
      </div>
    </div>
  );
}
