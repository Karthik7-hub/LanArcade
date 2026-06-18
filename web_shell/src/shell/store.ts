import { create } from 'zustand';
import { Player, Room } from '../shared/types';

interface ArcadeState {
  player: Player | null;
  room: Room | null;
  publicGameState: any | null;
  privateGameState: any | null;
  isConnected: boolean;
  debugLogs: string[];
  errorAlert: string | null;

  setPlayer: (player: Player) => void;
  setRoom: (room: Room | null) => void;
  setPublicGameState: (state: any) => void;
  setPrivateGameState: (state: any) => void;
  setConnected: (connected: boolean) => void;
  addDebugLog: (log: string) => void;
  clearDebugLogs: () => void;
  setErrorAlert: (error: string | null) => void;
}

export const useStore = create<ArcadeState>((set) => ({
  player: null,
  room: null,
  publicGameState: null,
  privateGameState: null,
  isConnected: false,
  debugLogs: [],
  errorAlert: null,

  setPlayer: (player) => set({ player }),
  setRoom: (room) => set({ room }),
  setPublicGameState: (publicGameState) => set({ publicGameState }),
  setPrivateGameState: (privateGameState) => set({ privateGameState }),
  setConnected: (isConnected) => set({ isConnected }),
  addDebugLog: (log) => set((state) => ({ debugLogs: [log, ...state.debugLogs].slice(0, 50) })),
  clearDebugLogs: () => set({ debugLogs: [] }),
  setErrorAlert: (errorAlert) => set({ errorAlert }),
}));

