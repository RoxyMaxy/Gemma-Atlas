export type EngineChoice = 'cloud' | 'local';

export type LearningStyleChoice =
  | 'auditory'
  | 'visual'
  | 'kinesthetic'
  | 'reading_writing'
  | 'tiktok_brain'
  | 'classic';

export interface UserProfile {
  name: string;
  email: string;
  academicLevel: string;
  majors: string[];
  learningStyle: 'classic' | 'kinesthetic' | 'auditory' | 'tiktok_brain' | 'adhd' | 'visual' | 'reading_writing';
  conditions: string[];
  otherCondition?: string;
  freeTimeValue: string;
  availableDays: string[];
  dailyMinutes: number;
  preferredTimeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  examDate: string;
  examTitle?: string;
  apiKey: string;
  theme: 'light' | 'dark';
  colorPalette: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'pink' | 'yellow' | 'slate';
  enginePreference: 'cloud' | 'local';
}

export interface RoadmapStep {
  stageNumber: number;
  chapterTitle: string;
  subChapter: string;
  hierarchyTitle?: string;
  contentSummary: string;
  allocatedTime: string;
  deadlineDate: string;
  highUtilitySearchKeywords: string;
  panicTip: string;
  keyNotions?: string[];
  properties?: string[];
  criticalNotices?: string[];
  completed?: boolean;
}

export interface ConceptAnalogy {
  term: string;
  jargon: string;
  analogy: string;
}

export interface FlashcardState {
  id: string;
  question: string;
  answer: string;
  leitnerBox: number;
  nextReviewDate: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface CourseSession {
  id: string;
  subject: string;
  timestamp: number;
  profileSnapshot: UserProfile;
  roadmap: RoadmapStep[];
  concepts: ConceptAnalogy[];
  flashcards: FlashcardState[];
  quiz: QuizQuestion[];
  vector?: number[];
}

export interface DailyStudyMetric {
  date: string;
  dayLabel: string;
  studyMinutes: number;
  studyHours: number;
  masteryScore: number;
  cardsReviewed: number;
  quizzesCompleted: number;
  stepsCompleted: number;
}

export interface LocalEngineProgress {
  status: 'idle' | 'loading' | 'ready' | 'error';
  progressText: string;
  percent: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  engine: 'cloud' | 'local';
  sourceContext?: string[];
}
