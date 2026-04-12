/**
 * Voice Pipeline — 3-stage client-side voice processing
 * Stage 1: MediaRecorder audio capture
 * Stage 2: Whisper STT via OpenRouter
 * Stage 3: GPT-4o-mini sentiment + risk analysis via OpenRouter
 *
 * @module src/agents/voice/voicePipeline
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_AUDIO_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';

// ============================================================================
// STAGE 1 — MediaRecorder capture
// ============================================================================

export interface Recorder {
  start: () => void;
  stop: () => Promise<Blob>;
  getLevel: () => number;  // 0–100 real-time amplitude
}

export async function createRecorder(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 1,
    },
  });

  // Web Audio API — real-time level monitoring
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const audioCtx = new AudioCtx();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const getLevel = (): number => {
    analyser.getByteFrequencyData(freqData);
    const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
    return Math.min(100, (avg / 128) * 100);
  };

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
  const mr = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];

  mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return {
    start: () => { chunks.length = 0; mr.start(250); },
    stop: () => new Promise(resolve => {
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        resolve(new Blob(chunks, { type: mimeType }));
      };
      mr.stop();
    }),
    getLevel,
  };
}

// ============================================================================
// STAGE 2 — Whisper STT (OpenRouter)
// ============================================================================

export async function transcribeAudio(blob: Blob, apiKey: string): Promise<string> {
  try {
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'openai/whisper-large-v3');
    form.append('language', 'th');

    const res = await fetch(OPENROUTER_AUDIO_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      console.warn('[voicePipeline] STT error', res.status);
      return '';
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    return data?.text ?? '';
  } catch (err) {
    console.error('[voicePipeline] transcribeAudio error', err);
    return '';
  }
}

// ============================================================================
// STAGE 3 — Sentiment + risk analysis (OpenRouter gpt-4o-mini)
// ============================================================================

export interface SentimentResult {
  score: number;        // 1–5 (1=poor, 5=excellent)
  flags: string[];      // e.g. ['ผู้ป่วยเจ็บปวด', 'ยาขาด']
  summary: string;      // 1-sentence Thai summary
}

const ANALYSIS_PROMPT = `คุณคือ AI วิเคราะห์รายงานประจำวันของพนักงาน Welcares (บริการดูแลผู้ป่วย)
วิเคราะห์ข้อความต่อไปนี้และตอบเป็น JSON เท่านั้น รูปแบบ:
{"score": <1-5>, "flags": ["<ปัญหาถ้ามี>"], "summary": "<สรุปหนึ่งประโยค>"}

score คือระดับ 1-5 (1=มีปัญหามาก, 3=ปกติ, 5=ดีเยี่ยม)
flags คือปัญหาที่ต้องติดตาม เช่น "ผู้ป่วยเจ็บปวด" "ยาขาด" "ผู้ป่วยกังวล" (ถ้าไม่มีปัญหา ใส่ [])
summary สรุปสั้นๆ ภาษาไทย`;

export async function analyzeTranscript(
  transcript: string,
  apiKey: string,
): Promise<SentimentResult> {
  const fallback: SentimentResult = { score: 3, flags: [], summary: transcript.slice(0, 80) };
  if (!transcript.trim()) return fallback;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'WelCares Voice Analysis',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: ANALYSIS_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return fallback;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content);
    return {
      score: Number(parsed.score) || 3,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      summary: String(parsed.summary || ''),
    };
  } catch (err) {
    console.error('[voicePipeline] analyzeTranscript error', err);
    return fallback;
  }
}

// ============================================================================
// CONVERSATIONAL AI — voice assistant responses
// ============================================================================

export async function chatWithAI(
  message: string,
  apiKey: string,
  systemPrompt: string,
): Promise<string> {
  if (!apiKey || !message.trim()) return '';
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'WelCares Voice Assistant',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });
    if (!res.ok) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (err) {
    console.error('[voicePipeline] chatWithAI error', err);
    return '';
  }
}

// ============================================================================
// OCR — OpenRouter vision for prescription scanning
// ============================================================================

export interface MedicineItem {
  name: string;
  dose: string;
  frequency: string;
}

const OCR_PROMPT = `สแกนใบสั่งยานี้ ระบุรายการยาทั้งหมด ตอบเป็น JSON array เท่านั้น รูปแบบ:
[{"name":"ชื่อยา","dose":"ขนาด","frequency":"ความถี่"}]
ถ้าไม่เจอรายการยา ตอบ []`;

export async function scanPrescription(
  imageBase64: string,
  apiKey: string,
): Promise<MedicineItem[]> {
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'WelCares OCR',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: imageBase64, detail: 'low' } },
          ],
        }],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.medicines ?? parsed.items ?? []);
  } catch (err) {
    console.error('[voicePipeline] scanPrescription error', err);
    return [];
  }
}
