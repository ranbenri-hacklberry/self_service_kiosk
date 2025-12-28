/**
 * Image Caching Service
 * Caches menu item images for offline access
 * 
 * @module services/imageCache
 */

import { db } from '../db/database';

// Maximum age before re-caching (7 days in milliseconds)
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Cache an image from URL to IndexedDB
 * @param {string} imageUrl - The image URL to cache
 * @returns {Promise<string|null>} - Base64 data URL or null on failure
 */
export const cacheImage = async (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return null;

    try {
        // Check if already cached and not too old
        const existing = await db.cached_images.get(imageUrl);
        if (existing && (Date.now() - existing.cached_at) < MAX_CACHE_AGE) {
            return existing.data; // Return cached version
        }

        // Fetch the image
        const response = await fetch(imageUrl, { mode: 'cors' });
        if (!response.ok) throw new Error('Failed to fetch image');

        const blob = await response.blob();

        // Convert to base64 data URL
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        // Store in Dexie
        await db.cached_images.put({
            url: imageUrl,
            data: dataUrl,
            cached_at: Date.now(),
            size: blob.size
        });

        console.log(`🖼️ Cached image: ${imageUrl.slice(-30)}`);
        return dataUrl;
    } catch (error) {
        console.warn(`Failed to cache image: ${imageUrl}`, error);
        return null;
    }
};

/**
 * Get a cached image, falling back to network
 * @param {string} imageUrl - The image URL
 * @returns {Promise<string>} - Data URL or original URL
 */
export const getCachedImage = async (imageUrl) => {
    if (!imageUrl) return null;

    try {
        // Check cache first
        const cached = await db.cached_images.get(imageUrl);
        if (cached && cached.data) {
            return cached.data;
        }

        // If online, return original URL (and cache in background)
        if (navigator.onLine) {
            cacheImage(imageUrl); // Fire and forget
            return imageUrl;
        }

        // Offline and not cached - return null
        return null;
    } catch (error) {
        console.warn('Error getting cached image:', error);
        return imageUrl; // Fallback to original URL
    }
};

/**
 * Pre-cache images for all menu items
 * Call this when app loads or syncs
 * @param {Array} menuItems - Array of menu items with image_url
 */
export const preCacheMenuImages = async (menuItems) => {
    if (!menuItems || !Array.isArray(menuItems)) return;

    const imageUrls = menuItems
        .filter(item => item.image_url)
        .map(item => item.image_url);

    if (imageUrls.length === 0) return;

    console.log(`🖼️ Pre-caching ${imageUrls.length} menu images...`);

    // Cache in batches to avoid overwhelming the browser
    const batchSize = 5;
    for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);
        await Promise.all(batch.map(url => cacheImage(url)));

        // Small delay between batches
        if (i + batchSize < imageUrls.length) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    console.log(`✅ Finished caching ${imageUrls.length} images`);
};

/**
 * Clear old cached images
 * @param {number} maxAge - Max age in ms (default 7 days)
 */
export const cleanOldCache = async (maxAge = MAX_CACHE_AGE) => {
    try {
        const cutoff = Date.now() - maxAge;
        const old = await db.cached_images
            .filter(img => img.cached_at < cutoff)
            .toArray();

        if (old.length > 0) {
            await db.cached_images.bulkDelete(old.map(img => img.url));
            console.log(`🧹 Cleaned ${old.length} old cached images`);
        }
    } catch (error) {
        console.warn('Error cleaning image cache:', error);
    }
};

/**
 * Get cache stats
 */
export const getCacheStats = async () => {
    try {
        const count = await db.cached_images.count();
        const images = await db.cached_images.toArray();
        const totalSize = images.reduce((acc, img) => acc + (img.size || 0), 0);

        return {
            count,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        };
    } catch (error) {
        return { count: 0, totalSizeMB: '0' };
    }
};

export default {
    cacheImage,
    getCachedImage,
    preCacheMenuImages,
    cleanOldCache,
    getCacheStats
};
