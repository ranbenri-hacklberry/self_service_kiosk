/**
 * Audio Strategy Pattern Implementation for Ambiance Engine.
 * Decouples the UI from the playback source (Spotify vs Local).
 */

import { local_assets } from '../db/database';

/*
 * Base Provider Interface (Abstract)
 * 
 * - type: 'spotify' | 'local'
 * - isReady(): boolean
 * - load(track: object): Promise<void>
 * - play(): Promise<void>
 * - pause(): Promise<void>
 * - seek(position_ms: number): Promise<void>
 * - setVolume(volume: 0-1): Promise<void>
 * - getCurrentState(): Promise<{ position: number, duration: number, is_playing: boolean }>
 */

class BaseProvider {
    constructor() {
        this.listeners = new Set();
    }

    on(event, callback) {
        this.listeners.add({ event, callback });
        return () => this.listeners.delete({ event, callback });
    }

    emit(event, data) {
        for (const listener of this.listeners) {
            if (listener.event === event) listener.callback(data);
        }
    }
}

/**
 * 🎵 Spotify Provider using Web Playback SDK
 */
export class SpotifyProvider extends BaseProvider {
    constructor(tokenService) {
        super();
        this.type = 'spotify';
        this.tokenService = tokenService;
        this.player = null;
        this.deviceId = null;
        this.isReady = false;

        // Auto-initialize when token is available
        this.tokenService.onTokenUpdate((token) => {
            if (!this.player && token) {
                this.initializePlayer(token);
            }
        });

        // Check immediate token
        const token = this.tokenService.getToken();
        if (token) this.initializePlayer(token);
    }

    initializePlayer(token) {
        if (window.Spotify) {
            this.player = new window.Spotify.Player({
                name: 'RanTunes Ambiance Web Player',
                getOAuthToken: cb => { cb(token); },
                volume: 0.5
            });

            this.player.addListener('ready', ({ device_id }) => {
                console.log('✅ Spotify Player Ready with Device ID', device_id);
                this.deviceId = device_id;
                this.isReady = true;
                this.emit('ready', { device_id });
            });

            this.player.addListener('player_state_changed', state => {
                if (!state) return;
                this.emit('state_changed', {
                    is_playing: !state.paused,
                    position: state.position,
                    duration: state.duration,
                    track_window: state.track_window
                });
            });

            this.player.connect();
        } else {
            // Load script if missing
            console.warn('⚠️ Spotify SDK not loaded. Please include script in index.html');
        }
    }

    async load(trackUri) {
        if (!this.deviceId) throw new Error('Spotify player not ready');

        // Keep in mind: To play a track, we need a premium account usually.
        // We use the Web API to start playback on this device.
        const token = this.tokenService.getToken();

        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [trackUri] }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
    }

    async play() {
        this.player?.resume();
    }

    async pause() {
        this.player?.pause();
    }

    async seek(position_ms) {
        this.player?.seek(position_ms);
    }

    async setVolume(vol) {
        this.player?.setVolume(vol);
    }

    async getCurrentState() {
        const state = await this.player?.getCurrentState();
        if (!state) return null;
        return {
            position: state.position,
            duration: state.duration,
            is_playing: !state.paused
        };
    }
}

/**
 * 📂 Local Provider using HTML5 Audio & IndexedDB
 */
export class LocalProvider extends BaseProvider {
    constructor() {
        super();
        this.type = 'local';
        this.audio = new Audio();
        this.currentTxId = null; // Transaction ID for consistency

        this.audio.addEventListener('timeupdate', () => {
            this.emit('state_changed', {
                is_playing: !this.audio.paused,
                position: this.audio.currentTime * 1000,
                duration: (this.audio.duration || 0) * 1000
            });
        });

        this.audio.addEventListener('ended', () => {
            this.emit('track_ended');
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Local Audio Error:', e);
            this.emit('error', e);
        });
    }

    async load(localAssetId) {
        // 1. Fetch file path from Dexie
        const asset = await local_assets.get(localAssetId);
        if (!asset) throw new Error(`Asset ${localAssetId} not found in local DB`);

        // 2. Construct local file URL (or blob URL if stored as blob)
        // For simplicity, we assume we need to serve it via a local backend proxy or file:// access (if Electron).
        // Since we are web-based, we likely need a backend route to stream the file:
        // GET /api/stream/music?path=...

        const streamUrl = `/api/music/stream?path=${encodeURIComponent(asset.file_path)}`;
        this.audio.src = streamUrl;
        this.audio.load();
    }

    async play() {
        return this.audio.play();
    }

    async pause() {
        this.audio.pause();
    }

    async seek(position_ms) {
        this.audio.currentTime = position_ms / 1000;
    }

    async setVolume(vol) {
        this.audio.volume = vol;
    }

    async getCurrentState() {
        return {
            position: this.audio.currentTime * 1000,
            duration: (this.audio.duration || 0) * 1000,
            is_playing: !this.audio.paused
        };
    }
}

/**
 * 🎛️ Audio Controller - The central brain.
 * Manages active provider, queue, and state transitions.
 */
export class AudioController {
    constructor(tokenService) {
        this.providers = {
            spotify: new SpotifyProvider(tokenService),
            local: new LocalProvider()
        };

        this.activeProvider = null;
        this.queue = [];
        this.currentIndex = -1;
        this.state = { isPlaying: false, currentTrack: null };
        this.listeners = new Set();

        // Bind events
        Object.values(this.providers).forEach(p => {
            p.on('state_changed', (s) => this.broadcastState(s));
            p.on('track_ended', () => this.next());
            p.on('error', (e) => console.error('Audio Controller Error:', e));
        });
    }

    onStateChange(cb) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    broadcastState(providerState) {
        // Merge with controller state
        const fullState = {
            ...this.state,
            ...providerState
        };
        for (const cb of this.listeners) cb(fullState);
    }

    /**
     * Switch context based on track type
     */
    async playTrack(track) {
        const type = track.type || (track.uri?.startsWith('spotify:') ? 'spotify' : 'local');

        // 1. Stop current if switching providers
        if (this.activeProvider && this.activeProvider.type !== type) {
            await this.activeProvider.pause();
        }

        this.activeProvider = this.providers[type];

        if (!this.activeProvider) {
            console.error(`No provider for type: ${type}`);
            return;
        }

        try {
            await this.activeProvider.load(type === 'spotify' ? track.uri : track.id);
            await this.activeProvider.play();

            this.state.currentTrack = track;
            this.state.isPlaying = true;
            this.broadcastState({ is_playing: true });
        } catch (e) {
            console.error('Play failed:', e);
        }
    }

    async togglePlay() {
        if (!this.activeProvider) return;
        const s = await this.activeProvider.getCurrentState();
        if (s?.is_playing) {
            await this.activeProvider.pause();
        } else {
            await this.activeProvider.play();
        }
    }

    async next() {
        // Basic queue logic
        if (this.queue.length > 0) {
            // ... implement queue management
            console.log('Next track...');
        }
    }
}
