export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  sessionToken?: string;
  stats?: {
    totalWins: number;
    gameWins: Record<string, number>;
  };
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
  settingsSchema?: Record<string, any>;
  description?: string;
  supportsHaptics?: boolean;
  hapticProfile?: string;
  preferredOrientation?: 'portrait' | 'landscape';
  supportedOrientations?: ('portrait' | 'landscape')[];
  displayOrder?: number;
  featured?: boolean;
  hidden?: boolean;
  comingSoon?: boolean;
  accentColor?: string;
  accentDark?: string;
  badgeLabel?: string;
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
