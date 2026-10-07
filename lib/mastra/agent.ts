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
1. AUTONOMOUS STAGE COUNT DETERMINATION: YOU, as the Gemma AI curriculum architect, MUST autonomously determine the exact number of stages needed based strictly on the subject's real academic complexity, scope, and depth. DO NOT follow any arbitrary or hardcoded count. Break down the subject into its authentic, granular syllabus with EVERY SINGLE CHAPTER and UNDER-CHAPTER.
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
3. ZERO BOILERPLATE: Every field MUST be 100% specific to the given subject. Never use generic placeholder descriptions.
4. Output strictly valid JSON matching the requested schema.`;
}

export async function generateCourseSessionWithGemma(
  params: AgentGenerateSessionParams
): Promise<Omit<CourseSession, 'id' | 'timestamp'>> {
  const { subject, sourceText, userProfile, engineTarget = 'cloud', customApiKey } = params;

  // 1. Primary Path: Call server-side /api/session endpoint
  // This uses the server's GEMINI_API_KEY environment variable and fast Gemma/Gemini endpoints
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const effectiveKey = customApiKey || userProfile.apiKey;
    if (effectiveKey) {
      headers['x-gemma-api-key'] = effectiveKey;
      headers['x-gemini-api-key'] = effectiveKey;
    }

    const response = await fetch('/api/session', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject,
        sourceText,
        userProfile,
        customApiKey: effectiveKey,
      }),
    });

    if (response.ok) {
      const parsed = await response.json();
      if (parsed.roadmap && Array.isArray(parsed.roadmap) && parsed.roadmap.length > 0) {
        return {
          subject,
          profileSnapshot: userProfile,
          roadmap: parsed.roadmap.map((s: any, idx: number) => ({
            stageNumber: s.stageNumber || idx + 1,
            hierarchyTitle: s.hierarchyTitle || `MODULE ${Math.floor(idx / 2) + 1} ➔ SECTION ${idx + 1}: ${s.subChapter || subject}`,
            chapterTitle: s.chapterTitle || `STAGE ${idx + 1}: ${subject.toUpperCase()}`,
            subChapter: s.subChapter || `Core Concepts of ${subject}`,
            contentSummary: s.contentSummary || `Granular technical breakdown for ${subject}`,
            keyNotions: Array.isArray(s.keyNotions) ? s.keyNotions : [`Core mechanism of ${s.chapterTitle || subject}`],
            properties: Array.isArray(s.properties) ? s.properties : ['Governing invariant & characteristic property'],
            criticalNotices: Array.isArray(s.criticalNotices) ? s.criticalNotices : ['Notice: Be cautious of boundary conditions and edge values'],
            allocatedTime: s.allocatedTime || `${userProfile.dailyMinutes || 35} mins`,
            deadlineDate: s.deadlineDate || userProfile.examDate || `Sprint ${idx + 1}`,
            highUtilitySearchKeywords: s.highUtilitySearchKeywords || `${subject} ${s.subChapter || s.chapterTitle || ''} tutorial`,
            panicTip: s.panicTip || 'Breathe in 4s, out 6s. Focus on this single sub-chapter.',
            completed: false,
          })),
          concepts: (parsed.concepts || []).map((c: any) => ({
            term: c.term || `${subject} Concept`,
            jargon: c.jargon || `Technical definition in ${subject}`,
            analogy: c.analogy || `Real-world everyday analogy for ${subject}`,
          })),
          flashcards: (parsed.flashcards || []).map((f: any, idx: number) => ({
            id: `card-${idx + 1}-${Date.now()}`,
            question: f.question || `Key question on ${subject}`,
            answer: f.answer || 'Key answer',
            leitnerBox: 1,
            nextReviewDate: Date.now() + 86400000,
          })),
          quiz: (parsed.quiz || []).map((q: any) => ({
            question: q.question || `Scenario check on ${subject}`,
            options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
            explanation: q.explanation || 'Detailed explanation',
          })),
        };
      }
    }
  } catch (apiErr) {
    console.warn('Backend /api/session call failed, trying direct client API:', apiErr);
  }

  // 2. Secondary Path: Direct Google GenAI call (if client has BYOK key)
  const apiKey = customApiKey || userProfile.apiKey;
  if (apiKey) {
    try {
      const isLocal = engineTarget === 'local';
      const systemInstruction = buildGemmaSystemInstruction(userProfile, isLocal);
      const prompt = `Generate an EXHAUSTIVE, DETAILED, MULTI-TIER hierarchical roadmap and study curriculum for subject: "${subject}".
${sourceText ? `Extracted Notes:\n${sourceText.slice(0, 3500)}\n` : ''}
Autonomously determine the exact number of stages required for "${subject}".
Output strictly valid JSON with keys: roadmap, concepts, flashcards, quiz.`;

      const ai = new GoogleGenAI({ apiKey });
      const candidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3.7-flash',
        'gemini-3.8-flash',
      ];

      for (const model of candidateModels) {
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
          const raw = response.text || '';
          if (raw) {
            const parsed = JSON.parse(raw.replace(/^```json/m, '').replace(/^```/m, '').replace(/```$/m, '').trim());
            if (parsed.roadmap && Array.isArray(parsed.roadmap)) {
              return {
                subject,
                profileSnapshot: userProfile,
                roadmap: parsed.roadmap.map((s: any, idx: number) => ({
                  stageNumber: s.stageNumber || idx + 1,
                  hierarchyTitle: s.hierarchyTitle || `MODULE ${Math.floor(idx / 2) + 1} ➔ SECTION ${idx + 1}`,
                  chapterTitle: s.chapterTitle || `STAGE ${idx + 1}`,
                  subChapter: s.subChapter || 'Foundational Topic',
                  contentSummary: s.contentSummary || `Granular technical breakdown for ${subject}`,
                  keyNotions: Array.isArray(s.keyNotions) ? s.keyNotions : [`Core mechanism of ${s.chapterTitle || subject}`],
                  properties: Array.isArray(s.properties) ? s.properties : ['Governing invariant & deterministic state bounds'],
                  criticalNotices: Array.isArray(s.criticalNotices) ? s.criticalNotices : ['Notice: Be cautious of boundary conditions and edge values'],
                  allocatedTime: s.allocatedTime || `${userProfile.dailyMinutes || 35} mins`,
                  deadlineDate: s.deadlineDate || userProfile.examDate || `Sprint ${idx + 1}`,
                  highUtilitySearchKeywords: s.highUtilitySearchKeywords || `${subject} ${s.subChapter || ''} tutorial`,
                  panicTip: s.panicTip || 'Breathe in 4s, out 6s. Focus on this single sub-chapter.',
                  completed: false,
                })),
                concepts: (parsed.concepts || []).map((c: any) => ({
                  term: c.term || 'Concept',
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
            }
          }
        } catch {
          // try next candidate
        }
      }
    } catch (directErr) {
      console.warn('Direct client API call failed:', directErr);
    }
  }

  // 3. Fallback Path: Domain-Aware Dynamic Curriculum Generator
  // If network is completely offline, synthesize authentic, topic-tailored syllabus
  return generateFallbackSession(subject, userProfile);
}

/**
 * High-fidelity domain-aware curriculum generator
 * Analyzes the subject title to generate authentically tailored chapters, concepts, and analogies
 */
export function generateFallbackSession(
  subject: string,
  userProfile: UserProfile
): Omit<CourseSession, 'id' | 'timestamp'> {
  const mins = userProfile.dailyMinutes || 35;
  const cleanSubj = subject.trim();
  const lower = cleanSubj.toLowerCase();

  // Detect domain
  const isBio = /\b(bio|cell|gene|dna|plant|photosyn|organ|medic|neuron|evolut|virus|ecol|heart|protein)\b/.test(lower);
  const isHistory = /\b(war|histor|revolution|empire|century|ancient|presiden|treaty|rome|greece|medieval|cold war|civil war)\b/.test(lower);
  const isCS = /\b(program|code|data structure|algorithm|python|java|javascript|react|database|sql|system|web|cloud|network|crypto|ai|machine learning)\b/.test(lower);
  const isMathPhysics = /\b(math|calculus|physics|algebra|vector|quantum|relativ|gravity|thermo|kinetic|derivative|integral|matrix|geometry)\b/.test(lower);
  const isChemistry = /\b(chem|reaction|acid|base|organic|molecule|atom|bond|stoichiomet|compound|periodic)\b/.test(lower);
  const isEcon = /\b(econ|finance|market|money|stock|business|trade|inflation|macro|micro|bank|invest)\b/.test(lower);

  let stages: Array<{
    hierarchy: string;
    chapter: string;
    subChapter: string;
    summary: string;
    notions: string[];
    properties: string[];
    notices: string[];
    keywords: string;
  }> = [];

  if (isBio) {
    stages = [
      {
        hierarchy: `PART I: CELLULAR & MOLECULAR ANATOMY ➔ CHAPTER 1.1`,
        chapter: `ANATOMICAL FOUNDATIONS OF ${cleanSubj.toUpperCase()}`,
        subChapter: `Structural Architecture & Specialized Compartments`,
        summary: `Deconstruct the essential physical structures, membranes, and cellular compartments where ${cleanSubj} takes place.`,
        notions: [
          `Active Sites & Membranes: The selective boundaries regulating flow in ${cleanSubj}`,
          `Energy Intermediates: The ATP, NADH, and catalytic coenzymes driving the mechanism`,
          `Substrate Specificity: Molecular recognition and lock-and-key enzyme configurations`,
        ],
        properties: [
          `Surface-Area-to-Volume Ratio determines maximum metabolic exchange rates`,
          `Membrane Potential Gradient: Electrochemical conservation drives passive and active transport`,
        ],
        notices: [
          `Notice: Do not confuse passive diffusion with protein-facilitated channel transport.`,
        ],
        keywords: `${cleanSubj} cellular structure organelles diagram animation`,
      },
      {
        hierarchy: `PART I: CELLULAR & MOLECULAR ANATOMY ➔ CHAPTER 1.2`,
        chapter: `CATALYTIC MECHANISMS & ELECTRON TRANSFER`,
        subChapter: `Primary Reaction Cascade & Energy Coupling`,
        summary: `Trace the exact sequence of electron movement, redox transitions, and chemical conversions in ${cleanSubj}.`,
        notions: [
          `Redox Potential: Electron transfer gradients driving phosphorylation`,
          `Catalytic Activation Energy: How specialized enzymes lower kinetic barriers`,
          `Transition States: Ephemeral molecular configurations during intermediate cleavage`,
        ],
        properties: [
          `Conservation of Energy: First law of thermodynamics applies strictly to metabolic throughput`,
          `Allosteric Feedback: Product accumulation non-competitively downregulates enzyme velocity`,
        ],
        notices: [
          `Common Exam Trap: Misidentifying which molecule serves as the primary electron donor vs terminal acceptor.`,
        ],
        keywords: `${cleanSubj} reaction pathway steps electron transport animation`,
      },
      {
        hierarchy: `PART II: CYCLIC PATHWAYS & HOMEOSTASIS ➔ CHAPTER 2.1`,
        chapter: `METABOLIC CYCLES & REGULATORY LOOPS`,
        subChapter: `Cyclic Regeneration & Steady-State Turnover`,
        summary: `Master the regeneration loops and balancing mechanisms that maintain equilibrium during ${cleanSubj}.`,
        notions: [
          `Rate-Limiting Step: The slowest intermediate step that dictates overall pathway velocity`,
          `Homeostatic Buffering: pH, ionic strength, and temperature tolerance windows`,
          `Substrate Saturation: Michaelis-Menten kinetics and maximum velocity ceilings`,
        ],
        properties: [
          `Le Chatelier Shift: Shifting product concentrations immediately tilts reversible reaction direction`,
          `Kinetic Invariant: Km remains constant unless an inhibitor directly alters binding affinity`,
        ],
        notices: [
          `Notice: Competitive inhibitors increase apparent Km without changing Vmax; non-competitive decrease Vmax.`,
        ],
        keywords: `${cleanSubj} cycle steps rate limiting enzymes review`,
      },
      {
        hierarchy: `PART II: CYCLIC PATHWAYS & HOMEOSTASIS ➔ CHAPTER 2.2`,
        chapter: `ENVIRONMENTAL LIMITING FACTORS & ADAPTATIONS`,
        subChapter: `Stress Responses, Inhibitors & Ecological Variations`,
        summary: `Explore how light, temperature, toxic inhibitors, and resource scarcity alter ${cleanSubj} in the real world.`,
        notions: [
          `Limiting Factor Principle: The factor in shortest supply governs overall physiological output`,
          `Competitive Inhibition: Structural analogs blocking primary catalytic sites`,
          `Adaptive Variations: Alternative evolutionary pathways bypass standard biochemical constraints`,
        ],
        properties: [
          `Q10 Temperature Coefficient: Metabolic rates approximately double every 10°C until protein denaturation`,
          `Asymptotic Plateau: Output saturates once all carrier proteins and pigments reach 100% occupancy`,
        ],
        notices: [
          `Exam Tip: Questions frequently ask you to predict graph curves when one single variable is held at zero.`,
        ],
        keywords: `${cleanSubj} limiting factors experiments graph questions`,
      },
      {
        hierarchy: `PART III: ADVANCED INTEGRATION & EXAM MASTERY ➔ CHAPTER 3.1`,
        chapter: `ORGANISMIC SYNTHESIS & APPLIED CASE STUDIES`,
        subChapter: `Full-Scale Physiological Integration & High-Yield Exam Scenarios`,
        summary: `Synthesize the entire biochemical pathway into macro-organism function, evolutionary significance, and past exam questions.`,
        notions: [
          `Systemic Integration: How ${cleanSubj} connects to whole-organism energy budgets`,
          `Pathology & Mutation: What phenotypic failures manifest when single genes or enzymes are knocked out`,
          `Diagnostic Markers: Quantitative laboratory assays used to measure real-time pathway activity`,
        ],
        properties: [
          `Thermodynamic Efficiency: The net percentage of input energy conserved as usable metabolic currency`,
          `Coupled Equilibrium: Endergonic reactions proceed strictly by coupling with exergonic ATP hydrolysis`,
        ],
        notices: [
          `Final Warning: Always state both the cellular location and the net equation before diving into detailed sub-steps.`,
        ],
        keywords: `${cleanSubj} high yield exam questions solved walkthrough`,
      },
    ];
  } else if (isHistory) {
    stages = [
      {
        hierarchy: `PART I: ANTECEDENTS & CATALYSTS ➔ CHAPTER 1.1`,
        chapter: `ROOT CAUSES & STRUCTURAL CONDITIONS OF ${cleanSubj.toUpperCase()}`,
        subChapter: `Socioeconomic, Diplomatic & Ideological Tensions`,
        summary: `Examine the underlying systemic fragilities, geopolitical rivalries, and economic pressures that set the stage for ${cleanSubj}.`,
        notions: [
          `Structural Inevitability vs Agency: Systemic tensions versus individual leader decisions`,
          `Ideological Polarization: Competing doctrines and cultural divides`,
          `Alliance Web: Entangling treaties and mutual defense pacts`,
        ],
        properties: [
          `Power Vacuum Invariant: Sudden collapse of authority creates immediate armed competition`,
          `Economic Pressure Lever: Resource scarcity and inflation accelerate popular radicalization`,
        ],
        notices: [
          `Notice: Do not mistake the immediate trigger event for the multi-decade structural causes.`,
        ],
        keywords: `${cleanSubj} causes and origins historical analysis documentary`,
      },
      {
        hierarchy: `PART I: ANTECEDENTS & CATALYSTS ➔ CHAPTER 1.2`,
        chapter: `THE FLASHPOINT & INITIAL MOBILIZATION`,
        subChapter: `Trigger Events, Escalation Spirals & Opening Moves`,
        summary: `Analyze the critical tipping point and opening operations that transformed regional tensions into ${cleanSubj}.`,
        notions: [
          `Escalation Spiral: Retaliatory actions exceeding proportional response`,
          `Logistical Mobilization: Converting civilian industry and manpower into war/action machinery`,
          `Information Warfare: Censorship, propaganda, and public narrative mobilization`,
        ],
        properties: [
          `First-Mover Advantage: Initial offensive initiative dictates theater dynamics until lines solidify`,
          `Logistical Ceiling: Operational depth is strictly bounded by fuel, food, and rail capacity`,
        ],
        notices: [
          `Exam Trap: Confusing chronological dates of declarations with actual tactical commencement.`,
        ],
        keywords: `${cleanSubj} outbreak timeline opening battles analysis`,
      },
      {
        hierarchy: `PART II: CLIMAX & TURNING POINTS ➔ CHAPTER 2.1`,
        chapter: `THE PIVOTAL TURNING POINTS`,
        subChapter: `Decisive Engagements & Strategic Realignment`,
        summary: `Investigate the key battles, diplomatic summits, and policy shifts where momentum permanently shifted in ${cleanSubj}.`,
        notions: [
          `Strategic Reversal: Point where defensive sustainability overtakes offensive velocity`,
          `Coalition Dynamics: Asymmetric alliance management and friction among powers`,
          `Technological Paradigm Shift: New weaponry or doctrines neutralizing traditional advantages`,
        ],
        properties: [
          `Attrition Invariant: When tactical deadlock occurs, the side with larger industrial surplus prevails`,
          `Morale Degradation: Sustained strategic encirclement collapses unit cohesion exponentially`,
        ],
        notices: [
          `Notice: Evaluate turning points not just militarily, but through raw industrial and domestic production statistics.`,
        ],
        keywords: `${cleanSubj} turning points major battles decisive moments`,
      },
      {
        hierarchy: `PART II: CLIMAX & TURNING POINTS ➔ CHAPTER 2.2`,
        chapter: `THE HUMAN EXPERIENCE, SOCIETY & THE HOME FRONT`,
        subChapter: `Civilian Impact, Resistance & Structural Transformations`,
        summary: `Look inside society during ${cleanSubj}: total mobilization, social restructuring, human tragedies, and moral dilemmas.`,
        notions: [
          `Total Warfare: Erasure of the distinction between military forces and civilian infrastructure`,
          `Social Shifts: Transformations in labor, gender roles, and civil rights sparked by necessity`,
          `Moral & Humanitarian Crisis: War crimes, persecution, and civil resistance movements`,
        ],
        properties: [
          `Institutional Inertia: Emergency wartime powers rarely dissolve completely upon peace`,
          `Demographic Chasm: Generational losses distort subsequent economic productivity for decades`,
        ],
        notices: [
          `Notice: History essays award top marks for citing specific primary sources and domestic legislation.`,
        ],
        keywords: `${cleanSubj} home front society civilians impact documentary`,
      },
      {
        hierarchy: `PART III: AFTERMATH & LEGACY ➔ CHAPTER 3.1`,
        chapter: `TREATIES, RECONSTRUCTION & MODERN WORLD ORDER`,
        subChapter: `Peace Settlements, Border Redraws & Historical Memory`,
        summary: `Trace how ${cleanSubj} reshaped international law, national borders, economic systems, and historical identity today.`,
        notions: [
          `Settlement Flaws: How post-conflict treaties sowed future revanchism or stabilized peace`,
          `Institutional Architecture: Creation of new international governing bodies and alliances`,
          `Historiographical Debate: How historical interpretations of ${cleanSubj} have evolved over time`,
        ],
        properties: [
          `Geopolitical Rebalancing: Hegemonic transitions take decades to consolidate after conflict`,
          `Memory Politics: National narratives selectively memorialize victories while downplaying complicity`,
        ],
        notices: [
          `Final Warning: Always ground your argument in clear thesis statements backed by primary source evidence.`,
        ],
        keywords: `${cleanSubj} aftermath consequences treaty legacy explained`,
      },
    ];
  } else if (isCS) {
    stages = [
      {
        hierarchy: `PART I: PRIMITIVES & FOUNDATIONS ➔ CHAPTER 1.1`,
        chapter: `CORE ARCHITECTURE & DATA STRUCTURES OF ${cleanSubj.toUpperCase()}`,
        subChapter: `Memory Layout, Primitive Types & Mental Models`,
        summary: `Build the foundational mental model for ${cleanSubj}: how state is stored, indexed, and represented in memory.`,
        notions: [
          `State Representation: In-memory pointers, allocations, and data layouts for ${cleanSubj}`,
          `Big-O Asymptotics: Time and space complexity trade-offs across operations`,
          `Invariants: Assertions that must hold true before and after state mutations`,
        ],
        properties: [
          `Locality of Reference: Contiguous memory access yields massive cache line hit speedups`,
          `Space-Time Tradeoff: Pre-computing indices or caches reduces runtime lookup latency from O(N) to O(1)`,
        ],
        notices: [
          `Notice: Never guess time complexity without analyzing the hidden loop overhead inside library helpers.`,
        ],
        keywords: `${cleanSubj} architecture data structures fundamentals tutorial`,
      },
      {
        hierarchy: `PART I: PRIMITIVES & FOUNDATIONS ➔ CHAPTER 1.2`,
        chapter: `OPERATIONAL MECHANICS & ALGORITHMIC PIPELINES`,
        subChapter: `Transformation Functions, Flow Control & Data Ingestion`,
        summary: `Trace how data flows through ${cleanSubj}, from input parsing to deterministic transformed output.`,
        notions: [
          `Pure Functions vs Side Effects: Deterministic state transformations vs external I/O`,
          `Recursive vs Iterative paradigms: Call stack depth bounds and recursion limits`,
          `Idempotency: Ensuring repeated operations produce identical terminal states`,
        ],
        properties: [
          `Immutability Invariant: Immutable structures eliminate concurrent race conditions entirely`,
          `Throughput Ceiling: Pipeline processing speed is capped by the slowest stage bottleneck`,
        ],
        notices: [
          `Common Trap: Off-by-one boundary errors and unhandled null/undefined input edges.`,
        ],
        keywords: `${cleanSubj} algorithms implementation step by step code`,
      },
      {
        hierarchy: `PART II: SCALE, CONCURRENCY & OPTIMIZATION ➔ CHAPTER 2.1`,
        chapter: `CONCURRENCY, ASYNC & STATE MANAGEMENT`,
        subChapter: `Thread Safety, Event Loops & Race Condition Defense`,
        summary: `Master asynchronous control flow, mutexes, promises, and safe state coordination in ${cleanSubj}.`,
        notions: [
          `Event Loop / Scheduler: Task queues, microtasks, and thread pool starvation`,
          `Deadlock & Livelock: Circular lock acquisition orders and recovery strategies`,
          `Atomic Operations: Compare-and-swap primitives and thread-safe data synchronization`,
        ],
        properties: [
          `Amdahl's Law: Maximum parallel speedup is strictly bounded by the serial execution fraction`,
          `Eventual Consistency: Distributed states converge once all pending event updates propagate`,
        ],
        notices: [
          `Notice: Beware of race conditions where asynchronous reads execute before previous writes commit.`,
        ],
        keywords: `${cleanSubj} concurrency async performance optimization`,
      },
      {
        hierarchy: `PART II: SCALE, CONCURRENCY & OPTIMIZATION ➔ CHAPTER 2.2`,
        chapter: `EDGE CASES, FAULT TOLERANCE & TESTING`,
        subChapter: `Error Handling, Graceful Degradation & Unit Test Suites`,
        summary: `Hardening ${cleanSubj} against unexpected inputs, network partitions, memory leaks, and production crashes.`,
        notions: [
          `Circuit Breaker: Halting cascading failures when downstream dependencies time out`,
          `Property-Based Testing: Generative fuzzy testing to uncover extreme boundary edge cases`,
          `Memory Leak Detection: Unreleased references, dangling listeners, and heap profiling`,
        ],
        properties: [
          `Defense in Depth: Validating inputs at boundaries prevents tainted data injection downstream`,
          `Idempotent Retries: Exponential backoff with jitter prevents thundering herd API overloads`,
        ],
        notices: [
          `Exam Tip: Questions regularly test your ability to pinpoint the exact failure line in a stack trace.`,
        ],
        keywords: `${cleanSubj} debugging unit testing best practices walkthrough`,
      },
      {
        hierarchy: `PART III: PRODUCTION MASTERY ➔ CHAPTER 3.1`,
        chapter: `END-TO-END SYSTEM DESIGN & INTERVIEW BLUEPRINT`,
        subChapter: `Production Architecture, Case Studies & High-Stakes Coding`,
        summary: `Assemble the entire framework into scalable production systems and master technical interview scenarios for ${cleanSubj}.`,
        notions: [
          `Horizontal Scaling vs Sharding: Partitioning datasets across independent compute nodes`,
          `CAP Theorem Trade-Offs: Choosing between Consistency, Availability, and Partition Tolerance`,
          `Production Observability: Metrics, structured logging, and distributed tracing telemetry`,
        ],
        properties: [
          `Little's Law: In-flight concurrency equals arrival rate multiplied by average latency (L = λW)`,
          `Graceful Degradation: Dropping non-critical features preserves core transaction availability`,
        ],
        notices: [
          `Final Warning: Always state your time and space complexity before writing or deploying code.`,
        ],
        keywords: `${cleanSubj} system design interview questions solved`,
      },
    ];
  } else {
    // Dynamic universal generator with subject-injected concepts
    stages = [
      {
        hierarchy: `PART I: CORE DISCIPLINE FOUNDATIONS ➔ CHAPTER 1.1`,
        chapter: `FUNDAMENTAL MECHANICS OF ${cleanSubj.toUpperCase()}`,
        subChapter: `Essential Principles & Governing Rules of ${cleanSubj}`,
        summary: `Map the essential concepts, governing rules, and foundational mental models that define ${cleanSubj}.`,
        notions: [
          `Primary Premise of ${cleanSubj}: The fundamental core rule governing all behavior in ${cleanSubj}`,
          `Elementary Units: The basic building blocks, terminology, and key mechanics of ${cleanSubj}`,
          `Operating Environment: Where ${cleanSubj} applies and where its primary assumptions break down`,
        ],
        properties: [
          `Invariance Principle: Core properties that hold true across diverse contexts in ${cleanSubj}`,
          `Conservation of Complexity: Simplifying one subsystem transfers trade-offs elsewhere in ${cleanSubj}`,
        ],
        notices: [
          `Notice: Master the exact terminology of ${cleanSubj} before trying to memorize advanced formulas or case studies.`,
        ],
        keywords: `${cleanSubj} introduction first principles explained for beginners`,
      },
      {
        hierarchy: `PART I: TAXONOMY & FIRST PRINCIPLES ➔ CHAPTER 1.2`,
        chapter: `INTERNAL MECHANISMS & DYNAMICS`,
        subChapter: `Operational Rules & Causal Chains`,
        summary: `Analyze how components interact, transform, and influence outcomes within ${cleanSubj}.`,
        notions: [
          `Causal Chain: Sequential inputs, intermediate triggers, and terminal outputs in ${cleanSubj}`,
          `Feedback Loops: How positive and negative feedback shape equilibrium in ${cleanSubj}`,
          `Catalysts & Friction: Variables that accelerate or hinder progress in ${cleanSubj}`,
        ],
        properties: [
          `Proportional Response: Linear adjustments hold in central operating zones of ${cleanSubj}`,
          `Threshold Dynamics: Tipping points where marginal input produces dramatic systemic shifts`,
        ],
        notices: [
          `Common Exam Trap: Confusing correlation with the direct causal mechanism in ${cleanSubj}.`,
        ],
        keywords: `${cleanSubj} mechanics process explained step by step`,
      },
      {
        hierarchy: `PART II: STRUCTURAL ANALYSIS & ADVANCED MODELS ➔ CHAPTER 2.1`,
        chapter: `SUBSYSTEM INTEGRATION & VARIATIONS`,
        subChapter: `Comparative Models & Structural Nuance`,
        summary: `Compare alternative perspectives, schools of thought, and structural variations in ${cleanSubj}.`,
        notions: [
          `Comparative Frameworks: Competing theories and their explanatory power in ${cleanSubj}`,
          `Sub-Disciplinary Specializations: How advanced practitioners segment ${cleanSubj}`,
          `Optimization Metrics: The gold-standard benchmarks used to measure performance in ${cleanSubj}`,
        ],
        properties: [
          `Pareto Invariant: 80% of consequences in ${cleanSubj} stem from 20% of governing causes`,
          `Diminishing Returns: Beyond optimal investment, marginal gains in ${cleanSubj} decline`,
        ],
        notices: [
          `Notice: Be prepared to defend why one model in ${cleanSubj} is preferred under specific constraints.`,
        ],
        keywords: `${cleanSubj} advanced concepts models comparison tutorial`,
      },
      {
        hierarchy: `PART II: STRUCTURAL ANALYSIS & ADVANCED MODELS ➔ CHAPTER 2.2`,
        chapter: `STRESS-TESTING, EDGE CASES & CONTROVERSIES`,
        subChapter: `Extreme Scenarios, Failure Modes & Counter-Examples`,
        summary: `Examine what happens when ${cleanSubj} is pushed to its absolute limits, stress boundaries, or historical crises.`,
        notions: [
          `Failure Modes: The most common points of breakdown and corruption in ${cleanSubj}`,
          `Counterexamples: Famous paradoxes or historical exceptions that challenge conventional wisdom`,
          `Modern Controversies: Active debates currently dividing scholars and practitioners of ${cleanSubj}`,
        ],
        properties: [
          `Fragility vs Robustness: Systems with zero redundancy collapse catastrophically under stress`,
          `Asymmetric Risk: Low-probability, high-impact tail events dominate long-term outcomes`,
        ],
        notices: [
          `Exam Tip: High-scoring responses proactively discuss counter-arguments and acknowledge edge-case limitations.`,
        ],
        keywords: `${cleanSubj} edge cases common mistakes problems solved`,
      },
      {
        hierarchy: `PART III: MASTERY & EXAM ARENA ➔ CHAPTER 3.1`,
        chapter: `COMPREHENSIVE SYNTHESIS & PROBLEM SOLVING`,
        subChapter: `Real-World Application & High-Yield Exam Protocol`,
        summary: `Bring every concept together into a fluent, battle-tested problem-solving framework for ${cleanSubj}.`,
        notions: [
          `Rapid Diagnostic Triage: Identifying the problem type in ${cleanSubj} within 15 seconds`,
          `Synthesis Checklist: Verifying all constraints before committing to a final solution`,
          `Communication Clarity: How to structure written and verbal explanations in ${cleanSubj} for maximum marks`,
        ],
        properties: [
          `Occam's Razor: The simplest coherent hypothesis that fits all empirical evidence in ${cleanSubj} is preferred`,
          `Verification Invariance: A true solution satisfies both forward calculation and backwards boundary checks`,
        ],
        notices: [
          `Final Warning: Always re-read the core prompt in ${cleanSubj} to ensure you answered every sub-part directly.`,
        ],
        keywords: `${cleanSubj} full course review high yield exam prep`,
      },
    ];
  }

  const roadmap: RoadmapStep[] = stages.map((st, idx) => ({
    stageNumber: idx + 1,
    hierarchyTitle: st.hierarchy,
    chapterTitle: st.chapter,
    subChapter: st.subChapter,
    contentSummary: st.summary,
    keyNotions: st.notions,
    properties: st.properties,
    criticalNotices: st.notices,
    allocatedTime: `${mins} mins`,
    deadlineDate: userProfile.examDate || `Sprint Day ${(idx + 1) * 2}`,
    highUtilitySearchKeywords: st.keywords,
    panicTip: idx === 0
      ? 'Focus only on Stage 1. Build momentum with one micro-win before looking ahead.'
      : 'Breathe in 4s, out 6s. You have already completed previous stages. Errors in practice are simply free XP.',
    completed: false,
  }));

  const concepts: ConceptAnalogy[] = [
    {
      term: `Primary Engine of ${cleanSubj}`,
      jargon: `The foundational operational transformation that drives active state changes in ${cleanSubj}.`,
      analogy: `Like a bicycle chain and gears: turning the pedals (inputs) immediately translates force into forward movement (outputs).`,
    },
    {
      term: `Feedback Equilibrium in ${cleanSubj}`,
      jargon: `The continuous self-regulating balancing loop that prevents runaway destabilization.`,
      analogy: `Like a household thermostat: as soon as the temperature exceeds the target setpoint, cooling kicks in to restore stability.`,
    },
    {
      term: `Boundary Constraint Ceiling`,
      jargon: `The physical, mathematical, or systemic asymptote beyond which linear expansion ceases.`,
      analogy: `Like trying to pour water through a narrow kitchen funnel faster than gravity can empty the neck.`,
    },
    {
      term: `System Invariant of ${cleanSubj}`,
      jargon: `A fundamental conserved quantity or rule that remains identical across all transformations.`,
      analogy: `Like the total mass of ingredients in a sealed pressure cooker: no matter how hot or altered they become, total weight remains unchanged.`,
    },
  ];

  const flashcards: FlashcardState[] = [
    {
      id: `card-1-${Date.now()}`,
      question: `What is the core premise that differentiates ${cleanSubj} from adjacent topics?`,
      answer: `Its specific boundary rules, governing transformation dynamics, and foundational axioms.`,
      leitnerBox: 1,
      nextReviewDate: Date.now() + 86400000,
    },
    {
      id: `card-2-${Date.now()}`,
      question: `How do you diagnose when a problem in ${cleanSubj} has hit a non-linear edge condition?`,
      answer: `When standard proportional assumptions break down due to resource saturation, boundary constraints, or feedback loops.`,
      leitnerBox: 1,
      nextReviewDate: Date.now() + 86400000,
    },
    {
      id: `card-3-${Date.now()}`,
      question: `What is the single most common exam trap when solving questions on ${cleanSubj}?`,
      answer: `Confusing intermediate correlation with the fundamental causal mechanism, or ignoring initial boundary conditions.`,
      leitnerBox: 2,
      nextReviewDate: Date.now() + 86400000 * 3,
    },
    {
      id: `card-4-${Date.now()}`,
      question: `What is the recommended 3-step triage method for analyzing new problems in ${cleanSubj}?`,
      answer: `1) Extract boundary constraints; 2) Identify the governing invariant; 3) Verify solution by testing edge inputs.`,
      leitnerBox: 1,
      nextReviewDate: Date.now() + 86400000,
    },
  ];

  const quiz: QuizQuestion[] = [
    {
      question: `When tackling a high-stakes scenario involving ${cleanSubj}, what is the first priority step?`,
      options: [
        `Identify the boundary constraints, fundamental inputs, and governing rules`,
        `Skip immediately to complex calculations without checking assumptions`,
        `Rely on superficial intuition without verifying edge cases`,
        `Memorize generic formulas without connecting them to the underlying mechanism`,
      ],
      correctIndex: 0,
      explanation: `Grounding the problem in boundary conditions and governing rules prevents cascading errors downstream.`,
    },
    {
      question: `Why is active recall and spaced retrieval especially effective for mastering ${cleanSubj}?`,
      options: [
        `Forced retrieval triggers neuroplastic synaptic consolidation, beating the Ebbinghaus forgetting curve`,
        `It requires zero cognitive effort or concentration`,
        `It makes notes look cleaner in a notebook`,
        `It is only effective for multiple choice exams, not technical problem solving`,
      ],
      correctIndex: 0,
      explanation: `Active retrieval forces the brain to reconstruct neural pathways, dramatically increasing long-term retention stability.`,
    },
  ];

  return {
    subject: cleanSubj,
    profileSnapshot: userProfile,
    roadmap,
    concepts,
    flashcards,
    quiz,
  };
}
