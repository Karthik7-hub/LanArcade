import { useStore } from './store';
import { PlatformEvent } from '../shared/types';

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string = '';

  connect(url: string) {
    this.url = url;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('Connected to Lan Arcade Kernel');
      useStore.getState().setConnected(true);

      // Auto identify if player exists
      const player = useStore.getState().player;
      if (player) {
        this.send('player.identify', player);
      }
    };

    this.socket.onmessage = (event) => {
      const data: PlatformEvent = JSON.parse(event.data);
      useStore.getState().addDebugLog(`← IN: ${data.type}`);
      this.handleEvent(data);
    };

    this.socket.onclose = () => {
      console.log('Disconnected from Lan Arcade Kernel');
      useStore.getState().setConnected(false);
      setTimeout(() => this.connect(this.url), 2000);
    };
  }

  private handleEvent(event: PlatformEvent) {
    const store = useStore.getState();
    switch (event.type) {
      case 'player.identified':
        store.setPlayer(event.payload);
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
    }
  }
}

export const wsClient = new WebSocketClient();
