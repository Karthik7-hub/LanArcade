import React, { useState } from 'react';
import { Settings, Gamepad2, Trophy, Wifi } from 'lucide-react';
import { useStore } from '../store';
import { wsClient } from '../WebSocketClient';
import { resolveAvatarColor } from '../constants';
import type { GameManifest } from '../../shared/types';

interface HomeScreenProps {
  availableGames: GameManifest[];
  onOpenSettings: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ availableGames, onOpenSettings }) => {
  const player = useStore((s) => s.player);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  if (!player) return null;

  const handleCreateRoom = (gameId: string) => {
    wsClient.send('room.create', { gameId, settings: {} });
  };

  const handleJoinRoom = () => {
    if (roomCodeInput.trim()) {
      wsClient.send('room.join', { code: roomCodeInput });
    }
  };

  return (
    <div className="home-screen">
      <div className="home-body">
        {/* LEFT PANEL – Header, Profile, and Join */}
        <div className="home-left-panel">
          <div className="home-brand-header" style={{ padding: '0 4px 8px' }}>
            <h1 className="home-title">LAN ARCADE</h1>
            <p className="home-subtitle">Welcome to the local multiplayer arena</p>
          </div>

          <div className="home-profile-card">
            <div
              className="home-profile-avatar"
              style={{ background: resolveAvatarColor(player.avatar) }}
            >
              {player.name[0].toUpperCase()}
              <span className="home-profile-online-dot" />
            </div>
            <div className="home-profile-info">
              <div className="home-profile-name">{player.name}</div>
              <div className="home-profile-wins">
                <Trophy size={11} />
                <span>{player.stats?.totalWins ?? 0} GLOBAL WINS</span>
              </div>
            </div>
            <button
              className="home-settings-btn"
              onClick={onOpenSettings}
              title="Settings"
            >
              <Settings size={15} />
            </button>
          </div>

          <div className="home-join-card">
            <div className="home-join-eyebrow">
              <Wifi size={14} />
              <span>JOIN ROOM</span>
            </div>
            <h2 className="home-join-heading">Have a room code?</h2>
            <p className="home-join-desc">Ask your host to share their room code, then enter it below.</p>

            <div className="home-join-field">
              <span className="home-join-hash">#</span>
              <input
                id="home-room-code-input"
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                placeholder="Enter Room Code"
                className="home-join-input"
                maxLength={4}
                autoComplete="off"
              />
            </div>

            <button
              id="home-join-room-btn"
              onClick={handleJoinRoom}
              className="home-join-btn"
            >
              <span>JOIN ROOM</span>
              <span className="home-join-arrow">→</span>
            </button>

            <div className="home-join-hint">
              <Wifi size={12} />
              <span>Make sure you're on the same Wi-Fi as your friends.</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL – Games list */}
        <div className="home-right-panel">
          <div className="home-games-header" style={{ paddingBottom: '4px' }}>
            <div className="home-games-label">Available Games</div>
          </div>
          <div className="home-game-scroll-area">
            <div className="home-game-grid">
              {availableGames.map((game) => {
                const isUno = game.id === 'uno';
                const accentColor = isUno ? '#ec4899' : '#6366f1';
                const accentDark = isUno ? '#be185d' : '#4f46e5';
                const badgeLabel = isUno ? 'CARD GAME' : 'CO-OP';
                const gameDesc = game.description
                  ? game.description.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').trim()
                  : null;

                return (
                  <div
                    key={game.id}
                    className={`home-game-card${selectedGame === game.id ? ' hovered' : ''}`}
                    style={{ '--card-accent': accentColor, '--card-accent-dark': accentDark } as React.CSSProperties}
                    onMouseEnter={() => setSelectedGame(game.id)}
                    onMouseLeave={() => setSelectedGame(null)}
                  >
                    <div className="home-game-thumb">
                      {game.thumbnail ? (
                        <img src={game.thumbnail} alt={game.name} className="home-game-thumb-img" />
                      ) : (
                        <div className="home-game-thumb-fallback">
                          <Gamepad2 size={44} />
                        </div>
                      )}
                      <span className="home-game-badge" style={{ background: accentColor }}>{badgeLabel}</span>
                      <span className="home-game-playercount">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {game.minPlayers}–{game.maxPlayers}
                      </span>
                    </div>

                    <div className="home-game-body">
                      <div className="home-game-identity">
                        <div className="home-game-icon" style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}>
                          <Gamepad2 size={17} style={{ color: accentColor }} />
                        </div>
                        <div>
                          <div className="home-game-name">{game.name}</div>
                          <div className="home-game-playcount" style={{ color: accentColor }}>
                            {game.minPlayers}–{game.maxPlayers} PLAYERS
                          </div>
                        </div>
                      </div>

                      {gameDesc && <p className="home-game-desc">{gameDesc}</p>}

                      <button
                        id={`home-play-btn-${game.id}`}
                        onClick={() => handleCreateRoom(game.id)}
                        className="home-game-play-btn"
                        style={{
                          background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
                          boxShadow: `0 4px 16px ${accentColor}50`,
                        }}
                      >
                        <span>PLAY</span>
                        <span style={{ fontSize: '15px' }}>→</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {availableGames.length === 0 && (
                <div className="home-empty-state">
                  <Gamepad2 size={36} />
                  <span>No games available. Start the server first.</span>
                </div>
              )}
            </div>

            {availableGames.length > 0 && (
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
