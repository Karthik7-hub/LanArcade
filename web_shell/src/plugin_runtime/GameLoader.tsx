import React, { useEffect } from 'react';
import { useStore } from '../shell/store';
import { ArcadeSDK } from './ArcadeSDK';
import { wsClient } from '../shell/WebSocketClient';

const GameLoader: React.FC = () => {
    const { room } = useStore();

    useEffect(() => {
        return () => {
            console.log('Cleaning up game sdk subscriptions...');
            ArcadeSDK.clearSubscriptions();
        };
    }, [room?.game.id]);

    if (!room) return null;

    // The BIOS points the iframe to the game's entry point served by the Kernel
    const gameUrl = `/games/${room.game.id}/${room.game.entry}`;

    const handleLeaveRoom = () => {
        if (window.confirm("Are you sure you want to leave the match?")) {
            wsClient.send('room.leave', {});
            window.history.replaceState({}, '', window.location.pathname);
            window.location.reload();
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: '#000',
            zIndex: 100,
        }}>
            <button
                onClick={handleLeaveRoom}
                style={{
                    position: 'absolute',
                    top: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    padding: '8px 16px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '20px',
                    color: '#f8fafc',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.9)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
            >
                🚪 LEAVE MATCH
            </button>
            <iframe
                id="game-frame"
                src={gameUrl}
                sandbox="allow-scripts allow-same-origin"
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

