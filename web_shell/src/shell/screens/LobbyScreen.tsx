import React, { useState, useEffect } from 'react';
import {
  User,
  Settings,
  Trophy,
  HelpCircle,
  Copy,
  LogOut,
} from 'lucide-react';
import { useStore } from '../store';
import { useConfirm } from '../components/ConfirmDialog';
import { useSettings } from '../hooks/useSettings';
import { useFullscreen } from '../hooks/useFullscreen';
import { wsClient, clearRoomFromUrl } from '../WebSocketClient';
import type { GameManifest } from '../../shared/types';

// Lobby Pane components
import LobbyPlayersPane from '../components/lobby/LobbyPlayersPane';
import LobbyRulesPane from '../components/lobby/LobbyRulesPane';
import LobbyLeaderboardPane from '../components/lobby/LobbyLeaderboardPane';
import LobbyProfilePane from '../components/lobby/LobbyProfilePane';
import LobbySystemPane from '../components/lobby/LobbySystemPane';
import LobbyActionFooter from '../components/lobby/LobbyActionFooter';
import { audioManager } from '../../plugin_runtime/AudioManager';

interface LobbyScreenProps {
  availableGames: GameManifest[];
  isViewingLobby: boolean;
  setIsViewingLobby: (val: boolean) => void;
  onOpenSettings: () => void;
  isPortrait?: boolean;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({
  availableGames,
  isViewingLobby,
  setIsViewingLobby,
  onOpenSettings,
  isPortrait,
}) => {
  const room = useStore((state) => state.room);
  const player = useStore((state) => state.player);
  const setPlayer = useStore((state) => state.setPlayer);

  const confirm = useConfirm();

  const {
    mute, setMute,
    masterVolume, setMasterVolume,
    sfxVolume, setSfxVolume,
    musicVolume, setMusicVolume,
    currentTheme,
    setCurrentTheme,
  } = useSettings();

  const { isFullscreen, toggleFullscreen: handleToggleFullscreen } = useFullscreen();

  // Tab state
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
    audioManager.playUI('click');
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

  const renderActiveTabPane = () => {
    switch (lobbyTab) {
      case 'players':
        return <LobbyPlayersPane room={room} isPortrait={isPortrait} />;
      case 'leaderboard':
        return <LobbyLeaderboardPane room={room} isPortrait={isPortrait} />;
      case 'rules':
        return (
          <LobbyRulesPane
            room={room}
            player={player}
            activeRuleTooltip={activeRuleTooltip}
            setActiveRuleTooltip={setActiveRuleTooltip}
            handleUpdateSetting={handleUpdateSetting}
            handlePresetChange={handlePresetChange}
            isPortrait={isPortrait}
          />
        );
      case 'profile':
        return (
          <LobbyProfilePane
            player={player}
            editName={editName}
            setEditName={setEditName}
            editColor={editColor}
            setEditColor={setEditColor}
            copiedId={copiedId}
            handleCopyId={handleCopyId}
            handleLogout={handleLogout}
            setPlayer={setPlayer}
            isPortrait={isPortrait}
          />
        );
      case 'settings':
        return (
          <LobbySystemPane
            mute={mute}
            setMute={setMute}
            masterVolume={masterVolume}
            setMasterVolume={setMasterVolume}
            sfxVolume={sfxVolume}
            setSfxVolume={setSfxVolume}
            musicVolume={musicVolume}
            setMusicVolume={setMusicVolume}
            isFullscreen={isFullscreen}
            handleToggleFullscreen={handleToggleFullscreen}
            currentTheme={currentTheme}
            setCurrentTheme={setCurrentTheme}
            handleLogout={handleLogout}
            isPortrait={isPortrait}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`full-screen lobby-screen ${isPortrait ? 'is-portrait' : 'is-landscape'}`} style={{ padding: 0 }}>
      <div className="waiting-container">
        {/* LEFT DASHBOARD PANEL (Sidebar in landscape, header/tabs in portrait) */}
        <div className="lobby-dashboard-left">
          {/* Top Bar (Portrait only) */}
          <div className="lobby-portrait-header">
            <button onClick={handleLeaveRoom} className="lobby-portrait-back-btn" title="Leave Room">
              <LogOut size={16} />
            </button>
            <div className="lobby-portrait-game-select">
              {player.id === room.hostId ? (
                <select
                  value={room.game.id}
                  onChange={(e) => {
                    wsClient.send('room.change_game', { gameId: e.target.value });
                  }}
                  className="game-select-input-new portrait-select"
                >
                  {availableGames.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="lobby-portrait-game-name">{room.game.name.toUpperCase()}</span>
              )}
            </div>
            <button
              onClick={() => {
                const inviteUrl = `${window.location.origin}/?room=${room.code}`;
                navigator.clipboard.writeText(inviteUrl);
                setCopiedRoomLink(true);
                setTimeout(() => setCopiedRoomLink(false), 2000);
              }}
              className="lobby-portrait-code-btn"
              title="Copy Invite Link"
            >
              <Copy size={12} />
              <span>#{room.code}</span>
              {copiedRoomLink && <span className="copied-tooltip">Copied</span>}
            </button>
          </div>

          {/* Room Code & Copy (Landscape only) */}
          <div className="dashboard-room-section">
            <div className="room-code-badge">#{room.code}</div>
            <button
              onClick={() => {
                const inviteUrl = `${window.location.origin}/?room=${room.code}`;
                navigator.clipboard.writeText(inviteUrl);
                setCopiedRoomLink(true);
                audioManager.playUI('success');
                setTimeout(() => setCopiedRoomLink(false), 2000);
              }}
              className="lobby-copy-btn-new"
              title="Copy Invite Link"
            >
              <Copy size={13} style={{ color: '#3b82f6' }} />
              <span>{copiedRoomLink ? 'COPIED!' : 'COPY LINK'}</span>
            </button>
          </div>

          {/* Navigation Tabs (Vertical in landscape, Horizontal in portrait) */}
          <div className="dashboard-tabs">
            <button
              onClick={() => { setLobbyTab('players'); audioManager.playUI('nav'); }}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'players' ? 'active' : ''}`}
            >
              <User size={14} />
              <span>PLAYERS ({room.players.length})</span>
            </button>
            <button
              onClick={() => { setLobbyTab('leaderboard'); audioManager.playUI('nav'); }}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'leaderboard' ? (isPortrait ? 'active active-pink' : 'active shadow-pink') : ''}`}
            >
              <Trophy size={14} />
              <span>{isPortrait ? 'SCORES' : 'LEADERBOARD'}</span>
            </button>
            <button
              onClick={() => { setLobbyTab('rules'); audioManager.playUI('nav'); }}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'rules' ? (isPortrait ? 'active active-green' : 'active shadow-green') : ''}`}
            >
              <HelpCircle size={14} />
              <span>{isPortrait ? 'RULES' : 'RULES & INFO'}</span>
            </button>
            <button
              onClick={() => { setLobbyTab('profile'); audioManager.playUI('nav'); }}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'profile' ? (isPortrait ? 'active active-indigo' : 'active shadow-indigo') : ''}`}
            >
              <User size={14} />
              <span>PROFILE</span>
            </button>
            <button
              onClick={() => { setLobbyTab('settings'); audioManager.playUI('nav'); }}
              className={`lobby-tab-btn-vertical ${lobbyTab === 'settings' ? 'active' : ''}`}
            >
              <Settings size={14} />
              <span>{isPortrait ? 'SYSTEM' : 'SETTINGS'}</span>
            </button>
          </div>

          {/* Start Section (Landscape only) */}
          <div className="dashboard-start-section">
            <LobbyActionFooter
              room={room}
              player={player}
              setIsViewingLobby={setIsViewingLobby}
              isPortrait={false}
            />
          </div>

          {/* Leave Room Button (Landscape only) */}
          <div className="dashboard-leave-section">
            <button onClick={handleLeaveRoom} className="lobby-btn-leave-new">
              <LogOut size={14} />
              <span>LEAVE ROOM</span>
            </button>
          </div>
        </div>

        {/* RIGHT CONTENT DISPLAY PANEL */}
        <div className="lobby-dashboard-right">
          {/* Header: Active game or dropdown (Landscape only) */}
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

          {/* Main content pane (reused for both) */}
          <div className="dashboard-right-content">
            {renderActiveTabPane()}
          </div>

          {/* Sticky actions (Portrait only) */}
          <div className="lobby-portrait-footer-actions">
            <LobbyActionFooter
              room={room}
              player={player}
              setIsViewingLobby={setIsViewingLobby}
              isPortrait={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyScreen;
