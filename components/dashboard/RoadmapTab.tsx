import React, { useState } from 'react';
import { RoadmapStep, UserProfile } from '../../lib/vector/types';
import {
  CheckCircle2,
  Video,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  ArrowDown,
  Clock,
  Compass,
  Check,
  Layers,
  FileCheck,
  AlertTriangle,
  Lightbulb,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RoadmapTabProps {
  roadmap: RoadmapStep[];
  subject: string;
  userProfile: UserProfile;
  onToggleStep: (stageNumber: number) => void;
}

export const RoadmapTab: React.FC<RoadmapTabProps> = ({
  roadmap,
  subject,
  userProfile,
  onToggleStep,
}) => {
  const [expandedStages, setExpandedStages] = useState<Record<number, boolean>>({});

  const toggleExpand = (stageNumber: number) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stageNumber]: !prev[stageNumber],
    }));
  };

  const completedCount = roadmap.filter((s) => s.completed).length;
  const progressPercent = roadmap.length > 0 ? Math.round((completedCount / roadmap.length) * 100) : 0;

  // Ensure stages are strictly sorted linearly (Stage 1 first up top, then Stage 2 down, etc.)
  const linearSteps = [...roadmap].sort((a, b) => a.stageNumber - b.stageNumber);

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      {/* Top Mission Control Header */}
      <div className="mlh-card p-8 bg-[var(--bg-card)]">
        <span className="mlh-badge bg-[#be1e2d] text-white border-white">
          GEMMA AI ARCHITECTURE // {linearSteps.length} STAGES AUTONOMOUSLY SIZED
        </span>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
          <div>
            <p className="mlh-card-subtitle">
              AUTONOMOUSLY DETERMINED BY GEMMA 2 ACCORDING TO SUBJECT COMPLEXITY
            </p>
            <h2 className="mlh-card-title text-3xl">
              {subject} CURRICULUM ({linearSteps.length} STAGES)
            </h2>
            <p className="mlh-card-text max-w-2xl mb-0">
              Gemma evaluated the knowledge graph of {subject} and autonomously sized the curriculum into {linearSteps.length} granular hierarchical stages—covering every chapter, under-chapter, notion, property, and notice.
            </p>
          </div>

          {/* League Score Badge */}
          <div className="flex items-center gap-4 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] p-4 rounded-[4px] shadow-[4px_4px_0px_#000] shrink-0 font-tech">
            <div className="text-right">
              <div className="text-[10px] tracking-wider uppercase text-[var(--text-muted)] font-black">
                PROGRESSION
              </div>
              <div className="text-2xl font-black text-[var(--text-main)]">
                {completedCount}/{linearSteps.length}{' '}
                <span className="text-sm text-emerald-400">({progressPercent}%)</span>
              </div>
            </div>
            <div className="h-10 w-10 border-2 border-[var(--border-color)] bg-[#be1e2d] text-white flex items-center justify-center rounded-[4px] shadow-[2px_2px_0px_#000]">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Physical Mechanical Progress Bar */}
        <div className="mt-6 h-3 w-full border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-0.5 rounded-[3px]">
          <div
            className="h-full bg-gradient-to-r from-[#be1e2d] via-yellow-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* LINEARLY DOWNCAST TRACK */}
      <div className="relative pl-6 md:pl-10 space-y-8">
        {/* Downward Vertical Spine Rail */}
        <div className="absolute left-2.5 md:left-4.5 top-6 bottom-6 w-1 border-l-2 border-dashed border-[var(--border-color)] opacity-60 pointer-events-none" />

        {linearSteps.map((step, idx) => {
          const isLast = idx === linearSteps.length - 1;
          const isCompleted = !!step.completed;
          const isNextUp = !isCompleted && (idx === 0 || linearSteps[idx - 1].completed);
          const isExpanded = expandedStages[step.stageNumber] ?? true;

          const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${step.highUtilitySearchKeywords || `${step.chapterTitle} ${step.subChapter} ${subject} tutorial`}`
          )}`;

          return (
            <div key={step.stageNumber} className="relative group">
              {/* Checkpoint Node along the Spine */}
              <div
                className={`absolute -left-6 md:-left-10 top-6 h-7 w-7 rounded-[4px] border-2 border-[var(--border-color)] flex items-center justify-center font-tech font-black text-xs shadow-[2px_2px_0px_#000] z-20 transition-all ${
                  isCompleted
                    ? 'bg-emerald-400 text-black border-black'
                    : isNextUp
                    ? 'bg-amber-400 text-black animate-pulse'
                    : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.stageNumber}
              </div>

              {/* The Step MLH Card */}
              <div
                className={`mlh-card p-6 md:p-8 transition-all ${
                  isCompleted
                    ? 'border-emerald-400/80 bg-emerald-950/15'
                    : isNextUp
                    ? 'border-amber-400/90 shadow-[6px_6px_0px_#000]'
                    : ''
                }`}
              >
                {/* Floating Sticker Badge */}
                <span
                  className={`mlh-badge ${
                    isCompleted
                      ? 'bg-emerald-400 text-black border-black'
                      : isNextUp
                      ? 'bg-amber-400 text-black border-black'
                      : 'bg-white text-black border-black'
                  }`}
                >
                  STAGE {step.stageNumber < 10 ? `0${step.stageNumber}` : step.stageNumber} // {step.allocatedTime} {isCompleted ? '✓ CLEARED' : isNextUp ? '★ CURRENT TARGET' : ''}
                </span>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pt-1">
                  <div className="flex-1">
                    {/* Multi-tier Hierarchy Breadcrumbs */}
                    {step.hierarchyTitle && (
                      <div className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--border-color)]/40 bg-[var(--bg-primary)] px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-400 mb-2">
                        <Layers className="h-3 w-3" />
                        <span>{step.hierarchyTitle}</span>
                      </div>
                    )}

                    <p className="mlh-card-subtitle flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[var(--text-main)]">CHAPTER: {step.chapterTitle}</span>
                      <span>•</span>
                      <span>UNDER-CHAPTER: {step.subChapter.toUpperCase()}</span>
                      <span>•</span>
                      <span>DUE: {step.deadlineDate}</span>
                    </p>

                    <h3 className="mlh-card-title text-xl md:text-2xl mt-1">
                      {step.subChapter}
                    </h3>

                    <p className="mlh-card-text text-sm md:text-base leading-relaxed mb-4">
                      {step.contentSummary}
                    </p>

                    {/* Collapsible Granular Technical Details */}
                    {isExpanded && (
                      <div className="space-y-4 pt-2 border-t border-[var(--border-color)]/20">
                        {/* Key Notions & Concepts */}
                        {step.keyNotions && step.keyNotions.length > 0 && (
                          <div className="rounded-[4px] border-2 border-[var(--border-color)]/60 bg-[var(--bg-primary)]/80 p-3.5">
                            <div className="flex items-center gap-1.5 text-xs font-tech font-black text-amber-400 uppercase tracking-wider mb-2">
                              <Tag className="h-3.5 w-3.5" />
                              <span>KEY NOTIONS & CONCEPTS ({step.keyNotions.length})</span>
                            </div>
                            <ul className="space-y-1.5 text-xs font-mono text-[var(--text-main)]">
                              {step.keyNotions.map((notion, nIdx) => (
                                <li key={nIdx} className="flex items-start gap-2">
                                  <span className="text-amber-400 font-bold shrink-0">▸</span>
                                  <span>{notion}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Fundamental Properties & Mathematical Invariants */}
                        {step.properties && step.properties.length > 0 && (
                          <div className="rounded-[4px] border-2 border-[var(--border-color)]/60 bg-[var(--bg-primary)]/80 p-3.5">
                            <div className="flex items-center gap-1.5 text-xs font-tech font-black text-blue-400 uppercase tracking-wider mb-2">
                              <FileCheck className="h-3.5 w-3.5" />
                              <span>FUNDAMENTAL PROPERTIES & INVARIANTS</span>
                            </div>
                            <ul className="space-y-1.5 text-xs font-mono text-[var(--text-main)]">
                              {step.properties.map((prop, pIdx) => (
                                <li key={pIdx} className="flex items-start gap-2">
                                  <span className="text-blue-400 font-bold shrink-0">◆</span>
                                  <span>{prop}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Critical Notices, Traps & Caveats */}
                        {step.criticalNotices && step.criticalNotices.length > 0 && (
                          <div className="rounded-[4px] border-2 border-red-500/60 bg-red-950/20 p-3.5 text-xs">
                            <div className="flex items-center gap-1.5 font-tech font-black text-red-400 uppercase tracking-wider mb-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>CRITICAL NOTICES & EXAM TRAPS</span>
                            </div>
                            <ul className="space-y-1 font-mono text-red-200">
                              {step.criticalNotices.map((notice, noIdx) => (
                                <li key={noIdx} className="flex items-start gap-2">
                                  <span className="text-red-400 font-bold shrink-0">!</span>
                                  <span>{notice}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Anti-Panic Protocol Sticker */}
                        {step.panicTip && (
                          <div className="rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-xs shadow-[3px_3px_0px_#000]">
                            <div className="flex items-center gap-1.5 font-tech font-black text-amber-400 uppercase tracking-wider mb-1">
                              <ShieldAlert className="h-4 w-4" />
                              <span>ANTI-PANIC FOCUS PROTOCOL</span>
                            </div>
                            <p className="text-[var(--text-muted)] font-mono leading-relaxed">
                              {step.panicTip}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-4 border-t border-[var(--border-color)]/25 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleStep(step.stageNumber)}
                      className={`mlh-card-btn py-2.5 px-5 text-xs ${
                        isCompleted ? 'bg-emerald-500 text-black font-black border-emerald-400' : isNextUp ? 'bg-amber-400 text-black font-black' : ''
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{isCompleted ? 'STAGE COMPLETED ✓' : 'MARK STAGE DONE'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpand(step.stageNumber)}
                      className="mlh-card-btn py-2.5 px-3 text-xs"
                      title={isExpanded ? 'Collapse technical notions' : 'Expand technical notions'}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span>{isExpanded ? 'HIDE NOTIONS' : 'EXPAND NOTIONS'}</span>
                    </button>
                  </div>

                  <a
                    href={ytSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mlh-card-btn py-2.5 px-4 text-xs bg-[#be1e2d] text-white hover:bg-white hover:text-black shrink-0"
                    title="Search video tutorial"
                  >
                    <Video className="h-4 w-4" />
                    <span>WATCH BREAKDOWN</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Downward Connector Arrow to next step (unless last) */}
              {!isLast && (
                <div className="flex items-center gap-3 py-2 my-2 text-xs font-tech font-black text-[var(--text-muted)] uppercase">
                  <div className="h-7 w-7 rounded-full border-2 border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-main)] shadow-[2px_2px_0px_#000]">
                    <ArrowDown className="h-4 w-4 animate-bounce" />
                  </div>
                  <span>PROCEED DOWN TO STAGE {linearSteps[idx + 1].stageNumber < 10 ? `0${linearSteps[idx + 1].stageNumber}` : linearSteps[idx + 1].stageNumber}: {linearSteps[idx + 1].subChapter.toUpperCase()} ➔</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
