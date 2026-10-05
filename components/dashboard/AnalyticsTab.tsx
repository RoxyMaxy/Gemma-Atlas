import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DailyStudyMetric, UserProfile, CourseSession } from '../../lib/vector/types';
import { StorageService } from '../../lib/vector/storageService';
import { Clock, Flame, Award, TrendingUp, Brain, CheckCircle, Sparkles } from 'lucide-react';

interface AnalyticsTabProps {
  userProfile: UserProfile;
  sessions: CourseSession[];
  onRefreshMetrics?: () => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  userProfile,
  sessions,
  onRefreshMetrics,
}) => {
  const [history, setHistory] = useState<DailyStudyMetric[]>(() => StorageService.getStudyHistory());
  const [logSuccessMessage, setLogSuccessMessage] = useState<string | null>(null);

  const streakData = StorageService.getStreakData();
  const totalMinutes = history.reduce((acc, curr) => acc + curr.studyMinutes, 0);
  const totalHours = Number((totalMinutes / 60).toFixed(1));
  const latestMastery = history.length > 0 ? history[history.length - 1].masteryScore : 75;

  const totalCards = sessions.reduce((acc, s) => acc + (s.flashcards?.length || 0), 0);
  const masteredCards = sessions.reduce(
    (acc, s) => acc + (s.flashcards?.filter((c) => c.leitnerBox >= 3).length || 0),
    0
  );

  const handleQuickLog = (minutes: number) => {
    const updated = StorageService.logStudyMinutes(minutes, 3);
    setHistory([...updated]);
    setLogSuccessMessage(`LOGGED +${minutes} MINS STUDY TIME!`);
    setTimeout(() => setLogSuccessMessage(null), 3000);
    if (onRefreshMetrics) onRefreshMetrics();
  };

  const isLight = userProfile.theme === 'light';

  return (
    <div className="space-y-8">
      {/* MLH Banner */}
      <div className="mlh-card p-8 bg-[var(--bg-card)]">
        <span className="mlh-badge bg-[#be1e2d] text-white border-white">
          COGNITIVE ANALYTICS // TELEMETRY
        </span>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
          <div>
            <p className="mlh-card-subtitle">EBBINGHAUS RETENTION & SPRINT METRICS</p>
            <h2 className="mlh-card-title text-3xl mb-1">
              STUDY HOURS & MASTERY CURVE
            </h2>
            <p className="mlh-card-text max-w-2xl mb-0">
              Real-time visualization of focus stamina, spaced repetition memory stability, and exam readiness.
            </p>
          </div>

          {/* Quick Study Logger Buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-primary)] p-3 rounded-[4px] border-2 border-[var(--border-color)] shadow-[3px_3px_0px_#000]">
            <span className="text-xs font-tech font-bold uppercase text-[var(--text-muted)] mr-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> LOG TIME:
            </span>
            {[15, 30, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleQuickLog(m)}
                className="mlh-card-btn py-1.5 px-3 text-xs"
              >
                +{m}M
              </button>
            ))}
          </div>
        </div>

        {logSuccessMessage && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-[4px] border-2 border-emerald-400 bg-emerald-500/20 px-3 py-1.5 text-xs font-tech font-bold text-emerald-400 shadow-[2px_2px_0px_#000]">
            <CheckCircle className="h-4 w-4" />
            <span>{logSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="mlh-card p-6 flex flex-col justify-between">
          <span className="mlh-badge bg-white text-black border-black">STAT 01</span>
          <div>
            <p className="mlh-card-subtitle">TOTAL ACCUMULATED</p>
            <div className="text-3xl font-tech font-black text-[var(--text-main)]">{totalHours} <span className="text-sm font-bold text-[var(--text-muted)]">HRS</span></div>
          </div>
          <p className="text-[11px] font-mono text-[var(--text-muted)] mt-2">ACROSS {history.length} ACTIVE DAYS</p>
        </div>

        <div className="mlh-card p-6 flex flex-col justify-between">
          <span className="mlh-badge bg-amber-400 text-black border-black">STREAK</span>
          <div>
            <p className="mlh-card-subtitle">CONSECUTIVE SESSIONS</p>
            <div className="text-3xl font-tech font-black text-amber-400">{streakData.streak} <span className="text-sm font-bold">DAYS</span></div>
          </div>
          <p className="text-[11px] font-mono text-[var(--text-muted)] mt-2">DOPAMINE MULTIPLIER ACTIVE</p>
        </div>

        <div className="mlh-card p-6 flex flex-col justify-between">
          <span className="mlh-badge bg-emerald-400 text-black border-black">STABILITY</span>
          <div>
            <p className="mlh-card-subtitle">MASTERY INDEX</p>
            <div className="text-3xl font-tech font-black text-emerald-400">{latestMastery}%</div>
          </div>
          <p className="text-[11px] font-mono text-[var(--text-muted)] mt-2">EBBINGHAUS RETENTION</p>
        </div>

        <div className="mlh-card p-6 flex flex-col justify-between">
          <span className="mlh-badge bg-purple-400 text-black border-black">RETRIEVAL</span>
          <div>
            <p className="mlh-card-subtitle">CARDS IN BOX 3+</p>
            <div className="text-3xl font-tech font-black text-purple-400">{masteredCards}/{totalCards}</div>
          </div>
          <p className="text-[11px] font-mono text-[var(--text-muted)] mt-2">CONSOLIDATED MEMORY</p>
        </div>
      </div>

      {/* Chart 1: Study Hours Over Time */}
      <div className="mlh-card p-8">
        <span className="mlh-badge bg-white text-black border-black">CHART 01 // FOCUS TIME</span>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pt-1">
          <div>
            <p className="mlh-card-subtitle">CHRONOLOGICAL FOCUS LOG</p>
            <h3 className="mlh-card-title text-2xl mb-0">DAILY STUDY TIME</h3>
          </div>
          <span className="text-xs font-tech font-bold uppercase border-2 border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1 rounded-[4px] shadow-[2px_2px_0px_#000]">
            SCHEDULE: {userProfile.freeTimeValue}
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="studyHoursMlh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#be1e2d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#be1e2d" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke={isLight ? '#cbd5e1' : '#334155'} opacity={0.6} />
              <XAxis dataKey="dayLabel" stroke={isLight ? '#475569' : '#94a3b8'} fontSize={12} fontFamily="Montserrat" />
              <YAxis stroke={isLight ? '#475569' : '#94a3b8'} fontSize={12} unit="m" fontFamily="Montserrat" />
              <Tooltip
                contentStyle={{
                  backgroundColor: isLight ? '#ffffff' : '#0a0f1d',
                  borderColor: isLight ? '#0a0f1d' : '#ffffff',
                  borderWidth: '2px',
                  borderRadius: '4px',
                  color: isLight ? '#0a0f1d' : '#ffffff',
                  fontFamily: 'Montserrat',
                  fontSize: '12px',
                  fontWeight: '900',
                  boxShadow: '3px 3px 0px #000',
                }}
                formatter={(val: any) => [`${val} MINS (${(Number(val) / 60).toFixed(1)} HRS)`, 'STUDY TIME']}
              />
              <Area
                type="monotone"
                dataKey="studyMinutes"
                stroke="#be1e2d"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#studyHoursMlh)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Mastery Progression */}
      <div className="mlh-card p-8">
        <span className="mlh-badge bg-white text-black border-black">CHART 02 // MASTERY RATE</span>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pt-1">
          <div>
            <p className="mlh-card-subtitle">EBBINGHAUS SYNAPSE RETENTION</p>
            <h3 className="mlh-card-title text-2xl mb-0">MASTERY INDEX (%) OVER TIME</h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-tech font-bold uppercase">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-400 border border-black" /> MASTERY %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-purple-400 border border-black" /> REVIEWS
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke={isLight ? '#cbd5e1' : '#334155'} opacity={0.6} />
              <XAxis dataKey="dayLabel" stroke={isLight ? '#475569' : '#94a3b8'} fontSize={12} fontFamily="Montserrat" />
              <YAxis stroke={isLight ? '#475569' : '#94a3b8'} fontSize={12} domain={[0, 100]} fontFamily="Montserrat" />
              <Tooltip
                contentStyle={{
                  backgroundColor: isLight ? '#ffffff' : '#0a0f1d',
                  borderColor: isLight ? '#0a0f1d' : '#ffffff',
                  borderWidth: '2px',
                  borderRadius: '4px',
                  color: isLight ? '#0a0f1d' : '#ffffff',
                  fontFamily: 'Montserrat',
                  fontSize: '12px',
                  fontWeight: '900',
                  boxShadow: '3px 3px 0px #000',
                }}
              />
              <Line
                type="monotone"
                dataKey="masteryScore"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981' }}
                activeDot={{ r: 6 }}
                name="Mastery (%)"
              />
              <Line
                type="monotone"
                dataKey="cardsReviewed"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#a855f7' }}
                name="Cards Reviewed"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
