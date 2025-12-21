/**
 * Spotify API Service
 * Handles authentication and API calls to Spotify
 */

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
const SPOTIFY_SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-library-modify',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'streaming',
    'user-top-read',
    'user-read-recently-played',
].join(' ');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Storage keys
const STORAGE_KEYS = {
    ACCESS_TOKEN: 'spotify_access_token',
    REFRESH_TOKEN: 'spotify_refresh_token',
    TOKEN_EXPIRY: 'spotify_token_expiry',
    CODE_VERIFIER: 'spotify_code_verifier',
};

/**
 * Generate a random string for PKCE
 */
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

/**
 * Generate code challenge for PKCE
 */
async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Initiate Spotify OAuth login
 */
export async function loginWithSpotify() {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store verifier for later use (use sessionStorage for OAuth flow)
    sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope: SPOTIFY_SCOPES,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    });

    window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleSpotifyCallback(code) {
    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);

    if (!codeVerifier) {
        throw new Error('No code verifier found. Please try logging in again.');
    }

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_verifier: codeVerifier,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Failed to exchange code for tokens');
    }

    const data = await response.json();

    // Store tokens
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    localStorage.setItem(
        STORAGE_KEYS.TOKEN_EXPIRY,
        String(Date.now() + data.expires_in * 1000)
    );

    // Clean up verifier
    sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);

    return data;
}

/**
 * Refresh the access token
 */
export async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        // Clear tokens and require re-login
        logout();
        throw new Error('Failed to refresh token. Please log in again.');
    }

    const data = await response.json();

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    if (data.refresh_token) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    localStorage.setItem(
        STORAGE_KEYS.TOKEN_EXPIRY,
        String(Date.now() + data.expires_in * 1000)
    );

    return data.access_token;
}

/**
 * Get a valid access token (refreshes if needed)
 */
export async function getAccessToken() {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const tokenExpiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

    if (!accessToken) {
        return null;
    }

    // Refresh if token expires in less than 5 minutes
    if (tokenExpiry && Date.now() > Number(tokenExpiry) - 5 * 60 * 1000) {
        try {
            return await refreshAccessToken();
        } catch {
            return null;
        }
    }

    return accessToken;
}

/**
 * Check if user is logged in to Spotify
 */
export function isSpotifyLoggedIn() {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Logout from Spotify
 */
export function logout() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
}

/**
 * Make an authenticated API request to Spotify
 */
async function spotifyFetch(endpoint, options = {}) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        throw new Error('Not authenticated with Spotify');
    }

    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (response.status === 401) {
        // Token might be invalid, try refreshing
        try {
            const newToken = await refreshAccessToken();
            return fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    Authorization: `Bearer ${newToken}`,
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
        } catch {
            throw new Error('Authentication failed. Please log in again.');
        }
    }

    return response;
}

// ============================================
// Spotify API Methods
// ============================================

/**
 * Get current user's profile
 */
export async function getCurrentUser() {
    const response = await spotifyFetch('/me');
    if (!response.ok) throw new Error('Failed to get user profile');
    return response.json();
}

/**
 * Get user's saved tracks
 */
export async function getSavedTracks(limit = 50, offset = 0) {
    const response = await spotifyFetch(`/me/tracks?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to get saved tracks');
    return response.json();
}

/**
 * Get user's playlists
 */
export async function getUserPlaylists(limit = 50, offset = 0) {
    const response = await spotifyFetch(`/me/playlists?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to get playlists');
    return response.json();
}

/**
 * Get playlist tracks
 */
export async function getPlaylistTracks(playlistId, limit = 100, offset = 0) {
    const response = await spotifyFetch(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to get playlist tracks');
    return response.json();
}

/**
 * Get album details
 */
export async function getAlbum(albumId) {
    const response = await spotifyFetch(`/albums/${albumId}`);
    if (!response.ok) throw new Error('Failed to get album');
    return response.json();
}

/**
 * Get album tracks
 */
export async function getAlbumTracks(albumId, limit = 50, offset = 0) {
    const response = await spotifyFetch(`/albums/${albumId}/tracks?limit=${limit}&offset=${offset}`);
    if (!response.ok) throw new Error('Failed to get album tracks');
    return response.json();
}

/**
 * Search for tracks, artists, albums, or playlists
 */
export async function search(query, types = ['track'], limit = 20) {
    const params = new URLSearchParams({
        q: query,
        type: types.join(','),
        limit: String(limit),
    });
    const response = await spotifyFetch(`/search?${params.toString()}`);
    if (!response.ok) throw new Error('Search failed');
    return response.json();
}

/**
 * Get playback state
 */
export async function getPlaybackState() {
    const response = await spotifyFetch('/me/player');
    if (response.status === 204) return null;
    if (!response.ok) throw new Error('Failed to get playback state');
    return response.json();
}

/**
 * Start/resume playback
 */
export async function play(options = {}) {
    const response = await spotifyFetch('/me/player/play', {
        method: 'PUT',
        body: JSON.stringify(options),
    });
    if (!response.ok && response.status !== 204) {
        throw new Error('Failed to start playback');
    }
}

/**
 * Pause playback
 */
export async function pause() {
    const response = await spotifyFetch('/me/player/pause', {
        method: 'PUT',
    });
    if (!response.ok && response.status !== 204) {
        throw new Error('Failed to pause playback');
    }
}

/**
 * Skip to next track
 */
export async function skipToNext() {
    const response = await spotifyFetch('/me/player/next', {
        method: 'POST',
    });
    if (!response.ok && response.status !== 204) {
        throw new Error('Failed to skip to next');
    }
}

/**
 * Skip to previous track
 */
export async function skipToPrevious() {
    const response = await spotifyFetch('/me/player/previous', {
        method: 'POST',
    });
    if (!response.ok && response.status !== 204) {
        throw new Error('Failed to skip to previous');
    }
}

/**
 * Get available devices
 */
export async function getDevices() {
    const response = await spotifyFetch('/me/player/devices');
    if (!response.ok) throw new Error('Failed to get devices');
    return response.json();
}

/**
 * Transfer playback to a device
 */
export async function transferPlayback(deviceId, play = false) {
    const response = await spotifyFetch('/me/player', {
        method: 'PUT',
        body: JSON.stringify({
            device_ids: [deviceId],
            play,
        }),
    });
    if (!response.ok && response.status !== 204) {
        throw new Error('Failed to transfer playback');
    }
}

/**
 * Get recently played tracks
 */
export async function getRecentlyPlayed(limit = 50) {
    const response = await spotifyFetch(`/me/player/recently-played?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to get recently played');
    return response.json();
}

/**
 * Get user's top tracks
 */
export async function getTopTracks(timeRange = 'medium_term', limit = 50) {
    const response = await spotifyFetch(`/me/top/tracks?time_range=${timeRange}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to get top tracks');
    return response.json();
}

/**
 * Get user's top artists
 */
export async function getTopArtists(timeRange = 'medium_term', limit = 50) {
    const response = await spotifyFetch(`/me/top/artists?time_range=${timeRange}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to get top artists');
    return response.json();
}

/**
 * Save tracks to library
 */
export async function saveTracks(trackIds) {
    const response = await spotifyFetch('/me/tracks', {
        method: 'PUT',
        body: JSON.stringify({ ids: trackIds }),
    });
    if (!response.ok && response.status !== 200) {
        throw new Error('Failed to save tracks');
    }
}

/**
 * Remove tracks from library
 */
export async function removeTracks(trackIds) {
    const response = await spotifyFetch('/me/tracks', {
        method: 'DELETE',
        body: JSON.stringify({ ids: trackIds }),
    });
    if (!response.ok && response.status !== 200) {
        throw new Error('Failed to remove tracks');
    }
}

/**
 * Check if tracks are saved
 */
export async function checkSavedTracks(trackIds) {
    const response = await spotifyFetch(`/me/tracks/contains?ids=${trackIds.join(',')}`);
    if (!response.ok) throw new Error('Failed to check saved tracks');
    return response.json();
}

export default {
    loginWithSpotify,
    handleSpotifyCallback,
    isSpotifyLoggedIn,
    logout,
    getAccessToken,
    getCurrentUser,
    getSavedTracks,
    getUserPlaylists,
    getPlaylistTracks,
    getAlbum,
    getAlbumTracks,
    search,
    getPlaybackState,
    play,
    pause,
    skipToNext,
    skipToPrevious,
    getDevices,
    transferPlayback,
    getRecentlyPlayed,
    getTopTracks,
    getTopArtists,
    saveTracks,
    removeTracks,
    checkSavedTracks,
};
