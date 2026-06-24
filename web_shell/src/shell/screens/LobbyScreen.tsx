import React, { useState, useEffect } from 'react';
import {
  User,
  Settings,
  Gamepad2,
  Trophy,
  Eye,
  Lock,
  HelpCircle,
  Volume2,
  Wifi,
  Copy,
  LogOut,
  Minus,
  Plus,
} from 'lucide-react';
import { useStore } from '../store';
import { useConfirm } from '../components/ConfirmDialog';
import { useSettings } from '../hooks/useSettings';
import { useFullscreen } from '../hooks/useFullscreen';
import { wsClient, clearRoomFromUrl } from '../WebSocketClient';
import { resolveAvatarColor, stripEmojis } from '../constants';
import { IdentityManager } from '../IdentityManager';
import type { GameManifest } from '../../shared/types';

interface LobbyScreenProps {
  availableGames: GameManifest[];
  isViewingLobby: boolean;
  setIsViewingLobby: (val: boolean) => void;
  onOpenSettings: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({
  availableGames,
  isViewingLobby,
  setIsViewingLobby,
  onOpenSettings,
}) => {
  const room = useStore((state) => state.room);
  const player = useStore((state) => state.player);
  const setPlayer = useStore((state) => state.setPlayer);

  const confirm = useConfirm();

  const {
    soundEffects,
    setSoundEffects,
    soundVolume,
    setSoundVolume,
    currentTheme,
    setCurrentTheme,
  } = useSettings();

  const { isFullscreen, toggleFullscreen: handleToggleFullscreen } = useFullscreen();

  // Vertical Tab state
  const [lobbyTab, setLobbyTab] = useState<'players' | 'leaderboard' | 'rules' | 'profile' | 'settings'>('players');

  // Interactive tooltip state for rules
  const [activeRuleTooltip, setActiveRuleTooltip] = useState<string | null>(null);

  // Invitation link copy indicator
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

  // Player ID copy indicator
  const [copiedId, setCopiedId] = useState(false);

  // Profile forms local states
  const [editName, setEditName] = useState(player?.name || '');
  const [editColor, setEditColor] = useState(player?.avatar || 'default');

  // Synchronize local edit states when player changes
  useEffect(() => {
    if (player) {
      setEditName(player.name);
      setEditColor(player.avatar);
    }
  }, [player]);

  if (!room || !player) return null;

  const handleLeaveRoom = async () => {
    const ok = await confirm({
      title: 'LEAVE ROOM',
      message: 'Are you sure you want to leave the room?',
    });
    if (ok) {
      wsClient.send('room.leave', {});
      clearRoomFromUrl();
      window.location.reload();
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

  const handleCopyId = () => {
    navigator.clipboard.writeText(player.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdateSetting = (key: string, value: any) => {
    if (player.id !== room.hostId) return;
    const currentSettings = room.settings || {};
    const newSettings = { ...currentSettings, [key]: value };

    // Auto-update presets if custom settings are modified
    if (room.game.settingsSchema && 'preset' in room.game.settingsSchema && key !== 'preset') {
      newSettings['preset'] = 'custom';
    }

    wsClient.send('room.update_settings', { settings: newSettings });
  };

  const handlePresetChange = (preset: string) => {
    if (player.id !== room.hostId) return;
    const schemaPreset = room.game.settingsSchema?.preset;
    let presetSettings: Record<string, any> = { preset };
    if (schemaPreset && schemaPreset.values && schemaPreset.values[preset]) {
      presetSettings = {
        ...presetSettings,
        ...schemaPreset.values[preset],
      };
    } else {
      presetSettings = { ...room.settings, preset };
    }
    wsClient.send('room.update_settings', { settings: presetSettings });
  };

  return (
    <div className="full-screen" style={{ padding: 0 }}>
      <div className="waiting-container">
        {/* LEFT DASHBOARD PANEL */}
        <div className="lobby-dashboard-left">
          {/* Top Room Code & Copy */}
          <div className="dashboard-room-section">
            <div className="room-code-badge">#{room.code}</div>
            <button
              onClick={() => {
                const inviteUrl = `${window.location.origin}/?room=${room.code}`;
                navigator.clipboard.writeText(inviteUrl);
                setCopiedRoomLink(true);
                setTimeout(() => setCopiedRoomLink(false), 2000);
              }}
              className="lobby-copy-btn-new"
              title="Copy Invite Link"
            >
              <Copy size={13} style={{ color: '#3b82f6' }} />
              <span>{copiedRoomLink ? 'COPIED!' : 'COPY LINK'}</span>
            </button>
          </div>

          {/* Tabs List */}
          <div className="dashboard-tabs">
            <button
              onClick={() => setLobbyTab('players')}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'players' ? 'active' : ''}`}
            >
              <User size={14} />
              <span>PLAYERS ({room.players.length})</span>
            </button>
            <button
              onClick={() => setLobbyTab('leaderboard')}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'leaderboard' ? 'active shadow-pink' : ''}`}
            >
              <Trophy size={14} />
              <span>LEADERBOARD</span>
            </button>
            <button
              onClick={() => setLobbyTab('rules')}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'rules' ? 'active shadow-green' : ''}`}
            >
              <HelpCircle size={14} />
              <span>RULES & INFO</span>
            </button>
            <button
              onClick={() => setLobbyTab('profile')}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'profile' ? 'active shadow-indigo' : ''}`}
            >
              <User size={14} />
              <span>PROFILE</span>
            </button>
            <button
              onClick={() => setLobbyTab('settings')}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'settings' ? 'active' : ''}`}
            >
              <Settings size={14} />
              <span>SETTINGS</span>
            </button>
          </div>

          {/* Start Section (integrated) */}
          <div className="dashboard-start-section">
            {room.status !== 'waiting' ? (
              <button
                onClick={() => {
                  setIsViewingLobby(false);
                  localStorage.setItem('isViewingLobby', 'false');
                }}
                className="start-button-vertical rejoin"
              >
                <Gamepad2 size={18} />
                <span>REJOIN MATCH</span>
              </button>
            ) : player.id === room.hostId ? (
              <>
                <button
                  onClick={() => wsClient.send('game.action', { type: 'START', data: {} })}
                  disabled={room.players.length < room.game.minPlayers}
                  className={`start-button-vertical ${room.players.length < room.game.minPlayers ? 'disabled' : ''}`}
                >
                  START MATCH
                </button>
                {room.players.length < room.game.minPlayers ? (
                  <p className="start-hint-vertical error">
                    Need {room.game.minPlayers} players to start (Current: {room.players.length})
                  </p>
                ) : (
                  <p className="start-hint-vertical">Ready to start match!</p>
                )}
              </>
            ) : (
              <div className="waiting-host-wrap-vertical">
                <div className="spinner-small"></div>
                <p className="wait-label-vertical">Waiting for host...</p>
              </div>
            )}
          </div>

          {/* Leave Room Button at the very bottom */}
          <div className="dashboard-leave-section">
            <button onClick={handleLeaveRoom} className="lobby-btn-leave-new">
              <LogOut size={14} />
              <span>LEAVE ROOM</span>
            </button>
          </div>
        </div>

        {/* RIGHT CONTENT DISPLAY PANEL */}
        <div className="lobby-dashboard-right">
          {/* Header: Active game or dropdown */}
          <div className="dashboard-right-header">
            <div className="header-label">ACTIVE GAME</div>
            {player.id === room.hostId ? (
              <select
                value={room.game.id}
                onChange={(e) => {
                  wsClient.send('room.change_game', { gameId: e.target.value });
                }}
                className="game-select-input-new"
              >
                {availableGames.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name.toUpperCase()}
                  </option>
                ))}
              </select>
            ) : (
              <h2 className="dashboard-game-name">{room.game.name}</h2>
            )}
          </div>

          {/* Content pane */}
          <div className="dashboard-right-content">
            {lobbyTab === 'players' && (
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
                        {p.name[0].toUpperCase()}
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
            )}

            {lobbyTab === 'leaderboard' && (
              <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(() => {
                  const leaderboardData = room.settings?._leaderboard || {};
                  const sortedEntries = Object.entries(leaderboardData)
                    .map(([id, data]: [string, any]) => ({
                      id,
                      name: typeof data === 'object' ? data.name : `Player ${id.substring(0, 4)}`,
                      wins: typeof data === 'object' ? data.wins : data,
                    }))
                    .sort((a, b) => b.wins - a.wins);

                  if (sortedEntries.length === 0) {
                    return (
                      <div
                        className="leaderboard-empty"
                        style={{
                          color: '#94a3b8',
                          fontStyle: 'italic',
                          padding: 20,
                          textAlign: 'center',
                        }}
                      >
                        No games played yet in this room.
                      </div>
                    );
                  }

                  return sortedEntries.map((entry, idx) => {
                    const suffix = idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th';
                    const badgeClass = idx < 3 ? `rank-${idx + 1}` : 'rank-other';
                    return (
                      <div key={entry.id} className="player-item">
                        <div className={`rank-badge ${badgeClass}`}>
                          {idx + 1}
                          {suffix}
                        </div>
                        <span className="player-name">{entry.name}</span>
                        <span className="host-badge">{entry.wins} WINS</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {lobbyTab === 'rules' && (
              <div className="lobby-rules-tab">
                <div
                  className="lobby-rules-subheader"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    paddingBottom: 10,
                  }}
                >
                  <div className="settings-label" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {player.id === room.hostId ? (
                      <span
                        className="host-privilege-active"
                        style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Settings size={14} /> HOST PRIVILEGES ACTIVE
                      </span>
                    ) : (
                      <span
                        className="read-only-rules-label"
                        style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Lock size={14} /> READ-ONLY LOBBY RULES
                      </span>
                    )}
                  </div>
                  {player.id === room.hostId && (
                    <span className="changes-instant-hint" style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                      Changes apply instantly
                    </span>
                  )}
                </div>

                <div className="settings-rules-grid">
                  {room.game.settingsSchema ? (
                    Object.entries(room.game.settingsSchema).map(([key, def]: [string, any]) => {
                      if (key === 'isDailyChallenge' && room.settings?.levelType !== 'procedural') {
                        return null;
                      }

                      const value = room.settings?.[key] !== undefined ? room.settings[key] : def.default;

                      if (def.type === 'boolean') {
                        const handleToggle = () => {
                          if (player.id !== room.hostId) return;
                          handleUpdateSetting(key, !value);
                        };
                        return (
                          <div key={key} className="rule-card-wrapper">
                            <div
                              onClick={handleToggle}
                              className={`rule-card ${value ? 'active' : ''}`}
                              style={{ cursor: player.id === room.hostId ? 'pointer' : 'default' }}
                            >
                              <div className="rule-card-left">
                                <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                              </div>
                              <div className="rule-card-control">
                                <div className={`rule-toggle-pill ${value ? 'on' : 'off'}`}>
                                  <div className="rule-toggle-knob" />
                                </div>
                                {def.description && (
                                  <button
                                    className={`rule-help-btn ${activeRuleTooltip === key ? 'active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRuleTooltip(activeRuleTooltip === key ? null : key);
                                    }}
                                    title="About this rule"
                                  >
                                    ?
                                  </button>
                                )}
                              </div>
                            </div>
                            {activeRuleTooltip === key && def.description && (
                              <div className="rule-tooltip-panel">{stripEmojis(def.description)}</div>
                            )}
                          </div>
                        );
                      }

                      if (def.type === 'number') {
                        const handleDec = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (player.id !== room.hostId) return;
                          const val = value - 1;
                          handleUpdateSetting(key, val >= (def.min ?? 0) ? val : value);
                        };
                        const handleInc = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (player.id !== room.hostId) return;
                          const val = value + 1;
                          handleUpdateSetting(key, val <= (def.max ?? 1000) ? val : value);
                        };
                        return (
                          <div key={key} className="rule-card-wrapper">
                            <div className="rule-card">
                              <div className="rule-card-left">
                                <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                              </div>
                              <div className="rule-card-control">
                                <span className="rule-card-value">{value}</span>
                                <div className="rule-number-adjuster">
                                  <button
                                    onClick={handleDec}
                                    disabled={player.id !== room.hostId || value <= (def.min ?? 0)}
                                    className="rule-adjust-btn"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <button
                                    onClick={handleInc}
                                    disabled={player.id !== room.hostId || value >= (def.max ?? 1000)}
                                    className="rule-adjust-btn"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                                {def.description && (
                                  <button
                                    className={`rule-help-btn ${activeRuleTooltip === key ? 'active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRuleTooltip(activeRuleTooltip === key ? null : key);
                                    }}
                                    title="About this rule"
                                  >
                                    ?
                                  </button>
                                )}
                              </div>
                            </div>
                            {activeRuleTooltip === key && def.description && (
                              <div className="rule-tooltip-panel">{stripEmojis(def.description)}</div>
                            )}
                          </div>
                        );
                      }

                      // select
                      return (
                        <div key={key} className="rule-card-wrapper">
                          <div className="rule-card">
                            <div className="rule-card-left">
                              <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                            </div>
                            <div className="rule-card-control">
                              <select
                                value={value}
                                onChange={(e) => {
                                  let val: any = e.target.value;
                                  if (
                                    def.options &&
                                    def.options.length > 0 &&
                                    typeof def.options[0].value === 'number'
                                  ) {
                                    val = Number(val);
                                  }
                                  if (key === 'preset') {
                                    handlePresetChange(val);
                                  } else {
                                    handleUpdateSetting(key, val);
                                  }
                                }}
                                disabled={player.id !== room.hostId}
                                className="rule-card-select-overlay"
                              >
                                {def.options?.map((opt: any) => (
                                  <option key={opt.value} value={opt.value}>
                                    {stripEmojis(opt.label || String(opt.value))}
                                  </option>
                                ))}
                              </select>
                              {def.description && (
                                <button
                                  className={`rule-help-btn ${activeRuleTooltip === key ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveRuleTooltip(activeRuleTooltip === key ? null : key);
                                  }}
                                  title="About this rule"
                                >
                                  ?
                                </button>
                              )}
                            </div>
                          </div>
                          {activeRuleTooltip === key && def.description && (
                            <div className="rule-tooltip-panel">{stripEmojis(def.description)}</div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="settings-rules-empty">No Customizable Rules.</div>
                  )}

                  {/* Configurable Win on Abandonment Toggle (Host Only) */}
                  {player.id === room.hostId && (
                    <div className="rule-card-wrapper">
                      <div
                        onClick={() =>
                          handleUpdateSetting('winOnAbandonment', !(room.settings?.winOnAbandonment ?? true))
                        }
                        className={`rule-card ${(room.settings?.winOnAbandonment ?? true) ? 'active' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="rule-card-left">
                          <div className="rule-card-title">WIN ON ABANDONMENT</div>
                        </div>
                        <div className="rule-card-control">
                          <div
                            className={`rule-toggle-pill ${(room.settings?.winOnAbandonment ?? true) ? 'on' : 'off'}`}
                          >
                            <div className="rule-toggle-knob" />
                          </div>
                          <button
                            className={`rule-help-btn ${activeRuleTooltip === 'winOnAbandonment' ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRuleTooltip(
                                activeRuleTooltip === 'winOnAbandonment' ? null : 'winOnAbandonment'
                              );
                            }}
                            title="About this rule"
                          >
                            ?
                          </button>
                        </div>
                      </div>
                      {activeRuleTooltip === 'winOnAbandonment' && (
                        <div className="rule-tooltip-panel">
                          Declare the remaining connected player as the winner if all other players disconnect during
                          the match.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {lobbyTab === 'profile' && (
              <div className="lobby-profile-tab">
                {/* Global Stats card */}
                <div
                  className="profile-stats-card"
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '16px',
                    padding: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
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
                    }}
                  >
                    {player.name ? player.name[0].toUpperCase() : '?'}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>{player.name}</div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
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
                    <div className="avatar-color-picker">
                      {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`avatar-color-circle ${editColor === c ? 'active' : ''}`}
                          style={{
                            backgroundColor: resolveAvatarColor(c),
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (editName.trim()) {
                        const updatedPlayer = { ...player, name: editName, avatar: editColor };
                        setPlayer(updatedPlayer);
                        IdentityManager.savePlayer(updatedPlayer);
                        wsClient.send('player.identify', updatedPlayer);
                      }
                    }}
                    className="settings-modal-save-btn"
                    style={{ alignSelf: 'flex-start', width: 'max-content' }}
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
                      borderStyle: 'solid',
                    }}
                  >
                    LOGOUT
                  </button>
                </div>
              </div>
            )}

            {lobbyTab === 'settings' && (
              <div
                className="settings-content-pane"
                style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div>
                  <h4
                    className="pane-title"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 12 }}
                  >
                    SYSTEM SETTINGS
                  </h4>

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
                        <strong style={{ fontSize: 13, color: '#fff' }}>Sound Effects</strong>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                          Enable game micro-interaction audio
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={soundEffects}
                        onChange={() => setSoundEffects((prev) => !prev)}
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
                        <strong style={{ fontSize: 13, color: '#fff' }}>Sound Volume ({soundVolume}%)</strong>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Master audio volume level</p>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundVolume}
                        onChange={(e) => setSoundVolume(Number(e.target.value))}
                        className="pane-slider"
                        style={{ width: 100 }}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyScreen;
