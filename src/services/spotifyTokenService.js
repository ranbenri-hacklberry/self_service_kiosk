/**
 * SpotifyTokenService.js
 * 
 * Proactive token management for Spotify OAuth.
 * Ensures tokens are refreshed before expiry and synced across devices via Supabase.
 * Uses Dexie for offline fast-access.
 */
import { system_config } from '../db/database';
import { supabase } from '../lib/supabase';

const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state'
];

const CONFIG_KEY = 'spotify_token';
// Token expires in 1 hour usually. We refresh 10 minutes before.
const REFRESH_BUFFER = 10 * 60 * 1000;
const CHECK_INTERVAL = 60 * 1000; // Check every minute

export class SpotifyTokenService {
    constructor() {
        this.checkTimer = null;
        this.listeners = new Set();
        this.currentToken = null;
        this.isRefreshing = false;
    }

    /**
     * Start the proactive token manager
     */
    async start() {
        console.log('🎵 Starting SpotifyTokenService...');

        // 1. Try improved load from Dexie first (fastest)
        const localConfig = await system_config.get(CONFIG_KEY);

        if (localConfig && localConfig.value) {
            this.currentToken = localConfig.value;
            this.notifyListeners();
        }

        // 2. Start the check, loop
        this.checkTimer = setInterval(() => this.checkTokenStatus(), CHECK_INTERVAL);

        // 3. Immediate check
        await this.checkTokenStatus();
    }

    stop() {
        if (this.checkTimer) clearInterval(this.checkTimer);
    }

    /**
     * Subscribe to token updates
     * @param {Function} callback (token) => void
     */
    onTokenUpdate(callback) {
        this.listeners.add(callback);
        // Immediate callback if we have a valid token
        if (this.currentToken && !this.isExpired(this.currentToken)) {
            callback(this.currentToken.access_token);
        }
        return () => this.listeners.delete(callback);
    }

    notifyListeners() {
        if (!this.currentToken) return;
        const token = this.currentToken.access_token;
        for (const listener of this.listeners) {
            listener(token);
        }
    }

    /**
     * Main loop: Checks expiry and refreshes if needed.
     * Also syncs with Supabase to get the latest token from other devices (e.g. backend refresh).
     */
    async checkTokenStatus() {
        if (this.isRefreshing) return;

        try {
            // A. Fetch latest from Supabase (source of truth)
            const { data, error } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', CONFIG_KEY)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.warn('⚠️ Failed to fetch token from Supabase:', error);
            }

            if (data && data.value) {
                // Check if Supabase has a newer/different token
                if (!this.currentToken || data.value.access_token !== this.currentToken.access_token) {
                    console.log('🔄 Syncing token from cloud...');
                    await this.updateLocalToken(data.value);
                }
            }

            // B. Use local token to check expiry
            if (!this.currentToken) {
                console.log('⚠️ No token found. Login required.');
                return;
            }

            // C. Check if expired (or close to expiry)
            if (this.shouldRefresh(this.currentToken)) {
                await this.refreshToken();
            }

        } catch (err) {
            console.error('❌ Token check failed:', err);
        }
    }

    isExpired(tokenObj) {
        if (!tokenObj || !tokenObj.expires_at) return true;
        return Date.now() > tokenObj.expires_at;
    }

    shouldRefresh(tokenObj) {
        if (!tokenObj || !tokenObj.expires_at) return true;
        return Date.now() > (tokenObj.expires_at - REFRESH_BUFFER);
    }

    /**
     * Performs the refresh via backend API or internal logic.
     * For implicit flow, we might need to redirect. Ideally, we use refresh tokens via backend.
     */
    async refreshToken() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;

        try {
            console.log('🔄 Refreshing Spotify token...');

            // Assume we have a backend endpoint that handles the refresh using the refresh_token
            // stored securely (or passed here if allowed).
            // If strictly client-side without refresh token rotation, we can't truly refresh silently
            // without a backend proxy. Assuming backend proxy exists or we store refresh_token.

            // SCENARIO: Backend Proxy Refresh
            const response = await fetch('/api/spotify/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: this.currentToken?.refresh_token
                })
            });

            if (!response.ok) throw new Error('Refresh failed');

            const newTokenData = await response.json();

            // Calculate new expiry
            const expires_at = Date.now() + (newTokenData.expires_in * 1000);

            const tokenObj = {
                ...this.currentToken,
                ...newTokenData,
                expires_at
            };

            // DUAL WRITE: Save to Supabase + Dexie
            await this.saveToken(tokenObj);

        } catch (err) {
            console.error('❌ Failed to refresh token:', err);
            // If refresh fails, we might need to trigger re-login flow in UI
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Save token to both storages
     */
    async saveToken(tokenObj) {
        this.currentToken = tokenObj;

        // 1. Save to Dexie (Local)
        await system_config.put({
            id: CONFIG_KEY, // Use fixed ID/Key for single config
            key: CONFIG_KEY,
            value: tokenObj,
            updated_at: new Date()
        });

        // 2. Save to Supabase (Cloud)
        const { error } = await supabase
            .from('system_config')
            .upsert({
                key: CONFIG_KEY,
                value: tokenObj,
                updated_at: new Date()
            });

        if (error) console.error('⚠️ Failed to sync token to cloud:', error);

        this.notifyListeners();
    }

    async updateLocalToken(tokenObj) {
        this.currentToken = tokenObj;
        await system_config.put({
            id: CONFIG_KEY,
            key: CONFIG_KEY,
            value: tokenObj,
            updated_at: new Date()
        });
        this.notifyListeners();
    }

    // Check if we have a valid access token right now
    getToken() {
        if (this.currentToken && !this.isExpired(this.currentToken)) {
            return this.currentToken.access_token;
        }
        return null;
    }
}

export const spotifyTokenService = new SpotifyTokenService();
