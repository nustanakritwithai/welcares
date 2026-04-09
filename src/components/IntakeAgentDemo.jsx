/**
 * IntakeAgentDemo - React Component ตัวอย่าง
 * แสดงวิธีใช้ Intake Agent ทั้ง 4 ฟังก์ชัน
 */

import React, { useState } from 'react';
import { useIntakeAgent } from '../agents/intake';
import type { IntakeFormData, ServiceType, UrgencyLevel } from '../agents/intake';

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'hospital-visit', label: 'พบแพทย์นอก' },
  { value: 'follow-up', label: 'ติดตามอาการ' },
  { value: 'physical-therapy', label: 'กายภาพบำบัด' },
  { value: 'dialysis', label: 'ล้างไต' },
  { value: 'chemotherapy', label: 'เคมีบำบัด' },
  { value: 'checkup', label: 'ตรวจสุขภาพ' },
  { value: 'other', label: 'อื่นๆ' },
];

export default function IntakeAgentDemo() {
  const {
    formData,
    isLoading,
    error,
    validation,
    progress,
    isComplete,
    nextQuestion,
    jobSpec,
    updateField,
    submitForm,
    reset,
    sessionId,
  } = useIntakeAgent();

  const [showJobSpec, setShowJobSpec] = useState(false);

  const handleSubmit = async () => {
    const result = await submitForm();
    if (result) {
      setShowJobSpec(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Intake Agent Demo</h1>
      <p className="text-sm text-gray-600 mb-6">Session: {sessionId}</p>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>ความคืบหน้า</span>
          <span>{progress.percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        {/* 1. บริการ */}
        <div>
          <label className="block text-sm font-medium mb-2">ต้องการบริการอะไร</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={formData.serviceType || ''}
            onChange={(e) => updateField('serviceType', e.target.value as ServiceType)}
            disabled={isLoading}
          >
            <option value="">เลือกบริการ...</option>
            {SERVICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. วันและเวลา */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">นัดวันไหน</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={formData.appointmentDate || ''}
              onChange={(e) => updateField('appointmentDate', e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">เวลา</label>
            <input
              type="time"
              className="w-full border rounded px-3 py-2"
              value={formData.appointmentTime || ''}
              onChange={(e) => updateField('appointmentTime', e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* 3. สถานที่ */}
        <div>
          <label className="block text-sm font-medium mb-2">รับจากที่ไหน</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder="ที่อยู่จุดรับ"
            value={formData.pickupLocation?.address || ''}
            onChange={(e) =>
              updateField('pickupLocation', {
                ...formData.pickupLocation,
                address: e.target.value,
                contactName: '',
                contactPhone: '',
              })
            }
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">ไปที่ไหน</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            placeholder="โรงพยาบาล/คลินิก"
            value={formData.dropoffLocation?.address || ''}
            onChange={(e) =>
              updateField('dropoffLocation', {
                ...formData.dropoffLocation,
                address: e.target.value,
                contactName: '',
                contactPhone: '',
              })
            }
            disabled={isLoading}
          />
        </div>

        {/* 4. Boolean Options */}
        <div className="space-y-3 pt-4 border-t">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={formData.patientNeedsEscort || false}
              onChange={(e) => updateField('patientNeedsEscort', e.target.checked)}
              disabled={isLoading}
            />
            <span>ผู้ป่วยต้องมีคนพา</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={formData.needsWheelchair || false}
              onChange={(e) => updateField('needsWheelchair', e.target.checked)}
              disabled={isLoading}
            />
            <span>ต้องใช้รถเข็น</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={formData.needsMedicinePickup || false}
              onChange={(e) => updateField('needsMedicinePickup', e.target.checked)}
              disabled={isLoading}
            />
            <span>ต้องรับยากลับบ้าน</span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={formData.needsHomeCare || false}
              onChange={(e) => updateField('needsHomeCare', e.target.checked)}
              disabled={isLoading}
            />
            <span>ต้องดูแลต่อที่บ้าน</span>
          </label>
        </div>

        {/* 5. Urgency */}
        <div>
          <label className="block text-sm font-medium mb-2">ความเร่งด่วน</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={formData.urgency || 'normal'}
            onChange={(e) => updateField('urgency', e.target.value as UrgencyLevel)}
            disabled={isLoading}
          >
            <option value="low">ปกติ (3+ วัน)</option>
            <option value="normal">1-2 วัน</option>
            <option value="high">พรุ่งนี้</option>
            <option value="urgent">วันนี้/ฉุกเฉิน</option>
          </select>
        </div>

        {/* Next Question */}
        {nextQuestion && !isComplete && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
            <p className="text-sm text-yellow-800">
              <strong>ถามต่อ:</strong> {nextQuestion.question}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={!isComplete || isLoading}
            className={`flex-1 py-2 px-4 rounded font-medium ${
              isComplete
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? 'กำลังส่ง...' : 'สร้าง Job'}
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            เริ่มใหม่
          </button>
        </div>
      </div>

      {/* Job Spec Result */}
      {showJobSpec && jobSpec && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded">
          <h2 className="font-bold text-green-800 mb-2">✅ Job Spec สร้างสำเร็จ!</h2>
          <pre className="text-xs overflow-auto bg-white p-3 rounded">
            {JSON.stringify(jobSpec, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
