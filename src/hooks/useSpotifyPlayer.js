import { useState, useEffect, useCallback, useRef } from 'react';
import { getAccessToken } from '@/lib/spotifyService';

/**
 * Spotify Web Playback SDK Hook
 * Enables playing Spotify music directly in the browser
 */
export function useSpotifyPlayer() {
    const [player, setPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [lastTimestamp, setLastTimestamp] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [error, setError] = useState(null);

    const playerRef = useRef(null);
    const positionInterval = useRef(null);
    const isActiveDevice = useRef(false);

    // Initialize the Spotify Player
    useEffect(() => {
        // Load Spotify SDK script
        if (!window.Spotify) {
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            document.body.appendChild(script);
        }

        window.onSpotifyWebPlaybackSDKReady = async () => {
            const token = await getAccessToken();
            if (!token) {
                setError('No Spotify token available');
                return;
            }

            const spotifyPlayer = new window.Spotify.Player({
                name: 'Sfat Hamidbar Music Player',
                getOAuthToken: async cb => {
                    const freshToken = await getAccessToken();
                    cb(freshToken);
                },
                volume: volume,
            });

            // Error handling
            spotifyPlayer.addListener('initialization_error', ({ message }) => {
                console.error('Spotify init error:', message);
                setError(message);
            });

            spotifyPlayer.addListener('authentication_error', ({ message }) => {
                console.error('Spotify auth error:', message);
                setError(message);
            });

            spotifyPlayer.addListener('account_error', ({ message }) => {
                console.error('Spotify account error:', message);
                setError('Premium account required for playback');
            });

            spotifyPlayer.addListener('playback_error', ({ message }) => {
                console.error('Spotify playback error:', message);
            });

            // Playback status updates
            spotifyPlayer.addListener('player_state_changed', state => {
                if (!state) {
                    isActiveDevice.current = false;
                    return;
                }

                isActiveDevice.current = true;
                setCurrentTrack(state.track_window.current_track);
                setIsPlaying(!state.paused);

                setPosition(state.position);
                setLastTimestamp(Date.now());
                setDuration(state.duration);
            });

            // Ready
            spotifyPlayer.addListener('ready', ({ device_id }) => {
                console.log('🎵 Spotify Player ready with Device ID:', device_id);
                setDeviceId(device_id);
                setIsReady(true);
                // On ready, we don't necessarily know if it's active yet
                isActiveDevice.current = false;
            });

            // Not Ready
            spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setIsReady(false);
            });

            // Connect to the player
            const success = await spotifyPlayer.connect();
            if (success) {
                console.log('🎵 Connected to Spotify!');
                playerRef.current = spotifyPlayer;
                setPlayer(spotifyPlayer);
            }
        };

        // If SDK already loaded
        if (window.Spotify) {
            window.onSpotifyWebPlaybackSDKReady();
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
            }
            if (positionInterval.current) {
                clearInterval(positionInterval.current);
            }
        };
    }, []);

    // Update position more smoothly when playing
    useEffect(() => {
        if (isPlaying && !error) {
            positionInterval.current = setInterval(() => {
                setPosition(prev => {
                    const next = prev + 500;
                    return (duration > 0 && next > duration) ? duration : next;
                });
            }, 500);
        }

        return () => {
            if (positionInterval.current) clearInterval(positionInterval.current);
        };
    }, [isPlaying, duration, error]);

    // Helper to check if this device is active
    const checkIsActive = async () => {
        if (!playerRef.current) return false;
        const state = await playerRef.current.getCurrentState();
        return !!state;
    };

    // Keep track of active device via state updates
    useEffect(() => {
        if (player) {
            player.addListener('player_state_changed', state => {
                if (state) {
                    isActiveDevice.current = true;
                }
            });
        }
    }, [player]);

    // Play a specific track or album
    const play = useCallback(async (spotifyUri, positionMs = 0) => {
        if (!deviceId) {
            setError('No device available');
            return;
        }

        const token = await getAccessToken();
        if (!token) return;

        try {
            // Check if active directly from SDK
            const isActive = await checkIsActive();

            if (!isActive) {
                console.log('🎵 Device not active, transferring playback...', deviceId);
                await fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        device_ids: [deviceId],
                        play: false, // Don't start playing old song
                    }),
                });

                // Wait significantly longer for device to wake up
                await new Promise(resolve => setTimeout(resolve, 1500));
                isActiveDevice.current = true;
            }

            // Send specific play command
            const isTrack = spotifyUri?.includes(':track:');
            const body = isTrack
                ? { uris: [spotifyUri], position_ms: positionMs }
                : { context_uri: spotifyUri, position_ms: positionMs };

            console.log('🎵 Sending play command:', spotifyUri);
            const playResponse = await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                }
            );

            if (!playResponse.ok) {
                const errData = await playResponse.json().catch(() => ({}));
                console.warn('🎵 Play command failed:', errData);

                // Retry once if error
                console.log('🎵 Retrying play command in 1s...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                });
            }

            // Forced check to ensure it remains playing
            setTimeout(async () => {
                if (playerRef.current) {
                    const state = await playerRef.current.getCurrentState();
                    // If it was supposed to be playing but turned to pause immediately
                    if (state && state.paused && !state.loading) {
                        console.log('🎵 Detected auto-pause/stop, forcing resume...');
                        await playerRef.current.resume();
                    }
                }
            }, 1000);

            // Second check
            setTimeout(async () => {
                if (playerRef.current) {
                    const state = await playerRef.current.getCurrentState();
                    if (state && state.paused && !state.loading) {
                        console.log('🎵 Final resume check...');
                        await playerRef.current.resume();
                    }
                }
            }, 3000);

        } catch (err) {
            console.error('Spotify Play error:', err);
            setError(err.message);
        }
    }, [deviceId]);

    // Play a list of tracks
    const playTracks = useCallback(async (trackUris, startIndex = 0) => {
        if (!deviceId) {
            setError('No device available');
            return;
        }

        const token = await getAccessToken();
        if (!token) return;

        try {
            const isActive = await checkIsActive();

            if (!isActive) {
                console.log('🎵 Playlist: Device not active, transferring...', deviceId);
                await fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        device_ids: [deviceId],
                        play: false,
                    }),
                });
                await new Promise(resolve => setTimeout(resolve, 1500));
                isActiveDevice.current = true;
            }

            console.log('🎵 Sending playTracks command for', trackUris.length, 'tracks');
            const playResponse = await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        uris: trackUris,
                        offset: { position: startIndex },
                    }),
                }
            );

            if (!playResponse.ok) {
                const errData = await playResponse.json().catch(() => ({}));
                console.warn('🎵 PlayTracks command failed:', errData);

                console.log('🎵 Retrying playTracks in 1s...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        uris: trackUris,
                        offset: { position: startIndex },
                    }),
                });
            }

            // Forced check to ensure it starts playing
            setTimeout(async () => {
                if (playerRef.current) {
                    const state = await playerRef.current.getCurrentState();
                    if (state && state.paused && !state.loading) {
                        console.log('🎵 Playlist: Detected auto-pause, forcing resume...');
                        await playerRef.current.resume();
                    }
                }
            }, 1000);

            // Second check
            setTimeout(async () => {
                if (playerRef.current) {
                    const state = await playerRef.current.getCurrentState();
                    if (state && state.paused && !state.loading) {
                        console.log('🎵 Playlist: Final resume attempt...');
                        await playerRef.current.resume();
                    }
                }
            }, 3000);

        } catch (err) {
            console.error('Spotify PlayTracks error:', err);
        }
    }, [deviceId]);

    // Toggle play/pause
    const togglePlay = useCallback(async () => {
        if (player) {
            await player.togglePlay();
        }
    }, [player]);

    // Pause
    const pause = useCallback(async () => {
        if (player) {
            await player.pause();
        }
    }, [player]);

    // Resume
    const resume = useCallback(async () => {
        if (player) {
            await player.resume();
        }
    }, [player]);

    // Next track
    const nextTrack = useCallback(async () => {
        if (player) {
            await player.nextTrack();
        }
    }, [player]);

    // Previous track
    const previousTrack = useCallback(async () => {
        if (player) {
            await player.previousTrack();
        }
    }, [player]);

    // Seek
    const seek = useCallback(async (positionMs) => {
        if (player) {
            await player.seek(positionMs);
            setPosition(positionMs);
        }
    }, [player]);

    // Set volume
    const setPlayerVolume = useCallback(async (vol) => {
        if (player) {
            await player.setVolume(vol);
            setVolume(vol);
        }
    }, [player]);

    return {
        player,
        deviceId,
        isReady,
        isPlaying,
        currentTrack,
        position,
        duration,
        volume,
        error,
        play,
        playTracks,
        togglePlay,
        pause,
        resume,
        nextTrack,
        previousTrack,
        seek,
        setVolume: setPlayerVolume,
    };
}

export default useSpotifyPlayer;
