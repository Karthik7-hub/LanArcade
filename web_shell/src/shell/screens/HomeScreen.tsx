import React, { useState } from 'react';
import { Settings, Gamepad2 } from 'lucide-react';
import { useStore } from '../store';
import { wsClient } from '../WebSocketClient';
import type { GameManifest } from '../../shared/types';
import ProfileCard from '../components/ProfileCard';
import JoinCard from '../components/JoinCard';
import GameCard from '../components/GameCard';

interface HomeScreenProps {
  availableGames: GameManifest[];
  onOpenSettings: () => void;
  isPortrait?: boolean;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ availableGames, onOpenSettings, isPortrait }) => {
  const player = useStore((s) => s.player);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const visibleGames = availableGames
    .filter((game) => !game.hidden)
    .sort((a, b) => {
      const orderA = a.displayOrder !== undefined ? a.displayOrder : Infinity;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : Infinity;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return a.id.localeCompare(b.id);
    });

  if (!player) return null;

  const handleCreateRoom = (gameId: string) => {
    wsClient.send('room.create', { gameId, settings: {} });
  };

  const handleJoinRoom = () => {
    if (roomCodeInput.trim()) {
      wsClient.send('room.join', { code: roomCodeInput });
    }
  };

  // Find the featured game marked in the manifest, fallback to first sorted game
  const featuredGame = visibleGames.find((g) => g.featured) || visibleGames[0];
  const catalogGames = visibleGames.filter((g) => g.id !== featuredGame?.id);

  return (
    <div className={`home-screen ${isPortrait ? 'is-portrait' : 'is-landscape'}`}>
      {/* Top Header bar for Portrait mode */}
      <div className="home-header-bar">
        <div>
          <h1 className="home-title">LAN ARCADE</h1>
          <p className="home-subtitle">Local multiplayer arena</p>
        </div>
        <button
          className="home-portrait-settings-btn"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>

      <div className="home-body">
        {/* LEFT PANEL – Profile and Join */}
        <div className="home-left-panel">
          <div className="home-panel-header-desktop">
            <h1 className="home-title">LAN ARCADE</h1>
            <p className="home-subtitle">Welcome to the local multiplayer arena</p>
          </div>

          <ProfileCard
            player={player}
            onOpenSettings={onOpenSettings}
            isPortrait={isPortrait}
          />

          <JoinCard
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            handleJoinRoom={handleJoinRoom}
            isPortrait={isPortrait}
          />
        </div>

        {/* RIGHT PANEL – Games catalog */}
        <div className="home-right-panel">
          <div className="home-games-header">
            <div className="home-games-label">
              {isPortrait ? 'Featured Game' : 'Available Games'}
            </div>
          </div>
          
          <div className="home-game-scroll-area">
            {isPortrait ? (
              <div className="home-portrait-catalog-layout">
                {featuredGame && (
                  <GameCard
                    game={featuredGame}
                    variant="featured"
                    onPlay={handleCreateRoom}
                  />
                )}
                {catalogGames.length > 0 && (
                  <>
                    <div className="home-games-label" style={{ marginTop: '20px', marginBottom: '10px' }}>
                      More Games
                    </div>
                    <div className="home-portrait-game-grid">
                      {catalogGames.map((game) => (
                        <GameCard
                          key={game.id}
                          game={game}
                          variant="compact"
                          onPlay={handleCreateRoom}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="home-game-grid">
                {visibleGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    variant="default"
                    isSelected={selectedGame === game.id}
                    onMouseEnter={() => setSelectedGame(game.id)}
                    onMouseLeave={() => setSelectedGame(null)}
                    onPlay={handleCreateRoom}
                  />
                ))}
              </div>
            )}

            {visibleGames.length === 0 && (
              <div className="home-empty-state">
                <Gamepad2 size={36} />
                <span>No games available. Start the server first.</span>
              </div>
            )}

            {visibleGames.length > 0 && !isPortrait && (
              <div className="home-games-footer">
                <span>★</span>
                <span>More games coming soon. Stay tuned!</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
