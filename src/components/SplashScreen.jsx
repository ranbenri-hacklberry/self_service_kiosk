import React, { useState, useEffect, useRef } from 'react';
import './SplashScreen.css';
import { supabase } from '../lib/supabase';
import { initialLoad } from '../services/syncService';

const SplashScreen = ({ onFinish }) => {
    const [minTimePassed, setMinTimePassed] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [syncComplete, setSyncComplete] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [showSkipButton, setShowSkipButton] = useState(false);
    const [tapCount, setTapCount] = useState(0);

    // Track if we've already triggered finish to prevent double calls
    const finishTriggered = useRef(false);

    // 🕵️ SECRET RESET: Tap logo 5 times to clear EVERYTHING
    const handleLogoTap = () => {
        const newCount = tapCount + 1;
        setTapCount(newCount);
        if (newCount >= 5) {
            console.warn('🧹 EMERGENCY RESET TRIGGERED!');
            localStorage.clear();
            sessionStorage.clear();
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
            }
            window.location.reload(true);
        }
    };

    useEffect(() => {
        console.log('🎨 SplashScreen v4.5.1 Robust mounted');

        // Global Safety Timeout - If NOTHING happens in 15 seconds, just go in.
        const globalRescueTimer = setTimeout(() => {
            console.error('🆘 GLOBAL SPLASH TIMEOUT - Forcing entry');
            setAuthChecked(true);
            setSyncComplete(true);
            setMinTimePassed(true);
        }, 15000);

        // Show skip button after 8 seconds
        const skipButtonTimer = setTimeout(() => setShowSkipButton(true), 8000);

        const initialize = async () => {
            try {
                // A. Version Check & Performance Support
                const { APP_VERSION } = await import('../version');
                const lastVersion = localStorage.getItem('app_version');

                // --- 🔋 WEAK DEVICE DETECTION ---
                const isWeakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
                    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
                    window.innerWidth < 1024 ||
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                if (isWeakDevice) {
                    localStorage.setItem('lite_mode', 'true');
                    document.body.classList.add('lite-mode');
                } else {
                    localStorage.removeItem('lite_mode');
                    document.body.classList.remove('lite-mode');
                }

                // Deep memory cleanup
                sessionStorage.clear();

                if (lastVersion && lastVersion !== APP_VERSION) {
                    localStorage.removeItem('last_full_sync');
                    try {
                        const { db } = await import('../db/database');
                        await db.delete();
                    } catch (e) { }
                }
                localStorage.setItem('app_version', APP_VERSION);

                // B. Auth Check & Daily Sync
                const authPromise = supabase.auth.getUser();
                const authTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth Timeout')), 5000));

                let userRecord = null;
                try {
                    const { data: { user } } = await Promise.race([authPromise, authTimeout]);
                    userRecord = user;
                } catch (e) {
                    console.warn('Auth check skipped or failed:', e);
                }

                if (userRecord) {
                    setStatusText('מתחבר...');
                    let businessId = userRecord.user_metadata?.business_id;

                    if (!businessId) {
                        try {
                            const { data: emp } = await supabase.from('employees')
                                .select('business_id')
                                .eq('auth_user_id', userRecord.id)
                                .maybeSingle();
                            if (emp) businessId = emp.business_id;
                        } catch (e) { }
                    }

                    if (businessId) {
                        setStatusText('מסנכרן...');
                        const syncPromise = initialLoad(businessId, (table) => setStatusText(`טוען ${table}...`));
                        const syncTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Sync Timeout')), 10000));

                        try {
                            await Promise.race([syncPromise, syncTimeout]);
                        } catch (e) {
                            console.warn('Sync issues, continuing...');
                            setStatusText('טוען ממטמון...');
                        }
                    }
                }
            } catch (err) {
                console.error('Initialization error:', err);
            } finally {
                setAuthChecked(true);
                setSyncComplete(true);
            }
        };

        const minTimer = setTimeout(() => setMinTimePassed(true), 2000);
        initialize();

        return () => {
            clearTimeout(minTimer);
            clearTimeout(globalRescueTimer);
            clearTimeout(skipButtonTimer);
        };
    }, []);

    // Coordinate Finish
    useEffect(() => {
        if (minTimePassed && authChecked && syncComplete && !finishTriggered.current) {
            finishTriggered.current = true;
            setTimeout(() => onFinish(), 500);
        }
    }, [minTimePassed, authChecked, syncComplete, onFinish]);

    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <img
                    src="/rainbow_cup.png"
                    alt="Logo"
                    className="brand-logo-img"
                    onClick={handleLogoTap}
                    onLoad={() => setImageLoaded(true)}
                    style={{
                        opacity: imageLoaded ? 1 : 0,
                        cursor: 'pointer',
                        width: '200px',
                        height: 'auto',
                        marginBottom: '10px'
                    }}
                />

                <h1 className="brand-name">iCaffeOS</h1>
                <p className="tagline">CoffeeShops Operating System</p>

                <div className="mt-12 flex flex-col items-center gap-4 w-full min-h-[100px]">
                    <div className="loading-bar">
                        <div className="progress"></div>
                    </div>
                    {statusText && (
                        <p className="text-white/60 text-[10px] font-mono animate-pulse uppercase tracking-widest">{statusText}</p>
                    )}

                    {showSkipButton && (
                        <button
                            onClick={() => {
                                localStorage.setItem('lite_mode', 'true');
                                onFinish();
                            }}
                            className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-full border border-white/20 transition-all animate-bounce"
                        >
                            דלג על סנכרון והכנס ➔ (Lite Mode)
                        </button>
                    )}
                </div>

                {tapCount > 0 && tapCount < 5 && (
                    <p className="text-white/20 text-[8px] mt-2">Reset in {5 - tapCount} taps...</p>
                )}
            </div>
        </div>
    );
};

export default SplashScreen;
