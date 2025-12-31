import React from 'react';
import './SplashScreen.css';

const SplashScreen = () => {
    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <img src="/assets/images/icaffeos_logo.png" alt="iCaffeOS Logo" className="brand-logo-img" />
                <h1 className="brand-name">iCaffeOS</h1>
                <div className="loading-bar">
                    <div className="progress"></div>
                </div>
            </div>
            <p className="tagline">CoffeeShops Operating System</p>
        </div>
    );
};

export default SplashScreen;
