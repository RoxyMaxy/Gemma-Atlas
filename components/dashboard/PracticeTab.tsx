import React, { useState } from 'react';
import { FlashcardState, UserProfile } from '../../lib/vector/types';
import { StorageService } from '../../lib/vector/storageService';
import { RotateCw, Check, X, ArrowLeft, ArrowRight, Brain, Zap } from 'lucide-react';

interface PracticeTabProps {
  flashcards: FlashcardState[];
  userProfile: UserProfile;
  onUpdateFlashcards: (updated: FlashcardState[]) => void;
}

export const PracticeTab: React.FC<PracticeTabProps> = ({
  flashcards,
  userProfile,
  onUpdateFlashcards,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="mlh-card p-12 text-center">
        <Brain className="mx-auto h-12 w-12 text-[var(--text-muted)] mb-3" />
        <h3 className="mlh-card-title text-xl">NO FLASHCARDS ACTIVE</h3>
        <p className="mlh-card-text">Launch a course session to generate your Leitner active recall deck.</p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex] || flashcards[0];

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleGrade = (remembered: boolean) => {
    const updatedMeta = StorageService.calculateLeitnerNextReview(currentCard, remembered);
    const updatedList = flashcards.map((c, idx) => {
      if (idx === currentIndex) {
        return {
          ...c,
          ...updatedMeta,
        };
      }
      return c;
    });

    onUpdateFlashcards(updatedList);
    StorageService.recordStudyActivity();
    StorageService.logStudyMinutes(5, remembered ? 4 : 1);

    setIsFlipped(false);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Top Banner */}
      <div className="mlh-card p-6 bg-[var(--bg-card)]">
        <span className="mlh-badge bg-[#be1e2d] text-white border-white">
          LEITNER SYSTEM // ACTIVE RECALL
        </span>

        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="mlh-card-subtitle">SPACED REPETITION ENGINE</p>
            <h2 className="mlh-card-title text-2xl mb-0">
              CARD {currentIndex + 1} OF {flashcards.length}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((box) => (
              <div
                key={box}
                className={`h-8 w-8 rounded-[4px] border-2 border-[var(--border-color)] flex items-center justify-center font-tech font-black text-xs shadow-[2px_2px_0px_#000] ${
                  currentCard.leitnerBox === box
                    ? 'bg-emerald-400 text-black'
                    : currentCard.leitnerBox > box
                    ? 'bg-[var(--border-color)] text-[var(--text-dark)] opacity-60'
                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                }`}
                title={`Leitner Box ${box}`}
              >
                B{box}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3D Mechanical Flip Card in MLH Style */}
      <div
        onClick={handleFlip}
        className="mlh-card p-8 min-h-[360px] flex flex-col justify-between cursor-pointer select-none"
      >
        <span className="mlh-badge bg-white text-black border-black">
          {isFlipped ? 'REVEALED // SYNTHESIS ANSWER' : `LEITNER BOX 0${currentCard.leitnerBox || 1} // TAP TO FLIP`}
        </span>

        <div className="flex items-center justify-between text-[11px] font-tech text-[var(--text-muted)] uppercase">
          <span>ACTIVE RETRIEVAL TRIAL</span>
          <span className="flex items-center gap-1 font-bold">
            <RotateCw className="h-3.5 w-3.5" /> CLICK OR TAP TO FLIP
          </span>
        </div>

        <div className="my-auto py-8 text-center px-4">
          {!isFlipped ? (
            <h3 className="mlh-card-title text-2xl md:text-3xl font-black leading-snug">
              {currentCard.question}
            </h3>
          ) : (
            <div className="space-y-4">
              <p className="text-xl md:text-2xl font-tech font-black text-emerald-400 leading-snug uppercase">
                {currentCard.answer}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs font-tech text-[var(--text-muted)] border-t border-[var(--border-color)]/20 pt-4">
          <span>BOX {currentCard.leitnerBox} INTERVAL: {[1, 3, 7, 14, 30][currentCard.leitnerBox - 1] || 1} DAYS</span>
          <span>NEXT REVIEW: {new Date(currentCard.nextReviewDate || Date.now()).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Mechanical Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => {
              setIsFlipped(false);
              setCurrentIndex((p) => Math.max(0, p - 1));
            }}
            className="mlh-card-btn py-3 px-4 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={currentIndex === flashcards.length - 1}
            onClick={() => {
              setIsFlipped(false);
              setCurrentIndex((p) => Math.min(flashcards.length - 1, p + 1));
            }}
            className="mlh-card-btn py-3 px-4 disabled:opacity-40"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleGrade(false)}
            className="mlh-card-btn flex-1 sm:flex-none border-red-500 bg-red-600/20 text-red-200 hover:bg-red-600 hover:text-white"
          >
            <X className="h-4 w-4" />
            <span>FAILED (RESET B1)</span>
          </button>

          <button
            type="button"
            onClick={() => handleGrade(true)}
            className="mlh-card-btn flex-1 sm:flex-none border-emerald-400 bg-emerald-500 text-black font-black hover:bg-white hover:text-black"
          >
            <Check className="h-4 w-4" />
            <span>RECALLED (ADVANCE)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
