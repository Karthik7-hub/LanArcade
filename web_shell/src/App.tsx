import React, { useEffect, useState } from 'react';
import { useStore } from './shell/store';
import { wsClient } from './shell/WebSocketClient';
import { IdentityManager } from './shell/IdentityManager';
import GameLoader from './plugin_runtime/GameLoader';
import './plugin_runtime/ArcadeSDK'; // Initialize SDK
import type { GameManifest } from './shared/types';
import { Html5QrcodeScanner } from 'html5-qrcode';
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
  Lock,
  HelpCircle,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Database,
  Accessibility,
  Info,
  Copy
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

const stripEmojis = (str: string): string => {
  if (typeof str !== 'string') return str;
  return str.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
            .replace(/\p{Extended_Pictographic}/gu, '')
            .trim();
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
  const [lobbyTab, setLobbyTab] = useState<'players' | 'leaderboard' | 'rules' | 'profile' | 'settings'>('players');
  const [homeTab, setHomeTab] = useState<'launcher' | 'profile' | 'settings'>('launcher');

  const [loginTab, setLoginTab] = useState<'create' | 'load' | 'scan'>('create');
  const [playerIdInput, setPlayerIdInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('indigo');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(player?.name || '');
  const [editColor, setEditColor] = useState(player?.avatar || 'default');
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isViewingLobby, setIsViewingLobby] = useState(() => {
    return localStorage.getItem('isViewingLobby') === 'true';
  });

  // Modern Console settings states
  const [activeSettingsTab, setActiveSettingsTab] = useState<'gameplay' | 'audio' | 'display' | 'network' | 'storage' | 'accessibility' | 'about'>('gameplay');
  const [soundEffects, setSoundEffects] = useState(() => localStorage.getItem('soundEffects') !== 'false');
  const [soundVolume, setSoundVolume] = useState(() => Number(localStorage.getItem('soundVolume') ?? '80'));
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('highContrast') === 'true');
  const [textScaling, setTextScaling] = useState<'normal' | 'large'>(() => (localStorage.getItem('textScaling') as 'normal' | 'large') ?? 'normal');
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('uiTheme') ?? 'slate');
  const [mockPing, setMockPing] = useState(42);

  useEffect(() => {
    localStorage.setItem('soundEffects', String(soundEffects));
  }, [soundEffects]);

  useEffect(() => {
    localStorage.setItem('soundVolume', String(soundVolume));
  }, [soundVolume]);

  useEffect(() => {
    localStorage.setItem('highContrast', String(highContrast));
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem('textScaling', textScaling);
    document.documentElement.setAttribute('data-text-scale', textScaling);
  }, [textScaling]);

  useEffect(() => {
    localStorage.setItem('uiTheme', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMockPing(prev => {
        const delta = Math.floor(Math.random() * 9) - 4;
        const next = prev + delta;
        return next > 10 && next < 150 ? next : prev;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (player) {
      setEditName(player.name);
      setEditColor(player.avatar);
    }
  }, [player]);

  useEffect(() => {
    const handleFsChange = () => {
      const isCurrentlyFs = !!document.fullscreenElement || 
        (window.innerWidth >= window.screen.width - 4 && window.innerHeight >= window.screen.height - 4);
      setIsFullscreen(isCurrentlyFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('resize', handleFsChange);
    // Initial check
    handleFsChange();
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('resize', handleFsChange);
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
    // Initial identity check with query parameter auto-login fallback
    const urlParams = new URLSearchParams(window.location.search);
    const loginId = urlParams.get('login_id') || urlParams.get('playerId');

    let storedPlayer = IdentityManager.getPlayer();

    if (loginId) {
      storedPlayer = {
        id: loginId,
        name: '', // Server will fetch name/avatar by ID from db
        avatar: 'default',
        isHost: false,
      };
      setPlayer(storedPlayer);
      IdentityManager.savePlayer(storedPlayer);

      // Strip query parameters from URL history to keep it clean
      urlParams.delete('login_id');
      urlParams.delete('playerId');
      const newQuery = urlParams.toString();
      const newUrl = `${window.location.pathname}${newQuery ? '?' + newQuery : ''}`;
      window.history.replaceState({}, '', newUrl);
    } else if (storedPlayer) {
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

  // QR Code camera scanning on login screen
  useEffect(() => {
    if (loginTab !== 'scan') return;

    let scanner: Html5QrcodeScanner | null = null;
    try {
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          try {
            console.log('Decoded QR Text:', decodedText);
            // Scanned text might be: http://<ip>:<port>/?login_id=<player_id> or the raw ID
            let pid = decodedText;
            if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
              const url = new URL(decodedText);
              pid = url.searchParams.get('login_id') || url.searchParams.get('playerId') || decodedText;
            }

            if (pid && pid.trim().length > 10) {
              if (scanner) {
                scanner.clear().catch(err => console.error('Failed to clear scanner', err));
              }
              
              const loadPlayer = {
                id: pid.trim(),
                name: '',
                avatar: 'default',
                isHost: false,
              };
              wsClient.send('player.identify', loadPlayer);
            }
          } catch (e) {
            console.error('Failed to parse scanned QR content:', e);
          }
        },
        (error) => {
          // scanner error
        }
      );
    } catch (e) {
      console.error('Failed to initialize Html5QrcodeScanner:', e);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error('Failed to clear scanner on cleanup', err));
      }
    };
  }, [loginTab]);

  const handleJoinPlatform = () => {
    if (loginTab === 'create') {
      if (nameInput.trim()) {
        const newPlayer = {
          id: '',
          name: nameInput.trim(),
          avatar: selectedAvatar,
          isHost: false,
        };
        wsClient.send('player.identify', newPlayer);
      }
    } else {
      if (playerIdInput.trim()) {
        const loadPlayer = {
          id: playerIdInput.trim(),
          name: '',
          avatar: 'default',
          isHost: false,
        };
        wsClient.send('player.identify', loadPlayer);
      }
    }
  };

  const handleCopyId = () => {
    if (player?.id) {
      navigator.clipboard.writeText(player.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
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
        <div className="full-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
          <div className="identity-panel">
            <img src="/logo.png" alt="LAN Arcade Logo" className="identity-logo" style={{ width: 80, height: 80 }} />
            <h1 className="identity-title">LAN ARCADE</h1>
            <p className="identity-subtitle">Zero-latency local multiplayer gaming portal</p>

            {/* Login Tabs Header */}
            <div className="login-tabs-header" style={{
              display: 'flex',
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              padding: '2px',
              marginBottom: '20px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <button
                type="button"
                onClick={() => setLoginTab('create')}
                className={`login-tab-btn ${loginTab === 'create' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  background: loginTab === 'create' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: loginTab === 'create' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                  color: loginTab === 'create' ? '#fff' : '#94a3b8',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                  boxShadow: loginTab === 'create' ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none'
                }}
              >
                Create Profile
              </button>
              <button
                type="button"
                onClick={() => setLoginTab('load')}
                className={`login-tab-btn ${loginTab === 'load' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  background: loginTab === 'load' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: loginTab === 'load' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                  color: loginTab === 'load' ? '#fff' : '#94a3b8',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                  boxShadow: loginTab === 'load' ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none'
                }}
              >
                Reload Profile
              </button>
              <button
                type="button"
                onClick={() => setLoginTab('scan')}
                className={`login-tab-btn ${loginTab === 'scan' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  background: loginTab === 'scan' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: loginTab === 'scan' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                  color: loginTab === 'scan' ? '#fff' : '#94a3b8',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                  boxShadow: loginTab === 'scan' ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none'
                }}
              >
                Scan QR
              </button>
            </div>

            {loginTab === 'create' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Username</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJoinPlatform()}
                    placeholder="Enter username"
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#fff',
                      padding: '12px 16px',
                      fontSize: '15px',
                      fontWeight: 700,
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Avatar Color</label>
                  <div className="avatar-color-picker" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedAvatar(c)}
                        className={`avatar-color-circle ${selectedAvatar === c ? 'active' : ''}`}
                        style={{
                          backgroundColor: resolveAvatarColor(c),
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: selectedAvatar === c ? '2.5px solid #fff' : '2.5px solid transparent',
                          cursor: 'pointer',
                          boxShadow: selectedAvatar === c ? `0 0 12px ${resolveAvatarColor(c)}` : 'none',
                          transition: 'all 0.2s'
                        }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleJoinPlatform}
                  className="primary-button"
                  style={{
                    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    padding: '14px 20px',
                    fontWeight: 900,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                    marginTop: '8px',
                    width: '100%',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                >
                  Create Character
                </button>
              </div>
            )}

            {loginTab === 'load' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Player ID</label>
                  <input
                    type="text"
                    value={playerIdInput}
                    onChange={e => setPlayerIdInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJoinPlatform()}
                    placeholder="Paste Player ID UUID"
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      color: '#fff',
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: 700,
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                <button
                  onClick={handleJoinPlatform}
                  className="primary-button"
                  style={{
                    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    padding: '14px 20px',
                    fontWeight: 900,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                    marginTop: '8px',
                    width: '100%',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                >
                  Load Profile
                </button>
              </div>
            )}

            {loginTab === 'scan' && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Scan login QR code</label>
                  <div className="qr-reader-container">
                    <div id="qr-reader" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!room) {
      return (
        <div className="home-screen">
          {/* Two-Panel Layout — no shared header, left starts from top */}
          <div className="home-body">
            {/* LEFT PANEL – Header, Profile, and Join */}
            <div className="home-left-panel">
              {/* Brand Header */}
              <div className="home-brand-header" style={{ padding: '0 4px 8px' }}>
                <h1 className="home-title">LAN ARCADE</h1>
                <p className="home-subtitle">Welcome to the local multiplayer arena</p>
              </div>

              {/* Profile Card – compact */}
              <div className="home-profile-card">
                <div
                  className="home-profile-avatar"
                  style={{ background: resolveAvatarColor(player.avatar) }}
                >
                  {player.name[0].toUpperCase()}
                  <span className="home-profile-online-dot" />
                </div>
                <div className="home-profile-info">
                  <div className="home-profile-name">{player.name}</div>
                  <div className="home-profile-wins">
                    <Trophy size={11} />
                    <span>{player.stats?.totalWins ?? 0} GLOBAL WINS</span>
                  </div>
                </div>
                <button
                  className="home-settings-btn"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Settings"
                >
                  <Settings size={15} />
                </button>
              </div>

              {/* Join Room Card – primary action */}
              <div className="home-join-card">
                <div className="home-join-eyebrow">
                  <Wifi size={14} />
                  <span>JOIN ROOM</span>
                </div>
                <h2 className="home-join-heading">Have a room code?</h2>
                <p className="home-join-desc">Ask your host to share their room code, then enter it below.</p>

                <div className="home-join-field">
                  <span className="home-join-hash">#</span>
                  <input
                    id="home-room-code-input"
                    type="text"
                    value={roomCodeInput}
                    onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                    placeholder="Enter Room Code"
                    className="home-join-input"
                    maxLength={4}
                    autoComplete="off"
                  />
                </div>

                <button
                  id="home-join-room-btn"
                  onClick={handleJoinRoom}
                  className="home-join-btn"
                >
                  <span>JOIN ROOM</span>
                  <span className="home-join-arrow">→</span>
                </button>

                <div className="home-join-hint">
                  <Wifi size={12} />
                  <span>Make sure you're on the same Wi-Fi as your friends.</span>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL – Games list with small header (no brand headers) */}
            <div className="home-right-panel">
              <div className="home-games-header" style={{ paddingBottom: '4px' }}>
                <div className="home-games-label">Available Games</div>
              </div>
              <div className="home-game-scroll-area">
                <div className="home-game-grid">
                  {availableGames.map(game => {
                    const isUno = game.id === 'uno';
                    const accentColor = isUno ? '#ec4899' : '#6366f1';
                    const accentDark = isUno ? '#be185d' : '#4f46e5';
                    const badgeLabel = isUno ? 'CARD GAME' : 'CO-OP';
                    const gameDesc = game.description
                      ? game.description.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '').trim()
                      : null;

                    return (
                      <div
                        key={game.id}
                        className={`home-game-card${selectedGame === game.id ? ' hovered' : ''}`}
                        style={{ '--card-accent': accentColor, '--card-accent-dark': accentDark } as React.CSSProperties}
                        onMouseEnter={() => setSelectedGame(game.id)}
                        onMouseLeave={() => setSelectedGame(null)}
                      >
                        {/* Thumbnail */}
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

                        {/* Card body */}
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
                            onClick={() => handleCreateRoom(game.id)}
                            className="home-game-play-btn"
                            style={{
                              background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
                              boxShadow: `0 4px 16px ${accentColor}50`
                            }}
                          >
                            <span>PLAY</span>
                            <span style={{ fontSize: '15px' }}>→</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {availableGames.length === 0 && (
                    <div className="home-empty-state">
                      <Gamepad2 size={36} />
                      <span>No games available. Start the server first.</span>
                    </div>
                  )}
                </div>

                {availableGames.length > 0 && (
                  <div className="home-games-footer">
                    <span>★</span>
                    <span>More games coming soon. Stay tuned!</span>
                  </div>
                )}
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
      <div className="full-screen">
        <div className="waiting-container">
          <header className="waiting-header">
            <div className="room-info" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="room-code-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="room-code">{room.code}</div>
                <button
                  onClick={() => {
                    const inviteUrl = `${window.location.origin}/?room=${room.code}`;
                    navigator.clipboard.writeText(inviteUrl);
                    setCopiedRoomLink(true);
                    setTimeout(() => setCopiedRoomLink(false), 2000);
                  }}
                  className="lobby-copy-btn"
                  title="Copy Invite Link"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#fff',
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    transition: 'all 0.2s',
                  }}
                >
                  <Copy size={13} style={{ color: '#3b82f6' }} />
                  <span>{copiedRoomLink ? 'COPIED!' : 'COPY LINK'}</span>
                </button>
              </div>
              {player.id === room.hostId ? (
                <select
                  value={room.game.id}
                  onChange={(e) => {
                    wsClient.send('room.change_game', { gameId: e.target.value });
                  }}
                  className="game-select-input"
                >
                  {availableGames.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="game-name">{room.game.name}</h2>
              )}
            </div>
            <div className="waiting-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => {
                  wsClient.send('room.leave', {});
                  window.history.replaceState({}, '', window.location.pathname);
                  window.location.reload();
                }}
                className="lobby-btn-leave"
              >
                LEAVE ROOM
              </button>
            </div>
          </header>

          <div className="lobby-card">
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
                <HelpCircle size={14} />
                <span>?</span>
              </button>
              <button
                onClick={() => setLobbyTab('profile')}
                className={`lobby-tab-btn ${lobbyTab === 'profile' ? 'active shadow-indigo' : ''}`}
              >
                <User size={14} />
                <span>PROFILE</span>
              </button>
              <button
                onClick={() => setLobbyTab('settings')}
                className={`lobby-tab-btn ${lobbyTab === 'settings' ? 'active' : ''}`}
              >
                <Settings size={14} />
                <span>SETTINGS</span>
              </button>
            </div>

            {lobbyTab === 'players' && (
              <>
                <div className="player-list-header">
                  <h3 className="card-title">PLAYERS IN LOBBY</h3>
                  <span className="player-count">
                    {room.players.length} / {room.game.maxPlayers}
                  </span>
                </div>
                <ul className="player-list">
                  {room.players.map(p => (
                    <li key={p.id} className="player-item">
                      <div 
                        className="player-avatar"
                        style={{
                          background: resolveAvatarColor(p.avatar),
                          border: '2px solid rgba(255, 255, 255, 0.2)'
                        }}
                      >
                        {p.name[0].toUpperCase()}
                      </div>
                      <span className="player-name">{p.name}</span>
                      {p.id === room.hostId && (
                        <span className="host-badge">HOST</span>
                      )}
                    </li>
                  ))}
                </ul>
                {room.spectators && room.spectators.length > 0 && (
                  <>
                    <div className="player-list-header" style={{ marginTop: 24 }}>
                      <h3 className="card-title">SPECTATORS ({room.spectators.length})</h3>
                    </div>
                    <ul className="player-list">
                      {room.spectators.map(p => (
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
                      <div className="leaderboard-empty" style={{ color: '#94a3b8', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                        No games played yet in this room.
                      </div>
                    );
                  }

                  return sortedEntries.map((entry, idx) => {
                    const suffix = idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th";
                    const badgeClass = idx < 3 ? `rank-${idx + 1}` : 'rank-other';
                    return (
                      <div key={entry.id} className="player-item">
                        <div className={`rank-badge ${badgeClass}`}>{idx + 1}{suffix}</div>
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
                {/* Game Instructions Card at the top */}
                {room.game.description && (
                  <div className="game-instructions-card">
                    <div className="game-instructions-title">ABOUT {room.game.name.toUpperCase()}</div>
                    <div className="game-instructions-text">{stripEmojis(room.game.description)}</div>
                  </div>
                )}

                <div className="lobby-rules-subheader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                  <div className="settings-label" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {player?.id === room.hostId ? (
                      <span className="host-privilege-active" style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Settings size={14} /> HOST PRIVILEGES ACTIVE
                      </span>
                    ) : (
                      <span className="read-only-rules-label" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Lock size={14} /> READ-ONLY LOBBY RULES
                      </span>
                    )}
                  </div>
                  {player?.id === room.hostId && (
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
                            <div>
                              <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                              {def.description && (
                                <div className="rule-card-desc">{stripEmojis(def.description)}</div>
                              )}
                            </div>
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
                            <div>
                              <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                              {def.description && (
                                <div className="rule-card-desc">{stripEmojis(def.description)}</div>
                              )}
                            </div>
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
                          <div>
                            <div className="rule-card-title">{stripEmojis(def.label || key)}</div>
                            {def.description && (
                              <div className="rule-card-desc">{stripEmojis(def.description)}</div>
                            )}
                          </div>
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
                                  {stripEmojis(opt.label || String(opt.value))}
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

                  {/* Configurable Win on Abandonment Toggle (Host Only) */}
                  {player?.id === room.hostId && (
                    <div 
                      onClick={() => handleUpdateSetting('winOnAbandonment', !(room.settings?.winOnAbandonment ?? true))}
                      className={`rule-card ${(room.settings?.winOnAbandonment ?? true) ? 'active' : ''}`}
                      style={{ cursor: 'pointer', gridColumn: 'span 2' }}
                    >
                      <div>
                        <div className="rule-card-title">WIN ON ABANDONMENT</div>
                        <div className="rule-card-desc">Declare remaining player winner if others disconnect</div>
                      </div>
                      <div className="rule-card-control">
                        <span className="rule-card-value" style={{ color: (room.settings?.winOnAbandonment ?? true) ? '#34d399' : '#94a3b8' }}>
                          {(room.settings?.winOnAbandonment ?? true) ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {lobbyTab === 'profile' && (
              <div className="lobby-profile-tab">
                {/* Global Stats card */}
                <div className="profile-stats-card" style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '16px',
                  padding: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '16px'
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
                    border: '2px solid rgba(255, 255, 255, 0.3)'
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

                <div className="lobby-profile-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', marginTop: '8px' }}>
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
                            outline: 'none'
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
                            cursor: 'pointer'
                          }}
                        >
                          {copiedId ? 'COPIED!' : 'COPY'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to log out? This clears local session keys.")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }} 
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
                      borderStyle: 'solid'
                    }}
                  >
                    LOGOUT
                  </button>
                </div>
              </div>
            )}

            {lobbyTab === 'settings' && (
              <div className="settings-content-pane" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h4 className="pane-title" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 12 }}>SYSTEM SETTINGS</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="pane-control-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div className="pane-control-label">
                        <strong style={{ fontSize: 13, color: '#fff' }}>Sound Effects</strong>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Enable game micro-interaction audio</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={soundEffects}
                        onChange={() => setSoundEffects(prev => !prev)}
                        className="pane-checkbox"
                      />
                    </div>

                    <div className="pane-control-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div className="pane-control-label">
                        <strong style={{ fontSize: 13, color: '#fff' }}>Sound Volume ({soundVolume}%)</strong>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Master audio volume level</p>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundVolume}
                        onChange={e => setSoundVolume(Number(e.target.value))}
                        className="pane-slider"
                        style={{ width: 100 }}
                      />
                    </div>

                    <div className="pane-control-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div className="pane-control-label">
                        <strong style={{ fontSize: 13, color: '#fff' }}>Fullscreen Presentation</strong>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Toggle client window fullscreen</p>
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
                          cursor: 'pointer'
                        }}
                      >
                        {isFullscreen ? 'DISABLE' : 'ENABLE'}
                      </button>
                    </div>

                    <div className="pane-control-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)' }}>
                      <div className="pane-control-label">
                        <strong style={{ fontSize: 13, color: '#fff' }}>Interface Theme</strong>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>Visual style of the lobby</p>
                      </div>
                      <select
                        value={currentTheme}
                        onChange={e => setCurrentTheme(e.target.value)}
                        className="pane-select"
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          color: '#fff',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="slate">SLATE NEON</option>
                        <option value="cyberpunk">CYBERPUNK GLOW</option>
                        <option value="forest">FOREST SHADOW</option>
                        <option value="sunset">SUNSET GLOW</option>
                      </select>
                    </div>

                    <div className="pane-control-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.05)', padding: '10px 14px', borderRadius: 12, border: '1px dashed rgba(239,68,68,0.3)' }}>
                      <div className="pane-control-label">
                        <strong style={{ fontSize: 13, color: '#ef4444' }}>Factory Reset</strong>
                        <p style={{ margin: 0, fontSize: 10, color: 'rgba(239,68,68,0.7)' }}>Clear cached profile, stats and logout</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm("This will erase your saved name, avatar choices, and stats. Proceed?")) {
                            localStorage.clear();
                            window.location.reload();
                          }
                        }}
                        style={{
                          background: '#ef4444',
                          border: 'none',
                          color: '#fff',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        RESET
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="start-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 16 }}>
            {room.status !== 'waiting' ? (
              <button
                onClick={() => {
                  setIsViewingLobby(false);
                  localStorage.setItem('isViewingLobby', 'false');
                }}
                className="start-button start-button-rejoin"
                style={{
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
                  className={`start-button ${room.players.length < room.game.minPlayers ? 'disabled' : ''}`}
                >
                  START MATCH
                </button>
                {room.players.length < room.game.minPlayers ? (
                  <p className="wait-hint danger-text" style={{ color: '#ef4444', fontWeight: 'bold' }}>
                    Need at least {room.game.minPlayers} players to start! (Current: {room.players.length})
                  </p>
                ) : (
                  <p className="wait-hint">Wait for everyone to join before starting!</p>
                )}
              </>
            ) : (
              <div className="waiting-host-spinner-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div className="spinner"></div>
                <p className="wait-label">Waiting for host to start...</p>
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

    const categoriesList = [
      { id: 'gameplay', name: 'Gameplay', icon: <Gamepad2 size={16} /> },
      { id: 'audio', name: 'Audio', icon: <Volume2 size={16} /> },
      { id: 'display', name: 'Display', icon: <Maximize2 size={16} /> },
      { id: 'network', name: 'Network', icon: <Wifi size={16} /> },
      { id: 'storage', name: 'Storage', icon: <Database size={16} /> },
      { id: 'accessibility', name: 'Accessibility', icon: <Accessibility size={16} /> },
      { id: 'about', name: 'About', icon: <Info size={16} /> }
    ];

    return (
      <div className="settings-modal-overlay">
        <div className="console-settings-card">
          {/* Header */}
          <div className="console-settings-header">
            <span className="console-settings-title-wrap">
              <Settings size={20} className="tab-header-icon" />
              <h3>SYSTEM SETTINGS</h3>
            </span>
            <button onClick={() => setIsSettingsOpen(false)} className="console-settings-close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="console-settings-layout">
            {/* Sidebar */}
            <div className="console-settings-sidebar">
              {categoriesList.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveSettingsTab(cat.id as any)}
                  className={`console-settings-sidebar-btn ${activeSettingsTab === cat.id ? 'active' : ''}`}
                >
                  {cat.icon}
                  <span>{cat.name.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {/* Content Panel */}
            <div className="console-settings-content">
              {activeSettingsTab === 'gameplay' && (
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

                  {/* Room Leave / Abandon Options */}
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

              {activeSettingsTab === 'audio' && (
                <div className="settings-content-pane">
                  <h4 className="pane-title">AUDIO SETTINGS</h4>
                  
                  <div className="pane-control-card">
                    <div className="pane-control-label">
                      <strong>Sound Effects</strong>
                      <p>Enable game and UI micro-interaction audio</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={soundEffects}
                      onChange={() => setSoundEffects(prev => !prev)}
                      className="pane-checkbox"
                    />
                  </div>

                  <div className="pane-control-card slider-card">
                    <div className="pane-control-label">
                      <strong>Volume</strong>
                      <p>Master audio level ({soundVolume}%)</p>
                    </div>
                    <div className="pane-slider-wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                      {soundVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundVolume}
                        onChange={e => setSoundVolume(Number(e.target.value))}
                        className="pane-slider"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'display' && (
                <div className="settings-content-pane">
                  <h4 className="pane-title">DISPLAY & PERFORMANCE</h4>
                  
                  <div className="pane-control-card">
                    <div className="pane-control-label">
                      <strong>Fullscreen Mode</strong>
                      <p>Toggle client window fullscreen presentation</p>
                    </div>
                    <button onClick={handleToggleFullscreen} className="pane-button">
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
                      onChange={e => setCurrentTheme(e.target.value)}
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

              {activeSettingsTab === 'network' && (
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

              {activeSettingsTab === 'storage' && (
                <div className="settings-content-pane">
                  <h4 className="pane-title">IDENTITY & STORAGE</h4>
                  
                  {/* Embedded profile username update form */}
                  <div className="settings-modal-row" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Username</label>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      className="settings-modal-input"
                      placeholder="Username"
                    />
                  </div>
                  <div className="settings-modal-row" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Avatar Color</label>
                    <div className="avatar-color-picker" style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map(c => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={`avatar-color-circle ${editColor === c ? 'active' : ''}`}
                          style={{
                            backgroundColor: resolveAvatarColor(c),
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: editColor === c ? '2px solid #fff' : '2px solid transparent',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (editName.trim() && player) {
                        const updatedPlayer = { ...player!, name: editName, avatar: editColor };
                        setPlayer(updatedPlayer);
                        IdentityManager.savePlayer(updatedPlayer);
                        wsClient.send('player.identify', updatedPlayer);
                      }
                    }} 
                    className="settings-modal-save-btn"
                    style={{ marginTop: 12, alignSelf: 'flex-start' }}
                  >
                    SAVE PROFILE
                  </button>

                  <div className="pane-control-card" style={{ marginTop: 'auto', border: '1px dashed rgba(239,68,68,0.3)', padding: 12, background: 'rgba(239,68,68,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="pane-control-label">
                      <strong>Factory Reset</strong>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Clear profile data, cached matches, and logout</p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm("This will erase your saved name, avatar choices, and stats. Proceed?")) {
                          localStorage.clear();
                          window.location.reload();
                        }
                      }}
                      className="pane-button danger-btn"
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 850 }}
                    >
                      RESET ALL
                    </button>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'accessibility' && (
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
                      onChange={() => setHighContrast(prev => !prev)}
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
                      onChange={e => setTextScaling(e.target.value as any)}
                      className="pane-select"
                    >
                      <option value="normal">NORMAL</option>
                      <option value="large">LARGE (+20%)</option>
                    </select>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'about' && (
                <div className="settings-content-pane">
                  <h4 className="pane-title">ABOUT PLATFORM</h4>
                  <div className="pane-about-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className="pane-about-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src="/logo.png" alt="LAN Arcade" className="pane-about-logo" style={{ width: 48, height: 48, objectFit: 'contain' }} />
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

  const renderProfileModal = () => {
    if (!isProfileModalOpen || !player) return null;

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
          
          <div className="settings-modal-body" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Global Stats card */}
            <div className="profile-stats-card" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
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
                border: '2px solid rgba(255, 255, 255, 0.3)'
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
                onChange={e => setEditName(e.target.value)} 
                className="settings-modal-input"
                placeholder="Username"
              />
            </div>
            
            <div className="settings-modal-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
              <label>Avatar Color</label>
              <div className="avatar-color-picker">
                {['indigo', 'pink', 'emerald', 'amber', 'cyan', 'rose', 'violet'].map(c => (
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
                      outline: 'none'
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
                      cursor: 'pointer'
                    }}
                  >
                    {copiedId ? 'COPIED!' : 'COPY'}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to log out? This clears local session keys.")) {
                  localStorage.clear();
                  window.location.reload();
                }
              }} 
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
                borderStyle: 'solid'
              }}
            >
              LOGOUT
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
  bg: '#090b11',
  bgAlt: '#0d0f18',
  surface: 'rgba(255, 255, 255, 0.03)',
  surfaceHover: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255,255,255,0.06)',
  text: '#ffffff',
  textMuted: '#94a3b8',
  primary: '#2563eb',
  primaryGlow: 'rgba(37,99,235,0.15)',
  secondary: '#64748b',
  secondaryGlow: 'rgba(100,116,139,0.1)',
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
    background: 'linear-gradient(135deg, #ffffff 40%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
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
    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
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
    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    color: '#fff',
    padding: '14px 20px',
    fontWeight: 900,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
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
