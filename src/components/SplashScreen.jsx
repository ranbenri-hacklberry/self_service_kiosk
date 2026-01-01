import React, { useState, useEffect } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onFinish }) => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setReady(true);
        }, 2500); // 2.5 seconds loading
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <img
                    src="/rainbow_cup.png"
                    alt="iCaffeOS Logo"
                    className="brand-logo-img"
                    style={{
                        filter: "drop-shadow(0 0 30px rgba(255, 250, 220, 0.6))", // Warm glow
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

                <div style={{ marginTop: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ready ? (
                        <button
                            onClick={onFinish}
                            style={{
                                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
                                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                backdropFilter: 'blur(10px)',
                                color: 'white',
                                padding: '14px 48px',
                                borderRadius: '12px',
                                fontWeight: '600',
                                fontSize: '1rem',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                cursor: 'pointer',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                                transition: 'all 0.3s ease',
                                letterSpacing: '0.5px'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                                e.target.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                                e.target.style.transform = 'translateY(0)';
                            }}
                        >
                            כניסה למערכת
                        </button>
                    ) : (
                        <div className="loading-bar">
                            <div className="progress"></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
