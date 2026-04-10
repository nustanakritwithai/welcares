// Export all agents from this barrel file
export { ChatBookingAgent } from './ChatBookingAgent';
export { BaseAgent } from './BaseAgent';

// ตัวอย่างการใช้งาน
/*
import { ChatBookingAgent } from './agents/ChatBookingAgent';

const agent = new ChatBookingAgent({
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  temperature: 0.3,
  maxTokens: 500,
  timeoutMs: 5000,
  retryAttempts: 3
});

const input = {
  requestId: 'req-001',
  timestamp: new Date().toISOString(),
  message: 'อยากจองรถไปโรงพยาบาลพรุ่งนี้ 9 โมงพร้อมวีลแชร์',
  context: {
    bookingType: 'TRIP',
    files: [
      {
        name: 'map.jpg',
        type: 'image/jpeg',
        size: 102400,
        content: 'base64encodedimagecontent...'
      }
    ]
  }
};

agent.process(input).then(result => {
  console.log('ผลลัพธ์:', JSON.stringify(result, null, 2));
});
*/