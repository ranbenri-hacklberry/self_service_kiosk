import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleSpotifyCallback } from '@/lib/spotifyService';

/**
 * Spotify OAuth Callback Handler
 * This page handles the redirect from Spotify after user authorization
 */
export default function SpotifyCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing');
    const [error, setError] = useState(null);

    useEffect(() => {
        async function processCallback() {
            const code = searchParams.get('code');
            const errorParam = searchParams.get('error');

            if (errorParam) {
                setStatus('error');
                setError(`Spotify authorization failed: ${errorParam}`);
                return;
            }

            if (!code) {
                setStatus('error');
                setError('No authorization code received from Spotify');
                return;
            }

            try {
                await handleSpotifyCallback(code);
                setStatus('success');

                // Redirect to music page after successful login
                setTimeout(() => {
                    navigate('/music', { replace: true });
                }, 1500);
            } catch (err) {
                console.error('Spotify callback error:', err);
                setStatus('error');
                setError(err.message || 'Failed to complete Spotify authentication');
            }
        }

        processCallback();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
            <div className="text-center p-8">
                {status === 'processing' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6">
                            <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="#1DB954"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="#1DB954"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            מתחבר ל-Spotify...
                        </h1>
                        <p className="text-gray-400">
                            אנא המתן בזמן שאנחנו מסיימים את תהליך ההתחברות
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 text-green-500">
                            <svg fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            התחברת בהצלחה! 🎉
                        </h1>
                        <p className="text-gray-400">
                            מעביר אותך לדף המוזיקה...
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 text-red-500">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            שגיאה בהתחברות
                        </h1>
                        <p className="text-red-400 mb-6">{error}</p>
                        <button
                            onClick={() => navigate('/music')}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-colors"
                        >
                            חזור לדף המוזיקה
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
