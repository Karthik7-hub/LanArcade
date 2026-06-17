import React from 'react';
import { useStore } from '../shell/store';

const GameLoader: React.FC = () => {
    const { room } = useStore();

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
