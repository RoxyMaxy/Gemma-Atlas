import React, { useState } from 'react';
import { QuizQuestion, UserProfile } from '../../lib/vector/types';
import { StorageService } from '../../lib/vector/storageService';
import { Trophy, CheckCircle2, XCircle, RotateCcw, Award } from 'lucide-react';

interface CrashTestTabProps {
  quiz: QuizQuestion[];
  userProfile: UserProfile;
  subject: string;
}

export const CrashTestTab: React.FC<CrashTestTabProps> = ({ quiz, userProfile, subject }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  if (!quiz || quiz.length === 0) {
    return (
      <div className="mlh-card p-12 text-center">
        <Trophy className="mx-auto h-12 w-12 text-[var(--text-muted)] mb-3" />
        <h3 className="mlh-card-title text-xl">NO CRASH TESTS AVAILABLE</h3>
        <p className="mlh-card-text">Launch a course session to generate your adaptive quiz simulation.</p>
      </div>
    );
  }

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const calculateScore = () => {
    let score = 0;
    quiz.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        score += 1;
      }
    });
    return score;
  };

  const score = calculateScore();
  const total = quiz.length;
  const percentage = Math.round((score / total) * 100);

  const handleFinish = () => {
    setShowResults(true);
    StorageService.recordStudyActivity();
    StorageService.logStudyMinutes(15, percentage > 70 ? 5 : 2);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setShowResults(false);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* MLH Championship Banner */}
      <div className="mlh-card p-8 bg-[var(--bg-card)]">
        <span className="mlh-badge bg-[#be1e2d] text-white border-white">
          CHAMPIONSHIP ARENA // SIMULATOR
        </span>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2">
          <div>
            <p className="mlh-card-subtitle">ZERO-PENALTY EXAM SANDBOX</p>
            <h2 className="mlh-card-title text-3xl mb-1">
              {subject} CRASH TEST
            </h2>
            <p className="mlh-card-text mb-0">
              Scenario-based active retrieval trials to bulletproof memory under high-stakes exam conditions.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] p-4 rounded-[4px] shadow-[4px_4px_0px_#000] shrink-0 font-tech">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">ANSWERED</span>
              <div className="text-xl font-black text-amber-400">
                {Object.keys(selectedAnswers).length}/{total}
              </div>
            </div>
            {showResults && (
              <div className="text-right pl-3 border-l-2 border-[var(--border-color)]">
                <span className="text-[10px] uppercase font-bold text-emerald-400">SCORE</span>
                <div className="text-xl font-black text-emerald-400">{percentage}%</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-6">
        {quiz.map((q, qIdx) => {
          const userAnswer = selectedAnswers[qIdx];
          const isAnswered = typeof userAnswer === 'number';
          const isCorrect = isAnswered && userAnswer === q.correctIndex;

          return (
            <div
              key={qIdx}
              className={`mlh-card p-6 ${
                showResults
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-950/20'
                    : 'border-red-500 bg-red-950/20'
                  : ''
              }`}
            >
              <span className="mlh-badge bg-white text-black border-black">
                TRIAL #{qIdx < 9 ? `0${qIdx + 1}` : qIdx + 1}
              </span>

              <div className="flex items-center justify-between pt-1">
                <p className="mlh-card-subtitle">SCENARIO EVALUATION</p>
                {showResults && (
                  <span
                    className={`font-tech text-xs font-black uppercase flex items-center gap-1 ${
                      isCorrect ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {isCorrect ? 'CORRECT (+100 XP)' : 'INCORRECT'}
                  </span>
                )}
              </div>

              <h3 className="mlh-card-title text-lg md:text-xl font-bold mt-2">
                {q.question}
              </h3>

              {/* Options */}
              <div className="mt-4 space-y-3">
                {q.options.map((opt, oIdx) => {
                  const isSelected = userAnswer === oIdx;
                  let optClass = 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-main)]';

                  if (showResults) {
                    if (oIdx === q.correctIndex) {
                      optClass = 'bg-emerald-500 text-black font-black border-emerald-400';
                    } else if (isSelected && !isCorrect) {
                      optClass = 'bg-red-600 text-white font-bold border-red-500';
                    }
                  } else if (isSelected) {
                    optClass = 'bg-amber-400 text-black font-black border-amber-300';
                  }

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={showResults}
                      onClick={() => handleSelectOption(qIdx, oIdx)}
                      className={`w-full text-left rounded-[4px] border-2 p-3 text-xs md:text-sm font-tech uppercase tracking-wide flex items-center justify-between gap-3 shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all ${optClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-current bg-black/30 text-xs font-mono font-black">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span>{opt}</span>
                      </div>
                      {isSelected && !showResults && <span className="h-2.5 w-2.5 rounded-full bg-current" />}
                    </button>
                  );
                })}
              </div>

              {showResults && q.explanation && (
                <div className="mt-4 border-t-2 border-[var(--border-color)]/20 pt-3 text-xs text-[var(--text-muted)] font-mono">
                  <strong className="text-[var(--text-main)] font-tech uppercase">DEBRIEF: </strong>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="mlh-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs font-tech uppercase text-[var(--text-muted)]">
          {!showResults
            ? `${Object.keys(selectedAnswers).length} OF ${total} ANSWERED. SUBMIT WHEN READY.`
            : `TEST CONCLUDED • SCORE: ${score}/${total} (${percentage}%)`}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {showResults ? (
            <button type="button" onClick={handleReset} className="mlh-card-btn py-3 px-6">
              <RotateCcw className="h-4 w-4" />
              <span>RETRY ARENA</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={Object.keys(selectedAnswers).length === 0}
              onClick={handleFinish}
              className="mlh-card-btn mlh-card-btn-solid py-3 px-8 font-black disabled:opacity-40"
            >
              <Award className="h-4 w-4" />
              <span>SUBMIT & GRADE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
