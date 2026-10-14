import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '20mb' }));

// Serve static assets from /public directly (crucial for audio files)
const publicDir = path.resolve(process.cwd(), 'public');
const audioDir = path.resolve(publicDir, 'audio');
app.use(express.static(publicDir));
app.use('/audio', express.static(audioDir));

// Dedicated Voice Asset Status Endpoint
app.get('/api/voice-asset/status', (req, res) => {
  const filePath = path.resolve(audioDir, 'hope_welcome.wav');
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    return res.json({
      exists: true,
      fileName: 'hope_welcome.wav',
      filePath: 'public/audio/hope_welcome.wav',
      url: '/audio/hope_welcome.wav',
      sizeBytes: stats.size,
      mimeType: 'audio/wav',
      voiceName: 'Hope',
      greetingText: 'Welcome, Victor Sir. Shall we proceed to authentication?',
      lastModified: stats.mtime.toISOString(),
      exactAudioProvided: true,
    });
  } else {
    return res.json({
      exists: false,
      fileName: 'hope_welcome.wav',
      filePath: 'public/audio/hope_welcome.wav',
      url: '/audio/hope_welcome.wav',
      error: 'Audio file not found at public/audio/hope_welcome.wav',
      instructions: 'Place the authorized Hope welcome recording as public/audio/hope_welcome.wav or upload via the dashboard.',
    });
  }
});

// Dedicated Voice Asset Upload / Replace Endpoint
app.post('/api/voice-asset/upload', (req, res) => {
  try {
    const { audioBase64, fileName = 'hope_welcome.wav' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required.' });
    }

    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const targetPath = path.resolve(audioDir, 'hope_welcome.wav');
    const buffer = Buffer.from(audioBase64, 'base64');
    fs.writeFileSync(targetPath, buffer);
    const stats = fs.statSync(targetPath);

    return res.json({
      success: true,
      message: 'Successfully updated Hope voice recording.',
      sizeBytes: stats.size,
      url: '/audio/hope_welcome.wav',
      fileName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Failed to save voice file: ${msg}` });
  }
});

// 1. Google AI Studio Gemini TTS endpoint (with British Hope persona tuning)
app.post('/api/tts/generate', async (req, res) => {
  try {
    const { text, voiceName = 'Hope', stylePrompt } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text prompt is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server environment. Please configure it in AI Studio Secrets.',
        fallbackAvailable: true,
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Gemini API prebuilt voices are: Kore, Zephyr, Puck, Charon, Fenrir.
    // When Hope is requested, map base voice to Kore with British Hope persona style prompt.
    const isHopeRequested = voiceName.toLowerCase() === 'hope';
    const targetVoice = isHopeRequested ? 'Kore' : voiceName;
    const personaStyle =
      stylePrompt ||
      (isHopeRequested
        ? 'Hope persona: natural, warm, elegant, confident British English female voice with human-like pacing and expressive intonation. Addressing Victor Sir with poise and warmth.'
        : 'Warm, natural, elegant, poised executive security assistant');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text,
              speechMetadata: {
                style: personaStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: targetVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';

    if (!base64Audio) {
      return res.status(502).json({
        error: 'No audio data returned by Gemini TTS engine.',
        fallbackAvailable: true,
      });
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType,
      voiceName: isHopeRequested ? 'Hope (Gemini Persona)' : voiceName,
      provider: 'Google AI Studio Gemini',
      baseVoice: targetVoice,
      isExactVoice: false,
      stylePrompt: personaStyle,
      notice: isHopeRequested
        ? 'Generated via Gemini TTS with Hope British Persona tuning. For the exact proprietary Hope voice, configure ElevenLabs (Voice ID: tnSpp4vdxKPjI9w0GnoV) or import an authorized audio file.'
        : undefined,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[ASTRA-SERVER] Gemini TTS generation error:', errorMessage);
    return res.status(500).json({
      error: `Gemini TTS generation failed: ${errorMessage}`,
      fallbackAvailable: true,
    });
  }
});

// 2. ElevenLabs Exact Hope Voice endpoint (Voice ID: tnSpp4vdxKPjI9w0GnoV)
app.post('/api/tts/elevenlabs', async (req, res) => {
  try {
    const { text, apiKey: clientApiKey } = req.body;
    const apiKey = clientApiKey || process.env.ELEVENLABS_API_KEY;

    // Exact ElevenLabs Voice ID for Hope
    const HOPE_VOICE_ID = 'tnSpp4vdxKPjI9w0GnoV';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        requiresKey: true,
        voiceId: HOPE_VOICE_ID,
        provider: 'ElevenLabs',
        error: 'ElevenLabs API key is required to synthesize the exact proprietary "Hope" voice (Voice ID: tnSpp4vdxKPjI9w0GnoV). Alternatively, you can upload the authorized hope_welcome audio file or preview the Gemini British Hope persona.',
      });
    }

    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${HOPE_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text || 'Welcome, Victor Sir. Shall we proceed to authentication?',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      return res.status(elevenRes.status).json({
        success: false,
        error: `ElevenLabs API error: ${errText}`,
        voiceId: HOPE_VOICE_ID,
      });
    }

    const audioArrayBuffer = await elevenRes.arrayBuffer();
    const buffer = Buffer.from(audioArrayBuffer);
    const audioBase64 = buffer.toString('base64');

    return res.json({
      success: true,
      audioBase64,
      mimeType: 'audio/mpeg',
      voiceName: 'Hope (Exact ElevenLabs)',
      voiceId: HOPE_VOICE_ID,
      provider: 'ElevenLabs',
      isExactVoice: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      success: false,
      error: `ElevenLabs request failed: ${msg}`,
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    hasElevenLabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
    hopeVoiceId: 'tnSpp4vdxKPjI9w0GnoV',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[ASTRA] SecureDrive Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[ASTRA-SERVER] Fatal startup error:', err);
  process.exit(1);
});
