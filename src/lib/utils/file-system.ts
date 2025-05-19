import fs from 'fs';
import path from 'path';
import { rimraf } from 'rimraf';

// Directory for storing temporary video files
export const TEMP_DIR = path.join(process.cwd(), 'temp');

/**
 * Ensures the temporary directory exists
 * Creates directory recursively if it doesn't exist
 */
export function ensureTempDirectoryExists(): void {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Cleans up old temporary files from disk
 * - Preserves files younger than 1 hour
 * - Uses rimraf for cross-platform compatibility
 */
export async function cleanTempDirectory(): Promise<void> {
  try {
    ensureTempDirectoryExists();
    
    const files = fs.readdirSync(TEMP_DIR);
    const oneHourAgo = Date.now() - (60 * 60 * 1000); // Files older than 1 hour

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      
      try {
        const stats = fs.statSync(filePath);
        // Delete file if it's older than threshold
        if (stats.mtimeMs < oneHourAgo) {
          await rimraf(filePath);
          console.log(`Removed old temp file: ${file}`);
        }
      } catch (err) {
        console.error(`Error processing file ${file}:`, err);
      }
    }

    console.log('Temporary directory cleanup complete');
  } catch (error) {
    console.error('Failed to clean temporary directory:', error);
  }
}

/**
 * Creates a sanitized filename from video title and timestamp
 * @param title - Original video title
 * @param timestamp - Unique timestamp for file uniqueness
 * @returns Sanitized filename with .mp4 extension
 */
export function generateSafeFilename(title: string, timestamp: number): string {
  // Replace special characters with underscores and normalize spacing
  const safeTitle = title.replace(/[^\w]/g, '_').replace(/_+/g, '_');
  return `${safeTitle}_${timestamp}.mp4`;
}

/**
 * Removes residual temporary files matching a pattern
 * @param baseFilename - Base name pattern to match
 * @param targetFilename - File to preserve
 */
export function cleanExtraFiles(baseFilename: string, targetFilename: string): void {
  const extraFiles = fs.readdirSync(TEMP_DIR).filter(file => 
    file !== targetFilename && 
    file.includes(baseFilename)
  );
  
  extraFiles.forEach(file => {
    try {
      fs.unlinkSync(path.join(TEMP_DIR, file));
      console.log('Removed residual temp file:', file);
    } catch (err) {
      console.error('Failed to remove temp file:', err);
    }
  });
}