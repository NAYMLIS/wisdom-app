import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface MeditationSession {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  timestamp: number; // milliseconds
  duration: number; // minutes
  preset: string; // e.g., "ocean", "forest"
  moodBefore?: 'anxious' | 'neutral' | 'calm';
  moodAfter?: 'calm' | 'clear' | 'energized';
}

export interface UserData {
  lastMeditationDate?: string; // ISO date (YYYY-MM-DD)
  currentStreak: number;
  totalSessions: number;
  totalMinutes: number;
  sessions: MeditationSession[];
  freePassesUsed: number; // tracks monthly free pass for streak
}

const STORAGE_KEY = '@lanita_user_data';

const DEFAULT_USER_DATA: UserData = {
  currentStreak: 0,
  totalSessions: 0,
  totalMinutes: 0,
  sessions: [],
  freePassesUsed: 0,
};

// Utility: Get storage backend (AsyncStorage or localStorage)
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
    };
  }
  return AsyncStorage;
};

export const userDataService = {
  // Load user data from storage
  async loadUserData(): Promise<UserData> {
    try {
      const storage = getStorage();
      const data = await storage.getItem(STORAGE_KEY);
      if (!data) {
        return DEFAULT_USER_DATA;
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load user data:', error);
      return DEFAULT_USER_DATA;
    }
  },

  // Save user data to storage
  async saveUserData(data: UserData): Promise<void> {
    try {
      const storage = getStorage();
      await storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  },

  // Log a completed meditation session
  async logMeditationSession(
    duration: number,
    preset: string,
    moodBefore?: 'anxious' | 'neutral' | 'calm',
    moodAfter?: 'calm' | 'clear' | 'energized'
  ): Promise<MeditationSession> {
    const data = await this.loadUserData();
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0]; // YYYY-MM-DD

    const session: MeditationSession = {
      id: `session_${Date.now()}`,
      date: todayISO,
      timestamp: now.getTime(),
      duration,
      preset,
      moodBefore,
      moodAfter,
    };

    // Add session to history
    data.sessions.push(session);
    data.totalSessions += 1;
    data.totalMinutes += duration;

    // Update streak
    const lastDate = data.lastMeditationDate;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split('T')[0];

    if (lastDate === todayISO) {
      // Already meditated today, don't change streak
    } else if (lastDate === yesterdayISO) {
      // Continuation of streak
      data.currentStreak += 1;
    } else {
      // Break in streak, reset to 1
      data.currentStreak = 1;
    }

    data.lastMeditationDate = todayISO;

    // Save updated data
    await this.saveUserData(data);

    return session;
  },

  // Get current streak
  async getStreak(): Promise<number> {
    const data = await this.loadUserData();
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0];

    // Check if they've meditated today or yesterday
    if (data.lastMeditationDate === todayISO || data.lastMeditationDate) {
      const lastDate = new Date(data.lastMeditationDate!);
      const daysSinceLastSession = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // If more than 1 day has passed, streak is broken
      if (daysSinceLastSession > 1) {
        return 0;
      }
    }

    return data.currentStreak;
  },

  // Get stats for display
  async getStats(): Promise<{ streak: number; totalSessions: number; totalMinutes: number }> {
    const data = await this.loadUserData();
    const streak = await this.getStreak();

    return {
      streak,
      totalSessions: data.totalSessions,
      totalMinutes: data.totalMinutes,
    };
  },

  // Get sessions from last N days
  async getRecentSessions(days: number = 7): Promise<MeditationSession[]> {
    const data = await this.loadUserData();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString().split('T')[0];

    return data.sessions.filter((s) => s.date >= cutoffISO);
  },

  // Clear all data (for testing)
  async clearAllData(): Promise<void> {
    const storage = getStorage();
    await storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USER_DATA));
  },
};
