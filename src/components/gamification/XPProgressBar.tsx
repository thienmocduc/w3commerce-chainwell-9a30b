'use client';

// Client-side XP calculation (no server imports)
const LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 7500, 15000, 30000];

function getProgressToNextLevel(xp: number) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const current = xp - currentThreshold;
  const required = nextThreshold - currentThreshold;
  const percent = required > 0 ? Math.min(Math.round((current / required) * 100), 100) : 100;
  return { current, required, percent };
}

function getLevelBadge(level: number): string {
  if (level <= 2) return 'Bronze';
  if (level <= 4) return 'Silver';
  if (level <= 6) return 'Gold';
  return 'Diamond';
}

interface XPProgressBarProps {
  xp: number;
  level: number;
}

export function XPProgressBar({ xp, level }: XPProgressBarProps) {
  const progress = getProgressToNextLevel(xp);
  const badge = getLevelBadge(level);

  const badgeColors: Record<string, string> = {
    Bronze: 'bg-amber-700 text-amber-100',
    Silver: 'bg-gray-400 text-gray-900',
    Gold: 'bg-yellow-500 text-yellow-900',
    Diamond: 'bg-cyan-400 text-cyan-900',
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${badgeColors[badge] ?? ''}`}>
        Lv.{level} {badge}
      </span>
      <div className="flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">
        {xp} XP
      </span>
    </div>
  );
}
