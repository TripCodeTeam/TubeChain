import { Thumbnail } from './model';
import fs from 'fs';

/**
 * Selects the highest resolution thumbnail from available options
 * @param thumbnails - Array of thumbnail metadata objects
 * @returns URL of best thumbnail or null if none available
 */
export function getBestThumbnail(thumbnails: Thumbnail[] = []): string | null {
    if (!thumbnails || thumbnails.length === 0) {
        return null;
    }

    // Sort by resolution (width × height) descending
    const sortedThumbnails = [...thumbnails].sort((a, b) => {
        const aRes = (a.width || 0) * (a.height || 0);
        const bRes = (b.width || 0) * (b.height || 0);
        return bRes - aRes; // Descending order
    });

    return sortedThumbnails[0].url;
}

/**
 * Calculates file size in human-readable format (MB)
 * @param filePath - Path to file system resource
 * @returns File size as string with 2 decimal places
 * @throws If file doesn't exist or is inaccessible
 */
export function calculateFileSize(filePath: string): string {
    // Using synchronous call since file should already exist
    const stats = fs.statSync(filePath);
    
    // Convert bytes to MB with 2 decimal precision
    return `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
}