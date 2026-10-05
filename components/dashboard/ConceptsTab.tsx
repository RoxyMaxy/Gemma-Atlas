import React, { useState } from 'react';
import { ConceptAnalogy, UserProfile } from '../../lib/vector/types';
import { Volume2, Search, Zap, Lightbulb, Sparkles, BookOpen } from 'lucide-react';

interface ConceptsTabProps {
  concepts: ConceptAnalogy[];
  userProfile: UserProfile;
}

export const ConceptsTab: React.FC<ConceptsTabProps> = ({ concepts, userProfile }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [speakingTerm, setSpeakingTerm] = useState<string | null>(null);

  const filtered = concepts.filter(
    (c) =>
      c.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.jargon.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.analogy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSpeak = (concept: ConceptAnalogy) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingTerm === concept.term) {
      window.speechSynthesis.cancel();
      setSpeakingTerm(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${concept.term}. Academic jargon: ${concept.jargon}. Everyday analogy: ${concept.analogy}`
    );
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingTerm(null);
    utterance.onerror = () => setSpeakingTerm(null);
    setSpeakingTerm(concept.term);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-8">
      {/* MLH Banner */}
      <div className="mlh-card p-8 bg-[var(--bg-card)]">
        <span className="mlh-badge bg-[#be1e2d] text-white border-white">
          ANALOGY MATRIX // ANTI-JARGON
        </span>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
          <div>
            <p className="mlh-card-subtitle">ZERO MONOLOGUE • REAL WORLD GROUNDING</p>
            <h2 className="mlh-card-title text-3xl">
              ACADEMIC JARGON ➔ DAILY ANALOGIES
            </h2>
            <p className="mlh-card-text max-w-2xl mb-0">
              Transforming dense textbook abstractions into tangible physical machines, gaming mechanics, and daily household levers.
            </p>
          </div>

          <div className="relative min-w-[280px]">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH TERMS OR ANALOGIES..."
              className="w-full rounded-[4px] border-2 border-[var(--border-color)] bg-[var(--bg-primary)] pl-10 pr-4 py-2.5 text-xs font-tech font-bold uppercase tracking-wider text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none shadow-[3px_3px_0px_#000]"
            />
          </div>
        </div>
      </div>

      {/* Grid of Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
        {filtered.map((item, idx) => (
          <div key={idx} className="mlh-card p-6 flex flex-col justify-between">
            {/* Sticker Badge */}
            <span className="mlh-badge bg-white text-black border-black">
              CONCEPT #{idx < 9 ? `0${idx + 1}` : idx + 1}
            </span>

            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="mlh-card-subtitle">CORE PRIMITIVE</p>
                <button
                  type="button"
                  onClick={() => handleSpeak(item)}
                  className={`flex items-center gap-1.5 rounded-[4px] border-2 border-[var(--border-color)] px-2.5 py-1 text-[11px] font-tech font-bold uppercase transition-all shadow-[2px_2px_0px_#000] ${
                    speakingTerm === item.term ? 'bg-emerald-400 text-black' : 'bg-[var(--bg-primary)] text-[var(--text-main)]'
                  }`}
                  title="Auditory Mode: Listen to synthesis"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>{speakingTerm === item.term ? 'PLAYING...' : 'LISTEN'}</span>
                </button>
              </div>

              <h3 className="mlh-card-title text-2xl mt-1">
                {item.term}
              </h3>

              {/* Jargon Definition Box */}
              <div className="rounded-[4px] border-2 border-[var(--border-color)]/50 bg-[var(--bg-primary)]/80 p-3 mb-4">
                <div className="flex items-center gap-1.5 text-[10px] font-tech font-black text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>TECHNICAL JARGON</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed font-mono">
                  {item.jargon}
                </p>
              </div>

              {/* Real World Analogy Box (MLH Sticker Highlight) */}
              <div className="rounded-[4px] border-2 border-[var(--border-color)] bg-amber-400/10 p-4 shadow-[3px_3px_0px_#000]">
                <div className="flex items-center gap-1.5 text-xs font-tech font-black text-amber-400 uppercase tracking-wider mb-1">
                  <Lightbulb className="h-4 w-4" />
                  <span>REAL-WORLD EVERYDAY ANALOGY</span>
                </div>
                <p className="text-sm font-bold text-[var(--text-main)] leading-relaxed">
                  "{item.analogy}"
                </p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-[var(--border-color)]/20 flex items-center justify-between text-[11px] font-tech uppercase text-[var(--text-muted)]">
              <span>FEYNMAN VALIDATION</span>
              <span className="text-emerald-400 font-bold">100% INTUITIVE ✓</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
