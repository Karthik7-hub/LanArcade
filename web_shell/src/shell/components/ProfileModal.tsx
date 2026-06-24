import React, { useState, useEffect } from 'react';
import { User, X, Trophy } from 'lucide-react';
import { useStore } from '../store';
import { useConfirm } from './ConfirmDialog';
import { wsClient } from '../WebSocketClient';
import { IdentityManager } from '../IdentityManager';
import { resolveAvatarColor } from '../constants';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const player = useStore((s) => s.player);
  const setPlayer = useStore((s) => s.setPlayer);
  const confirm = useConfirm();

  const [editName, setEditName] = useState(player?.name || '');
  const [editColor, setEditColor] = useState(player?.avatar || 'default');
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (player) {
      setEditName(player.name);
      setEditColor(player.avatar);
    }
  }, [player]);

  if (!isOpen || !player) return null;

  const saveProfile = () => {
    if (editName.trim()) {
      const updatedPlayer = { ...player!, name: editName, avatar: editColor };
      setPlayer(updatedPlayer);
      IdentityManager.savePlayer(updatedPlayer);
      wsClient.send('player.identify', updatedPlayer);
      onClose();
    }
  };

  const handleCopyId = () => {
    if (player?.id) {
      navigator.clipboard.writeText(player.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'LOGOUT',
      message: 'Are you sure you want to log out? This clears local session keys.',
    });
    if (ok) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal-card profile-modal-card">
        <div className="settings-tab-header" style={{ justifyContent: 'space-between', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={20} className="tab-header-icon" />
            <h3>EDIT PROFILE</h3>
          </span>
          <button onClick={onClose} className="settings-floating-close-btn" style={{ display: 'block', position: 'static' }}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-modal-body" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Global Stats card */}
          <div className="profile-stats-card" style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: resolveAvatarColor(player.avatar),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 900,
              border: '2px solid rgba(255, 255, 255, 0.3)',
            }}>
              {player.name[0].toUpperCase()}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>{player.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#34d399', fontWeight: 700, marginTop: '4px' }}>
                <Trophy size={14} />
                <span>{player.stats?.totalWins ?? 0} GLOBAL WINS</span>
              </div>
            </div>
          </div>

          <div className="settings-modal-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <label>Username</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="settings-modal-input"
              placeholder="Username"
            />
          </div>

          <div className="settings-modal-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            <label>Avatar Color</label>
            <div className="avatar-color-picker">
              {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={`avatar-color-circle ${editColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: resolveAvatarColor(c) }}
                />
              ))}
            </div>
          </div>

          <button onClick={saveProfile} className="settings-modal-save-btn" style={{ width: '100%' }}>
            SAVE CHANGES
          </button>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
            <div className="settings-modal-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
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
              borderStyle: 'solid',
            }}
          >
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
