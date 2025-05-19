import { execAsync } from '../utils/execute';
import { TEMP_DIR, ensureTempDirectoryExists } from '../utils/file-system';
import fs from 'fs';
import path from 'path';

/**
 * Ensures yt-dlp binary is available in the system
 * - First checks for existing installation
 * - Installs locally if missing with OS-specific strategies
 */
export async function ensureYtDlp(): Promise<boolean> {
    try {
        // Verify existing installation
        await execAsync('yt-dlp --version');
        console.log('yt-dlp is already installed.');
        return true;
    } catch {
        console.log('yt-dlp not found. Attempting local installation...');

        try {
            const isWindows = process.platform === 'win32';

            if (isWindows) {
                // Windows-specific installation: download executable directly
                const binDir = path.join(process.cwd(), 'bin');
                if (!fs.existsSync(binDir)) {
                    fs.mkdirSync(binDir, { recursive: true });
                }

                const exePath = path.join(binDir, 'yt-dlp.exe');

                // Try multiple download methods
                try {
                    // Primary: curl
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe  -o "${exePath}"`);
                } catch {
                    // Fallback: PowerShell
                    await execAsync(`powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe ' -OutFile '${exePath}'"`);
                }

                // Extend PATH for current process
                process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
                console.log('yt-dlp installed at:', exePath);
            } else {
                // Linux/macOS: install via pip
                await execAsync('pip install yt-dlp');
                console.log('yt-dlp installed via pip');
            }

            // Final verification
            await execAsync('yt-dlp --version');
            return true;
        } catch (installError) {
            console.error('Installation failed:', installError);
            return false;
        }
    }
}

/**
 * Retrieves video metadata from URL
 * - First attempts JSON format output
 * - Falls back to plain text extraction if needed
 */
export async function getVideoInfo(url: string, infoPath: string): Promise<any> {
    console.log('Fetching video metadata...');

    try {
        // Primary method: structured JSON output
        await execAsync(`yt-dlp "${url}" --dump-json --no-check-certificate --no-warnings > "${infoPath}"`);

        return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch {
        console.log('JSON parsing failed. Using text-based extraction...');

        // Fallback method: raw field extraction
        await execAsync(`yt-dlp "${url}" --print title --print thumbnail --print duration --print uploader --no-check-certificate --no-warnings > "${infoPath}.txt"`);

        const rawFields = fs.readFileSync(`${infoPath}.txt`, 'utf8').split('\n').filter(Boolean);

        const metadata = {
            title: rawFields[0] || 'Untitled Video',
            thumbnail: rawFields[1] || '',
            duration: parseFloat(rawFields[2]) || 0,
            uploader: rawFields[3] || 'Unknown'
        };

        fs.writeFileSync(infoPath, JSON.stringify(metadata));
        return metadata;
    }
}

/**
 * Downloads video with format prioritization
 * - Uses explicit format selection for best quality
 * - Handles post-download validation and recovery
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting video download...');
    console.log('Output path:', outputPath);

    try {
        // Format priority: best mp4 with audio/video combined
        const command = `yt-dlp "${url}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputPath}" --no-check-certificate --no-warnings`;
        console.log('Executing command:', command);

        await execAsync(command);

        // Small delay for filesystem consistency
        await new Promise(resolve => setTimeout(resolve, 1000));

        validateDownloadedFile(outputPath);
    } catch (dlError) {
        console.error('Primary download failed:', dlError);
        await tryFallbackDownload(url, outputPath);
    }
}

/**
 * Attempts alternative download strategies
 * - Progressively simpler format specifications
 * - Final verification with file validation
 */
async function tryFallbackDownload(url: string, outputPath: string): Promise<void> {
    console.log('Initiating fallback download methods...');

    try {
        // Try direct mp4 format
        await execAsync(`yt-dlp "${url}" --format mp4 -o "${outputPath}" --no-check-certificate --no-warnings`);

        if (!fs.existsSync(outputPath)) {
            // Last resort: any best available format
            await execAsync(`yt-dlp "${url}" --format best -o "${outputPath}" --no-check-certificate --no-warnings`);
        }

        validateDownloadedFile(outputPath);
    } catch (fallbackError) {
        console.error('Fallback methods failed:', fallbackError);
        throw new Error(`Download failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
    }
}

/**
 * Validates download results and fixes common issues
 * - Handles missing files and format inconsistencies
 * - Implements file search and renaming strategies
 */
function validateDownloadedFile(outputPath: string): void {
    if (fs.existsSync(outputPath)) {
        console.log('Download verified at:', outputPath);
        return;
    }

    console.log('File not found at expected location:', outputPath);

    const dir = path.dirname(outputPath);
    const baseName = path.basename(outputPath, '.mp4');
    const files = fs.readdirSync(dir);

    console.log('Available files:', files);

    // Find matching files
    const candidates = files.filter(f => f.startsWith(baseName));
    console.log('Matching candidates:', candidates);

    if (candidates.length > 0) {
        const actualPath = path.join(dir, candidates[0]);
        console.log('Using discovered file:', actualPath);

        if (!actualPath.endsWith('.mp4')) {
            fs.copyFileSync(actualPath, outputPath);
            fs.unlinkSync(actualPath);
            console.log('Renamed to:', outputPath);
        }
    } else {
        findAndUseRecentFile(outputPath);
    }
}

/**
 * Recovers from failed downloads by scanning recent files
 * - Looks for files modified in last 30 seconds
 * - Cleans up temporary leftovers after recovery
 */
function findAndUseRecentFile(outputPath: string): void {
    const recentFiles = fs.readdirSync(TEMP_DIR)
        .filter(file => {
            const stats = fs.statSync(path.join(TEMP_DIR, file));
            return Date.now() - stats.mtimeMs < 30000; // 5-minute window
        })
        .sort((a, b) => {
            const aTime = fs.statSync(path.join(TEMP_DIR, a)).mtimeMs;
            const bTime = fs.statSync(path.join(TEMP_DIR, b)).mtimeMs;
            return bTime - aTime; // Newest first
        });

    if (recentFiles.length > 0) {
        const source = path.join(TEMP_DIR, recentFiles[0]);
        console.log('Using recent file:', source);
        fs.copyFileSync(source, outputPath);

        // Clean up remaining temp files
        recentFiles.slice(1).forEach(file => {
            try {
                fs.unlinkSync(path.join(TEMP_DIR, file));
                console.log('Cleaned up:', file);
            } catch (err) {
                console.error('Cleanup failed:', err);
            }
        });
    } else {
        throw new Error('No recent files found for recovery');
    }
}