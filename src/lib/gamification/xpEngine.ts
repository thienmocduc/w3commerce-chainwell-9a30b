import { createServiceClient } from '@/lib/supabase/server';

export const XP_ACTIONS = {
  purchase: 100,
  writeReview: 50,
  shareProduct: 25,
  referFriend: 200,
  completeCourseLesson: 50,
  completeCourse: 500,
  passKOCExam: 1000,
  dailyLogin: 10,
  firstPurchase: 500,
} as const;

export type XPAction = keyof typeof XP_ACTIONS;

export const LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7500, 15000, 30000];

export function getLevelFromXP(xp: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, LEVEL_THRESHOLDS.length);
}

export function getProgressToNextLevel(xp: number): {
  current: number;
  required: number;
  percent: number;
} {
  const level = getLevelFromXP(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  const current = xp - currentThreshold;
  const required = nextThreshold - currentThreshold;
  const percent = required > 0 ? Math.min(Math.round((current / required) * 100), 100) : 100;

  return { current, required, percent };
}

export function getLevelBadge(level: number): string {
  if (level <= 2) return 'Bronze';
  if (level <= 4) return 'Silver';
  if (level <= 6) return 'Gold';
  return 'Diamond';
}

/**
 * Award XP to a user and handle level-up logic
 */
export async function awardXP(
  userId: string,
  action: XPAction,
  _metadata?: Record<string, unknown>
): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
  const supabase = await createServiceClient();
  const amount = XP_ACTIONS[action];

  // Fetch current user
  const { data: user } = await supabase
    .from('users')
    .select('xp_points, level')
    .eq('id', userId)
    .single();

  if (!user) throw new Error('User not found');

  const newXP = user.xp_points + amount;
  const newLevel = getLevelFromXP(newXP);
  const leveledUp = newLevel > user.level;

  // Update user
  await supabase
    .from('users')
    .update({ xp_points: newXP, level: newLevel })
    .eq('id', userId);

  return { newXP, newLevel, leveledUp };
}
