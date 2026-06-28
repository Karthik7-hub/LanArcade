import { create } from 'zustand';
import { useEffect } from 'react';

interface SettingsState {
  soundEffects: boolean;
  soundVolume: number;
  mute: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  highContrast: boolean;
  textScaling: 'normal' | 'large';
  currentTheme: string;
  mockPing: number;
  hapticsEnabled: boolean;
  hapticIntensity: 'soft' | 'normal' | 'strong';
  gameHaptics: boolean;
  systemHaptics: boolean;

  setSoundEffects: (val: boolean | ((prev: boolean) => boolean)) => void;
  setSoundVolume: (val: number | ((prev: number) => number)) => void;
  setMute: (val: boolean | ((prev: boolean) => boolean)) => void;
  setMasterVolume: (val: number | ((prev: number) => number)) => void;
  setSfxVolume: (val: number | ((prev: number) => number)) => void;
  setMusicVolume: (val: number | ((prev: number) => number)) => void;
  setHighContrast: (val: boolean | ((prev: boolean) => boolean)) => void;
  setTextScaling: (val: ('normal' | 'large') | ((prev: 'normal' | 'large') => 'normal' | 'large')) => void;
  setCurrentTheme: (val: string | ((prev: string) => string)) => void;
  setMockPing: (ping: number) => void;
  setHapticsEnabled: (val: boolean | ((prev: boolean) => boolean)) => void;
  setHapticIntensity: (val: ('soft' | 'normal' | 'strong') | ((prev: 'soft' | 'normal' | 'strong') => 'soft' | 'normal' | 'strong')) => void;
  setGameHaptics: (val: boolean | ((prev: boolean) => boolean)) => void;
  setSystemHaptics: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  soundEffects: localStorage.getItem('soundEffects') !== 'false',
  soundVolume: Number(localStorage.getItem('soundVolume') ?? '80'),
  mute: localStorage.getItem('soundMute') === 'true',
  masterVolume: Number(localStorage.getItem('masterVolume') ?? '80'),
  sfxVolume: Number(localStorage.getItem('sfxVolume') ?? '80'),
  musicVolume: Number(localStorage.getItem('musicVolume') ?? '80'),
  highContrast: localStorage.getItem('highContrast') === 'true',
  textScaling: (localStorage.getItem('textScaling') as 'normal' | 'large') ?? 'normal',
  currentTheme: localStorage.getItem('uiTheme') ?? 'slate',
  mockPing: 42,
  hapticsEnabled: localStorage.getItem('hapticsEnabled') !== 'false',
  hapticIntensity: (localStorage.getItem('hapticIntensity') as 'soft' | 'normal' | 'strong') ?? 'normal',
  gameHaptics: localStorage.getItem('gameHaptics') !== 'false',
  systemHaptics: localStorage.getItem('systemHaptics') !== 'false',

  setSoundEffects: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.soundEffects) : val;
      localStorage.setItem('soundEffects', String(next));
      localStorage.setItem('soundMute', String(!next));
      return { soundEffects: next, mute: !next };
    });
  },
  setSoundVolume: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.soundVolume) : val;
      localStorage.setItem('soundVolume', String(next));
      localStorage.setItem('masterVolume', String(next));
      return { soundVolume: next, masterVolume: next };
    });
  },
  setMute: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.mute) : val;
      localStorage.setItem('soundMute', String(next));
      localStorage.setItem('soundEffects', String(!next));
      return { mute: next, soundEffects: !next };
    });
  },
  setMasterVolume: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.masterVolume) : val;
      localStorage.setItem('masterVolume', String(next));
      localStorage.setItem('soundVolume', String(next));
      return { masterVolume: next, soundVolume: next };
    });
  },
  setSfxVolume: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.sfxVolume) : val;
      localStorage.setItem('sfxVolume', String(next));
      return { sfxVolume: next };
    });
  },
  setMusicVolume: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.musicVolume) : val;
      localStorage.setItem('musicVolume', String(next));
      return { musicVolume: next };
    });
  },
  setHighContrast: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.highContrast) : val;
      localStorage.setItem('highContrast', String(next));
      if (next) {
        document.documentElement.classList.add('high-contrast');
      } else {
        document.documentElement.classList.remove('high-contrast');
      }
      return { highContrast: next };
    });
  },
  setTextScaling: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.textScaling) : val;
      localStorage.setItem('textScaling', next);
      document.documentElement.setAttribute('data-text-scale', next);
      return { textScaling: next };
    });
  },
  setCurrentTheme: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.currentTheme) : val;
      localStorage.setItem('uiTheme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { currentTheme: next };
    });
  },
  setMockPing: (mockPing) => set({ mockPing }),
  setHapticsEnabled: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.hapticsEnabled) : val;
      localStorage.setItem('hapticsEnabled', String(next));
      return { hapticsEnabled: next };
    });
  },
  setHapticIntensity: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.hapticIntensity) : val;
      localStorage.setItem('hapticIntensity', next);
      return { hapticIntensity: next };
    });
  },
  setGameHaptics: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.gameHaptics) : val;
      localStorage.setItem('gameHaptics', String(next));
      return { gameHaptics: next };
    });
  },
  setSystemHaptics: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.systemHaptics) : val;
      localStorage.setItem('systemHaptics', String(next));
      return { systemHaptics: next };
    });
  },
}));

// Start the simulated ping jitter immediately once
setInterval(() => {
  const current = useSettingsStore.getState().mockPing;
  const delta = Math.floor(Math.random() * 9) - 4;
  const next = current + delta;
  if (next > 10 && next < 150) {
    useSettingsStore.setState({ mockPing: next });
  }
}, 3000);

/**
 * Encapsulates all user-preference settings with localStorage persistence using a shared Zustand store.
 */
export function useSettings() {
  const store = useSettingsStore();

  // Apply properties to root document element on first use
  useEffect(() => {
    if (store.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    document.documentElement.setAttribute('data-text-scale', store.textScaling);
    document.documentElement.setAttribute('data-theme', store.currentTheme);
  }, []);

  return {
    soundEffects: store.soundEffects,
    setSoundEffects: store.setSoundEffects,
    soundVolume: store.soundVolume,
    setSoundVolume: store.setSoundVolume,
    mute: store.mute,
    setMute: store.setMute,
    masterVolume: store.masterVolume,
    setMasterVolume: store.setMasterVolume,
    sfxVolume: store.sfxVolume,
    setSfxVolume: store.setSfxVolume,
    musicVolume: store.musicVolume,
    setMusicVolume: store.setMusicVolume,
    highContrast: store.highContrast,
    setHighContrast: store.setHighContrast,
    textScaling: store.textScaling,
    setTextScaling: store.setTextScaling,
    currentTheme: store.currentTheme,
    setCurrentTheme: store.setCurrentTheme,
    mockPing: store.mockPing,
    hapticsEnabled: store.hapticsEnabled,
    setHapticsEnabled: store.setHapticsEnabled,
    hapticIntensity: store.hapticIntensity,
    setHapticIntensity: store.setHapticIntensity,
    gameHaptics: store.gameHaptics,
    setGameHaptics: store.setGameHaptics,
    systemHaptics: store.systemHaptics,
    setSystemHaptics: store.setSystemHaptics,
  };
}
