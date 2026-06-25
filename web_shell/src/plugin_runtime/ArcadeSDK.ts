import { useStore } from '../shell/store';
import { wsClient } from '../shell/WebSocketClient';
import { HapticManager } from './HapticManager';

let activeSubscriptions: (() => void)[] = [];

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

    haptics: {
        trigger: (type: string) => {
            HapticManager.trigger(type, true);
        }
    },

    returnToLobby: () => {
        wsClient.send('room.reset', {});
    },

    onUpdate: (callback: () => void) => {
        const unsubscribe = useStore.subscribe(callback);
        activeSubscriptions.push(unsubscribe);
        
        const iframe = document.getElementById('game-frame') as HTMLIFrameElement | null;
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.addEventListener('unload', () => {
                unsubscribe();
                activeSubscriptions = activeSubscriptions.filter(fn => fn !== unsubscribe);
            });
        }
        
        return () => {
            unsubscribe();
            activeSubscriptions = activeSubscriptions.filter(fn => fn !== unsubscribe);
        };
    },

    clearSubscriptions: () => {
        activeSubscriptions.forEach((unsub) => {
            try {
                unsub();
            } catch (_) {}
        });
        activeSubscriptions = [];
    }
};


