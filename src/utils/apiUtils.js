/**
 * Utility to get the Backend API URL with intelligent guessing.
 * Priority:
 * 1. VITE_MANAGER_API_URL from environment
 * 2. Intelligent guess based on current window location (port 8081)
 * 3. Fallback to production cloud URL
 */
export const getBackendApiUrl = () => {
    // 1. Check environment variable
    const envUrl = import.meta.env.VITE_MANAGER_API_URL || import.meta.env.VITE_DATA_MANAGER_API_URL;
    if (envUrl) {
        return envUrl.replace(/\/$/, '');
    }

    // 2. Intelligent Guess for Local Network / Docker
    // If we are on localhost, 127.0.0.1, or a LAN IP (192.168.x.x), try port 8081
    const { hostname, protocol } = window.location;
    const isLocalOrLan =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('100.') ||
        hostname.startsWith('172.');

    if (isLocalOrLan) {
        // Standardized local backend port is 8081
        return `${protocol}//${hostname}:8081`;
    }

    // 3. Last resort: Production Fallback
    return 'https://aimanageragentrani-625352399481.europe-west1.run.app';
};
