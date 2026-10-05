import { GoogleGenAI } from '@google/genai';
import {
  UserProfile,
  CourseSession,
  RoadmapStep,
  ConceptAnalogy,
  FlashcardState,
  QuizQuestion,
} from '../vector/types';

export interface AgentGenerateSessionParams {
  subject: string;
  sourceText?: string;
  userProfile: UserProfile;
  engineTarget?: 'cloud' | 'local';
  customApiKey?: string;
}

export function buildGemmaSystemInstruction(profile: UserProfile, isLocal: boolean): string {
  const conditionsText = [
    ...(profile.conditions || []),
    profile.otherCondition ? `Other: ${profile.otherCondition}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const scheduleText = `${profile.dailyMinutes || 35} mins/day on ${(profile.availableDays || ['Mon', 'Wed', 'Fri']).join(', ')} (${profile.preferredTimeSlot || 'evening'})`;

  return `You are Gemma 2, an empathetic, adaptive, high-impact private study architect created to help students master any subject.
MODEL TARGET: ${isLocal ? 'gemma-2-2b-it (Local In-Browser WebLLM Engine)' : 'gemma-2-9b-it (Cloud Gemma Endpoint Engine)'}.
STUDENT PROFILE:
- Name: ${profile.name || 'Student'}
- Academic Level: ${profile.academicLevel || 'University'}
- Majors: ${(profile.majors || []).join(', ') || 'General Studies'}
- Preferred Learning Style: ${profile.learningStyle || 'visual'} (Auditory, Visual, Kinesthetic, Reading/Writing, or Fast-Paced)
- Psychological & Cognitive Conditions: ${conditionsText || 'None specified'}
- Availability & Study Schedule: ${scheduleText}
- Exam Deadline: ${profile.examDate || 'Self-paced'} ${profile.examTitle ? `(${profile.examTitle})` : ''}

CORE BEHAVIOR RULES:
1. AUTONOMOUS STAGE COUNT DETERMINATION: YOU, as the Gemma AI curriculum architect, MUST autonomously determine the exact number of stages needed based strictly on the subject's real academic complexity, scope, and depth. DO NOT follow any arbitrary or hardcoded count. Break down the subject into its authentic, granular syllabus with EVERY SINGLE CHAPTER and UNDER-CHAPTER. If the topic requires 7, 10, 15, or more stages to cover thoroughly from first principles to mastery, generate that exact sequence.
2. For EVERY stage, provide:
   - "hierarchyTitle": Breadcrumb hierarchy (e.g. "MODULE 1: TAXONOMY ➔ SECTION 1.2: UNDER-CHAPTER NAME")
   - "chapterTitle": The major chapter / module
   - "subChapter": The precise under-chapter
   - "contentSummary": High-impact breakdown tailored to ${profile.learningStyle}
   - "keyNotions": Array of 2 to 4 specific notions & concepts introduced here
   - "properties": Array of 2 to 3 mathematical invariants, physical laws, or fundamental properties
   - "criticalNotices": Array of 1 to 2 caveats, traps, edge-cases ("Notice", "Common Exam Trap")
   - "allocatedTime": Realistic duration honoring student's ${profile.dailyMinutes || 35}m daily budget
   - "deadlineDate": Milestone deadline
   - "highUtilitySearchKeywords": Keywords for video queries
   - "panicTip": Anti-panic micro-hack for cognitive overload
3. If the user has ADHD, Short Attention Span, or TikTok Brain: break concepts into micro-units, provide vivid everyday analogies, and deliver rapid dopamine feedback loops.
4. Output strictly valid JSON matching the requested schema.`;
}

export async function generateCourseSessionWithGemma(
  params: AgentGenerateSessionParams
): Promise<Omit<CourseSession, 'id' | 'timestamp'>> {
  const { subject, sourceText, userProfile, engineTarget = 'cloud', customApiKey } = params;
  const isLocal = engineTarget === 'local';

  const systemInstruction = buildGemmaSystemInstruction(userProfile, isLocal);

  const prompt = `Generate an EXHAUSTIVE, DETAILED, MULTI-TIER hierarchical roadmap and study curriculum for subject: "${subject}".
${sourceText ? `Extracted Document Context (First 3500 chars):\n${sourceText.slice(0, 3500)}\n` : ''}

CRITICAL REQUIREMENT:
YOU (Gemma AI) MUST AUTONOMOUSLY DETERMINE THE EXACT NUMBER OF STAGES.
Do not shrink or force this subject into any arbitrary or fixed count! Different subjects have completely different depths. You must analyze the authentic scope and complexity of "${subject}" and generate the exact number of stages required to cover every essential chapter, under-chapter, hierarchy level, notion, property, and notice from foundational principles to mastery. Let the subject's true academic knowledge graph dictate the stage count.

Respond ONLY with a valid JSON object (no markdown code blocks, no backticks, no trailing explanation) in this exact schema:
{
  "roadmap": [
    {
      "stageNumber": 1,
      "hierarchyTitle": "PART I: FOUNDATIONAL PREREQUISITES ➔ CHAPTER 1: CORE DYNAMICS",
      "chapterTitle": "Short uppercase chapter title",
      "subChapter": "Granular under-chapter focus",
      "contentSummary": "Punchy sentences summarizing the specific mental model",
      "keyNotions": ["Notion 1: Definition", "Notion 2: Mechanism"],
      "properties": ["Invariant rule or property A", "Constraint or mathematical law B"],
      "criticalNotices": ["Notice: Common confusion or edge-case trap"],
      "allocatedTime": "${userProfile.dailyMinutes || 35} mins",
      "deadlineDate": "${userProfile.examDate || 'Sprint 1'}",
      "highUtilitySearchKeywords": "core keywords for video search",
      "panicTip": "1-sentence calm psychological reset or triage hack"
    }
  ],
  "concepts": [
    {
      "term": "Concept Name",
      "jargon": "Complex academic definition or technical jargon",
      "analogy": "Vivid everyday real-world analogy (e.g. gym spotter, Lego, pizza delivery, traffic light)"
    }
  ],
  "flashcards": [
    {
      "question": "Active recall prompt or scenario question",
      "answer": "High-yield concise answer"
    }
  ],
  "quiz": [
    {
      "question": "Scenario-based exam test question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this option is correct"
    }
  ]
}

Provide as many stages in the roadmap as the subject genuinely requires according to your Gemma AI assessment. Provide 6 to 8 core concepts, 6 to 8 flashcards, and 4 to 5 scenario quiz questions.`;

  try {
    const apiKey = customApiKey || userProfile.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return generateFallbackSession(subject, userProfile);
    }

    const ai = new GoogleGenAI({ apiKey });
    const gemmaEndpoints = ['gemma-2-9b-it', 'gemma-2-27b-it', 'gemini-3.8-flash'];
    let raw = '';

    for (const model of gemmaEndpoints) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.4,
          },
        });
        raw = response.text || '';
        if (raw) break;
      } catch (err) {
        // try next candidate model
      }
    }

    if (!raw) {
      return generateFallbackSession(subject, userProfile);
    }

    raw = raw.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim();
    const parsed = JSON.parse(raw);

    return {
      subject,
      profileSnapshot: userProfile,
      roadmap: (parsed.roadmap || []).map((s: any, idx: number) => ({
        stageNumber: s.stageNumber || idx + 1,
        hierarchyTitle: s.hierarchyTitle || `MODULE ${Math.floor(idx / 3) + 1} ➔ SECTION ${idx + 1}`,
        chapterTitle: s.chapterTitle || `CHAPTER ${idx + 1}`,
        subChapter: s.subChapter || 'Foundational Sub-Module',
        contentSummary: s.contentSummary || `Granular technical breakdown for ${subject}`,
        keyNotions: Array.isArray(s.keyNotions) ? s.keyNotions : [`Core mechanism of ${s.chapterTitle || subject}`],
        properties: Array.isArray(s.properties) ? s.properties : ['Conservation invariant & deterministic state bounds'],
        criticalNotices: Array.isArray(s.criticalNotices) ? s.criticalNotices : ['Notice: Be cautious of boundary conditions and edge values'],
        allocatedTime: s.allocatedTime || `${userProfile.dailyMinutes || 35} mins`,
        deadlineDate: s.deadlineDate || userProfile.examDate || `Day ${idx * 2 + 1}`,
        highUtilitySearchKeywords: s.highUtilitySearchKeywords || `${subject} ${s.subChapter || ''} tutorial`,
        panicTip: s.panicTip || 'Breathe in 4s, out 6s. Focus on the single active sub-chapter.',
        completed: false,
      })),
      concepts: (parsed.concepts || []).map((c: any) => ({
        term: c.term || 'Core Mechanism',
        jargon: c.jargon || 'Academic technical definition',
        analogy: c.analogy || 'Everyday life mechanism',
      })),
      flashcards: (parsed.flashcards || []).map((f: any, idx: number) => ({
        id: `card-${idx + 1}-${Date.now()}`,
        question: f.question || `Key question on ${subject}`,
        answer: f.answer || 'Key answer',
        leitnerBox: 1,
        nextReviewDate: Date.now() + 86400000,
      })),
      quiz: (parsed.quiz || []).map((q: any) => ({
        question: q.question || 'Exam scenario check',
        options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || 'Detailed explanation',
      })),
    };
  } catch (err) {
    return generateFallbackSession(subject, userProfile);
  }
}

export function generateFallbackSession(
  subject: string,
  userProfile: UserProfile
): Omit<CourseSession, 'id' | 'timestamp'> {
  const mins = userProfile.dailyMinutes || 35;

  return {
    subject,
    profileSnapshot: userProfile,
    roadmap: [
      {
        stageNumber: 1,
        hierarchyTitle: `PART I: TAXONOMY & PRIMITIVES ➔ CHAPTER 1.1: TAXONOMIC FOUNDATIONS`,
        chapterTitle: `DECONSTRUCTING ${subject.toUpperCase()}`,
        subChapter: 'Taxonomic Architecture & State Space',
        contentSummary: 'Map the boundary conditions and elementary units that govern the entire domain.',
        keyNotions: [
          'State Space: The universe of all valid operational configurations',
          'Primitive Units: Irreducible components and boundary constraints',
          'Invariance: Core principles that remain unchanged across transformations',
        ],
        properties: [
          'Completeness: Every system state can be expressed as a linear combination of primitives',
          'Deterministic Bounds: No output exceeds the input entropy ceiling',
        ],
        criticalNotices: [
          'Notice: Do not memorize complex formulas until the elementary taxonomy is second nature.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 1',
        highUtilitySearchKeywords: `${subject} visualized intuitive fundamentals`,
        panicTip: 'Exams test pattern recognition, not encyclopedic memorization. Breathe in 4s, out 6s.',
        completed: false,
      },
      {
        stageNumber: 2,
        hierarchyTitle: `PART I: TAXONOMY & PRIMITIVES ➔ CHAPTER 1.2: TRANSFORMATION MECHANISMS`,
        chapterTitle: 'TRANSFORMATION PIPELINES & LEVERS',
        subChapter: 'Dynamical Transition Functions',
        contentSummary: 'How input signals are transformed into deterministic states through sequential stages.',
        keyNotions: [
          'Transition Function: The operational mapping rule f(S, I) -> S_next',
          'Feedback Dampening: Mechanisms preventing unstable oscillatory loops',
        ],
        properties: [
          'Reversibility: Inverse operators can recover pre-transition states under zero noise',
          'Linear vs Non-linear threshold response zones',
        ],
        criticalNotices: [
          'Notice: Non-linear zones exhibit sensitive dependence on initial boundary tolerances.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 3',
        highUtilitySearchKeywords: `${subject} process flow diagram explained`,
        panicTip: 'Take a 30s pause. Stand up, stretch, and verify one single transition step.',
        completed: false,
      },
      {
        stageNumber: 3,
        hierarchyTitle: `PART II: STRUCTURAL HIERARCHY ➔ CHAPTER 2.1: INTERNAL MECHANICS`,
        chapterTitle: 'MICRO-COMPONENTS & SUBSYSTEMS',
        subChapter: 'Coupled Subsystems & Interface Contracts',
        contentSummary: 'Inspect the interconnected modules and how data or energy flows between contracts.',
        keyNotions: [
          'Interface Contract: Preconditions and postconditions required for interoperability',
          'Loose Coupling: Modular isolation that shields subsystems from cascading failures',
        ],
        properties: [
          'Orthogonality: Changing Subsystem A does not alter the independent invariants of Subsystem B',
          'Throughput bottleneck equals min(capacity_i)',
        ],
        criticalNotices: [
          'Notice: Watch for hidden shared state dependencies that violate contract boundaries.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 5',
        highUtilitySearchKeywords: `${subject} component architecture deep dive`,
        panicTip: 'Mistakes in practice are neuroplasticity triggers. Errors are free XP.',
        completed: false,
      },
      {
        stageNumber: 4,
        hierarchyTitle: `PART II: STRUCTURAL HIERARCHY ➔ CHAPTER 2.2: EQUILIBRIUM & STEADY STATES`,
        chapterTitle: 'STEADY-STATE DYNAMICS',
        subChapter: 'Equilibrium Conditions & Balances',
        contentSummary: 'Analyze systems at rest and under continuous stationary load.',
        keyNotions: [
          'Dynamic Equilibrium: Opposing rates are equal, creating stable observable states',
          'Perturbation Response: How the system self-corrects after an external shock',
        ],
        properties: [
          "Le Chatelier's Invariant: The system counteracts applied stress to restore balance",
          'Lyapunov Stability Criterion: Small perturbations remain bounded',
        ],
        criticalNotices: [
          'Notice: Distinguish static dormancy from dynamic equilibrium with active flow.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 7',
        highUtilitySearchKeywords: `${subject} equilibrium balance equations`,
        panicTip: 'Visualize the physical balance scale. Intuition anchors the math.',
        completed: false,
      },
      {
        stageNumber: 5,
        hierarchyTitle: `PART III: LIMIT THEOREMS & BOUNDARIES ➔ CHAPTER 3.1: SATURATION & STRESS`,
        chapterTitle: 'BOUNDARY LIMITS & BOTTLENECKS',
        subChapter: 'Capacity Saturation & Non-linear Falloff',
        contentSummary: 'Where linear approximations collapse under excessive load, stress, or edge inputs.',
        keyNotions: [
          'Saturation Ceiling: The asymptotic maximum throughput or capacity of the system',
          'Resource Starvation: Secondary processes locked waiting on saturated bottlenecks',
        ],
        properties: [
          "Amdahl's Upper Bound: Overall speedup is strictly bounded by the non-scalable fraction",
          'Diminishing returns exponential decay',
        ],
        criticalNotices: [
          'Notice: Optimizing non-bottleneck components yields zero net throughput improvement.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 9',
        highUtilitySearchKeywords: `${subject} edge cases bottleneck analysis`,
        panicTip: 'Panic happens when staring at the whole cliff. Focus on the immediate next rung.',
        completed: false,
      },
      {
        stageNumber: 6,
        hierarchyTitle: `PART III: LIMIT THEOREMS & BOUNDARIES ➔ CHAPTER 3.2: ERROR DETECTION & PROOF`,
        chapterTitle: 'VERIFICATION & INVARIANT PROOFS',
        subChapter: 'Invariant Testing & Proof by Contradiction',
        contentSummary: 'Rigorous validation methods to guarantee correctness and catch exam traps.',
        keyNotions: [
          'Loop Invariant: Assertion that remains true before and after each iteration',
          'Counterexample Generation: Finding the minimal edge case that breaks a false claim',
        ],
        properties: [
          'Inductive Step: If P(k) implies P(k+1), the invariant holds across the infinite domain',
          'Monotonicity of error propagation',
        ],
        criticalNotices: [
          'Common Exam Trap: Assuming the converse is true without proving bidirectional equivalence.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 11',
        highUtilitySearchKeywords: `${subject} formal proof techniques practice`,
        panicTip: 'If stuck, test small simple numbers (0, 1, empty, negative) to illuminate the pattern.',
        completed: false,
      },
      {
        stageNumber: 7,
        hierarchyTitle: `PART IV: ADVANCED SYNTHESIS ➔ CHAPTER 4.1: MULTI-SYSTEM INTEGRATION`,
        chapterTitle: 'HOLISTIC INTEGRATION',
        subChapter: 'Cross-Domain Coupling & Synthesis',
        contentSummary: 'Combining multiple subsystems into unified end-to-end architectures.',
        keyNotions: [
          'Pipeline Chaining: Output of stage i seamlessly feeds input of stage i+1',
          'Impedance Matching: Harmonizing differing transmission rates across boundaries',
        ],
        properties: [
          'Compositionality: Well-behaved subsystems compose into predictable super-systems',
          'End-to-End latency equals sum of stage latencies + buffer delays',
        ],
        criticalNotices: [
          'Notice: Off-by-one synchronization errors frequently corrupt boundary handoffs.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 13',
        highUtilitySearchKeywords: `${subject} end to end case studies review`,
        panicTip: 'You have solved every individual piece. Integration is simply connecting the wires.',
        completed: false,
      },
      {
        stageNumber: 8,
        hierarchyTitle: `PART IV: ADVANCED SYNTHESIS ➔ CHAPTER 4.2: EXAM-READY RAPID RECOVERY`,
        chapterTitle: 'CHAMPIONSHIP ARENA BULLETPROOFING',
        subChapter: 'High-Stakes Scenario Execution & Triage',
        contentSummary: 'Mastering time-constrained problem resolution and anti-panic exam tactics.',
        keyNotions: [
          'Pareto 80/20 Triage: First collect high-yield quick marks before grinding complex proofs',
          'Active Backtracking: Quickly discarding dead-end assumptions before sunk-cost bias sets in',
        ],
        properties: [
          'Calm Cognitive Bandwidth: Cortisol reduction directly increases working memory buffer by 30%',
          'Speed-Accuracy trade-off optimization',
        ],
        criticalNotices: [
          'Notice: Always read the question prompt twice. 60% of exam errors stem from misread constraints.',
        ],
        allocatedTime: `${mins} mins`,
        deadlineDate: userProfile.examDate || 'Day 15',
        highUtilitySearchKeywords: `${subject} solved past exams high yield questions`,
        panicTip: 'You have done the repetitions. Trust your instincts. You are ready.',
        completed: false,
      },
    ],
    concepts: [
      {
        term: `Core Primitive of ${subject}`,
        jargon: `The irreducible base rule and state transformation governing ${subject}.`,
        analogy: 'Like the foundation blocks in a Lego castle: without them, everything else collapses.',
      },
      {
        term: 'Operational Dynamics',
        jargon: 'Sequential processing pipeline converting raw inputs to deterministic states.',
        analogy: 'Like traffic flow regulated by synchronized smart traffic lights during rush hour.',
      },
      {
        term: 'Boundary Saturation',
        jargon: 'Constraint overflow limits where normal linear rules break down.',
        analogy: 'Like a funnel overflowing when liquid is poured in faster than the neck diameter.',
      },
      {
        term: 'Invariant State',
        jargon: 'A condition that remains invariant across state transitions.',
        analogy: 'Like the total amount of water in a closed loop aquarium regardless of pump speed.',
      },
    ],
    flashcards: [
      {
        id: 'card-1',
        question: `What is the single most critical mechanism in ${subject}?`,
        answer: 'The fundamental transformation cycle that converts inputs into predictable outputs.',
        leitnerBox: 1,
        nextReviewDate: Date.now() + 86400000,
      },
      {
        id: 'card-2',
        question: `Why does ${subject} fail under edge conditions?`,
        answer: 'Resource saturation or unhandled constraint overflow occurs.',
        leitnerBox: 1,
        nextReviewDate: Date.now() + 86400000,
      },
      {
        id: 'card-3',
        question: `How do you verify an invariant in ${subject}?`,
        answer: 'Show base case validity, then prove inductive maintenance through state transitions.',
        leitnerBox: 2,
        nextReviewDate: Date.now() + 86400000 * 3,
      },
    ],
    quiz: [
      {
        question: `When analyzing a new problem involving ${subject}, what is the first priority step?`,
        options: [
          'Identify constraints, boundaries, and fundamental inputs',
          'Memorize the longest formula immediately',
          'Ignore the real-world conditions and guess',
          'Skip directly to the end-result without validation',
        ],
        correctIndex: 0,
        explanation: 'Grounding the problem in boundary conditions prevents cascading errors down the chain.',
      },
      {
        question: `Why is active recall spaced repetition superior to re-reading notes for ${subject}?`,
        options: [
          'It signals the brain to strengthen neural synapses through forced retrieval',
          'It makes the textbook look cleaner',
          'It takes zero cognitive effort',
          'It only works for mathematics',
        ],
        correctIndex: 0,
        explanation: 'Active retrieval defeats the Ebbinghaus forgetting curve by resetting retention stability.',
      },
    ],
  };
}
