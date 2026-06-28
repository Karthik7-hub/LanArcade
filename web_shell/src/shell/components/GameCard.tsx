import React from 'react';
import { Gamepad2 } from 'lucide-react';
import type { GameManifest } from '../../shared/types';

interface GameCardProps {
  game: GameManifest;
  variant: 'default' | 'featured' | 'compact';
  onPlay: (gameId: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isSelected?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({
  game,
  variant,
  onPlay,
  onMouseEnter,
  onMouseLeave,
  isSelected,
}) => {
  // Resolve customizations from manifest or fall back to defaults
  const accentColor = game.accentColor || (game.id === 'uno' ? '#ec4899' : '#6366f1');
  const accentDark = game.accentDark || (game.id === 'uno' ? '#be185d' : '#4f46e5');
  const badgeLabel = game.badgeLabel || (game.id === 'uno' ? 'CARD GAME' : 'CO-OP');
  
  const gameDesc = game.description
    ? game.description.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').trim()
    : null;

  if (variant === 'featured') {
    return (
      <div
        className="home-game-card portrait-featured-card"
        style={{ '--card-accent': accentColor, '--card-accent-dark': accentDark } as React.CSSProperties}
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
            onClick={() => onPlay(game.id)}
            className="home-game-play-btn"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
              boxShadow: `0 4px 16px ${accentColor}50`,
              marginTop: '8px'
            }}
          >
            <span>PLAY GAME</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className="home-game-card portrait-grid-card"
        style={{ '--card-accent': accentColor, '--card-accent-dark': accentDark } as React.CSSProperties}
      >
        <div className="home-game-thumb" style={{ aspectRatio: '4/3' }}>
          {game.thumbnail ? (
            <img src={game.thumbnail} alt={game.name} className="home-game-thumb-img" />
          ) : (
            <div className="home-game-thumb-fallback">
              <Gamepad2 size={28} />
            </div>
          )}
          <span className="home-game-badge" style={{ background: accentColor, fontSize: '8px', padding: '2px 6px' }}>{badgeLabel}</span>
          <span className="home-game-playercount" style={{ fontSize: '8.5px', padding: '2px 6px' }}>
            {game.minPlayers}–{game.maxPlayers}
          </span>
        </div>
        <div className="home-game-body" style={{ padding: '10px', gap: '6px' }}>
          <div className="home-game-name" style={{ fontSize: '13px' }}>{game.name}</div>
          <button
            id={`home-play-btn-${game.id}`}
            onClick={() => onPlay(game.id)}
            className="home-game-play-btn"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
              boxShadow: `0 3px 10px ${accentColor}40`,
              padding: '8px 10px',
              fontSize: '11px',
              borderRadius: '8px',
            }}
          >
            <span>PLAY</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  // default variant
  return (
    <div
      className={`home-game-card${isSelected ? ' hovered' : ''}`}
      style={{ '--card-accent': accentColor, '--card-accent-dark': accentDark } as React.CSSProperties}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
          onClick={() => onPlay(game.id)}
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
};

export default GameCard;
