import React, { useEffect } from 'react';
import { useStore } from '../shell/store';
import { ArcadeSDK } from './ArcadeSDK';

interface GameLoaderProps {
    onOpenSettings: () => void;
}

const GameLoader: React.FC<GameLoaderProps> = ({ onOpenSettings }) => {
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
