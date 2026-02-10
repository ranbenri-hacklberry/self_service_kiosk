import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const CONTAINER_NAME = 'supabase_db_scarlet-zodiac';

/**
 * Checks if the Docker container is running and attempts to start it if not.
 */
export const checkDockerStatus = async () => {
    try {
        // Check if container is running
        const { stdout } = await execAsync(`docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Status}}"`);

        if (!stdout || !stdout.includes('Up')) {
            console.warn(`⚠️ [Watchdog] ${CONTAINER_NAME} is not running. Attempting to start...`);

            // Try to start it
            await execAsync(`docker start ${CONTAINER_NAME}`);
            console.log(`✅ [Watchdog] ${CONTAINER_NAME} started successfully.`);
            return { status: 'restarted', name: CONTAINER_NAME };
        }

        return { status: 'running', name: CONTAINER_NAME };
    } catch (error) {
        // If container doesn't exist or docker is down
        if (error.message.includes('No such container')) {
            console.error(`❌ [Watchdog] Critical: Container ${CONTAINER_NAME} not found on this system.`);
        } else {
            console.error(`❌ [Watchdog] Error checking Docker status:`, error.message);
        }
        return { status: 'error', error: error.message };
    }
};

/**
 * Starts a periodic check of the Docker container status.
 * @param {number} intervalMs - Frequency of checks (default 1 minute)
 */
export const startDockerWatchdog = (intervalMs = 60000) => {
    console.log(`🛡️ [Watchdog] Starting Docker Watchdog for ${CONTAINER_NAME} (Interval: ${intervalMs}ms)`);

    // Initial check
    checkDockerStatus();

    // Set interval for subsequent checks
    const intervalId = setInterval(async () => {
        await checkDockerStatus();
    }, intervalMs);

    return intervalId;
};

export default { checkDockerStatus, startDockerWatchdog };
