import React, { useEffect, useState } from 'react';
import { useStore } from './shell/store';
import { wsClient } from './shell/WebSocketClient';
import { IdentityManager } from './shell/IdentityManager';
import GameLoader from './plugin_runtime/GameLoader';
import type { GameManifest } from './shared/types';

// Screen components
import LoginScreen from './shell/screens/LoginScreen';
import HomeScreen from './shell/screens/HomeScreen';
import LobbyScreen from './shell/screens/LobbyScreen';

// Overlay & Modal components
import PortraitOverlay from './shell/components/PortraitOverlay';
import ErrorAlert from './shell/components/ErrorAlert';
import SettingsModal from './shell/components/SettingsModal';
import ProfileModal from './shell/components/ProfileModal';
import FullscreenBanner from './shell/components/FullscreenBanner';

// Custom Hooks
import { useFullscreen } from './shell/hooks/useFullscreen';

const App: React.FC = () => {
  const isConnected = useStore((state) => state.isConnected);
  const player = useStore((state) => state.player);
  const room = useStore((state) => state.room);
  const errorAlert = useStore((state) => state.errorAlert);
  const setPlayer = useStore((state) => state.setPlayer);
  const setErrorAlert = useStore((state) => state.setErrorAlert);

  const [availableGames, setAvailableGames] = useState<GameManifest[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileModalOpen] = useState(false); // Can be triggered if profile edit path is expanded in the future
  const [isViewingLobby, setIsViewingLobby] = useState(() => {
    return localStorage.getItem('isViewingLobby') === 'true';
  });

  const {
    isFullscreen,
    showFsBanner,
    attemptFullscreen,
    restoreFullscreen,
    dismissBanner,
  } = useFullscreen();

  // Fetch available games list on mount
  useEffect(() => {
    fetch('/api/games')
      .then((res) => res.json())
      .then((games) => setAvailableGames(games))
      .catch(() => console.warn('Could not fetch game list'));
  }, []);

  // WebSocket connect + initial identity check on mount
  useEffect(() => {
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
  }, [setPlayer]);

  // Attempt fullscreen when room starts/changes status
  useEffect(() => {
    if (room) {
      attemptFullscreen();
    }
  }, [room, attemptFullscreen]);

  useEffect(() => {
    if (room && room.status !== 'waiting') {
      attemptFullscreen();
    }
  }, [room?.status, attemptFullscreen]);

  useEffect(() => {
    if (room && room.status === 'waiting') {
      setIsViewingLobby(false);
      localStorage.setItem('isViewingLobby', 'false');
    }
  }, [room?.status]);

  const renderView = () => {
    if (!isConnected) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0d0f18, #090b11)',
          color: '#ffffff',
          fontFamily: "'Inter', 'system-ui', sans-serif",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div className="app-spinner" style={{
              width: 48,
              height: 48,
              border: '4px solid rgba(255, 255, 255, 0.03)',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ fontWeight: 700, letterSpacing: 3, color: '#94a3b8', fontSize: 14 }}>CONNECTING TO ARCADE...</p>
          </div>
        </div>
      );
    }

    if (!player) {
      return <LoginScreen />;
    }

    if (!room) {
      return (
        <HomeScreen
          availableGames={availableGames}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      );
    }

    if (room.status !== 'waiting' && !isViewingLobby) {
      return <GameLoader onOpenSettings={() => setIsSettingsOpen(true)} />;
    }

    return (
      <LobbyScreen
        availableGames={availableGames}
        isViewingLobby={isViewingLobby}
        setIsViewingLobby={setIsViewingLobby}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    );
  };

  return (
    <>
      <PortraitOverlay />
      <ErrorAlert message={errorAlert} onDismiss={() => setErrorAlert(null)} />
      {renderView()}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isViewingLobby={isViewingLobby}
        setIsViewingLobby={setIsViewingLobby}
      />
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {}}
      />
      {showFsBanner && (
        <FullscreenBanner
          onRestore={restoreFullscreen}
          onDismiss={dismissBanner}
        />
      )}
    </>
  );
};

export default App;
