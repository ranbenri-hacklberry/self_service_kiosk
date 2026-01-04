import React, { useState, useEffect, useRef } from 'react';
import './SplashScreen.css';
import { supabase } from '../lib/supabase';

const SplashScreen = ({ onFinish }) => {
    const [minTimePassed, setMinTimePassed] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Track if we've already triggered finish to prevent double calls
    const finishTriggered = useRef(false);

    useEffect(() => {
        console.log('🎨 SplashScreen v3 mounted');

        // 1. Minimum display timer (2.0s)
        const timer = setTimeout(() => {
            setMinTimePassed(true);
        }, 2000);

        // 2. Check Authentication
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('👤 Auth check result:', user ? 'Logged In' : 'Guest');
            if (user) setIsAuthenticated(true);
            setAuthChecked(true);
        };
        checkAuth();

        return () => clearTimeout(timer);
    }, []);

    // 3. Coordinate Finish (Auto-redirect for EVERYONE)
    useEffect(() => {
        if (minTimePassed && authChecked && !finishTriggered.current) {
            finishTriggered.current = true;
            // Short delay for visual polish (let the cup animation settle)
            setTimeout(() => {
                onFinish();
            }, 500);
        }
    }, [minTimePassed, authChecked, onFinish]);

    const showButton = false; // Button is now permanently removed

    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                {/* 
                   Image Effect: 
                   Start: Opacity 0, Blur 20px, Grayscale
                   End: Opacity 1, No Blur, Color
                */}
                <img
                    src="/rainbow_cup.png" // Removed query param to use cached version if available
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

                    {/* Always show Loading Bar until transition */}
                    <div className="loading-bar">
                        <div className="progress"></div>
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
