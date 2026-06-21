import React, { useEffect, useState } from 'react';
import { useStore } from './shell/store';
import { wsClient } from './shell/WebSocketClient';
import { IdentityManager } from './shell/IdentityManager';
import GameLoader from './plugin_runtime/GameLoader';
import './plugin_runtime/ArcadeSDK'; // Initialize SDK
import type { GameManifest } from './shared/types';
import { 
  User, 
  Settings, 
  Gamepad2, 
  Maximize2, 
  Minimize2, 
  LogOut, 
  X, 
  Plus, 
  Minus,
  AlertCircle,
  Trophy,
  Eye,
  Smartphone,
  RotateCw,
  Lock
} from 'lucide-react';


const resolveAvatarColor = (avatar: string) => {
  switch (avatar) {
    case 'indigo': return '#6366f1';
    case 'pink': return '#ec4899';
    case 'emerald': return '#10b981';
    case 'amber': return '#f59e0b';
    case 'cyan': return '#06b6d4';
    case 'rose': return '#f43f5e';
    case 'violet': return '#8b5cf6';
    default: return '#6366f1';
  }
};

const App: React.FC = () => {
  const isConnected = useStore((state) => state.isConnected);
  const player = useStore((state) => state.player);
  const room = useStore((state) => state.room);
  const errorAlert = useStore((state) => state.errorAlert);
  const setPlayer = useStore((state) => state.setPlayer);
  const setErrorAlert = useStore((state) => state.setErrorAlert);

  const [nameInput, setNameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [availableGames, setAvailableGames] = useState<GameManifest[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [lobbyTab, setLobbyTab] = useState<'players' | 'leaderboard' | 'rules' | 'profile'>('players');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(player?.name || '');
  const [editColor, setEditColor] = useState(player?.avatar || 'default');
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isViewingLobby, setIsViewingLobby] = useState(() => {
    return localStorage.getItem('isViewingLobby') === 'true';
  });

  useEffect(() => {
    if (player) {
      setEditName(player.name);
      setEditColor(player.avatar);
    }
  }, [player]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    if (room && room.status === 'waiting') {
      setIsViewingLobby(false);
      localStorage.setItem('isViewingLobby', 'false');
    }
  }, [room?.status]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    // Initial identity check
    const storedPlayer = IdentityManager.getPlayer();
    if (storedPlayer) {
      setPlayer(storedPlayer);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || '8080';
    wsClient.connect(`${protocol}//${host}:${port}/ws`);

    // Fetch available games
    fetch('/api/games')
      .then(res => res.json())
      .then(games => setAvailableGames(games))
      .catch(() => console.warn('Could not fetch game list'));
  }, [setPlayer]);

  const handleJoinPlatform = () => {
    if (nameInput.trim()) {
      const newPlayer = IdentityManager.createDefault(nameInput);
      setPlayer(newPlayer);
      wsClient.send('player.identify', newPlayer);
    }
  };

  const handleCreateRoom = (gameId: string) => {
    wsClient.send('room.create', { gameId, settings: {} });
  };

  const handleJoinRoom = () => {
    if (roomCodeInput.trim()) {
      wsClient.send('room.join', { code: roomCodeInput });
    }
  };

  const handleUpdateSetting = (key: string, value: any) => {
    if (!room || !player || player.id !== room.hostId) return;
    const currentSettings = room.settings || {};
    const newSettings = { ...currentSettings, [key]: value };
    
    // Auto-update presets if custom settings are modified
    if (room.game.settingsSchema && 'preset' in room.game.settingsSchema && key !== 'preset') {
      newSettings['preset'] = 'custom';
    }
    
    wsClient.send('room.update_settings', { settings: newSettings });
  };

  const handlePresetChange = (preset: string) => {
    if (!room || !player || player.id !== room.hostId) return;
    const schemaPreset = room.game.settingsSchema?.preset;
    let presetSettings: Record<string, any> = { preset };
    if (schemaPreset && schemaPreset.values && schemaPreset.values[preset]) {
      presetSettings = {
        ...presetSettings,
        ...schemaPreset.values[preset]
      };
    } else {
      presetSettings = { ...room.settings, preset };
    }
    wsClient.send('room.update_settings', { settings: presetSettings });
  };

  // --- Render content based on connection / status ---
  const renderView = () => {
    if (!isConnected) {
      return (
        <div style={styles.fullScreen}>
          <div style={styles.centerColumn}>
            <div style={styles.spinner}></div>
            <p style={styles.connectingText}>CONNECTING TO ARCADE...</p>
          </div>
        </div>
      );
    }

    if (!player) {
      return (
        <div style={styles.fullScreen}>
          <div style={styles.identityCard}>
            <img src="/logo.png" alt="LAN Arcade Logo" style={{ width: 140, height: 140, marginBottom: 16, objectFit: 'contain' }} />
            <h1 style={styles.heroTitle}>LAN ARCADE</h1>
            <p style={styles.subtitle}>Ready to play? Enter your name below.</p>

            <div style={styles.inputGroup}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoinPlatform()}
                placeholder="Enter Username"
                style={styles.input}
              />
              <button onClick={handleJoinPlatform} style={styles.primaryButton}>
                JOIN PLATFORM
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!room) {
      return (
        <div style={styles.fullScreen}>
          <div style={styles.lobbyContainer}>
            <header style={styles.lobbyHeader}>
              <div>
                <h1 style={styles.lobbyTitle}>ARCADE LOBBY</h1>
                <p style={styles.subtitle}>Hey {player.name}, what's the plan?</p>
              </div>
              <div 
                onClick={() => { setIsProfileModalOpen(true); }}
                style={{
                  ...styles.avatar,
                  background: resolveAvatarColor(player.avatar),
                  cursor: 'pointer',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.2)',
                }}
              >
                {player.name[0].toUpperCase()}
              </div>
            </header>

            {/* Game Selection */}
            <div style={styles.sectionTitle}>SELECT A GAME</div>
            <div style={styles.gameGrid}>
              {availableGames.map(game => (
                <button
                  key={game.id}
                  onClick={() => handleCreateRoom(game.id)}
                  style={{
                    ...styles.gameCard,
                    ...(selectedGame === game.id ? styles.gameCardSelected : {}),
                  }}
                  onMouseEnter={() => setSelectedGame(game.id)}
                  onMouseLeave={() => setSelectedGame(null)}
                >
                  <div className="game-card-icon">
                    <Gamepad2 size={32} />
                  </div>
                  <div style={styles.gameCardName}>{game.name}</div>
                  <div style={styles.gameCardPlayers}>
                    {game.minPlayers}-{game.maxPlayers} players
                  </div>
                </button>
              ))}
              {availableGames.length === 0 && (
                <div style={styles.emptyState}>No games available. Start the server first.</div>
              )}
            </div>

            {/* Join with Code */}
            <div style={{ ...styles.card, marginTop: 24 }}>
              <h2 style={styles.cardTitle}>JOIN WITH CODE</h2>
              <p style={styles.cardSubtitle}>Enter the code shown on the host device.</p>
              <div style={styles.joinRow}>
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="CODE"
                  style={styles.codeInput}
                  maxLength={4}
                />
                <button onClick={handleJoinRoom} style={styles.joinButton}>
                  JOIN
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (room.status !== 'waiting' && !isViewingLobby) {
      return <GameLoader onOpenSettings={() => { setIsSettingsOpen(true); }} />;
    }

    return (
      <div style={styles.fullScreen}>
        <div style={styles.waitingContainer}>
          <header style={styles.waitingHeader}>
            <div style={styles.roomInfo}>
              <div style={styles.roomCode}>{room.code}</div>
              {player.id === room.hostId ? (
                <select
                  value={room.game.id}
                  onChange={(e) => {
                    wsClient.send('room.change_game', { gameId: e.target.value });
                  }}
                  style={styles.gameSelectInput}
                >
                  {availableGames.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 style={styles.gameName}>{room.game.name}</h2>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => { setIsSettingsOpen(true); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Settings size={20} />
              </button>
              <button
                onClick={() => {
                  wsClient.send('room.leave', {});
                  window.history.replaceState({}, '', window.location.pathname);
                  window.location.reload();
                }}
                style={styles.leaveButton}
              >
                LEAVE ROOM
              </button>
            </div>
          </header>

          <div style={styles.card}>
            {/* Tab Toggle */}
            <div className="lobby-tabs-header">
              <button
                onClick={() => setLobbyTab('players')}
                className={`lobby-tab-btn ${lobbyTab === 'players' ? 'active' : ''}`}
              >
                <User size={14} />
                <span>PLAYERS ({room.players.length})</span>
              </button>
              <button
                onClick={() => setLobbyTab('leaderboard')}
                className={`lobby-tab-btn ${lobbyTab === 'leaderboard' ? 'active shadow-pink' : ''}`}
              >
                <Trophy size={14} />
                <span>LEADERBOARD</span>
              </button>
              <button
                onClick={() => setLobbyTab('rules')}
                className={`lobby-tab-btn ${lobbyTab === 'rules' ? 'active shadow-green' : ''}`}
              >
                <Gamepad2 size={14} />
                <span>GAME RULES</span>
              </button>
              <button
                onClick={() => setLobbyTab('profile')}
                className={`lobby-tab-btn ${lobbyTab === 'profile' ? 'active shadow-indigo' : ''}`}
              >
                <User size={14} />
                <span>PROFILE</span>
              </button>
            </div>

            {lobbyTab === 'players' && (
              <>
                <div style={styles.playerListHeader}>
                  <h3 style={styles.cardTitle}>PLAYERS IN LOBBY</h3>
                  <span style={styles.playerCount}>
                    {room.players.length} / {room.game.maxPlayers}
                  </span>
                </div>
                <ul style={styles.playerList}>
                  {room.players.map(p => (
                    <li key={p.id} style={styles.playerItem}>
                      <div style={{
                        ...styles.playerAvatar,
                        background: resolveAvatarColor(p.avatar),
                        border: '2px solid rgba(255, 255, 255, 0.2)'
                      }}>
                        {p.name[0].toUpperCase()}
                      </div>
                      <span style={styles.playerName}>{p.name}</span>
                      {p.id === room.hostId && (
                        <span style={styles.hostBadge}>HOST</span>
                      )}
                    </li>
                  ))}
                </ul>
                {room.spectators && room.spectators.length > 0 && (
                  <>
                    <div style={{ ...styles.playerListHeader, marginTop: 24 }}>
                      <h3 style={styles.cardTitle}>SPECTATORS ({room.spectators.length})</h3>
                    </div>
                    <ul style={styles.playerList}>
                      {room.spectators.map(p => (
                        <li key={p.id} style={{ ...styles.playerItem, opacity: 0.8, borderStyle: 'dashed' }}>
                          <div style={{
                            ...styles.playerAvatar,
                            background: resolveAvatarColor(p.avatar),
                            border: '1px dashed rgba(255, 255, 255, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Eye size={14} />
                          </div>
                          <span style={styles.playerName}>{p.name} (Spectating)</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            {lobbyTab === 'leaderboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      <div style={{ color: colors.textMuted, fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                        No games played yet in this room.
                      </div>
                    );
                  }

                  return sortedEntries.map((entry, idx) => {
                    const suffix = idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th";
                    const badgeClass = idx < 3 ? `rank-${idx + 1}` : 'rank-other';
                    return (
                      <div key={entry.id} style={styles.playerItem}>
                        <div className={`rank-badge ${badgeClass}`}>{idx + 1}{suffix}</div>
                        <span style={styles.playerName}>{entry.name}</span>
                        <span style={styles.hostBadge}>{entry.wins} WINS</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {lobbyTab === 'rules' && (
              <div className="lobby-rules-tab">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: `1px solid ${colors.border}`, paddingBottom: 10 }}>
                  <div style={styles.settingsLabel}>
                    {player?.id === room.hostId ? (
                      <span style={{ color: colors.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Settings size={14} /> HOST PRIVILEGES ACTIVE
                      </span>
                    ) : (
                      <span style={{ color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Lock size={14} /> READ-ONLY LOBBY RULES
                      </span>
                    )}
                  </div>
                  {player?.id === room.hostId && (
                    <span style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
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
                          if (player?.id !== room.hostId) return;
                          handleUpdateSetting(key, !value);
                        };
                        return (
                          <div 
                            key={key} 
                            onClick={handleToggle}
                            className={`rule-card ${value ? 'active' : ''}`}
                            style={{ cursor: player?.id === room.hostId ? 'pointer' : 'default' }}
                          >
                            <div className="rule-card-title">{def.label || key}</div>
                            <div className="rule-card-control">
                              <span className="rule-card-value" style={{ color: value ? '#34d399' : '#94a3b8' }}>
                                {value ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      if (def.type === 'number') {
                        const handleDec = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (player?.id !== room.hostId) return;
                          const val = value - 1;
                          handleUpdateSetting(key, val >= (def.min ?? 0) ? val : value);
                        };
                        const handleInc = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (player?.id !== room.hostId) return;
                          const val = value + 1;
                          handleUpdateSetting(key, val <= (def.max ?? 1000) ? val : value);
                        };
                        return (
                          <div key={key} className="rule-card">
                            <div className="rule-card-title">{def.label || key}</div>
                            <div className="rule-card-control">
                              <span className="rule-card-value">{value}</span>
                              <div className="rule-number-adjuster">
                                <button 
                                  onClick={handleDec}
                                  disabled={player?.id !== room.hostId || value <= (def.min ?? 0)}
                                  className="rule-adjust-btn"
                                >
                                  <Minus size={12} />
                                </button>
                                <button 
                                  onClick={handleInc}
                                  disabled={player?.id !== room.hostId || value >= (def.max ?? 1000)}
                                  className="rule-adjust-btn"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // select
                      return (
                        <div key={key} className="rule-card">
                          <div className="rule-card-title">{def.label || key}</div>
                          <div className="rule-card-control" style={{ width: '100%' }}>
                            <select
                              value={value}
                              onChange={e => {
                                let val: any = e.target.value;
                                if (def.options && def.options.length > 0 && typeof def.options[0].value === 'number') {
                                  val = Number(val);
                                }
                                if (key === 'preset') {
                                  handlePresetChange(val);
                                } else {
                                  handleUpdateSetting(key, val);
                                }
                              }}
                              disabled={player?.id !== room.hostId}
                              className="rule-card-select-overlay"
                            >
                              {def.options?.map((opt: any) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label || opt.value}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="settings-rules-empty">
                      No Customizable Rules.
                    </div>
                  )}
                </div>
              </div>
            )}

            {lobbyTab === 'profile' && (
              <div className="lobby-profile-tab">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="settings-modal-row">
                    <label>Username</label>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      className="settings-modal-input"
                      placeholder="Username"
                    />
                  </div>
                  <div className="settings-modal-row">
                    <label>Avatar Color</label>
                    <div className="avatar-color-picker">
                      {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map(c => (
                        <button
                          key={c}
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
                        const updatedPlayer = { ...player!, name: editName, avatar: editColor };
                        setPlayer(updatedPlayer);
                        IdentityManager.savePlayer(updatedPlayer);
                        wsClient.send('player.identify', updatedPlayer);
                      }
                    }} 
                    className="settings-modal-save-btn"
                  >
                    SAVE CHANGES
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={styles.startSection}>
            {room.status !== 'waiting' ? (
              <button
                onClick={() => {
                  setIsViewingLobby(false);
                  localStorage.setItem('isViewingLobby', 'false');
                }}
                style={{
                  ...styles.startButton,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Gamepad2 size={24} /> REJOIN ACTIVE MATCH
              </button>
            ) : player.id === room.hostId ? (
              <>
                <button
                  onClick={() => wsClient.send('game.action', { type: 'START', data: {} })}
                  disabled={room.players.length < room.game.minPlayers}
                  style={{
                    ...styles.startButton,
                    ...(room.players.length < room.game.minPlayers ? styles.disabledButton : {}),
                  }}
                >
                  START MATCH
                </button>
                {room.players.length < room.game.minPlayers ? (
                  <p style={{ ...styles.waitHint, color: colors.danger, fontWeight: 'bold' }}>
                    Need at least {room.game.minPlayers} players to start! (Current: {room.players.length})
                  </p>
                ) : (
                  <p style={styles.waitHint}>Wait for everyone to join before starting!</p>
                )}
              </>
            ) : (
              <div style={styles.centerColumn}>
                <div style={styles.spinner}></div>
                <p style={styles.waitLabel}>Waiting for host to start...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsModal = () => {
    if (!isSettingsOpen) return null;

    const handleLeaveMatch = () => {
      if (window.confirm("Are you sure you want to leave the active match? You can rejoin later.")) {
        setIsViewingLobby(true);
        localStorage.setItem('isViewingLobby', 'true');
        setIsSettingsOpen(false);
      }
    };

    const handleLeaveRoomReal = () => {
      if (window.confirm("Are you sure you want to leave the room?")) {
        wsClient.send('room.leave', {});
        window.history.replaceState({}, '', window.location.pathname);
        window.location.reload();
      }
    };

    return (
      <div className="settings-modal-overlay">
        <div className="settings-modal-card system-modal-card">
          <div className="settings-tab-header" style={{ justifyContent: 'space-between', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Settings size={20} className="tab-header-icon" />
              <h3>SYSTEM SETTINGS</h3>
            </span>
            <button onClick={() => setIsSettingsOpen(false)} className="settings-floating-close-btn" style={{ display: 'block', position: 'static' }}>
              <X size={20} />
            </button>
          </div>
          
          <div className="settings-modal-body" style={{ marginTop: 20 }}>
            <div className="settings-grid">
              {/* Fullscreen Toggle Card */}
              <div 
                onClick={handleToggleFullscreen}
                className={`settings-card-item ${isFullscreen ? 'active' : ''}`}
              >
                <div className="settings-card-icon-wrap">
                  {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                </div>
                <div className="settings-card-title">Fullscreen Mode</div>
                <span className="settings-card-status">
                  {isFullscreen ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Return to Lobby Card */}
              {room && room.status === 'active' && !isViewingLobby && (
                <div 
                  onClick={handleLeaveMatch}
                  className="settings-card-item accent-green"
                >
                  <div className="settings-card-icon-wrap">
                    <Gamepad2 size={24} />
                  </div>
                  <div className="settings-card-title">Return to Lobby</div>
                  <span className="settings-card-status">
                    GO TO LOBBY
                  </span>
                </div>
              )}

              {/* Quit/Abandon Lobby Card */}
              {room && (
                <div 
                  onClick={handleLeaveRoomReal}
                  className="settings-card-item accent-red"
                  style={{ gridColumn: (room.status === 'active' && !isViewingLobby) ? 'auto' : 'span 2' }}
                >
                  <div className="settings-card-icon-wrap">
                    <LogOut size={24} />
                  </div>
                  <div className="settings-card-title">Abandon Match</div>
                  <span className="settings-card-status">
                    QUIT ROOM
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfileModal = () => {
    if (!isProfileModalOpen) return null;

    const saveProfile = () => {
      if (editName.trim()) {
        const updatedPlayer = { ...player!, name: editName, avatar: editColor };
        setPlayer(updatedPlayer);
        IdentityManager.savePlayer(updatedPlayer);
        wsClient.send('player.identify', updatedPlayer);
        setIsProfileModalOpen(false);
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
            <button onClick={() => setIsProfileModalOpen(false)} className="settings-floating-close-btn" style={{ display: 'block', position: 'static' }}>
              <X size={20} />
            </button>
          </div>
          
          <div className="settings-modal-body" style={{ marginTop: 16 }}>
            <div className="settings-modal-row">
              <label>Username</label>
              <input 
                type="text" 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
                className="settings-modal-input"
                placeholder="Username"
              />
            </div>
            <div className="settings-modal-row" style={{ marginTop: 16 }}>
              <label>Avatar Color</label>
              <div className="avatar-color-picker">
                {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map(c => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={`avatar-color-circle ${editColor === c ? 'active' : ''}`}
                    style={{
                      backgroundColor: resolveAvatarColor(c),
                    }}
                  />
                ))}
              </div>
            </div>
            <button onClick={saveProfile} className="settings-modal-save-btn" style={{ marginTop: 24, width: '100%' }}>
              SAVE CHANGES
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="portrait-overlay">
        <div className="portrait-overlay-icon-wrap">
          <Smartphone className="phone-icon" />
          <RotateCw className="rotate-icon" />
        </div>
        <div className="portrait-overlay-title">Landscape Mode Required</div>
        <div className="portrait-overlay-text">
          Please rotate your device to landscape for the best gaming interface.
        </div>
      </div>
      {errorAlert && (
        <div style={styles.errorAlertOverlay}>
          <div style={styles.errorAlertCard}>
            <div style={styles.errorAlertHeader}>
              <AlertCircle size={24} className="text-danger" style={{ color: colors.danger }} />
              <h4 style={styles.errorAlertTitle}>SYSTEM ALERT</h4>
            </div>
            <p style={styles.errorAlertText}>{errorAlert}</p>
            <button onClick={() => setErrorAlert(null)} style={styles.errorAlertBtn}>
              DISMISS
            </button>
          </div>
        </div>
      )}
      {renderView()}
      {renderSettingsModal()}
      {renderProfileModal()}
    </>
  );
};

// --- Inline Styles (no Tailwind dependency) ---
const colors = {
  bg: '#020617',
  bgAlt: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  border: 'rgba(255,255,255,0.1)',
  text: '#ffffff',
  textMuted: '#94a3b8',
  primary: '#6366f1',
  primaryGlow: 'rgba(99,102,241,0.3)',
  secondary: '#ec4899',
  secondaryGlow: 'rgba(236,72,153,0.2)',
  accent: '#10b981',
  danger: '#ef4444',
};

const styles: Record<string, React.CSSProperties> = {
  fullScreen: {
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${colors.bgAlt}, ${colors.bg})`,
    color: colors.text,
    fontFamily: "'Inter', 'system-ui', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  spinner: {
    width: 48,
    height: 48,
    border: `4px solid ${colors.surface}`,
    borderTopColor: colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  connectingText: {
    fontWeight: 700,
    letterSpacing: 3,
    color: colors.textMuted,
    fontSize: 14,
  },
  identityCard: {
    width: '100%',
    maxWidth: 420,
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  },
  heroTitle: {
    fontSize: 'clamp(2.5rem, 8vw, 4rem)',
    fontWeight: 900,
    fontStyle: 'italic',
    letterSpacing: -2,
    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
  },
  subtitle: {
    color: colors.textMuted,
    fontWeight: 500,
    margin: 0,
    fontSize: 14,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  input: {
    width: '100%',
    padding: '16px 24px',
    background: colors.bgAlt,
    border: `2px solid ${colors.surface}`,
    borderRadius: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: 700,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  primaryButton: {
    width: '100%',
    padding: '16px 24px',
    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
    border: 'none',
    borderRadius: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: `0 8px 24px ${colors.primaryGlow}`,
  },
  lobbyContainer: {
    width: '100%',
    maxWidth: 700,
    padding: '40px 0',
  },
  lobbyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  lobbyTitle: {
    fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
    fontWeight: 900,
    letterSpacing: -1,
    margin: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: colors.surface,
    border: `2px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 2,
    color: colors.textMuted,
    marginBottom: 12,
  },
  gameGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  gameCard: {
    background: colors.surface,
    border: `2px solid transparent`,
    borderRadius: 20,
    padding: 20,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
    color: colors.text,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  gameCardSelected: {
    borderColor: colors.primary,
    boxShadow: `0 0 20px ${colors.primaryGlow}`,
    transform: 'translateY(-2px)',
  },
  gameCardIcon: {
    fontSize: 32,
  },
  gameCardName: {
    fontWeight: 800,
    fontSize: 16,
  },
  gameCardPlayers: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: 600,
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    padding: 40,
    color: colors.textMuted,
    fontWeight: 600,
  },
  card: {
    background: colors.surface,
    borderRadius: 24,
    border: `2px solid ${colors.border}`,
    padding: 24,
  },
  cardTitle: {
    fontWeight: 800,
    fontSize: 14,
    color: colors.textMuted,
    margin: 0,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    margin: '4px 0 16px',
  },
  joinRow: {
    display: 'flex',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    padding: '16px',
    background: colors.bg,
    border: `2px solid ${colors.surface}`,
    borderRadius: 16,
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 24,
    textAlign: 'center' as const,
    letterSpacing: 8,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  joinButton: {
    padding: '16px 24px',
    background: colors.secondary,
    border: 'none',
    borderRadius: 16,
    color: colors.text,
    fontWeight: 800,
    fontSize: 16,
    cursor: 'pointer',
  },
  waitingContainer: {
    width: '100%',
    maxWidth: 600,
    padding: '40px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  },
  waitingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomInfo: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  roomCode: {
    padding: '8px 16px',
    background: colors.bgAlt,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    fontFamily: 'monospace',
    fontSize: 20,
    color: colors.secondary,
    fontWeight: 700,
  },
  gameName: {
    fontSize: 24,
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: -0.5,
    margin: 0,
  },
  leaveButton: {
    background: 'none',
    border: 'none',
    color: colors.textMuted,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  playerListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: 12,
  },
  playerCount: {
    padding: '4px 12px',
    background: colors.surface,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    color: colors.textMuted,
  },
  playerList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  playerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: `rgba(0,0,0,0.2)`,
    borderRadius: 16,
    border: `1px solid ${colors.border}`,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: colors.surface,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 16,
  },
  playerName: {
    flex: 1,
    fontWeight: 700,
  },
  hostBadge: {
    fontSize: 11,
    fontWeight: 900,
    background: 'rgba(99,102,241,0.2)',
    color: colors.primary,
    padding: '4px 10px',
    borderRadius: 20,
    textTransform: 'uppercase' as const,
    letterSpacing: -0.5,
  },
  startSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
  },
  startButton: {
    width: '100%',
    padding: '20px',
    background: `linear-gradient(135deg, ${colors.accent}, #059669)`,
    border: 'none',
    borderRadius: 16,
    color: colors.text,
    fontSize: 24,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
  },
  waitHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: 500,
    margin: 0,
  },
  waitLabel: {
    color: colors.textMuted,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    fontSize: 12,
  },
  settingsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    marginTop: 12,
  },
  settingsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: `1px solid ${colors.border}`,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.text,
  },
  settingsDescription: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectInput: {
    background: colors.bg,
    color: colors.text,
    border: `2px solid ${colors.surface}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    outline: 'none',
  },
  numberInput: {
    background: colors.bg,
    color: colors.text,
    border: `2px solid ${colors.surface}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    width: 70,
    textAlign: 'center' as const,
    outline: 'none',
  },
  checkboxInput: {
    width: 18,
    height: 18,
    cursor: 'pointer',
  },

  errorAlertOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(8px)',
  },
  errorAlertCard: {
    backgroundColor: '#0f172a',
    border: '2px solid #ef4444',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 360,
    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.25)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  errorAlertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  errorAlertTitle: {
    margin: 0,
    color: '#ef4444',
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: 2,
  },
  errorAlertText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  errorAlertBtn: {
    backgroundColor: '#ef4444',
    border: 'none',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.2s',
  },
  gameSelectInput: {
    background: 'rgba(15, 23, 42, 0.8)',
    border: '2px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 900,
    padding: '6px 12px',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    textTransform: 'uppercase',
  },
  disabledButton: {
    background: '#475569',
    cursor: 'not-allowed',
    boxShadow: 'none',
    opacity: 0.6,
  },
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 480,
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', 'system-ui', sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: '0.5px',
    color: '#fff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '24px',
    cursor: 'pointer',
    outline: 'none',
  },
  tabContainer: {
    display: 'flex',
    gap: 16,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '8px 4px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  input: {
    background: '#020617',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    color: '#fff',
    padding: '12px 16px',
    fontSize: 15,
    fontWeight: 700,
    outline: 'none',
  },
  colorGrid: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #6366f1, #ec4899)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    padding: '14px 20px',
    fontWeight: 900,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    marginTop: 8,
  },
  sysRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  sysTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
  },
  sysDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  leaveMatchBtn: {
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    padding: '14px 20px',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
  },
  leaveRoomBtn: {
    background: '#ef4444',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    padding: '14px 20px',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
  }
};

export default App;
