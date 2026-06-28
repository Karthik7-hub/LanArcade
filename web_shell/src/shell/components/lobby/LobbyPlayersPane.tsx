import React from 'react';
import { Eye } from 'lucide-react';
import { resolveAvatarColor } from '../../constants';
import type { Room } from '../../../shared/types';

interface LobbyPlayersPaneProps {
  room: Room;
  isPortrait?: boolean;
}

const LobbyPlayersPane: React.FC<LobbyPlayersPaneProps> = ({ room, isPortrait }) => {
  if (isPortrait) {
    return (
      <div className="portrait-pane-wrap">
        <div className="player-list-header">
          <h3 className="card-title">PLAYERS IN LOBBY</h3>
          <span className="player-count">
            {room.players.length} / {room.game.maxPlayers}
          </span>
        </div>
        <div className="portrait-players-chips">
          {room.players.map((p) => (
            <div key={p.id} className="portrait-player-chip">
              <div
                className="portrait-player-avatar"
                style={{
                  background: resolveAvatarColor(p.avatar),
                }}
              >
                {p.name ? p.name[0].toUpperCase() : '?'}
              </div>
              <span className="portrait-player-name">{p.name}</span>
              {p.id === room.hostId && <span className="host-badge">HOST</span>}
            </div>
          ))}
        </div>
        {room.spectators && room.spectators.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="player-list-header">
              <h3 className="card-title">SPECTATORS ({room.spectators.length})</h3>
            </div>
            <div className="portrait-players-chips">
              {room.spectators.map((p) => (
                <div key={p.id} className="portrait-player-chip spectator-chip">
                  <div
                    className="portrait-player-avatar spectator-avatar"
                    style={{
                      background: resolveAvatarColor(p.avatar),
                    }}
                  >
                    <Eye size={12} />
                  </div>
                  <span className="portrait-player-name">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Landscape original representation
  return (
    <>
      <div className="player-list-header">
        <h3 className="card-title">PLAYERS IN LOBBY</h3>
        <span className="player-count">
          {room.players.length} / {room.game.maxPlayers}
        </span>
      </div>
      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id} className="player-item">
            <div
              className="player-avatar"
              style={{
                background: resolveAvatarColor(p.avatar),
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {p.name ? p.name[0].toUpperCase() : '?'}
            </div>
            <span className="player-name">{p.name}</span>
            {p.id === room.hostId && <span className="host-badge">HOST</span>}
          </li>
        ))}
      </ul>
      {room.spectators && room.spectators.length > 0 && (
        <>
          <div className="player-list-header" style={{ marginTop: 24 }}>
            <h3 className="card-title">SPECTATORS ({room.spectators.length})</h3>
          </div>
          <ul className="player-list">
            {room.spectators.map((p) => (
              <li key={p.id} className="player-item spectator-item">
                <div
                  className="player-avatar spectator-avatar"
                  style={{
                    background: resolveAvatarColor(p.avatar),
                  }}
                >
                  <Eye size={14} />
                </div>
                <span className="player-name">{p.name} (Spectating)</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};

export default LobbyPlayersPane;
