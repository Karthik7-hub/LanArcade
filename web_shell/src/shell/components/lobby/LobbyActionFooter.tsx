import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { wsClient } from '../../WebSocketClient';
import type { Room, Player } from '../../../shared/types';

interface LobbyActionFooterProps {
  room: Room;
  player: Player;
  setIsViewingLobby: (val: boolean) => void;
  isPortrait?: boolean;
}

const LobbyActionFooter: React.FC<LobbyActionFooterProps> = ({
  room,
  player,
  setIsViewingLobby,
  isPortrait,
}) => {
  const handleStartMatch = () => {
    wsClient.send('game.action', { type: 'START', data: {} });
  };

  const handleRejoinMatch = () => {
    setIsViewingLobby(false);
    localStorage.setItem('isViewingLobby', 'false');
  };

  const isHost = player.id === room.hostId;
  const hasMinPlayers = room.players.length >= room.game.minPlayers;

  if (room.status !== 'waiting') {
    return (
      <button
        onClick={handleRejoinMatch}
        className={`start-button-vertical rejoin ${isPortrait ? 'portrait-lobby-action-btn' : ''}`}
      >
        <Gamepad2 size={18} />
        <span>REJOIN MATCH</span>
      </button>
    );
  }

  if (isHost) {
    return (
      <div style={{ width: '100%' }}>
        <button
          onClick={handleStartMatch}
          disabled={!hasMinPlayers}
          className={`start-button-vertical ${!hasMinPlayers ? 'disabled' : ''} ${isPortrait ? 'portrait-lobby-action-btn' : ''}`}
        >
          START MATCH
        </button>
        {!hasMinPlayers ? (
          <p className="start-hint-vertical error" style={isPortrait ? { marginTop: '8px' } : undefined}>
            Need {room.game.minPlayers} players to start (Current: {room.players.length})
          </p>
        ) : (
          <p className="start-hint-vertical" style={isPortrait ? { marginTop: '8px' } : undefined}>Ready to start match!</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="waiting-host-wrap-vertical"
      style={isPortrait ? { width: '100%', padding: '12px' } : { width: '100%' }}
    >
      <div
        className="app-spinner-small"
        style={{
          width: '16px',
          height: '16px',
          border: '2px solid transparent',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      <p className="wait-label-vertical" style={isPortrait ? { fontSize: '12px' } : undefined}>
        Waiting for host to start...
      </p>
    </div>
  );
};

export default LobbyActionFooter;
