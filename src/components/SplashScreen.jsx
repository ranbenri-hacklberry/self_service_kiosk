import BrandLogo from './BrandLogo';

const SplashScreen = () => {
    return (
        <div className="splash-container">
            <div className="logo-wrapper">
                <BrandLogo size="large" variant="light" />
                <div className="loading-bar">
                    <div className="progress"></div>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
