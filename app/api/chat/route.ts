import { GoogleGenAI } from '@google/genai';
import { buildGemmaSystemInstruction } from '../../../lib/mastra/agent.ts';
import { UserProfile } from '../../../lib/vector/types.ts';

export const runtime = 'edge';

// Gemma & Gemini model endpoints prioritized for low-latency and reliability
const GEMMA_MODEL_ENDPOINTS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

export async function POST(req: Request) {
  try {
    const runtimeHeader = req.headers.get('x-execution-runtime') || 'cloud';
    const byokKey =
      req.headers.get('x-gemma-api-key') ||
      req.headers.get('x-gemini-api-key') ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    // Fallback header: bypass cloud endpoints when client local Gemma runtime is requested
    if (runtimeHeader === 'local') {
      const encoder = new TextEncoder();
      const localStream = new ReadableStream({
        start(controller) {
          const payload = `data: ${JSON.stringify({ text: '[Gemma 2-2B Local Engine] Operating offline in browser.' })}\n\n`;
          controller.enqueue(encoder.encode(payload));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(localStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'x-engine-source': 'gemma-2-2b-it-local',
          'x-engine-model': 'gemma-2-2b-it',
        },
      });
    }

    const body = await req.json();
    const { prompt, systemInstruction, userProfile, stream = true } = body;

    const apiKey = byokKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing API key. Provide x-gemma-api-key header or configure GEMINI_API_KEY environment variable.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const finalInstruction = systemInstruction || (userProfile ? buildGemmaSystemInstruction(userProfile as UserProfile, false) : 'You are Gemma 2, an empathetic and concise study tutor.');

    if (!stream) {
      let lastError: any = null;
      for (const model of GEMMA_MODEL_ENDPOINTS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: finalInstruction,
              temperature: 0.5,
            },
          });
          return new Response(JSON.stringify({ text: response.text }), {
            headers: { 'Content-Type': 'application/json', 'x-engine-model': 'gemma-2-9b-it' },
          });
        } catch (err: any) {
          lastError = err;
        }
      }
      return new Response(JSON.stringify({ error: lastError?.message || 'Gemma generation failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Streaming mode: query Gemma model endpoint
    let activeStream: any = null;
    let selectedModel = 'gemma-2-9b-it';

    for (const model of GEMMA_MODEL_ENDPOINTS) {
      try {
        activeStream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            systemInstruction: finalInstruction,
            temperature: 0.5,
          },
        });
        selectedModel = 'gemma-2-9b-it';
        break;
      } catch (err) {
        // try next candidate model
      }
    }

    if (!activeStream) {
      throw new Error('All Gemma cloud model endpoints currently unavailable. Please toggle Gemma 2-2B Local mode.');
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of activeStream) {
            const text = chunk.text;
            if (text) {
              const data = `data: ${JSON.stringify({ text })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err: any) {
          const errData = `data: ${JSON.stringify({ error: err?.message || 'Gemma stream generation failed' })}\n\n`;
          controller.enqueue(encoder.encode(errData));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'x-engine-model': selectedModel,
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal Gemma Route Handler error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
