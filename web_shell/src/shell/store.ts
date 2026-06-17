import { create } from 'zustand';
import { Player, Room } from '../shared/types';

interface ArcadeState {
  player: Player | null;
  room: Room | null;
  publicGameState: any | null;
  privateGameState: any | null;
  isConnected: boolean;

  setPlayer: (player: Player) => void;
  setRoom: (room: Room | null) => void;
  setPublicGameState: (state: any) => void;
  setPrivateGameState: (state: any) => void;
  setConnected: (connected: boolean) => void;
}

export const useStore = create<ArcadeState>((set) => ({
  player: null,
  room: null,
  publicGameState: null,
  privateGameState: null,
  isConnected: false,

  setPlayer: (player) => set({ player }),
  setRoom: (room) => set({ room }),
  setPublicGameState: (publicGameState) => set({ publicGameState }),
  setPrivateGameState: (privateGameState) => set({ privateGameState }),
  setConnected: (isConnected) => set({ isConnected }),
}));
