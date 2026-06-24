import { create } from 'zustand';
import { useEffect } from 'react';

interface SettingsState {
  soundEffects: boolean;
  soundVolume: number;
  highContrast: boolean;
  textScaling: 'normal' | 'large';
  currentTheme: string;
  mockPing: number;

  setSoundEffects: (val: boolean | ((prev: boolean) => boolean)) => void;
  setSoundVolume: (val: number | ((prev: number) => number)) => void;
  setHighContrast: (val: boolean | ((prev: boolean) => boolean)) => void;
  setTextScaling: (val: ('normal' | 'large') | ((prev: 'normal' | 'large') => 'normal' | 'large')) => void;
  setCurrentTheme: (val: string | ((prev: string) => string)) => void;
  setMockPing: (ping: number) => void;
}

const useSettingsStore = create<SettingsState>((set) => ({
  soundEffects: localStorage.getItem('soundEffects') !== 'false',
  soundVolume: Number(localStorage.getItem('soundVolume') ?? '80'),
  highContrast: localStorage.getItem('highContrast') === 'true',
  textScaling: (localStorage.getItem('textScaling') as 'normal' | 'large') ?? 'normal',
  currentTheme: localStorage.getItem('uiTheme') ?? 'slate',
  mockPing: 42,

  setSoundEffects: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.soundEffects) : val;
      localStorage.setItem('soundEffects', String(next));
      return { soundEffects: next };
    });
  },
  setSoundVolume: (val) => {
    set((state) => {
      const next = typeof val === 'function' ? val(state.soundVolume) : val;
      localStorage.setItem('soundVolume', String(next));
      return { soundVolume: next };
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
    highContrast: store.highContrast,
    setHighContrast: store.setHighContrast,
    textScaling: store.textScaling,
    setTextScaling: store.setTextScaling,
    currentTheme: store.currentTheme,
    setCurrentTheme: store.setCurrentTheme,
    mockPing: store.mockPing,
  };
}
