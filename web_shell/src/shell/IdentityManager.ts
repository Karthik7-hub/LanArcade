import { v4 as uuidv4 } from 'uuid';
import { Player } from '../shared/types';

const STORAGE_KEY = 'arcade_player_identity';

export class IdentityManager {
  static getPlayer(): Player | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse identity', e);
      }
    }
    return null;
  }

  static savePlayer(player: Player) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
  }

  static createDefault(name: string): Player {
    const player: Player = {
      id: uuidv4(),
      name,
      avatar: 'default',
      isHost: false
    };
    this.savePlayer(player);
    return player;
  }
}
