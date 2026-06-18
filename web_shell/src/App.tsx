import React, { useEffect, useState } from 'react';
import { useStore } from './shell/store';
import { wsClient } from './shell/WebSocketClient';
import { IdentityManager } from './shell/IdentityManager';
import GameLoader from './plugin_runtime/GameLoader';
import './plugin_runtime/ArcadeSDK'; // Initialize SDK
import type { GameManifest } from './shared/types';


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
  const [lobbyTab, setLobbyTab] = useState<'players' | 'leaderboard'>('players');

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
              <div style={styles.avatar}>
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
                  <div style={styles.gameCardIcon}>🎮</div>
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

    if (room.status !== 'waiting') {
      return <GameLoader />;
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
          </header>

          <div style={styles.card}>
            {/* Tab Toggle */}
            <div style={{ display: 'flex', gap: 16, borderBottom: `1px solid ${colors.border}`, paddingBottom: 12, marginBottom: 12 }}>
              <button
                onClick={() => setLobbyTab('players')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: lobbyTab === 'players' ? colors.primary : colors.textMuted,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  borderBottom: lobbyTab === 'players' ? `2px solid ${colors.primary}` : 'none',
                  paddingBottom: 4,
                  outline: 'none',
                }}
              >
                PLAYERS ({room.players.length})
              </button>
              <button
                onClick={() => setLobbyTab('leaderboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: lobbyTab === 'leaderboard' ? colors.secondary : colors.textMuted,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  borderBottom: lobbyTab === 'leaderboard' ? `2px solid ${colors.secondary}` : 'none',
                  paddingBottom: 4,
                  outline: 'none',
                }}
              >
                🏆 ROOM LEADERBOARD
              </button>
            </div>

            {lobbyTab === 'players' ? (
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
                      <div style={styles.playerAvatar}>
                        {p.name[0].toUpperCase()}
                      </div>
                      <span style={styles.playerName}>{p.name}</span>
                      {p.id === room.hostId && (
                        <span style={styles.hostBadge}>HOST</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
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
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤';
                    return (
                      <div key={entry.id} style={styles.playerItem}>
                        <div style={styles.playerAvatar}>{medal}</div>
                        <span style={styles.playerName}>{entry.name}</span>
                        <span style={styles.hostBadge}>{entry.wins} WINS</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Room Settings Panel */}
          <div style={{ ...styles.card, marginTop: 12 }}>
            <h3 style={styles.cardTitle}><span style={{ marginRight: 6 }}>⚙️</span>ROOM GAME SETTINGS</h3>
            <p style={styles.cardSubtitle}>
              {player.id === room.hostId ? 'Configure game presets and house rules below.' : 'View current rules configured by the host.'}
            </p>
            
            <div style={styles.settingsContainer}>
              {room.game.settingsSchema ? (
                Object.entries(room.game.settingsSchema).map(([key, def]: [string, any]) => {
                  // Special check: hide isDailyChallenge if levelType is not 'procedural'
                  if (key === 'isDailyChallenge' && room.settings?.levelType !== 'procedural') {
                    return null;
                  }

                  const value = room.settings?.[key] !== undefined ? room.settings[key] : def.default;

                  return (
                    <div key={key} style={styles.settingsRow}>
                      <div>
                        <div style={styles.settingsLabel}>{def.label || key}</div>
                        {def.description && (
                          <div style={styles.settingsDescription}>{def.description}</div>
                        )}
                      </div>
                      {def.type === 'select' && (
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
                          disabled={player.id !== room.hostId}
                          style={styles.selectInput}
                        >
                          {def.options?.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label || opt.value}
                            </option>
                          ))}
                        </select>
                      )}
                      {def.type === 'number' && (
                        <input
                          type="number"
                          min={def.min}
                          max={def.max}
                          value={value}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            handleUpdateSetting(key, isNaN(val) ? def.default : val);
                          }}
                          disabled={player.id !== room.hostId}
                          style={styles.numberInput}
                        />
                      )}
                      {def.type === 'boolean' && (
                        <input
                          type="checkbox"
                          checked={!!value}
                          onChange={e => handleUpdateSetting(key, e.target.checked)}
                          disabled={player.id !== room.hostId}
                          style={styles.checkboxInput}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <p style={styles.cardSubtitle}>No customizable settings available for this game.</p>
              )}
            </div>
          </div>

          <div style={styles.startSection}>
            {room.status === 'waiting' && player.id === room.hostId ? (
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

  return (
    <>
      {errorAlert && (
        <div style={styles.errorAlertOverlay}>
          <div style={styles.errorAlertCard}>
            <div style={styles.errorAlertHeader}>
              <span style={{ fontSize: 24 }}>⚠️</span>
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

export default App;
