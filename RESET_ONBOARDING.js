/**
 * Reset Onboarding Session
 * Run this in browser console on localhost:4028/onboarding
 */

// Clear IndexedDB
indexedDB.deleteDatabase('OnboardingDB').onsuccess = () => {
    console.log('✅ Cleared IndexedDB');
};

// Clear localStorage
Object.keys(localStorage).forEach(key => {
    if (key.includes('onboarding') || key.includes('zustand')) {
        localStorage.removeItem(key);
    }
});

console.log('✅ Cleared localStorage');
console.log('🔄 Refresh the page to start fresh!');
