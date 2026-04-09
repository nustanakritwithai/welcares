# Intake Chat Agent

Conversational intake module สำหรับ WelCares - จัดการ flow การสนทนาเพื่อรวบรวมข้อมูลการจองบริการรถรับ-ส่งผู้ป่วยและผู้สูงอายุ

## Features

- 🤖 **Conversational UI**: Chat interface ที่เป็นมิตรสำหรับผู้ใช้
- 🇹🇭 **Thai Language Support**: Parser สำหรับภาษาไทยโดยเฉพาะ
- 📝 **Smart Form Filling**: ระบบถามตอบอัตโนมัติแบบ step-by-step
- ✅ **Real-time Validation**: ตรวจสอบข้อมูลทันทีขณะกรอก
- 📱 **Mobile-First Design**: UI ออกแบบสำหรับมือถือเป็นหลัก

## Module Structure

```
intake-chat/
├── index.ts                 # Main exports
├── types.ts                 # TypeScript type definitions
├── parser.ts                # Thai text parser
├── conversation.ts          # Conversation flow engine
├── useIntakeChatAgent.ts    # React hook
├── conversation-new-types.ts # Additional conversation types
├── demo/
│   └── IntakeChatDemo.tsx   # Demo UI component
└── __tests__/
    ├── parser.test.ts       # Parser tests (66 cases)
    ├── conversation.test.ts # Conversation tests (37 cases)
    ├── hook.test.ts         # Hook tests (30 cases)
    ├── demo.test.tsx        # Demo tests (26 cases)
    └── integration.test.ts  # Integration tests
```

## Quick Start

```tsx
import { useIntakeChatAgent, IntakeChatDemo } from '@/agents/intake-chat';

// Using the hook
function MyComponent() {
  const {
    messages,
    inputText,
    setInputText,
    sendMessage,
    isComplete,
    formData,
  } = useIntakeChatAgent({
    onSuccess: (jobId) => console.log('Job created:', jobId),
    onError: (error) => console.error('Error:', error),
  });
  
  return (
    // Your custom UI
  );
}

// Using the demo component
function App() {
  return (
    <IntakeChatDemo 
      onComplete={(jobId) => console.log('Complete:', jobId)}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

## Parser Functions

Parser รองรับการแปลงข้อความภาษาไทยเป็นข้อมูล structured:

| Function | Description |
|----------|-------------|
| `parseServiceType()` | แปลง "พบแพทย์", "ล้างไต" → service type |
| `parseRelationship()` | แปลง "ลูกสาว", "คู่สมรส" → relationship |
| `parseDate()` | แปลง "พรุ่งนี้", "15/04" → YYYY-MM-DD |
| `parseTime()` | แปลง "บ่าย 2 โมง" → HH:mm |
| `parsePhone()` | แปลงเบอร์โทรไทย → normalized format |
| `parseMobilityLevel()` | แปลง "เดินได้เอง", "ใช้รถเข็น" → mobility |
| `detectIntent()` | ตรวจจับ intent: confirm, edit, restart, etc. |

## Conversation Flow

1. **Greeting** → แสดงข้อความต้อนรับ
2. **Field Collection** → ถามข้อมูลทีละ field ตามลำดับ
3. **Conditional Questions** → ถามเพิ่มตาม context (เช่น department ถ้าเป็น hospital-visit)
4. **Confirmation** → แสดงสรุปให้ยืนยัน
5. **Submission** → ส่งข้อมูลและแสดงผลลัพธ์

## Testing

```bash
# Run all tests
npm test src/agents/intake-chat

# Run specific test file
npm test src/agents/intake-chat/__tests__/parser.test.ts
```

## Dependencies

- React 18+
- TypeScript 5+
- `@/agents/intake` - Core intake types and validation
- `@/agents/intake/schema` - Schema definitions

## License

Internal use for WelCares project
