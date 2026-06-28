const HAPTIC_PATTERNS: Record<string, number[]> = {
  button: [10],
  click: [10],
  selection: [15],
  heavy: [40],
  notification: [15, 30, 15],
  success: [20, 40, 20],
  error: [40, 40, 80],
  turn: [20],
  card_play: [5],
  card_draw: [8],
  player_join: [15, 30, 20],
  player_leave: [20, 40, 10],
  checkpoint: [25],
  achievement: [30, 40, 30, 40, 50],
  win: [40, 50, 40, 50, 80, 50, 80],
  lose: [80, 80, 40]
};

export const HapticManager = {
  trigger: (type: string, isGameEvent: boolean = true) => {
    try {
      const hapticsEnabled = localStorage.getItem('hapticsEnabled') !== 'false';
      const gameHaptics = localStorage.getItem('gameHaptics') !== 'false';
      const systemHaptics = localStorage.getItem('systemHaptics') !== 'false';
      const hapticIntensity = localStorage.getItem('hapticIntensity') || 'normal';

      if (!hapticsEnabled) return;
      if (isGameEvent && !gameHaptics) return;
      if (!isGameEvent && !systemHaptics) return;

      const basePattern = HAPTIC_PATTERNS[type];
      if (!basePattern) {
        console.warn(`[Haptics] Unknown haptic type requested: ${type}`);
        return;
      }

      // Calculate scaling multiplier based on intensity setting
      let multiplier = 1.0;
      if (hapticIntensity === 'soft') multiplier = 0.5;
      if (hapticIntensity === 'strong') multiplier = 1.5;

      // Scale active vibration segments (even indices). Leave silent gaps (odd indices) untouched.
      const pattern = basePattern.map((dur, index) => {
        if (index % 2 === 0) {
          return Math.max(1, Math.round(dur * multiplier));
        }
        return dur;
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
        console.log(`[Haptics] Triggered "${type}" haptic with pattern [${pattern.join(', ')}]`);
      } else {
        console.log(`[Haptics] navigator.vibrate not supported (type: ${type})`);
      }
    } catch (err) {
      console.error('[Haptics] Error triggering vibration:', err);
    }
  }
};
