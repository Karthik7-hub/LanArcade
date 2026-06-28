import React, { useState, useEffect } from 'react';
import {
  Settings, X, Gamepad2, Maximize2, Volume2, VolumeX,
  Wifi, Database, Accessibility, Info, LogOut
} from 'lucide-react';
import { useStore } from '../store';
import { useSettings } from '../hooks/useSettings';
import { useFullscreen } from '../hooks/useFullscreen';
import { useConfirm } from './ConfirmDialog';
import { wsClient, clearRoomFromUrl } from '../WebSocketClient';
import { IdentityManager } from '../IdentityManager';
import { resolveAvatarColor } from '../constants';
import { audioManager } from '../../plugin_runtime/AudioManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isViewingLobby: boolean;
  setIsViewingLobby: (v: boolean) => void;
  isPortrait?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, isViewingLobby, setIsViewingLobby, isPortrait,
}) => {
  const room = useStore((s) => s.room);
  const player = useStore((s) => s.player);
  const setPlayer = useStore((s) => s.setPlayer);
  const isConnected = useStore((s) => s.isConnected);
  const confirm = useConfirm();

  const {
    mute, setMute,
    masterVolume, setMasterVolume,
    sfxVolume, setSfxVolume,
    musicVolume, setMusicVolume,
    highContrast, setHighContrast,
    textScaling, setTextScaling,
    currentTheme, setCurrentTheme,
    mockPing,
    hapticsEnabled, setHapticsEnabled,
    hapticIntensity, setHapticIntensity,
    gameHaptics, setGameHaptics,
    systemHaptics, setSystemHaptics,
  } = useSettings();

  const { isFullscreen, toggleFullscreen, attemptFullscreen } = useFullscreen();

  const [activeTab, setActiveTab] = useState<
    'gameplay' | 'audio' | 'display' | 'network' | 'storage' | 'accessibility' | 'about'
  >('gameplay');

  // Profile editing (local to this modal)
  const [editName, setEditName] = useState(player?.name || '');
  const [editColor, setEditColor] = useState(player?.avatar || 'default');

  useEffect(() => {
    if (isOpen && player) {
      setEditName(player.name);
      setEditColor(player.avatar);
    }
  }, [isOpen, player]);

  if (!isOpen) return null;

  const handleUpdateSetting = (key: string, value: any) => {
    if (!room || !player || player.id !== room.hostId) return;
    const currentSettings = room.settings || {};
    const newSettings = { ...currentSettings, [key]: value };
    if (room.game.settingsSchema && 'preset' in room.game.settingsSchema && key !== 'preset') {
      newSettings['preset'] = 'custom';
    }
    wsClient.send('room.update_settings', { settings: newSettings });
  };

  const handleLeaveMatch = async () => {
    const ok = await confirm({
      title: 'RETURN TO LOBBY',
      message: 'Are you sure you want to leave the active match? You can rejoin later.',
    });
    if (ok) {
      setIsViewingLobby(true);
      localStorage.setItem('isViewingLobby', 'true');
      onClose();
      attemptFullscreen();
    }
  };

  const handleLeaveRoomReal = async () => {
    const ok = await confirm({
      title: 'LEAVE ROOM',
      message: 'Are you sure you want to leave the room?',
    });
    if (ok) {
      wsClient.send('room.leave', {});
      clearRoomFromUrl();
      const store = useStore.getState();
      store.setRoom(null);
      store.setPublicGameState(null);
      store.setPrivateGameState(null);
      onClose();
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'LOGOUT',
      message: 'Are you sure you want to log out? This will erase your saved name, avatar selections, and local stats.',
    });
    if (ok) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const categoriesList = [
    { id: 'gameplay', name: 'Gameplay', icon: <Gamepad2 size={16} /> },
    { id: 'audio', name: 'Audio & Haptics', icon: <Volume2 size={16} /> },
    { id: 'display', name: 'Display', icon: <Maximize2 size={16} /> },
    { id: 'network', name: 'Network', icon: <Wifi size={16} /> },
    { id: 'storage', name: 'Storage', icon: <Database size={16} /> },
    { id: 'accessibility', name: 'Accessibility', icon: <Accessibility size={16} /> },
    { id: 'about', name: 'About', icon: <Info size={16} /> },
  ];

  return (
    <div className="settings-modal-overlay">
      <div className={`console-settings-card ${isPortrait ? 'portrait-modal' : ''}`}>
        {/* Header */}
        <div className="console-settings-header">
          <span className="console-settings-title-wrap">
            <Settings size={20} className="tab-header-icon" />
            <h3>SYSTEM SETTINGS</h3>
          </span>
          <button onClick={() => { onClose(); audioManager.playUI('click'); }} className="console-settings-close-btn">
            <X size={20} />
          </button>
        </div>

        <div className={`console-settings-layout ${isPortrait ? 'portrait-console' : ''}`}>
          {/* Sidebar */}
          <div className="console-settings-sidebar">
            {categoriesList.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveTab(cat.id as any);
                  audioManager.playUI('nav');
                }}
                className={`console-settings-sidebar-btn ${activeTab === cat.id ? 'active' : ''}`}
              >
                {cat.icon}
                <span>{cat.name.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* Content Panel */}
          <div className="console-settings-content">
            {activeTab === 'gameplay' && (
              <div className="settings-content-pane">
                <h4 className="pane-title">GAMEPLAY CONFIGURATION</h4>
                {room ? (
                  <div className="pane-section">
                    <div className="pane-info-row">
                      <span className="pane-info-label">Active Room:</span>
                      <span className="pane-info-value font-mono text-secondary" style={{ color: '#ec4899' }}>{room.code}</span>
                    </div>
                    <div className="pane-info-row">
                      <span className="pane-info-label">Game:</span>
                      <span className="pane-info-value">{room.game.name}</span>
                    </div>
                    {player?.id === room.hostId ? (
                      <div className="pane-control-card">
                        <div className="pane-control-label">
                          <strong>Win on Abandonment</strong>
                          <p>Automatically declare wins if other players disconnect</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={room.settings?.winOnAbandonment ?? true}
                          onChange={() => handleUpdateSetting('winOnAbandonment', !(room.settings?.winOnAbandonment ?? true))}
                          className="pane-checkbox"
                        />
                      </div>
                    ) : (
                      <div className="pane-info-text text-muted" style={{ color: '#94a3b8', fontSize: 12, marginTop: 12 }}>
                        You are currently a guest in this room. Rules are managed by the host.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pane-info-text" style={{ color: '#94a3b8', fontSize: 12 }}>
                    No active room session. Join or create a room to configure gameplay options.
                  </div>
                )}
                <div className="pane-actions-footer" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {room && room.status === 'active' && !isViewingLobby && (
                    <button onClick={handleLeaveMatch} className="pane-footer-btn return-btn">
                      <Gamepad2 size={16} />
                      <span>RETURN TO LOBBY</span>
                    </button>
                  )}
                  {room && (
                    <button onClick={handleLeaveRoomReal} className="pane-footer-btn abandon-btn">
                      <LogOut size={16} />
                      <span>ABANDON MATCH / LEAVE ROOM</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="settings-content-pane">
                <h4 className="pane-title">AUDIO & HAPTICS SETTINGS</h4>
                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>Mute All Audio</strong>
                    <p>Silence all game and UI sound effects</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => {
                        const nextMute = !mute;
                        setMute(nextMute);
                        audioManager.playUI('click');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: mute ? 'var(--danger)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px'
                      }}
                    >
                      {mute ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="checkbox"
                      checked={mute}
                      onChange={(e) => {
                        setMute(e.target.checked);
                        audioManager.playUI('click');
                      }}
                      className="pane-checkbox"
                    />
                  </div>
                </div>
                <div className="pane-control-card slider-card">
                  <div className="pane-control-label">
                    <strong>Master Volume</strong>
                    <p>Overall system volume level ({masterVolume}%)</p>
                  </div>
                  <div className="pane-slider-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={masterVolume}
                      onChange={(e) => setMasterVolume(Number(e.target.value))}
                      className="pane-slider"
                    />
                  </div>
                </div>
                <div className="pane-control-card slider-card">
                  <div className="pane-control-label">
                    <strong>Sound Effects Volume</strong>
                    <p>Game and UI interaction sound level ({sfxVolume}%)</p>
                  </div>
                  <div className="pane-slider-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sfxVolume}
                      onChange={(e) => setSfxVolume(Number(e.target.value))}
                      className="pane-slider"
                    />
                  </div>
                </div>
                <div className="pane-control-card slider-card">
                  <div className="pane-control-label">
                    <strong>Music Volume</strong>
                    <p>Background music volume level ({musicVolume}%)</p>
                  </div>
                  <div className="pane-slider-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={musicVolume}
                      onChange={(e) => setMusicVolume(Number(e.target.value))}
                      className="pane-slider"
                    />
                  </div>
                </div>

                <div style={{ margin: '16px 0 8px 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Haptic Feedback</span>
                </div>

                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>Enable Haptics</strong>
                    <p>Vibrate device on key platform and game actions</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hapticsEnabled}
                    onChange={() => setHapticsEnabled((prev) => !prev)}
                    className="pane-checkbox"
                  />
                </div>

                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>Intensity</strong>
                    <p>Adjust the strength of vibration taps</p>
                  </div>
                  <select
                    value={hapticIntensity}
                    onChange={(e) => setHapticIntensity(e.target.value as any)}
                    className="pane-select"
                    disabled={!hapticsEnabled}
                  >
                    <option value="soft">SOFT</option>
                    <option value="normal">NORMAL</option>
                    <option value="strong">STRONG</option>
                  </select>
                </div>

                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>Game Haptics</strong>
                    <p>Allow games to trigger gameplay haptics</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={gameHaptics}
                    onChange={() => setGameHaptics((prev) => !prev)}
                    className="pane-checkbox"
                    disabled={!hapticsEnabled}
                  />
                </div>

                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>System Haptics</strong>
                    <p>Vibrate on dashboard, lobbies, and UI transitions</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemHaptics}
                    onChange={() => setSystemHaptics((prev) => !prev)}
                    className="pane-checkbox"
                    disabled={!hapticsEnabled}
                  />
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="settings-content-pane">
                <h4 className="pane-title">DISPLAY & PERFORMANCE</h4>
                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>Fullscreen Mode</strong>
                    <p>Toggle client window fullscreen presentation</p>
                  </div>
                  <button onClick={toggleFullscreen} className="pane-button">
                    {isFullscreen ? 'DISABLE' : 'ENABLE'}
                  </button>
                </div>
                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>Interface Theme</strong>
                    <p>Change the visual look of the platform</p>
                  </div>
                  <select
                    value={currentTheme}
                    onChange={(e) => setCurrentTheme(e.target.value)}
                    className="pane-select"
                  >
                    <option value="slate">SLATE NEON</option>
                    <option value="cyberpunk">CYBERPUNK GLOW</option>
                    <option value="forest">FOREST SHADOW</option>
                    <option value="sunset">SUNSET GLOW</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'network' && (
              <div className="settings-content-pane">
                <h4 className="pane-title">NETWORK TELEMETRY</h4>
                <div className="pane-info-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="pane-info-label" style={{ color: '#94a3b8', fontSize: 13 }}>Server Connection:</span>
                  <span className="pane-info-value font-bold" style={{ color: isConnected ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: 13 }}>
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
                <div className="pane-info-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="pane-info-label" style={{ color: '#94a3b8', fontSize: 13 }}>WebSocket Host:</span>
                  <span className="pane-info-value font-mono" style={{ fontSize: 13, fontFamily: 'monospace' }}>{window.location.host}</span>
                </div>
                <div className="pane-info-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="pane-info-label" style={{ color: '#94a3b8', fontSize: 13 }}>Signal Latency:</span>
                  <span className="pane-info-value font-mono" style={{ fontSize: 13, fontFamily: 'monospace' }}>{isConnected ? `${mockPing}ms` : 'N/A'}</span>
                </div>
              </div>
            )}

            {activeTab === 'storage' && (
              <div className="settings-content-pane">
                <h4 className="pane-title">IDENTITY & STORAGE</h4>
                <div className="settings-modal-row" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Username</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="settings-modal-input"
                    placeholder="Username"
                  />
                </div>
                <div className="settings-modal-row" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Avatar Color</label>
                  <div className="avatar-color-picker" style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`avatar-color-circle ${editColor === c ? 'active' : ''}`}
                        style={{
                          backgroundColor: resolveAvatarColor(c),
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          border: editColor === c ? '2.5px solid #fff' : '2.5px solid transparent',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (editName.trim() && player) {
                      const updatedPlayer = { ...player, name: editName, avatar: editColor };
                      setPlayer(updatedPlayer);
                      IdentityManager.savePlayer(updatedPlayer);
                      wsClient.send('player.identify', updatedPlayer);
                    }
                  }}
                  className="settings-modal-save-btn"
                  style={{ marginTop: 12, alignSelf: 'flex-start', width: 'max-content' }}
                >
                  SAVE PROFILE
                </button>
                <div className="pane-control-card" style={{ marginTop: 'auto', border: '1px dashed rgba(239,68,68,0.3)', padding: 12, background: 'rgba(239,68,68,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="pane-control-label">
                    <strong>Logout</strong>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Sign out of your profile and clear local cache</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="pane-button danger-btn"
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 850 }}
                  >
                    LOGOUT
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'accessibility' && (
              <div className="settings-content-pane">
                <h4 className="pane-title">ACCESSIBILITY OPTIONS</h4>
                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>High Contrast</strong>
                    <p>Increase color distinction and borders for clarity</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={() => setHighContrast((prev) => !prev)}
                    className="pane-checkbox"
                  />
                </div>
                <div className="pane-control-card">
                  <div className="pane-control-label">
                    <strong>Text Size Scale</strong>
                    <p>Adjust sizing layout for readable texts</p>
                  </div>
                  <select
                    value={textScaling}
                    onChange={(e) => setTextScaling(e.target.value as any)}
                    className="pane-select"
                  >
                    <option value="normal">NORMAL</option>
                    <option value="large">LARGE (+20%)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="settings-content-pane">
                <h4 className="pane-title">ABOUT PLATFORM</h4>
                <div className="pane-about-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="pane-about-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src="/logo.png" alt="LAN Arcade" className="pane-about-logo" />
                    <div>
                      <h5 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>LAN ARCADE CORE</h5>
                      <p className="text-muted" style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>v1.0.0 (Official Release)</p>
                    </div>
                  </div>
                  <p className="pane-about-desc" style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                    LAN Arcade is a zero-latency, local multiplayer web-and-mobile-integrated retro platform.
                    Designed for offline console play, it allows players to join with a single code and play synchronously using mobile controllers.
                  </p>
                  <div className="pane-info-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', marginTop: 'auto' }}>
                    <span className="pane-info-label" style={{ color: '#94a3b8', fontSize: 12 }}>SDK Target:</span>
                    <span className="pane-info-value font-mono" style={{ fontSize: 12, fontFamily: 'monospace' }}>v1.0.0</span>
                  </div>
                  <div className="pane-info-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="pane-info-label" style={{ color: '#94a3b8', fontSize: 12 }}>Developer Group:</span>
                    <span className="pane-info-value" style={{ fontSize: 12 }}>Advanced Agentic Coding Group</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
