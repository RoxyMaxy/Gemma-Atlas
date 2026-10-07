import {
  UserProfile,
  CourseSession,
  FlashcardState,
  DailyStudyMetric,
} from './types';

const STORAGE_KEYS = {
  USER_PROFILE: 'mlh_study_user_profile_v2',
  COURSE_SESSIONS: 'mlh_study_course_sessions_v2',
  ACTIVE_SESSION_ID: 'mlh_study_active_session_id_v2',
  STUDY_STREAK: 'mlh_study_streak_v2',
  STUDY_HISTORY: 'mlh_study_history_v2',
};

export class StorageService {
  public static getUserProfile(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static saveUserProfile(profile: UserProfile): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  }

  public static getSessions(): CourseSession[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.COURSE_SESSIONS);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      
      // Auto-purge any obsolete sessions that have legacy "taxonomic" or "state space" text
      const cleaned = list.filter((s: CourseSession) => {
        if (!s || !Array.isArray(s.roadmap)) return false;
        const isLegacyMock = s.roadmap.some((st: any) => {
          const combined = `${st.chapterTitle || ''} ${st.subChapter || ''} ${st.hierarchyTitle || ''}`.toLowerCase();
          return combined.includes('taxonomic') || combined.includes('state space');
        });
        return !isLegacyMock;
      });

      if (cleaned.length !== list.length) {
        this.saveSessions(cleaned);
        const currentActiveId = this.getActiveSessionId();
        if (currentActiveId && !cleaned.some((s) => s.id === currentActiveId)) {
          if (cleaned.length > 0) {
            this.setActiveSessionId(cleaned[0].id);
          } else {
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
          }
        }
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  public static saveSessions(sessions: CourseSession[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.COURSE_SESSIONS, JSON.stringify(sessions));
  }

  public static getActiveSessionId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  }

  public static setActiveSessionId(id: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, id);
  }

  public static saveSession(session: CourseSession): void {
    const list = this.getSessions();
    const idx = list.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      list[idx] = session;
    } else {
      list.unshift(session);
    }
    this.saveSessions(list);
    this.setActiveSessionId(session.id);
  }

  public static deleteSession(id: string): void {
    const list = this.getSessions().filter((s) => s.id !== id);
    this.saveSessions(list);
    if (this.getActiveSessionId() === id) {
      const nextId = list.length > 0 ? list[0].id : '';
      if (nextId) this.setActiveSessionId(nextId);
      else if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    }
  }

  /**
   * Leitner Box Spaced Repetition Scheduling:
   * Box 1: 1 day
   * Box 2: 3 days
   * Box 3: 7 days
   * Box 4: 14 days
   * Box 5: 30 days
   */
  public static calculateLeitnerNextReview(
    card: FlashcardState,
    remembered: boolean
  ): { leitnerBox: number; nextReviewDate: number } {
    let newBox = remembered ? Math.min(5, card.leitnerBox + 1) : 1;
    const boxIntervalDays = [1, 3, 7, 14, 30][newBox - 1] || 1;
    const nextDate = Date.now() + boxIntervalDays * 86400000;

    return {
      leitnerBox: newBox,
      nextReviewDate: nextDate,
    };
  }

  public static getStreakData(): { streak: number; lastDate: string } {
    if (typeof window === 'undefined') return { streak: 1, lastDate: new Date().toISOString() };
    const raw = localStorage.getItem(STORAGE_KEYS.STUDY_STREAK);
    if (!raw) return { streak: 1, lastDate: new Date().toISOString() };
    try {
      return JSON.parse(raw);
    } catch {
      return { streak: 1, lastDate: new Date().toISOString() };
    }
  }

  public static recordStudyActivity(): number {
    const data = this.getStreakData();
    const today = new Date().toISOString().split('T')[0];
    const lastDay = data.lastDate ? data.lastDate.split('T')[0] : '';

    if (today === lastDay) {
      return data.streak;
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = 1;
    if (lastDay === yesterday) {
      newStreak = data.streak + 1;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEYS.STUDY_STREAK,
        JSON.stringify({ streak: newStreak, lastDate: new Date().toISOString() })
      );
    }
    return newStreak;
  }

  public static getStudyHistory(): DailyStudyMetric[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.STUDY_HISTORY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }

    const days: DailyStudyMetric[] = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = dayNames[d.getDay()];
      const baseMinutes = i === 0 ? 40 : [30, 45, 60, 25, 50, 70][i % 6];
      const baseMastery = Math.min(98, 60 + (6 - i) * 6);

      days.push({
        date: dateStr,
        dayLabel,
        studyMinutes: baseMinutes,
        studyHours: Number((baseMinutes / 60).toFixed(1)),
        masteryScore: baseMastery,
        cardsReviewed: 8 + (6 - i) * 4,
        quizzesCompleted: 1 + (i % 2),
        stepsCompleted: 1 + Math.floor((6 - i) / 2),
      });
    }

    this.saveStudyHistory(days);
    return days;
  }

  public static saveStudyHistory(history: DailyStudyMetric[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.STUDY_HISTORY, JSON.stringify(history));
  }

  public static logStudyMinutes(minutes: number, masteryBoost: number = 3): DailyStudyMetric[] {
    const list = this.getStudyHistory();
    const todayStr = new Date().toISOString().split('T')[0];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayLabel = dayNames[new Date().getDay()];

    const existingIdx = list.findIndex((item) => item.date === todayStr);
    if (existingIdx >= 0) {
      const current = list[existingIdx];
      const newMinutes = current.studyMinutes + minutes;
      list[existingIdx] = {
        ...current,
        studyMinutes: newMinutes,
        studyHours: Number((newMinutes / 60).toFixed(1)),
        masteryScore: Math.min(100, current.masteryScore + masteryBoost),
      };
    } else {
      list.push({
        date: todayStr,
        dayLabel,
        studyMinutes: minutes,
        studyHours: Number((minutes / 60).toFixed(1)),
        masteryScore: Math.min(100, 65 + masteryBoost),
        cardsReviewed: 6,
        quizzesCompleted: 1,
        stepsCompleted: 1,
      });
    }

    this.saveStudyHistory(list);
    this.recordStudyActivity();
    return list;
  }
}
