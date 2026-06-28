import React from 'react';
import type { Room } from '../../../shared/types';
import { audioManager } from '../../../plugin_runtime/AudioManager';

interface LobbySystemPaneProps {
  mute: boolean;
  setMute: (val: boolean | ((prev: boolean) => boolean)) => void;
  masterVolume: number;
  setMasterVolume: (val: number) => void;
  sfxVolume: number;
  setSfxVolume: (val: number) => void;
  musicVolume: number;
  setMusicVolume: (val: number) => void;
  isFullscreen: boolean;
  handleToggleFullscreen: () => void;
  currentTheme: string;
  setCurrentTheme: (val: string) => void;
  handleLogout: () => void;
  isPortrait?: boolean;
}

const LobbySystemPane: React.FC<LobbySystemPaneProps> = ({
  mute,
  setMute,
  masterVolume,
  setMasterVolume,
  sfxVolume,
  setSfxVolume,
  musicVolume,
  setMusicVolume,
  isFullscreen,
  handleToggleFullscreen,
  currentTheme,
  setCurrentTheme,
  handleLogout,
  isPortrait,
}) => {
  return (
    <div
      className={isPortrait ? 'portrait-pane-wrap settings-content-pane' : 'settings-content-pane'}
      style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div>
        {!isPortrait && (
          <h4
            className="pane-title"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 12 }}
          >
            SYSTEM SETTINGS
          </h4>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            className="pane-control-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div className="pane-control-label">
              <strong style={{ fontSize: 13, color: '#fff' }}>Mute All Audio</strong>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                Silence all game and UI audio
              </p>
            </div>
            <input
              type="checkbox"
              checked={mute}
              onChange={() => {
                setMute((prev) => !prev);
                audioManager.playUI('click');
              }}
              className="pane-checkbox"
            />
          </div>

          <div
            className="pane-control-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div className="pane-control-label">
              <strong style={{ fontSize: 13, color: '#fff' }}>Master Volume ({masterVolume}%)</strong>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Overall system volume level</p>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="pane-slider"
              style={{ width: isPortrait ? 90 : 100 }}
            />
          </div>

          <div
            className="pane-control-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div className="pane-control-label">
              <strong style={{ fontSize: 13, color: '#fff' }}>SFX Volume ({sfxVolume}%)</strong>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Game and UI feedback volume</p>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume}
              onChange={(e) => setSfxVolume(Number(e.target.value))}
              className="pane-slider"
              style={{ width: isPortrait ? 90 : 100 }}
            />
          </div>

          <div
            className="pane-control-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div className="pane-control-label">
              <strong style={{ fontSize: 13, color: '#fff' }}>Music Volume ({musicVolume}%)</strong>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Background music volume</p>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="pane-slider"
              style={{ width: isPortrait ? 90 : 100 }}
            />
          </div>

          <div
            className="pane-control-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div className="pane-control-label">
              <strong style={{ fontSize: 13, color: '#fff' }}>Fullscreen Presentation</strong>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                Toggle client window fullscreen
              </p>
            </div>
            <button
              onClick={handleToggleFullscreen}
              className="pane-button"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {isFullscreen ? 'DISABLE' : 'ENABLE'}
            </button>
          </div>

          <div
            className="pane-control-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div className="pane-control-label">
              <strong style={{ fontSize: 13, color: '#fff' }}>Interface Theme</strong>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Visual style of the lobby</p>
            </div>
            <select
              value={currentTheme}
              onChange={(e) => setCurrentTheme(e.target.value)}
              className="pane-select"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="slate">SLATE NEON</option>
              <option value="cyberpunk">CYBERPUNK GLOW</option>
              <option value="forest">FOREST SHADOW</option>
              <option value="sunset">SUNSET GLOW</option>
            </select>
          </div>

          <div
            className="pane-control-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(239, 68, 68, 0.05)',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px dashed rgba(239,68,68,0.3)',
            }}
          >
            <div className="pane-control-label">
              <strong style={{ fontSize: 13, color: '#ef4444' }}>Logout</strong>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(239,68,68,0.7)' }}>
                Sign out of your profile and clear local cache
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: '#ef4444',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              LOGOUT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbySystemPane;
