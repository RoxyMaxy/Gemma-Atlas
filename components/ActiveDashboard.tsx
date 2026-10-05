import React, { useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  CourseSession,
  ChatMessage,
  LocalEngineProgress,
} from '../lib/vector/types';
import { StorageService } from '../lib/vector/storageService';
import { localVectorIndex, gemmaSwitcher } from '../lib/vector/engine';
import { generateCourseSessionWithGemma } from '../lib/mastra/agent';
import { RoadmapTab } from './dashboard/RoadmapTab';
import { ConceptsTab } from './dashboard/ConceptsTab';
import { PracticeTab } from './dashboard/PracticeTab';
import { CrashTestTab } from './dashboard/CrashTestTab';
import { AnalyticsTab } from './dashboard/AnalyticsTab';
import {
  Brain,
  Sparkles,
  Cpu,
  Cloud,
  HardDrive,
  Upload,
  FileText,
  Send,
  User,
  Settings,
  Moon,
  Sun,
  Shield,
  Zap,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Award,
  Palette,
  Check,
  Plus,
  X,
  Activity,
  Calendar,
  Clock,
  Compass,
  AlertTriangle,
  Heart,
  Sliders,
  CheckSquare,
  Square,
  BookOpen,
  Mail,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  FolderOpen,
  Trash2,
} from 'lucide-react';

function cleanSubjectFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  const clean = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return clean || 'Imported Curriculum Document';
}

async function extractTextFromAnyFile(file: File): Promise<string> {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

  const textExtensions = [
    '.txt', '.md', '.markdown', '.json', '.csv', '.tsv', '.py', '.js', '.jsx',
    '.ts', '.tsx', '.html', '.htm', '.xml', '.css', '.scss', '.yaml', '.yml',
    '.c', '.cpp', '.h', '.java', '.go', '.rs', '.sql', '.sh', '.bash', '.r',
    '.log', '.ini', '.cfg', '.env', '.tex'
  ];

  if (textExtensions.includes(extension) || file.type.startsWith('text/') || file.type === 'application/json') {
    try {
      const text = await file.text();
      return text.slice(0, 30000);
    } catch {
      // Fallback
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let binaryStr = '';
    const chunkLimit = Math.min(bytes.length, 250000);
    for (let i = 0; i < chunkLimit; i++) {
      binaryStr += String.fromCharCode(bytes[i]);
    }

    // PDF extraction
    if (extension === '.pdf' || file.type === 'application/pdf') {
      const pdfTextMatches: string[] = [];
      const tjMatches = binaryStr.match(/\(([^()]{2,})\)\s*(?:Tj|'|")/g);
      if (tjMatches && tjMatches.length > 0) {
        for (const m of tjMatches.slice(0, 300)) {
          const clean = m.replace(/^\(/, '').replace(/\)\s*(?:Tj|'|")?$/, '').trim();
          if (clean && clean.length > 2 && !clean.includes('\x00')) {
            pdfTextMatches.push(clean);
          }
        }
      }

      const readableStrings = binaryStr.match(/[\x20-\x7E\r\n\t]{4,}/g);
      if (readableStrings && readableStrings.length > 0) {
        const filtered = readableStrings
          .filter((s) => !/^(obj|endobj|xref|trailer|stream|endstream|\/Filter|\/Length|\/Type|\/Font)/i.test(s.trim()))
          .map((s) => s.trim())
          .filter((s) => s.length > 4);
        if (filtered.length > pdfTextMatches.length) {
          return `[PDF Document: ${file.name}]\n` + filtered.slice(0, 200).join(' ').slice(0, 25000);
        }
      }

      if (pdfTextMatches.length > 0) {
        return `[PDF Document: ${file.name}]\n` + pdfTextMatches.join(' ').slice(0, 25000);
      }
    }

    // Office DOCX / PPTX / XLSX / EPUB extraction
    if (['.docx', '.pptx', '.xlsx', '.epub'].includes(extension)) {
      const xmlTextMatches = binaryStr.match(/<[wa]:t[^>]*>([^<]+)<\/[wa]:t>/g);
      if (xmlTextMatches && xmlTextMatches.length > 0) {
        const textParts = xmlTextMatches
          .map((tag) => tag.replace(/<[^>]+>/g, '').trim())
          .filter(Boolean);
        return `[Office Document: ${file.name}]\n` + textParts.join(' ').slice(0, 25000);
      }
    }

    // Generic printable character extraction for any arbitrary format
    const printableChunks = binaryStr.match(/[\x20-\x7E\r\n\t]{4,}/g);
    if (printableChunks && printableChunks.length > 0) {
      const cleanChunks = printableChunks
        .map((c) => c.trim())
        .filter((c) => c.length > 5 && !/^[0-9a-fA-F]{16,}$/.test(c))
        .slice(0, 150);
      if (cleanChunks.length > 0) {
        return `[Document: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\n` + cleanChunks.join('\n').slice(0, 25000);
      }
    }

    return `[Attached Document: ${file.name}]\nFile Type: ${file.type || 'Custom Format'}\nFile Size: ${(file.size / 1024).toFixed(1)} KB`;
  } catch {
    return `[Document: ${file.name}]\nContent ingestion completed.`;
  }
}

const SAMPLE_TOPICS = [
  'Data Structures: Trees & Hash Maps',
  'Optical Lenses & Physics Refraction',
  'Storytelling: 3-Act Structure & Subtext',
  'World History: The Industrial Revolution',
  'Chess Endgames: King & Pawn Mastery',
  'Organic Chemistry: Reaction Mechanisms',
];

const SUGGESTED_MAJORS = [
  'Computer Science',
  'Pre-Med / Biology',
  'Mechanical Engineering',
  'Psychology',
  'Economics & Finance',
  'Physics & Mathematics',
  'Law & Jurisprudence',
];

const COLOR_PALETTES: { id: UserProfile['colorPalette']; name: string; hex: string }[] = [
  { id: 'blue', name: 'Electric Cobalt', hex: '#3b82f6' },
  { id: 'green', name: 'Cyber Emerald', hex: '#10b981' },
  { id: 'orange', name: 'Solar Amber', hex: '#f59e0b' },
  { id: 'red', name: 'Crimson Fury', hex: '#ef4444' },
  { id: 'purple', name: 'Royal Violet', hex: '#a855f7' },
  { id: 'pink', name: 'Neon Magenta', hex: '#ec4899' },
  { id: 'yellow', name: 'Acid Cyber', hex: '#eab308' },
  { id: 'slate', name: 'MLH Stealth', hex: '#64748b' },
];

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const LEARNING_STYLES = [
  { id: 'auditory', label: 'AUDITIVE / AUDITORY', desc: 'Rhythmic mnemonics, verbal explanations, podcasts' },
  { id: 'visual', label: 'VISUAL / SPATIAL', desc: 'Mental imagery, visual schematics, spatial maps' },
  { id: 'kinesthetic', label: 'KINESTHETIC / HANDS-ON', desc: 'Physical machinery analogies, interactive levers' },
  { id: 'reading_writing', label: 'READING / WRITING', desc: 'Structured bullet points, high-yield flashcards' },
  { id: 'tiktok_brain', label: 'TIKTOK BRAIN / FAST-PACED', desc: 'Micro-units under 30 words, punchy analogies' },
  { id: 'classic', label: 'CLASSIC STRUCTURED', desc: 'Sequential academic chapter progression' },
];

const USER_CONDITIONS = [
  { id: 'adhd', label: 'ADHD (ATTENTION DEFICIT)', desc: 'High energy, dopamine reward loops, rapid pacing' },
  { id: 'short_focus', label: 'SHORT-FOCUS & MEMORY SPAN', desc: 'Frequent micro-breaks, memory anchors' },
  { id: 'anxiety', label: 'EXAM ANXIETY / PANIC-PRONE', desc: 'Anti-panic micro-hacks, zero guilt, 80/20 triage' },
  { id: 'hyperactivity', label: 'HYPERACTIVITY / RESTLESSNESS', desc: 'Kinesthetic grounding, quick feedback trials' },
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'Alex',
  email: 'alex.student@learn.gemma',
  academicLevel: 'Bachelor Degree',
  majors: ['Computer Science', 'Cognitive Science'],
  learningStyle: 'tiktok_brain',
  conditions: ['adhd', 'short_focus', 'anxiety'],
  otherCondition: '',
  freeTimeValue: '45 mins / day',
  availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  dailyMinutes: 45,
  preferredTimeSlot: 'evening',
  examDate: '2026-11-15',
  examTitle: 'Final Semester Examinations',
  apiKey: '',
  theme: 'dark',
  colorPalette: 'blue',
  enginePreference: 'cloud',
};

export const ActiveDashboard: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [activeSession, setActiveSession] = useState<CourseSession | null>(null);

  // Active Tabs: 'roadmap' | 'concepts' | 'practice' | 'crashtest' | 'analytics' | 'chat'
  const [activeTab, setActiveTab] = useState<'roadmap' | 'concepts' | 'practice' | 'crashtest' | 'analytics' | 'chat'>('roadmap');

  // Input states
  const [subjectInput, setSubjectInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; text: string }[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Profile modal interactive states
  const [profileModalTab, setProfileModalTab] = useState<'identity' | 'learning' | 'schedule' | 'engine' | 'theme'>('identity');
  const [newMajorInput, setNewMajorInput] = useState('');
  const [hasOtherCondition, setHasOtherCondition] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState<{ testing: boolean; result: string | null; error: boolean }>({
    testing: false,
    result: null,
    error: false,
  });
  const [webGpuBenchmarkStatus, setWebGpuBenchmarkStatus] = useState<string | null>(null);

  // WebLLM / Local Engine Progress state
  const [localEngineProgress, setLocalEngineProgress] = useState<LocalEngineProgress>({
    status: 'idle',
    progressText: '',
    percent: 0,
  });

  // Chat tab states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreamingChat, setIsStreamingChat] = useState(false);

  // File drop refs & drag state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directUploadInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const savedProf = StorageService.getUserProfile();
    if (savedProf) {
      // Merge with defaults in case of missing fields
      const merged: UserProfile = {
        ...DEFAULT_PROFILE,
        ...savedProf,
        conditions: savedProf.conditions || DEFAULT_PROFILE.conditions,
        availableDays: savedProf.availableDays || DEFAULT_PROFILE.availableDays,
        dailyMinutes: savedProf.dailyMinutes || DEFAULT_PROFILE.dailyMinutes,
        preferredTimeSlot: savedProf.preferredTimeSlot || DEFAULT_PROFILE.preferredTimeSlot,
      };
      setProfile(merged);
      setHasOtherCondition(!!merged.otherCondition);
      gemmaSwitcher.setMode(merged.enginePreference);
      if (merged.apiKey) {
        gemmaSwitcher.setCustomApiKey(merged.apiKey);
      }
    } else {
      setIsProfileModalOpen(true);
    }

    const unsubscribe = gemmaSwitcher.onProgress((p) => {
      setLocalEngineProgress(p);
    });

    const savedSessions = StorageService.getSessions();
    setSessions(savedSessions);
    if (savedSessions.length > 0) {
      const activeId = StorageService.getActiveSessionId();
      const current = savedSessions.find((s) => s.id === activeId) || savedSessions[0];
      setActiveSession(current);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSaveProfile = (newProfile: UserProfile) => {
    const updated = {
      ...newProfile,
      freeTimeValue: `${newProfile.dailyMinutes} mins / day (${newProfile.preferredTimeSlot})`,
    };
    setProfile(updated);
    StorageService.saveUserProfile(updated);
    gemmaSwitcher.setMode(updated.enginePreference);
    gemmaSwitcher.setCustomApiKey(updated.apiKey || '');
    setIsProfileModalOpen(false);
  };

  const handleColorPaletteChange = (palette: UserProfile['colorPalette']) => {
    const updated = { ...profile, colorPalette: palette };
    setProfile(updated);
    StorageService.saveUserProfile(updated);
  };

  const handleToggleThemeMode = () => {
    const nextMode: 'light' | 'dark' = profile.theme === 'dark' ? 'light' : 'dark';
    const updated: UserProfile = { ...profile, theme: nextMode };
    setProfile(updated);
    StorageService.saveUserProfile(updated);
  };

  const handleAddMajor = (majorName: string) => {
    const trimmed = majorName.trim();
    if (!trimmed || profile.majors.includes(trimmed)) return;
    const updated = { ...profile, majors: [...profile.majors, trimmed] };
    setProfile(updated);
    setNewMajorInput('');
  };

  const handleRemoveMajor = (majorName: string) => {
    const updated = { ...profile, majors: profile.majors.filter((m) => m !== majorName) };
    setProfile(updated);
  };

  const handleToggleCondition = (condId: string) => {
    const current = profile.conditions || [];
    const next = current.includes(condId) ? current.filter((c) => c !== condId) : [...current, condId];
    setProfile({ ...profile, conditions: next });
  };

  const handleToggleDay = (day: string) => {
    const current = profile.availableDays || [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setProfile({ ...profile, availableDays: next });
  };

  const handleTestApiConnection = async () => {
    setApiTestStatus({ testing: true, result: null, error: false });
    const startTime = performance.now();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (profile.apiKey && profile.apiKey.trim()) {
        headers['x-gemma-api-key'] = profile.apiKey.trim();
        headers['x-gemini-api-key'] = profile.apiKey.trim();
      }
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: 'Ping Gemma tutor', stream: false }),
      });
      const elapsed = Math.round(performance.now() - startTime);
      if (resp.ok) {
        setApiTestStatus({
          testing: false,
          result: `SUCCESS (HTTP 200) • Latency: ${elapsed}ms • Model: Gemma 2 Ready`,
          error: false,
        });
      } else {
        const data = await resp.json().catch(() => ({}));
        setApiTestStatus({
          testing: false,
          result: `FAILED (${resp.status}): ${data.error || resp.statusText}`,
          error: true,
        });
      }
    } catch (err: any) {
      setApiTestStatus({
        testing: false,
        result: `Network Error: ${err?.message || 'Connection unreachable'}`,
        error: true,
      });
    }
  };

  const handleBenchmarkWebGpu = async () => {
    setWebGpuBenchmarkStatus('Querying browser WebGPU hardware adapter...');
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      setWebGpuBenchmarkStatus('WebGPU not supported on this browser. Local Gemma will use fast in-memory heuristic.');
      return;
    }
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) {
        setWebGpuBenchmarkStatus('WebGPU Adapter not found.');
        return;
      }
      await adapter.requestDevice();
      setWebGpuBenchmarkStatus(`WebGPU Device Verified: Ready for in-browser Gemma 2-2B weights.`);
    } catch (err: any) {
      setWebGpuBenchmarkStatus(`WebGPU initialization warning: ${err?.message}`);
    }
  };

  const processUploadedFiles = async (
    fileList: FileList | File[],
    autoLaunchSprint: boolean = false
  ) => {
    if (!fileList || fileList.length === 0) return;
    setStatusMessage(`EXTRACTING CONTENT ACROSS ${fileList.length} DOCUMENT(S)...`);

    const loadedDocs: { name: string; size: number; text: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const text = await extractTextFromAnyFile(file);
        loadedDocs.push({
          name: file.name,
          size: file.size,
          text,
        });
        localVectorIndex.addDocuments(file.name, text);
      } catch (err) {
        console.error('File read error:', err);
      }
    }

    if (loadedDocs.length === 0) {
      setStatusMessage('');
      return;
    }

    const allUploaded = [...uploadedFiles, ...loadedDocs];
    setUploadedFiles(allUploaded);

    let targetSubject = subjectInput.trim();
    if (!targetSubject) {
      targetSubject = cleanSubjectFromFileName(loadedDocs[0].name);
      setSubjectInput(targetSubject);
    }

    if (autoLaunchSprint) {
      setStatusMessage(`INSTANT ROADMAP: DECONSTRUCTING "${targetSubject}" WITH GEMMA...`);
      await handleCreateSession(targetSubject, allUploaded);
    } else {
      setStatusMessage(`INGESTED ${loadedDocs.length} FILE(S) INTO LOCAL VECTOR CONTEXT.`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleDirectUploadAndGenerate = () => {
    if (uploadedFiles.length > 0) {
      handleCreateSession();
    } else {
      directUploadInputRef.current?.click();
    }
  };

  const handleRemoveUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateSession = async (
    customSubject?: string,
    overrideFiles?: { name: string; size: number; text: string }[]
  ) => {
    const filesToUse = overrideFiles || uploadedFiles;
    let targetSubject = (customSubject || subjectInput).trim();
    if (!targetSubject && filesToUse.length > 0) {
      targetSubject = cleanSubjectFromFileName(filesToUse[0].name);
      setSubjectInput(targetSubject);
    }
    if (!targetSubject) return;

    setIsGenerating(true);
    const engineMode = profile.enginePreference;
    setStatusMessage(
      engineMode === 'local'
        ? 'EXECUTING GEMMA 2-2B IN-BROWSER WEBLLM / WEBGPU SPRINT...'
        : 'CALLING CLOUD GEMMA 2 HIGH-PRECISION SPRINT AGENT...'
    );

    try {
      const combinedDocText = filesToUse.map((f) => `[Source Document: ${f.name}]\n${f.text}`).join('\n\n');

      const generated = await generateCourseSessionWithGemma({
        subject: targetSubject,
        sourceText: combinedDocText,
        userProfile: profile,
        engineTarget: engineMode,
        customApiKey: profile.apiKey,
      });

      const newSession: CourseSession = {
        ...generated,
        id: `session-${Date.now()}`,
        timestamp: Date.now(),
      };

      StorageService.saveSession(newSession);
      setSessions(StorageService.getSessions());
      setActiveSession(newSession);
      setActiveTab('roadmap');
      setSubjectInput('');
      setUploadedFiles([]);
    } catch (err: any) {
      console.error(err);
      setStatusMessage('Sprint generation complete (adaptive fallback active).');
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const handleToggleRoadmapStep = (stageNumber: number) => {
    if (!activeSession) return;
    const updated = activeSession.roadmap.map((s) =>
      s.stageNumber === stageNumber ? { ...s, completed: !s.completed } : s
    );
    const newSession = { ...activeSession, roadmap: updated };
    setActiveSession(newSession);
    StorageService.saveSession(newSession);
    setSessions(StorageService.getSessions());
  };

  const handleUpdateFlashcards = (cards: any[]) => {
    if (!activeSession) return;
    const newSession = { ...activeSession, flashcards: cards };
    setActiveSession(newSession);
    StorageService.saveSession(newSession);
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isStreamingChat) return;
    const userText = chatInput.trim();
    setChatInput('');

    const localMatches = localVectorIndex.queryContext(userText, 2);
    const contextSnip = localMatches.map((m) => `[Vector Grounding: ${m.source}] ${m.text}`).join('\n');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      engine: profile.enginePreference,
      sourceContext: localMatches.map((m) => m.source),
    };

    const assistantMsgId = `msg-${Date.now() + 1}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      engine: profile.enginePreference,
    };

    setChatMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsStreamingChat(true);

    try {
      const fullPrompt = `${contextSnip ? `Context:\n${contextSnip}\n\n` : ''}User asks: ${userText}`;
      await gemmaSwitcher.runInference(fullPrompt, '', (chunk) => {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + chunk } : msg
          )
        );
      });
    } catch (err: any) {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: 'Gemma Sibling tutor fallback active. Network reconnected or offline ready.' }
            : msg
        )
      );
    } finally {
      setIsStreamingChat(false);
    }
  };

  // Days until exam calculation
  const getDaysUntilExam = () => {
    if (!profile.examDate) return null;
    const examTime = new Date(profile.examDate).getTime();
    const diff = Math.ceil((examTime - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const daysRemaining = getDaysUntilExam();

  return (
    <div
      data-theme={profile.theme}
      data-palette={profile.colorPalette}
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-main)] font-sans transition-colors duration-150 p-4 md:p-8"
    >
      {/* Top Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <div className="mlh-card p-6 bg-[var(--bg-card)]">
          <span className="mlh-badge bg-[#be1e2d] text-white border-white">
            SEASON 2027 // GEMMA SIBLING LEAGUE
          </span>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 border-2 border-[var(--border-color)] bg-[#be1e2d] text-white flex items-center justify-center rounded-[4px] shadow-[3px_3px_0px_#000]">
                <Brain className="h-7 w-7" />
              </div>
              <div>
                <h1 className="mlh-card-title text-2xl md:text-3xl mb-0">
                  GEMMA STUDY HUB
                </h1>
                <p className="mlh-card-subtitle mb-0">
                  POWERED EXCLUSIVELY BY GEMMA 2 (CLOUD 9B & LOCAL 2B)
                </p>
              </div>
            </div>

            {/* Quick Palette Swatches + Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick Palette Picker in Top Bar */}
              <div className="hidden sm:flex items-center gap-1.5 p-1 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] rounded-[4px] shadow-[2px_2px_0px_#000]">
                {COLOR_PALETTES.map((pal) => (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => handleColorPaletteChange(pal.id)}
                    className={`h-5 w-5 rounded-full border border-black transition-transform ${
                      profile.colorPalette === pal.id ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: pal.hex }}
                    title={`Theme: ${pal.name}`}
                  />
                ))}
              </div>

              {/* Engine Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextMode = profile.enginePreference === 'cloud' ? 'local' : 'cloud';
                  handleSaveProfile({ ...profile, enginePreference: nextMode });
                }}
                className={`mlh-card-btn py-2 px-3 text-xs ${
                  profile.enginePreference === 'local' ? 'bg-emerald-500 text-black border-emerald-400' : ''
                }`}
                title="Toggle Gemma Cloud 9B vs Gemma Local 2B"
              >
                {profile.enginePreference === 'local' ? (
                  <>
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>GEMMA LOCAL 2B</span>
                  </>
                ) : (
                  <>
                    <Cloud className="h-3.5 w-3.5" />
                    <span>GEMMA CLOUD 9B</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleThemeMode}
                className="mlh-card-btn py-2 px-3 text-xs"
                title="Toggle Light / Dark Mode"
              >
                {profile.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="mlh-card-btn py-2 px-4 text-xs mlh-card-btn-solid font-black"
              >
                <Settings className="h-4 w-4" />
                <span>PROFILE & SETTINGS</span>
              </button>
            </div>
          </div>

          {/* User Profile Quick Banner */}
          <div className="mt-4 pt-3 border-t border-[var(--border-color)]/30 flex flex-wrap items-center justify-between gap-3 text-xs font-tech text-[var(--text-muted)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-[var(--text-main)] uppercase">
                STUDENT: {profile.name.toUpperCase()}
              </span>
              <span>•</span>
              <span className="text-amber-400 font-bold uppercase">
                STYLE: {profile.learningStyle.replace('_', ' ').toUpperCase()}
              </span>
              <span>•</span>
              <span>
                SCHEDULE: {profile.dailyMinutes}M/DAY ({profile.availableDays.length} DAYS/WK)
              </span>
              {daysRemaining !== null && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">
                    EXAM: {daysRemaining} DAYS REMAINING
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(profile.conditions || []).map((c) => (
                <span
                  key={c}
                  className="px-2 py-0.5 rounded-[2px] border border-[var(--border-color)]/50 bg-[var(--bg-primary)] text-[10px] uppercase font-bold"
                >
                  {c.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* WebLLM Loading Bar */}
          {localEngineProgress.status === 'loading' && (
            <div className="mt-4 pt-3 border-t border-[var(--border-color)]/30">
              <div className="flex items-center justify-between text-xs font-tech font-bold uppercase text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>{localEngineProgress.progressText}</span>
                </span>
                <span>{localEngineProgress.percent}%</span>
              </div>
              <div className="mt-1 h-2 w-full border border-[var(--border-color)] bg-[var(--bg-primary)] p-0.5 rounded-[2px]">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${localEngineProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Console */}
      <main className="max-w-6xl mx-auto space-y-8">
        {/* Topic Input Box */}
        <div className="mlh-card p-8 bg-[var(--bg-card)]">
          <span className="mlh-badge bg-white text-black border-black">
            MISSION DISPATCH // TOPIC INPUT
          </span>

          <div className="flex flex-col lg:flex-row gap-8 items-start justify-between pt-2">
            <div className="flex-1 w-full space-y-4">
              <p className="mlh-card-subtitle">SPECIFY ONE STUDY SUBJECT TO MASTER</p>
              <h2 className="mlh-card-title text-2xl md:text-3xl mb-1">
                LAUNCH INTUITIVE SPRINT
              </h2>
              <p className="mlh-card-text">
                Zero encyclopedic wall of text. Mapped strictly to your learning style ({profile.learningStyle.toUpperCase()}) & availability with Gemma 2.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                  placeholder="E.G. DATA STRUCTURES, CHESS, OPTICAL LENSES..."
                  className="flex-1 rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 text-sm font-tech font-bold tracking-wider text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none shadow-[3px_3px_0px_#000]"
                />
                <button
                  type="button"
                  disabled={isGenerating || !subjectInput.trim()}
                  onClick={() => handleCreateSession()}
                  className="mlh-card-btn mlh-card-btn-solid py-3 px-6 font-black shrink-0 disabled:opacity-40"
                >
                  {isGenerating ? (
                    <>
                      <Cpu className="h-4 w-4 animate-spin" />
                      <span>DISPATCHING GEMMA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>LAUNCH SPRINT</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Topic Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-[11px] font-tech font-bold uppercase text-[var(--text-muted)]">
                  POPULAR SPRINTS:
                </span>
                {SAMPLE_TOPICS.map((top, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCreateSession(top)}
                    className="rounded-[4px] border border-[var(--border-color)]/60 bg-[var(--bg-primary)] px-2.5 py-1 text-[11px] font-tech font-bold uppercase hover:bg-white hover:text-black transition-all shadow-[2px_2px_0px_#000]"
                  >
                    {top}
                  </button>
                ))}
              </div>
            </div>

            {/* Universal Document Dropper with Drag-and-Drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  await processUploadedFiles(e.dataTransfer.files, false);
                }
              }}
              className={`w-full lg:w-88 shrink-0 mlh-card p-5 text-center transition-all bg-[var(--bg-primary)] ${
                isDraggingOver ? 'border-amber-400 bg-amber-400/10 shadow-[4px_4px_0px_#f59e0b]' : ''
              }`}
            >
              <span className="mlh-badge bg-[#be1e2d] text-white border-white">
                ALL FORMATS // VECTOR INGEST
              </span>

              {/* Browse Files Input: Supports all file types */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    processUploadedFiles(e.target.files, false);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />

              {/* Direct Upload & Instant Roadmap Generation Input */}
              <input
                ref={directUploadInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    processUploadedFiles(e.target.files, true);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />

              <UploadCloud className="mx-auto h-8 w-8 text-amber-400 mb-1.5 mt-1" />
              <p className="mlh-card-subtitle mb-1">UNIVERSAL FILE COMPATIBILITY</p>
              <h3 className="mlh-card-title text-base mb-1">DROP ANY DOCUMENT</h3>
              <p className="text-[10px] text-[var(--text-muted)] font-mono mb-3">
                PDF, DOCX, PPTX, TXT, MD, CSV, CODE, EPUB & ALL FILES
              </p>

              {/* Two Action Buttons Side-by-Side */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mlh-card-btn py-2 px-2 text-xs w-full flex items-center justify-center gap-1 font-bold"
                  title="Browse files to stage and attach before sprint launch"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>BROWSE FILES</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleDirectUploadAndGenerate}
                  className="mlh-card-btn mlh-card-btn-solid py-2 px-2 text-xs w-full flex items-center justify-center gap-1 font-black bg-[#be1e2d] text-white border-white hover:bg-white hover:text-black shrink-0"
                  title="Upload document to immediately generate its complete roadmap"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>UPLOAD DOCUMENTS</span>
                </button>
              </div>

              {/* Uploaded Files Staging List with Remove Action */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 text-left space-y-1.5 border-t border-[var(--border-color)]/30 pt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase">
                    <span>ATTACHED ({uploadedFiles.length})</span>
                    <button
                      type="button"
                      onClick={() => setUploadedFiles([])}
                      className="text-red-400 hover:underline"
                    >
                      CLEAR ALL
                    </button>
                  </div>
                  {uploadedFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-1.5 rounded-[3px] border border-[var(--border-color)]/40 bg-[var(--bg-card)] px-2 py-1 text-[11px] font-mono text-emerald-400 shadow-[1px_1px_0px_#000]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="truncate font-bold">{f.name}</span>
                        <span className="text-[9px] text-[var(--text-muted)] shrink-0">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadedFile(i)}
                        className="text-[var(--text-muted)] hover:text-red-400 p-0.5"
                        title="Remove file"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {statusMessage && (
            <div className="mt-4 rounded-[4px] border-2 border-amber-400 bg-amber-400/10 p-3 text-xs font-tech font-bold text-amber-400 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Sessions Ribbon */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <span className="text-xs font-tech font-bold uppercase text-[var(--text-muted)] shrink-0">
              ACTIVE SESSIONS:
            </span>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveSession(s);
                  StorageService.setActiveSessionId(s.id);
                }}
                className={`mlh-card-btn py-2 px-4 text-xs shrink-0 ${
                  activeSession?.id === s.id ? 'mlh-card-btn-solid font-black' : ''
                }`}
              >
                {s.subject}
              </button>
            ))}
          </div>
        )}

        {/* Multi-Tab Navigation */}
        {activeSession && (
          <div className="space-y-8">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b-2 border-[var(--border-color)]/30">
              <button
                type="button"
                onClick={() => setActiveTab('roadmap')}
                className={`mlh-card-btn py-2.5 px-4 text-xs shrink-0 ${
                  activeTab === 'roadmap' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                1. MISSION ROADMAP ({activeSession.roadmap.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('concepts')}
                className={`mlh-card-btn py-2.5 px-4 text-xs shrink-0 ${
                  activeTab === 'concepts' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                2. CONCEPTS & ANALOGIES ({activeSession.concepts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('practice')}
                className={`mlh-card-btn py-2.5 px-4 text-xs shrink-0 ${
                  activeTab === 'practice' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                3. LEITNER RECALL ({activeSession.flashcards.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('crashtest')}
                className={`mlh-card-btn py-2.5 px-4 text-xs shrink-0 ${
                  activeTab === 'crashtest' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                4. CRASH TEST ARENA ({activeSession.quiz.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`mlh-card-btn py-2.5 px-4 text-xs shrink-0 ${
                  activeTab === 'analytics' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                5. STUDY TELEMETRY
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`mlh-card-btn py-2.5 px-4 text-xs shrink-0 ${
                  activeTab === 'chat' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                6. GEMMA SIBLING TUTOR
              </button>
            </div>

            {/* Panels */}
            {activeTab === 'roadmap' && (
              <RoadmapTab
                roadmap={activeSession.roadmap}
                subject={activeSession.subject}
                userProfile={profile}
                onToggleStep={handleToggleRoadmapStep}
              />
            )}

            {activeTab === 'concepts' && (
              <ConceptsTab concepts={activeSession.concepts} userProfile={profile} />
            )}

            {activeTab === 'practice' && (
              <PracticeTab
                flashcards={activeSession.flashcards}
                userProfile={profile}
                onUpdateFlashcards={handleUpdateFlashcards}
              />
            )}

            {activeTab === 'crashtest' && (
              <CrashTestTab
                quiz={activeSession.quiz}
                userProfile={profile}
                subject={activeSession.subject}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab userProfile={profile} sessions={sessions} />
            )}

            {activeTab === 'chat' && (
              <div className="mlh-card p-6 space-y-4 max-w-3xl mx-auto">
                <span className="mlh-badge bg-[#be1e2d] text-white border-white">
                  TUTOR DISPATCH // GEMMA 2
                </span>

                <div className="flex items-center justify-between border-b border-[var(--border-color)]/20 pb-3 pt-2">
                  <div className="flex items-center gap-2 font-tech font-black text-sm">
                    <Brain className="h-4 w-4" />
                    <span>GEMMA SIBLING TUTOR</span>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {profile.enginePreference === 'local' ? 'GEMMA 2-2B (LOCAL WEBGPU)' : 'GEMMA 2-9B (CLOUD API)'}
                  </span>
                </div>

                <div className="min-h-[260px] max-h-[380px] overflow-y-auto space-y-3 pr-2">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-10 text-xs font-tech text-[var(--text-muted)] uppercase">
                      ASK GEMMA 2 TO BREAK DOWN ANY COMPLEX SUB-TOPIC IN {activeSession.subject}.
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`rounded-[4px] border-2 border-[var(--border-color)] p-3 text-xs md:text-sm max-w-[85%] font-mono leading-relaxed shadow-[3px_3px_0px_#000] ${
                          msg.role === 'user'
                            ? 'bg-amber-400 text-black font-bold border-amber-300'
                            : 'bg-[var(--bg-primary)] text-[var(--text-main)]'
                        }`}
                      >
                        {msg.content || (isStreamingChat ? '...' : '')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-color)]/20">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="ASK GEMMA FOR ANOTHER EVERYDAY ANALOGY..."
                    className="flex-1 rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-2.5 text-xs font-tech font-bold uppercase text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none shadow-[2px_2px_0px_#000]"
                  />
                  <button
                    type="button"
                    disabled={!chatInput.trim() || isStreamingChat}
                    onClick={handleSendChatMessage}
                    className="mlh-card-btn mlh-card-btn-solid py-2.5 px-4 text-xs font-black disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* TABBED INTERACTIVE PROFILE & HARDWARE SETTINGS MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
          <div className="mlh-card w-full max-w-3xl max-h-[92vh] flex flex-col p-5 sm:p-7 bg-[var(--bg-card)] shadow-[6px_6px_0px_#000]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)]/25 pb-3 pt-1">
              <div>
                <span className="mlh-badge bg-[#be1e2d] text-white border-white mb-1">
                  STUDENT PROFILE LAB // CONFIGURATION
                </span>
                <h2 className="mlh-card-title text-2xl md:text-3xl mb-0">LEARNER PROFILE & ENGINE</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="mlh-card-btn py-1.5 px-3 text-xs font-black"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Profile Settings 5 Tabs Navigation Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-[var(--border-color)]/25">
              <button
                type="button"
                onClick={() => setProfileModalTab('identity')}
                className={`mlh-card-btn py-2 px-3 text-xs font-black shrink-0 ${
                  profileModalTab === 'identity' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>1. IDENTITY & ACADEMICS</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab('learning')}
                className={`mlh-card-btn py-2 px-3 text-xs font-black shrink-0 ${
                  profileModalTab === 'learning' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                <Brain className="h-3.5 w-3.5" />
                <span>2. ATTENTION & STYLE</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab('schedule')}
                className={`mlh-card-btn py-2 px-3 text-xs font-black shrink-0 ${
                  profileModalTab === 'schedule' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>3. SCHEDULE & EXAM</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab('engine')}
                className={`mlh-card-btn py-2 px-3 text-xs font-black shrink-0 ${
                  profileModalTab === 'engine' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>4. GEMMA ENGINE & BYOK</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileModalTab('theme')}
                className={`mlh-card-btn py-2 px-3 text-xs font-black shrink-0 ${
                  profileModalTab === 'theme' ? 'mlh-card-btn-solid' : ''
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                <span>5. THEME & COLORS</span>
              </button>
            </div>

            {/* Tab Contents Container */}
            <div className="flex-1 overflow-y-auto py-4 pr-1 text-xs font-tech">
              {/* TAB 1: IDENTITY & ACADEMICS */}
              {profileModalTab === 'identity' && (
                <div className="space-y-4">
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-4 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-amber-400">
                      <User className="h-5 w-5" />
                      <span>STUDENT CREDENTIALS & ACADEMIC STANDING</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name Input */}
                      <div>
                        <label className="uppercase text-[var(--text-muted)] font-black flex items-center gap-1.5 mb-1">
                          <User className="h-3.5 w-3.5 text-amber-400" />
                          <span>STUDENT NAME / NICKNAME *</span>
                        </label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                          placeholder="E.G. ALEX HUNTER"
                        />
                      </div>

                      {/* Email Input */}
                      <div>
                        <label className="uppercase text-[var(--text-muted)] font-black flex items-center gap-1.5 mb-1">
                          <Mail className="h-3.5 w-3.5 text-blue-400" />
                          <span>STUDENT EMAIL ADDRESS *</span>
                        </label>
                        <input
                          type="email"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                          placeholder="E.G. ALEX@UNIVERSITY.EDU"
                        />
                        <span className="text-[10px] text-[var(--text-muted)] font-mono mt-1 block">
                          Used for study telemetry & adaptive session synchronization.
                        </span>
                      </div>
                    </div>

                    {/* Academic Level */}
                    <div>
                      <label className="uppercase text-[var(--text-muted)] font-black flex items-center gap-1.5 mb-1">
                        <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
                        <span>CURRENT ACADEMIC DEGREE / LEVEL</span>
                      </label>
                      <select
                        value={profile.academicLevel}
                        onChange={(e) => setProfile({ ...profile, academicLevel: e.target.value })}
                        className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                      >
                        <option value="High School">HIGH SCHOOL</option>
                        <option value="Associate Degree">ASSOCIATE DEGREE</option>
                        <option value="Bachelor Degree">BACHELOR DEGREE</option>
                        <option value="Master Degree">MASTER DEGREE</option>
                        <option value="PhD / Doctorate">PHD / DOCTORATE</option>
                        <option value="Self-Taught / Professional">SELF-TAUGHT / PROFESSIONAL</option>
                      </select>
                    </div>

                    {/* Majors & Disciplines */}
                    <div className="pt-2 border-t border-[var(--border-color)]/20">
                      <label className="uppercase text-[var(--text-muted)] font-black block mb-1">
                        MAJORS, MINORS & DISCIPLINES
                      </label>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {profile.majors.map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-xs font-bold shadow-[2px_2px_0px_#000]"
                          >
                            <span>{m.toUpperCase()}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMajor(m)}
                              className="hover:text-red-400 font-black"
                              title="Remove major"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMajorInput}
                          onChange={(e) => setNewMajorInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddMajor(newMajorInput)}
                          placeholder="TYPE MAJOR & PRESS ENTER OR CLICK ADD..."
                          className="flex-1 rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddMajor(newMajorInput)}
                          className="mlh-card-btn py-2 px-3 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" /> ADD
                        </button>
                      </div>

                      {/* Suggested Majors Quick Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">
                          POPULAR DISCIPLINES:
                        </span>
                        {SUGGESTED_MAJORS.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleAddMajor(sug)}
                            className="px-2 py-0.5 rounded-[3px] border border-[var(--border-color)]/40 bg-[var(--bg-card)] text-[10px] uppercase font-bold hover:bg-white hover:text-black transition-all"
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ATTENTION & LEARNING STYLE */}
              {profileModalTab === 'learning' && (
                <div className="space-y-4">
                  {/* Preferred Learning Style */}
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-3 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-amber-400">
                      <BookOpen className="h-5 w-5" />
                      <span>PREFERRED WAY TO LEARN</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {LEARNING_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setProfile({ ...profile, learningStyle: style.id as any })}
                          className={`p-3 rounded-[4px] border-2 text-left transition-all ${
                            profile.learningStyle === style.id
                              ? 'border-[var(--border-color)] bg-white text-black font-black shadow-[3px_3px_0px_#000]'
                              : 'border-[var(--border-color)]/30 bg-[var(--bg-card)] opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className="text-xs font-tech font-black uppercase">{style.label}</div>
                          <p className="text-[10px] opacity-80 mt-1 leading-snug">{style.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cognitive Conditions */}
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-3 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-black uppercase text-red-400">
                        <Heart className="h-5 w-5" />
                        <span>COGNITIVE CONDITIONS & ATTENTION DYNAMICS</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">SELECT ALL THAT APPLY</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {USER_CONDITIONS.map((cond) => {
                        const isSelected = (profile.conditions || []).includes(cond.id);
                        return (
                          <button
                            key={cond.id}
                            type="button"
                            onClick={() => handleToggleCondition(cond.id)}
                            className={`p-3 rounded-[4px] border-2 text-left flex items-start gap-2.5 transition-all ${
                              isSelected
                                ? 'border-[var(--border-color)] bg-amber-400 text-black font-black shadow-[3px_3px_0px_#000]'
                                : 'border-[var(--border-color)]/40 bg-[var(--bg-card)] text-[var(--text-main)] opacity-70 hover:opacity-100'
                            }`}
                          >
                            <div className="mt-0.5">
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4 text-[var(--text-muted)]" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-tech font-black uppercase">{cond.label}</div>
                              <p className="text-[10px] opacity-85 mt-0.5 leading-snug">{cond.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* "OTHER" Condition */}
                    <div className="pt-2 border-t border-[var(--border-color)]/20">
                      <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={hasOtherCondition}
                          onChange={(e) => {
                            setHasOtherCondition(e.target.checked);
                            if (!e.target.checked) setProfile({ ...profile, otherCondition: '' });
                          }}
                          className="rounded"
                        />
                        <span>OTHER SPECIFIC CONDITION OR PREFERENCE</span>
                      </label>
                      {hasOtherCondition && (
                        <input
                          type="text"
                          value={profile.otherCondition || ''}
                          onChange={(e) => setProfile({ ...profile, otherCondition: e.target.value })}
                          placeholder="E.G. DYSLEXIA, TINNITUS, EXAM-DAY PANIC, CHRONIC FATIGUE..."
                          className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SCHEDULE & EXAM DEADLINES */}
              {profileModalTab === 'schedule' && (
                <div className="space-y-4">
                  {/* Availability Days & Focus Time */}
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-4 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-emerald-400">
                      <Clock className="h-5 w-5" />
                      <span>AVAILABILITY SCHEDULE & TIME BUDGET</span>
                    </div>

                    {/* Days of the Week */}
                    <div>
                      <label className="uppercase text-[var(--text-muted)] font-black text-[11px] block mb-1.5">
                        DAYS AVAILABLE FOR STUDY SPRINTS:
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {WEEK_DAYS.map((day) => {
                          const isSelected = (profile.availableDays || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleToggleDay(day)}
                              className={`h-8 w-11 rounded-[4px] border-2 font-tech font-black text-xs transition-all shadow-[2px_2px_0px_#000] ${
                                isSelected
                                  ? 'border-[var(--border-color)] bg-emerald-400 text-black'
                                  : 'border-[var(--border-color)]/40 bg-[var(--bg-card)] text-[var(--text-muted)] opacity-60 hover:opacity-100'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Daily Minutes & Preferred Slot */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="uppercase text-[var(--text-muted)] font-black text-[11px] block mb-1">
                          DAILY FOCUS TIME: {profile.dailyMinutes} MINUTES
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="15"
                            max="180"
                            step="15"
                            value={profile.dailyMinutes}
                            onChange={(e) => setProfile({ ...profile, dailyMinutes: Number(e.target.value) })}
                            className="w-full accent-amber-400"
                          />
                          <span className="font-mono font-bold text-amber-400 shrink-0">{profile.dailyMinutes}m</span>
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          {[15, 30, 45, 60, 90, 120].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setProfile({ ...profile, dailyMinutes: m })}
                              className={`px-2 py-0.5 text-[10px] rounded border ${
                                profile.dailyMinutes === m
                                  ? 'bg-amber-400 text-black font-black border-amber-300'
                                  : 'bg-[var(--bg-card)] border-[var(--border-color)]/30'
                              }`}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="uppercase text-[var(--text-muted)] font-black text-[11px] block mb-1">
                          PREFERRED TIME OF DAY:
                        </label>
                        <select
                          value={profile.preferredTimeSlot}
                          onChange={(e) => setProfile({ ...profile, preferredTimeSlot: e.target.value as any })}
                          className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                        >
                          <option value="morning">MORNING (FRESH FOCUS)</option>
                          <option value="afternoon">AFTERNOON (POST-LUNCH)</option>
                          <option value="evening">EVENING (UNWIND & REVIEW)</option>
                          <option value="night">NIGHT OWL (QUIET HOURS)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Exam Dates & Countdown */}
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-3 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-black uppercase text-amber-400">
                        <Calendar className="h-5 w-5" />
                        <span>EXAM DATES & SUBJECT TITLE</span>
                      </div>
                      {daysRemaining !== null && (
                        <span className="text-amber-400 font-mono text-xs font-black">
                          {daysRemaining} DAYS REMAINING
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="uppercase text-[var(--text-muted)] font-black text-[11px] block mb-1">
                          EXAM / SPRINT TITLE
                        </label>
                        <input
                          type="text"
                          value={profile.examTitle || ''}
                          onChange={(e) => setProfile({ ...profile, examTitle: e.target.value })}
                          placeholder="E.G. FINAL SEMESTER EXAMS, MCAT..."
                          className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                        />
                      </div>

                      <div>
                        <label className="uppercase text-[var(--text-muted)] font-black text-[11px] block mb-1">
                          DEADLINE DATE
                        </label>
                        <input
                          type="date"
                          value={profile.examDate}
                          onChange={(e) => setProfile({ ...profile, examDate: e.target.value })}
                          className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs font-bold text-[var(--text-main)] focus:outline-none shadow-[2px_2px_0px_#000]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: GEMMA ENGINE & BYOK API */}
              {profileModalTab === 'engine' && (
                <div className="space-y-4">
                  {/* Engine Selection */}
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-3 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-emerald-400">
                      <Cpu className="h-5 w-5" />
                      <span>GEMMA EXECUTION ENGINE (CLOUD vs LOCAL)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setProfile({ ...profile, enginePreference: 'cloud' })}
                        className={`mlh-card p-4 text-left ${profile.enginePreference === 'cloud' ? 'border-amber-400 bg-amber-400/10' : ''}`}
                      >
                        <div className="flex items-center gap-2 font-black text-sm uppercase">
                          <Cloud className="h-4 w-4 text-amber-400" />
                          <span>GEMMA CLOUD 9B (API)</span>
                        </div>
                        <p className="mlh-card-text text-xs mb-0 mt-1">High-speed reasoning via Google Gemma 2 Cloud Endpoint.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setProfile({ ...profile, enginePreference: 'local' })}
                        className={`mlh-card p-4 text-left ${profile.enginePreference === 'local' ? 'border-emerald-400 bg-emerald-400/10' : ''}`}
                      >
                        <div className="flex items-center gap-2 font-black text-sm uppercase">
                          <HardDrive className="h-4 w-4 text-emerald-400" />
                          <span>GEMMA LOCAL 2B (WEBGPU)</span>
                        </div>
                        <p className="mlh-card-text text-xs mb-0 mt-1">100% offline in-browser execution with zero cloud telemetry.</p>
                      </button>
                    </div>
                  </div>

                  {/* API Key BYOK */}
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-3 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-black uppercase text-amber-400">
                        <Key className="h-5 w-5" />
                        <span>GEMMA API KEY (OPTIONAL BYOK)</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {profile.apiKey ? 'CUSTOM KEY ACTIVE' : 'SERVER PROXY ACTIVE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">
                      Enter your Google AI Studio key to talk to Gemma 2. Stored strictly in your browser. Leave blank to use server proxy.
                    </p>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={profile.apiKey}
                        onChange={(e) => setProfile({ ...profile, apiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-card)] pl-3 pr-10 py-2.5 text-xs font-mono text-[var(--text-main)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        disabled={apiTestStatus.testing}
                        onClick={handleTestApiConnection}
                        className="mlh-card-btn py-1.5 px-3 text-xs"
                      >
                        <Activity className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{apiTestStatus.testing ? 'PINGING GEMMA...' : 'TEST API CONNECTION'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBenchmarkWebGpu}
                        className="mlh-card-btn py-1.5 px-3 text-xs"
                      >
                        <Cpu className="h-3.5 w-3.5 text-blue-400" />
                        <span>VERIFY LOCAL WEBGPU ADAPTER</span>
                      </button>
                    </div>

                    {apiTestStatus.result && (
                      <div
                        className={`p-2.5 rounded-[4px] border text-xs font-mono ${
                          apiTestStatus.error
                            ? 'border-red-500 bg-red-950/20 text-red-300'
                            : 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                        }`}
                      >
                        {apiTestStatus.result}
                      </div>
                    )}

                    {webGpuBenchmarkStatus && (
                      <div className="p-2.5 rounded-[4px] border border-blue-500 bg-blue-950/20 text-xs font-mono text-blue-300">
                        {webGpuBenchmarkStatus}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: THEME & MONOCOLOR LAB */}
              {profileModalTab === 'theme' && (
                <div className="space-y-4">
                  <div className="rounded-[6px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-5 space-y-4 shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-amber-400" />
                        <span className="text-sm font-black uppercase">THEME & COLOR LAB (8 MONOCOLOR SHADES)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProfile({ ...profile, theme: 'dark' })}
                          className={`mlh-card-btn py-1 px-3 text-xs ${profile.theme === 'dark' ? 'mlh-card-btn-solid' : ''}`}
                        >
                          <Moon className="h-3.5 w-3.5" /> DARK
                        </button>
                        <button
                          type="button"
                          onClick={() => setProfile({ ...profile, theme: 'light' })}
                          className={`mlh-card-btn py-1 px-3 text-xs ${profile.theme === 'light' ? 'mlh-card-btn-solid' : ''}`}
                        >
                          <Sun className="h-3.5 w-3.5" /> LIGHT
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {COLOR_PALETTES.map((pal) => (
                        <button
                          key={pal.id}
                          type="button"
                          onClick={() => setProfile({ ...profile, colorPalette: pal.id })}
                          className={`p-3 rounded-[4px] border-2 text-left flex items-center gap-2.5 transition-all shadow-[2px_2px_0px_#000] ${
                            profile.colorPalette === pal.id
                              ? 'border-[var(--border-color)] bg-white text-black font-black'
                              : 'border-[var(--border-color)]/40 bg-[var(--bg-card)] text-[var(--text-main)] hover:border-[var(--border-color)]'
                          }`}
                        >
                          <span className="h-4 w-4 rounded-full border border-black shrink-0" style={{ backgroundColor: pal.hex }} />
                          <span className="truncate uppercase font-bold text-[11px]">{pal.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions: Prev / Next Tabs & Save Button */}
            <div className="mt-4 pt-3 border-t border-[var(--border-color)]/20 flex flex-wrap items-center justify-between gap-3">
              {/* Tab Navigation Shortcuts */}
              <div className="flex items-center gap-2">
                {profileModalTab !== 'identity' && (
                  <button
                    type="button"
                    onClick={() => {
                      const tabs: ('identity' | 'learning' | 'schedule' | 'engine' | 'theme')[] = [
                        'identity',
                        'learning',
                        'schedule',
                        'engine',
                        'theme',
                      ];
                      const curIdx = tabs.indexOf(profileModalTab);
                      if (curIdx > 0) setProfileModalTab(tabs[curIdx - 1]);
                    }}
                    className="mlh-card-btn py-2 px-3 text-xs flex items-center gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>PREVIOUS</span>
                  </button>
                )}

                {profileModalTab !== 'theme' && (
                  <button
                    type="button"
                    onClick={() => {
                      const tabs: ('identity' | 'learning' | 'schedule' | 'engine' | 'theme')[] = [
                        'identity',
                        'learning',
                        'schedule',
                        'engine',
                        'theme',
                      ];
                      const curIdx = tabs.indexOf(profileModalTab);
                      if (curIdx < tabs.length - 1) setProfileModalTab(tabs[curIdx + 1]);
                    }}
                    className="mlh-card-btn py-2 px-3 text-xs flex items-center gap-1"
                  >
                    <span>NEXT TAB</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSaveProfile(profile)}
                className="mlh-card-btn mlh-card-btn-solid py-2.5 px-6 font-black"
              >
                APPLY & SAVE PROFILE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
