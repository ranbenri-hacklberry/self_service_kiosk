import React, { useState, useEffect, useRef } from 'react';
import './SplashScreen.css';
import { supabase } from '../lib/supabase';
import { initialLoad } from '../services/syncService';

const SplashScreen = ({ onFinish }) => {
    const [minTimePassed, setMinTimePassed] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [syncComplete, setSyncComplete] = useState(false);
    const [statusText, setStatusText] = useState('');

    // Track if we've already triggered finish to prevent double calls
    const finishTriggered = useRef(false);

    useEffect(() => {
        console.log('🎨 SplashScreen v3.5 mounted');

        const initialize = async () => {
            // A. Version Check & Cleanup
            const { APP_VERSION } = await import('../context/AuthContext');
            const lastVersion = localStorage.getItem('app_version');

            if (lastVersion && lastVersion !== APP_VERSION) {
                console.warn(`🚨 VERSION MISMATCH (${lastVersion} -> ${APP_VERSION}). Performing silent cleanup...`);
                localStorage.removeItem('kiosk_mode');
                localStorage.removeItem('last_full_sync');
                localStorage.removeItem('last_sync_time');

                try {
                    const { db } = await import('../db/database');
                    await db.delete();
                    console.log('✅ Dexie database cleared');
                } catch (e) {
                    console.error('Failed to clear Dexie:', e);
                }
            }
            localStorage.setItem('app_version', APP_VERSION);

            // B. Auth Check & Daily Sync
            try {
                const { data: { user } } = await supabase.auth.getUser();
                console.log('👤 Auth check result:', user ? 'Logged In' : 'Guest');

                if (user) {
                    setIsAuthenticated(true);
                    setStatusText('מזהה משתמש...');

                    // Attempt to get business_id
                    let businessId = user.user_metadata?.business_id;
                    if (!businessId) {
                        try {
                            const { data: emp } = await supabase.from('employees')
                                .select('business_id')
                                .eq('auth_user_id', user.id)
                                .maybeSingle();
                            if (emp) businessId = emp.business_id;
                        } catch (e) {
                            console.warn('Failed to fetch employee record:', e);
                        }
                    }

                    if (businessId) {
                        setStatusText('מבצע סנכרון יומי...');
                        try {
                            await initialLoad(businessId, (table, count, percent) => {
                                setStatusText(`מסנכרן ${table} (${percent}%)...`);
                            });
                            setStatusText('הסנכרון הושלם בהצלחה!');
                        } catch (syncErr) {
                            console.error('Initial sync failed:', syncErr);
                            setStatusText('שגיאה בסנכרון (ממשיך...)');
                        }
                    } else {
                        setStatusText('לא נמצא עסק מקושר');
                    }
                }
            } catch (err) {
                console.error('Auth check error:', err);
            } finally {
                setAuthChecked(true);
                setSyncComplete(true);
            }
        };

        // 1. Minimum display timer (2.0s)
        const timer = setTimeout(() => {
            setMinTimePassed(true);
        }, 2000);

        // 2. Start initialization
        initialize();

        return () => clearTimeout(timer);
    }, []);

    // 3. Coordinate Finish (Auto-redirect)
    useEffect(() => {
        if (minTimePassed && authChecked && syncComplete && !finishTriggered.current) {
            finishTriggered.current = true;
            // Short delay for visual polish (let the cup animation settle)
            setTimeout(() => {
                onFinish();
            }, 500);
        }
    }, [minTimePassed, authChecked, syncComplete, onFinish]);

    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <img
                    src="/rainbow_cup.png"
                    alt="iCaffeOS Logo"
                    className="brand-logo-img"
                    onLoad={() => setImageLoaded(true)}
                    style={{
                        opacity: imageLoaded ? 1 : 0,
                        filter: imageLoaded ? "drop-shadow(0 0 30px rgba(255, 250, 220, 0.6))" : "blur(20px) grayscale(100%)",
                        transform: imageLoaded ? 'scale(1)' : 'scale(0.8)',
                        transition: "opacity 1.2s ease-out, filter 1.5s ease-out, transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        width: '220px',
                        height: 'auto',
                        marginBottom: '10px'
                    }}
                />

                <h1 className="brand-name" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' }}>
                    iCaffeOS
                </h1>
                <p className="tagline" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif' }}>
                    CoffeeShops Operating System
                </p>

                <div style={{ marginTop: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px' }}>
                    <div className="flex flex-col items-center gap-2 w-full">
                        <div className="loading-bar">
                            <div className="progress"></div>
                        </div>
                        {statusText && (
                            <p className="text-white/80 text-xs font-mono animate-pulse">{statusText}</p>
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default SplashScreen;
