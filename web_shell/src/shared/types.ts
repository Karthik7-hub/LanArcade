export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
}

export interface GameManifest {
  id: string;
  name: string;
  version: string;
  sdkVersion: string;
  permissions: string[];
  author: string;
  entry: string;
  minPlayers: number;
  maxPlayers: number;
  thumbnail?: string;
}

export type RoomStatus = 'waiting' | 'active' | 'finished';

export interface Room {
  id: string;
  code: string;
  game: GameManifest;
  players: Player[];
  spectators: Player[];
  hostId: string;
  status: RoomStatus;
  settings: Record<string, any>;
  publicGameState?: Record<string, any>;
  createdAt: string;
}

export interface PlatformEvent {
  type: string;
  payload: any;
}
