/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WellnessSeed {
  id: string;
  title: string;
  description: string;
  category: 'physical' | 'mental' | 'social' | 'spiritual';
  estimatedTime: string;
}

export interface DailyLog {
  date: string;
  mood: number; // 1-5
  energy: number; // 1-5
  gratitude: string[];
  seedCompleted: boolean;
  sleepHours?: number;
  affirmation?: string;
  aiReflection?: string;
}

export interface UserState {
  name: string;
  logs: DailyLog[];
  selectedIcon?: string;
  currentSeed?: WellnessSeed;
  lastSeedDate?: string;
  notificationEnabled?: boolean;
  notificationTime?: string;
}
