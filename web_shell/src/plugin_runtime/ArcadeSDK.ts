import { useStore } from '../shell/store';
import { wsClient } from '../shell/WebSocketClient';

/**
 * The Global SDK exposed to games.
 */
export const ArcadeSDK = {
    getRoom: () => useStore.getState().room,
    getPlayer: () => useStore.getState().player,
    getPublicState: () => useStore.getState().publicGameState,
    getPrivateState: () => useStore.getState().privateGameState,

    sendAction: (type: string, data: any) => {
        wsClient.send('game.action', { type, data });
    },

    unlockAchievement: (achievementId: string) => {
        wsClient.send('game.action', {
            type: 'UNLOCK_ACHIEVEMENT',
            data: { achievementId }
        });
    },

    onUpdate: (callback: () => void) => {
        return useStore.subscribe(callback);
    }
};

// Expose to window so the Iframe (Game) can access it via window.parent.Arcade
(window as any).Arcade = ArcadeSDK;
