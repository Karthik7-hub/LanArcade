import { useStore } from './store';
import { PlatformEvent } from '../shared/types';
import { IdentityManager } from './IdentityManager';

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string = '';
  private reconnectTimer: any = null;
  private messageQueue: { type: string; payload: any }[] = [];
  private pingInterval: any = null;

  connect(url: string) {
    this.url = url;
    this.cleanup();

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('Connected to Lan Arcade Kernel');
      useStore.getState().setConnected(true);

      // Auto identify if player exists
      const player = useStore.getState().player;
      if (player) {
        this.send('player.identify', player);
      }

      // Flush message queue
      const queue = [...this.messageQueue];
      this.messageQueue = [];
      queue.forEach((msg) => {
        this.send(msg.type, msg.payload);
      });

      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      const data: PlatformEvent = JSON.parse(event.data);
      useStore.getState().addDebugLog(`← IN: ${data.type}`);
      this.handleEvent(data);
    };

    this.socket.onclose = () => {
      console.log('Disconnected from Lan Arcade Kernel');
      useStore.getState().setConnected(false);
      this.scheduleReconnect();
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  private cleanup() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      try {
        this.socket.close();
      } catch (_) {}
      this.socket = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.url);
    }, 2000);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send('ping', null);
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleEvent(event: PlatformEvent) {
    const store = useStore.getState();
    switch (event.type) {
      case 'pong':
        break;
      case 'player.identified':
        store.setPlayer(event.payload);
        IdentityManager.savePlayer(event.payload);
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('room');
        if (roomCode) {
          console.log('Auto-joining room:', roomCode);
          this.send('room.join', { code: roomCode });
        }
        break;
      case 'room.update':
        store.setRoom(event.payload);
        if (event.payload) {
          if (event.payload.status === 'waiting') {
            store.setPublicGameState(null);
            store.setPrivateGameState(null);
          } else if (event.payload.publicGameState) {
            store.setPublicGameState(event.payload.publicGameState);
          }
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('room') !== event.payload.code) {
            urlParams.set('room', event.payload.code);
            window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
          }
        } else {
          store.setPublicGameState(null);
          store.setPrivateGameState(null);
          window.history.replaceState({}, '', window.location.pathname);
        }
        break;
      case 'game.public_state':
        store.setPublicGameState(event.payload);
        break;
      case 'game.private_state':
        store.setPrivateGameState(event.payload);
        break;
      case 'system.error':
        console.error('System Error:', event.payload);
        store.setErrorAlert(String(event.payload));
        break;
      default:
        console.warn('Unknown event type:', event.type);
    }
  }

  send(type: string, payload: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      useStore.getState().addDebugLog(`→ OUT: ${type}`);
      this.socket.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('Socket not open. Queueing message:', type);
      if (type.startsWith('game.') || type.startsWith('room.')) {
        this.messageQueue.push({ type, payload });
      }
    }
  }
}

export const wsClient = new WebSocketClient();

