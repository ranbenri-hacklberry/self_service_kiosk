// Placeholder DriveSync class for Google Drive sync functionality
// This is a minimal implementation to prevent import errors

export default class DriveSync {
    constructor(serviceAccountPath, localMusicDir) {
        this.serviceAccountPath = serviceAccountPath;
        this.localMusicDir = localMusicDir;
    }

    async performSync() {
        console.log('🔄 DriveSync: Performing sync (placeholder implementation)');
        return {
            syncedFiles: 0,
            skippedFiles: 0,
            errors: [],
            message: 'DriveSync placeholder - no files synced'
        };
    }
}
