import React from 'react';
import './SplashScreen.css';

const SplashScreen = () => {
    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <div className="ai-coffee-icon">☕</div>
                <h1 className="brand-name">Rani's DAO</h1>
                <div className="loading-bar">
                    <div className="progress"></div>
                </div>
            </div>
            <p className="tagline">Local AI, Fresh Community</p>
        </div>
    );
};

export default SplashScreen;
