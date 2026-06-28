import React from 'react';
import { Trophy } from 'lucide-react';
import { resolveAvatarColor } from '../../constants';
import { IdentityManager } from '../../IdentityManager';
import { wsClient } from '../../WebSocketClient';
import type { Player } from '../../../shared/types';

interface LobbyProfilePaneProps {
  player: Player;
  editName: string;
  setEditName: (val: string) => void;
  editColor: string;
  setEditColor: (val: string) => void;
  copiedId: boolean;
  handleCopyId: () => void;
  handleLogout: () => void;
  setPlayer: (p: Player) => void;
  isPortrait?: boolean;
}

const LobbyProfilePane: React.FC<LobbyProfilePaneProps> = ({
  player,
  editName,
  setEditName,
  editColor,
  setEditColor,
  copiedId,
  handleCopyId,
  handleLogout,
  setPlayer,
  isPortrait,
}) => {
  const avatarColors = ['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'];

  const handleSaveChanges = () => {
    if (editName.trim()) {
      const updatedPlayer = { ...player, name: editName, avatar: editColor };
      setPlayer(updatedPlayer);
      IdentityManager.savePlayer(updatedPlayer);
      wsClient.send('player.identify', updatedPlayer);
    }
  };

  return (
    <div className={isPortrait ? 'portrait-pane-wrap lobby-profile-tab' : 'lobby-profile-tab'}>
      {/* Global Stats card */}
      <div
        className="profile-stats-card"
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '16px',
          padding: isPortrait ? '12px 16px' : '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: isPortrait ? '48px' : '56px',
            height: isPortrait ? '48px' : '56px',
            borderRadius: '50%',
            background: resolveAvatarColor(player.avatar),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isPortrait ? '20px' : '24px',
            fontWeight: 900,
            border: '2px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          {player.name ? player.name[0].toUpperCase() : '?'}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: isPortrait ? '16px' : '18px', fontWeight: 900, color: '#fff' }}>{player.name}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: isPortrait ? '11px' : '12px',
              color: '#34d399',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            <Trophy size={14} />
            <span>{player.stats?.totalWins ?? 0} GLOBAL WINS</span>
          </div>
        </div>
      </div>

      <div className="lobby-profile-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="settings-modal-row">
          <label>Username</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="settings-modal-input"
            placeholder="Username"
          />
        </div>

        <div className="settings-modal-row">
          <label>Avatar Color</label>
          <div className="avatar-color-picker" style={{ gap: isPortrait ? '8px' : 'var(--space-s)' }}>
            {avatarColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditColor(c)}
                className={`avatar-color-circle ${editColor === c ? 'active' : ''}`}
                style={{
                  backgroundColor: resolveAvatarColor(c),
                  width: isPortrait ? '34px' : '32px',
                  height: isPortrait ? '34px' : '32px',
                }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleSaveChanges}
          className={`settings-modal-save-btn ${isPortrait ? 'portrait-save-btn' : ''}`}
          style={isPortrait ? undefined : { alignSelf: 'flex-start', width: 'max-content' }}
        >
          SAVE CHANGES
        </button>

        <div
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', marginTop: '8px' }}
        >
          <div
            className="settings-modal-row"
            style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}
          >
            <label>Player Account ID</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <input
                type="text"
                readOnly
                value={player.id}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  flex: 1,
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <button
                onClick={handleCopyId}
                type="button"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copiedId ? 'COPIED!' : 'COPY'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          type="button"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#ef4444',
            padding: '12px 20px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            marginTop: '8px',
            width: isPortrait ? '100%' : 'auto',
            textAlign: 'center',
          }}
        >
          LOGOUT
        </button>
      </div>
    </div>
  );
};

export default LobbyProfilePane;
