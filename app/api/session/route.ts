import { GoogleGenAI } from '@google/genai';
import { buildGemmaSystemInstruction } from '../../../lib/mastra/agent.ts';
import { UserProfile } from '../../../lib/vector/types.ts';

const SESSION_MODEL_ENDPOINTS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

export async function POST(req: Request) {
  try {
    const byokKey =
      req.headers.get('x-gemma-api-key') ||
      req.headers.get('x-gemini-api-key') ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    const body = await req.json();
    const { subject, sourceText, userProfile, customApiKey } = body;

    const apiKey = customApiKey || byokKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key available' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!subject || !subject.trim()) {
      return new Response(JSON.stringify({ error: 'Subject is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const profile = (userProfile as UserProfile) || {};
    const systemInstruction = buildGemmaSystemInstruction(profile, false);

    const prompt = `You are Gemma 2, an expert academic tutor and curriculum architect.
Generate a comprehensive, subject-tailored, multi-stage study roadmap and learning kit for the subject: "${subject}".
${sourceText ? `Extracted Resource Notes (use these for high fidelity):\n${sourceText.slice(0, 4000)}\n` : ''}

CRITICAL ARCHITECTURE INSTRUCTIONS:
1. AUTONOMOUS STAGE COUNT: You MUST autonomously determine the exact number of stages (typically between 5 and 10 stages) based strictly on the authentic scope, depth, and syllabus requirements of "${subject}".
2. ZERO BOILERPLATE: Every single chapterTitle, subChapter, contentSummary, keyNotions, properties, criticalNotices, and YouTube keywords MUST BE 100% SPECIFIC TO "${subject}". Do NOT use generic placeholder words like "Taxonomy", "State Space", "Primitive Units", or "Dynamic Transition Functions" unless "${subject}" is literally an abstract mathematics or state-machine topic.
3. LEARNING STYLE ADAPTATION: Tailor the explanations and analogies specifically to the student's learning style (${profile.learningStyle || 'visual'}) and cognitive needs.
4. Output MUST BE STRICTLY VALID JSON conforming to the following schema:

{
  "roadmap": [
    {
      "stageNumber": 1,
      "hierarchyTitle": "PART I: [SPECIFIC TITLE] ➔ CHAPTER 1.1: [SPECIFIC TITLE]",
      "chapterTitle": "Specific Chapter Name in UPPERCASE",
      "subChapter": "Specific granular sub-chapter topic",
      "contentSummary": "Deep, concrete summary of this specific topic's mental model and core mechanisms",
      "keyNotions": ["Concrete Notion 1 with real definition", "Concrete Notion 2 with mechanism"],
      "properties": ["Real law, formula, constraint, or invariant governing this topic", "Key characteristic property"],
      "criticalNotices": ["Notice: Specific exam trap or common misconception for this exact topic"],
      "allocatedTime": "${profile.dailyMinutes || 35} mins",
      "deadlineDate": "${profile.examDate || 'Milestone 1'}",
      "highUtilitySearchKeywords": "${subject} specific topic keywords for video tutorial",
      "panicTip": "Actionable calming mental anchor or cognitive triage hack"
    }
  ],
  "concepts": [
    {
      "term": "Specific Term / Notion in ${subject}",
      "jargon": "Exact rigorous academic definition",
      "analogy": "Vivid everyday real-world analogy (e.g. comparing this concept to a kitchen blender, car transmission, library index, soccer referee, etc.)"
    }
  ],
  "flashcards": [
    {
      "question": "Scenario or active-recall prompt specifically testing ${subject}",
      "answer": "Concise, high-yield explanation with key terms"
    }
  ],
  "quiz": [
    {
      "question": "Realistic exam multiple-choice question testing ${subject}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why the correct option is right and the common distractor trap"
    }
  ]
}

Provide 5 to 10 comprehensive stages, 6 to 8 concepts with rich analogies, 6 to 8 flashcards, and 4 to 5 scenario quiz questions.`;

    let generatedText = '';
    let lastError: any = null;

    for (const model of SESSION_MODEL_ENDPOINTS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.4,
            responseMimeType: 'application/json',
          },
        });
        generatedText = response.text || '';
        if (generatedText) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!generatedText) {
      throw new Error(lastError?.message || 'Failed to generate session across all candidate models');
    }

    let cleaned = generatedText.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Session generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
