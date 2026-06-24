import React, { useEffect } from 'react';
import { useStore } from '../shell/store';
import { wsClient } from '../shell/WebSocketClient';

interface GameLoaderProps {
    onOpenSettings: () => void;
}

const GameLoader: React.FC<GameLoaderProps> = ({ onOpenSettings }) => {
    const { room } = useStore();

    useEffect(() => {
        let isReady = false;

        const handleMessage = (event: MessageEvent) => {
            const iframe = document.getElementById('game-frame') as HTMLIFrameElement | null;
            if (!iframe || event.source !== iframe.contentWindow) {
                return;
            }

            const msg = event.data;
            if (!msg || typeof msg !== 'object') return;

            switch (msg.type) {
                case 'arcade:init':
                    isReady = true;
                    // Send initial state immediately
                    sendStateToIframe(iframe, useStore.getState());
                    break;
                case 'arcade:action':
                    wsClient.send('game.action', { type: msg.actionType, data: msg.actionData });
                    break;
                case 'arcade:achievement':
                    wsClient.send('game.action', {
                        type: 'UNLOCK_ACHIEVEMENT',
                        data: { achievementId: msg.achievementId }
                    });
                    break;
                case 'arcade:reset':
                    wsClient.send('room.reset', {});
                    break;
            }
        };

        const sendStateToIframe = (iframe: HTMLIFrameElement, state: any) => {
            if (!iframe.contentWindow) return;
            iframe.contentWindow.postMessage({
                type: 'arcade:update',
                room: state.room,
                player: state.player,
                publicState: state.publicGameState,
                privateState: state.privateGameState
            }, '*');
        };

        window.addEventListener('message', handleMessage);

        // Subscribe to store changes to push updates to the iframe
        const unsubscribeStore = useStore.subscribe((state) => {
            if (isReady) {
                const iframe = document.getElementById('game-frame') as HTMLIFrameElement | null;
                if (iframe) {
                    sendStateToIframe(iframe, state);
                }
            }
        });

        return () => {
            window.removeEventListener('message', handleMessage);
            unsubscribeStore();
        };
    }, []);

    if (!room) return null;

    // The BIOS points the iframe to the game's entry point served by the Kernel
    const gameUrl = `/games/${room.game.id}/${room.game.entry}`;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: '#000',
            zIndex: 100,
        }}>
            {/* Floating Settings Gear Icon */}
            <button
                onClick={onOpenSettings}
                style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 1000,
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                ⚙️
            </button>

            <iframe
                id="game-frame"
                src={gameUrl}
                sandbox="allow-scripts"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                }}
                allow="autoplay; gamepad; keyboard"
                title={room.game.name}
            />
        </div>
    );
};

export default GameLoader;
