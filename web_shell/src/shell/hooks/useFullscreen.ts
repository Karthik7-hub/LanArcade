import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';

/**
 * Encapsulates fullscreen state, listeners, and toggle/restore/dismiss logic.
 *
 * Room-aware auto-fullscreen (e.g. "fullscreen when game starts") is NOT
 * handled here — callers should invoke `attemptFullscreen()` themselves
 * when the room state changes.
 */
export function useFullscreen() {
  const isConnected = useStore((s) => s.isConnected);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [showFsBanner, setShowFsBanner] = useState(false);

  const attemptFullscreen = useCallback(() => {
    if (
      localStorage.getItem('lan_fullscreen') === 'true' &&
      !document.fullscreenElement &&
      useStore.getState().isConnected
    ) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Auto-fullscreen attempt deferred/failed:', err.message);
        setShowFsBanner(true);
      });
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => {
          localStorage.setItem('lan_fullscreen', 'true');
          localStorage.setItem('fullscreen_enabled', 'true');
          setShowFsBanner(false);
        })
        .catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        localStorage.setItem('lan_fullscreen', 'false');
        localStorage.setItem('fullscreen_enabled', 'false');
        setShowFsBanner(false);
      }
    }
  }, []);

  const restoreFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen()
      .then(() => {
        localStorage.setItem('lan_fullscreen', 'true');
        localStorage.setItem('fullscreen_enabled', 'true');
        setShowFsBanner(false);
      })
      .catch((err) => {
        console.error(`Error restoring fullscreen: ${err.message}`);
      });
  }, []);

  const dismissBanner = useCallback(() => {
    localStorage.setItem('lan_fullscreen', 'false');
    localStorage.setItem('fullscreen_enabled', 'false');
    setShowFsBanner(false);
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (localStorage.getItem('lan_fullscreen') === 'true' && !fs && useStore.getState().isConnected) {
        setShowFsBanner(true);
      } else if (fs) {
        setShowFsBanner(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);

    // Initial check & attempt
    handleFsChange();
    if (useStore.getState().isConnected) {
      attemptFullscreen();
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [attemptFullscreen]);

  // Attempt auto-fullscreen reactively when connection is restored, or hide banner when disconnected
  useEffect(() => {
    if (isConnected) {
      attemptFullscreen();
    } else {
      setShowFsBanner(false);
    }
  }, [isConnected, attemptFullscreen]);

  return {
    isFullscreen,
    showFsBanner: isConnected && showFsBanner,
    attemptFullscreen,
    toggleFullscreen,
    restoreFullscreen,
    dismissBanner,
  };
}
