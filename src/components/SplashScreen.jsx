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
        console.log('🎨 SplashScreen v3.6 mounted');

        const initialize = async () => {
            try {
                // A. Version Check & Performance Support
                const { APP_VERSION } = await import('../version');
                const lastVersion = localStorage.getItem('app_version');

                // --- 🔋 WEAK DEVICE DETECTION & CLEANUP ---
                const isWeakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                if (isWeakDevice) {
                    console.log('🐌 Weak device detected. Activating Lite Mode...');
                    localStorage.setItem('lite_mode', 'true');
                    document.body.classList.add('lite-mode');
                } else {
                    localStorage.removeItem('lite_mode');
                    document.body.classList.remove('lite-mode');
                }

                // Deep memory cleanup
                sessionStorage.clear();

                // Selective localStorage pruning
                const keysToKeep = [
                    'app_version', 'kiosk_user', 'kiosk_auth_time', 'kiosk_mode',
                    'lite_mode', 'whats_new_seen_version', 'last_full_sync',
                    'last_sync_time', 'manager_auth_key', 'manager_employee_id'
                ];

                try {
                    const session = localStorage.getItem('kiosk_user');
                    const currentBusinessId = session ? JSON.parse(session).business_id : null;

                    Object.keys(localStorage).forEach(key => {
                        if (keysToKeep.includes(key)) return;
                        if (currentBusinessId && key.includes(currentBusinessId)) return;
                        if (key.startsWith('inventory_draft_') || key.startsWith('sync_queue_') || key.startsWith('loglevel')) {
                            localStorage.removeItem(key);
                        }
                    });
                } catch (e) {
                    console.warn('Pruning error:', e);
                }

                if (lastVersion && lastVersion !== APP_VERSION) {
                    console.warn(`🚨 VERSION CHANGE. Cleaning up old data...`);
                    localStorage.removeItem('last_full_sync');
                    try {
                        const { db } = await import('../db/database');
                        await db.delete();
                    } catch (e) { console.error(e); }
                }
                localStorage.setItem('app_version', APP_VERSION);

                // B. Auth Check & Daily Sync
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setIsAuthenticated(true);
                    setStatusText('מתחבר לענן...');

                    let businessId = user.user_metadata?.business_id;
                    if (!businessId) {
                        const { data: emp } = await supabase.from('employees')
                            .select('business_id')
                            .eq('auth_user_id', user.id)
                            .maybeSingle();
                        if (emp) businessId = emp.business_id;
                    }

                    if (businessId) {
                        setStatusText('מסנכרן נתונים...');
                        // ⏱️ TIMEOUT WRAPPER for sync
                        const syncPromise = initialLoad(businessId, (table, count, percent) => {
                            setStatusText(`טוען ${table}...`);
                        });

                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Sync Timeout')), 12000)
                        );

                        try {
                            await Promise.race([syncPromise, timeoutPromise]);
                            setStatusText('מוכן!');
                        } catch (timeoutErr) {
                            console.warn('⚠️ Sync too slow, skipping to app...');
                            setStatusText('טוען ממטמון...');
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Initialization error:', err);
                setStatusText('שגיאה בטעינה, ממשיך...');
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
