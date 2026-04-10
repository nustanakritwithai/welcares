export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'update_booking_field',
      description: 'บันทึกข้อมูลการจองที่ผู้ใช้ให้มา อัปเดตหลาย field ได้ในครั้งเดียว',
      parameters: {
        type: 'object',
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  enum: [
                    'contact.name','contact.phone',
                    'service.type','service.department','service.doctorName',
                    'schedule.date','schedule.time','schedule.flexibility',
                    'locations.pickup','locations.dropoff',
                    'patient.name','patient.mobilityLevel',
                    'patient.needsWheelchair','patient.needsEscort',
                    'patient.oxygenRequired','patient.stretcherRequired',
                    'addons.medicinePickup','addons.homeCare','notes',
                  ],
                },
                value: {},
              },
              required: ['field','value'],
            },
          },
        },
        required: ['updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_status',
      description: 'ดูสถานะการจองปัจจุบัน ข้อมูลที่มีและที่ยังขาด',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_booking',
      description: 'ส่งการจองเมื่อผู้ใช้ยืนยันข้อมูลครบแล้ว',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean' },
        },
        required: ['confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_job',
      description: 'ค้นหาการจองที่มีอยู่แล้ว',
      parameters: {
        type: 'object',
        properties: { jobId: { type: 'string' } },
        required: ['jobId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_job',
      description: 'ยกเลิกการจอง',
      parameters: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['jobId'],
      },
    },
  },
];
