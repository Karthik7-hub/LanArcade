import { useSettingsStore } from '../shell/hooks/useSettings';

class AudioManager {
  private ctx: AudioContext | null = null;
  private cache: Record<string, AudioBuffer> = {};
  private activeSources: Set<{ source: AudioBufferSourceNode; gainNode: GainNode; category: 'sfx' | 'music' | 'ui' }> = new Set();
  
  private mute: boolean = false;
  private masterVolume: number = 80;
  private sfxVolume: number = 80;
  private musicVolume: number = 80;

  constructor() {
    // Initial sync from Zustand settings
    const settings = useSettingsStore.getState();
    this.mute = settings.mute ?? false;
    this.masterVolume = settings.masterVolume ?? 80;
    this.sfxVolume = settings.sfxVolume ?? 80;
    this.musicVolume = settings.musicVolume ?? 80;

    // Subscribe to store changes reactively
    useSettingsStore.subscribe((state) => {
      this.mute = state.mute;
      this.masterVolume = state.masterVolume;
      this.sfxVolume = state.sfxVolume;
      this.musicVolume = state.musicVolume;
      
      // Instantly adjust active playback volumes
      this.updateActiveVolumes();
    });

    // Auto-unlock helper on first valid gesture
    const unlock = () => {
      this.unlockCtx().then(() => {
        window.removeEventListener('click', unlock, true);
        window.removeEventListener('touchstart', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      });
    };
    window.addEventListener('click', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  private async getCtx(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser');
      }
      this.ctx = new AudioContextClass();
      console.log(`[Audio] AudioContext created. Initial state: ${this.ctx.state}`);
    }
    return this.ctx;
  }

  private async unlockCtx(): Promise<void> {
    try {
      const ctx = await this.getCtx();
      if (ctx.state === 'suspended') {
        console.log('[Audio] AudioContext is suspended. Resuming on user gesture...');
        await ctx.resume();
        console.log(`[Audio] AudioContext unlocked and resumed. State: ${ctx.state}`);
      }
    } catch (err) {
      console.error('[Audio] Failed to unlock AudioContext:', err);
    }
  }

  // Preloads a game's sound effects
  public async preloadGameSounds(gameId: string, soundNames: string[]): Promise<void> {
    console.log(`[Audio] Preloading sound effects for game "${gameId}":`, soundNames);
    const promises = soundNames.map(name => this.loadSound(gameId, name));
    await Promise.allSettled(promises);
  }

  // Loads a sound file (fetching & decoding)
  private async loadSound(gameId: string, soundName: string): Promise<AudioBuffer> {
    const key = `${gameId}:${soundName}`;
    if (this.cache[key]) {
      return this.cache[key];
    }

    const url = `/games/${gameId}/${soundName}.wav`;
    console.log(`[Audio] Loading sound: ${key} from ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const ctx = await this.getCtx();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      this.cache[key] = audioBuffer;
      console.log(`[Audio] Successfully loaded and cached sound: ${key}`);
      return audioBuffer;
    } catch (err) {
      console.error(`[Audio] Failed to load sound "${soundName}" from ${url}:`, err);
      throw err;
    }
  }

  // Plays a specific game sound
  public async play(gameId: string, soundName: string, category: 'sfx' | 'music' | 'ui' = 'sfx'): Promise<void> {
    console.log(`[Audio] Playback requested: sound="${soundName}", game="${gameId}", category="${category}"`);
    
    if (this.mute) {
      console.log(`[Audio] Playback suppressed: Audio is muted.`);
      return;
    }

    try {
      const buffer = await this.loadSound(gameId, soundName);
      const ctx = await this.getCtx();
      await this.unlockCtx();

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = this.calculateVolume(category);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const activeSound = { source, gainNode, category };
      this.activeSources.add(activeSound);

      source.onended = () => {
        this.activeSources.delete(activeSound);
        console.log(`[Audio] Playback completed: sound="${soundName}", game="${gameId}"`);
      };

      source.start(0);
      console.log(`[Audio] Playback started: sound="${soundName}", game="${gameId}"`);
    } catch (err) {
      console.error(`[Audio] Playback failed: sound="${soundName}", game="${gameId}". Error:`, err);
    }
  }

  // Plays synthesized UI sound effects
  public async playUI(soundType: string): Promise<void> {
    console.log(`[Audio] UI Playback requested: soundType="${soundType}"`);
    if (this.mute) return;

    try {
      const ctx = await this.getCtx();
      await this.unlockCtx();

      const gainNode = ctx.createGain();
      gainNode.gain.value = this.calculateVolume('ui');

      const osc = ctx.createOscillator();
      const now = ctx.currentTime;

      if (soundType === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (soundType === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(554.37, now + 0.08); // C#5
        osc.frequency.setValueAtTime(659.25, now + 0.16); // E5
        osc.frequency.setValueAtTime(880, now + 0.24); // A5
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.6, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.42);
      } else if (soundType === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.setValueAtTime(110, now + 0.1);
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.6, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (soundType === 'nav') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.03);
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (soundType === 'join') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (soundType === 'leave') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(783.99, now); // G5
        osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.18); // C4
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (soundType === 'ready') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now); // E5
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.6, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, now); // E6
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(this.calculateVolume('ui') * 0.2, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.26);
        osc2.stop(now + 0.16);
      } else if (soundType === 'countdown') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gainNode.gain.setValueAtTime(this.calculateVolume('ui') * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      }

      console.log(`[Audio] UI Playback started: soundType="${soundType}"`);
    } catch (err) {
      console.error(`[Audio] UI Playback failed: soundType="${soundType}". Error:`, err);
    }
  }

  private calculateVolume(category: 'sfx' | 'music' | 'ui'): number {
    const master = this.masterVolume / 100;
    const catVol = (category === 'music' ? this.musicVolume : this.sfxVolume) / 100;
    return master * catVol;
  }

  private updateActiveVolumes(): void {
    this.activeSources.forEach(({ gainNode, category }) => {
      try {
        if (this.mute) {
          gainNode.gain.value = 0;
        } else {
          gainNode.gain.value = this.calculateVolume(category);
        }
      } catch (err) {
        console.warn('[Audio] Failed to update active playback volume:', err);
      }
    });
  }
}

export const audioManager = new AudioManager();
