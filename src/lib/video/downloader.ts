import { execAsync } from '../utils/execute';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Ensures yt-dlp binary is available in the system
 * - First checks for existing installation
 * - Installs locally if missing with OS-specific strategies
 * - Uses system temp directory for Vercel serverless environment
 */
export async function ensureYtDlp(): Promise<boolean> {
    try {
        // Verify existing installation
        await execAsync('yt-dlp --version');
        console.log('yt-dlp is already installed.');
        return true;
    } catch {
        console.log('yt-dlp not found. Attempting local installation...');

        // Create bin directory in the system temp directory
        const tempDir = os.tmpdir();
        const binDir = path.join(tempDir, 'app-bin');

        try {
            if (!fs.existsSync(binDir)) {
                fs.mkdirSync(binDir, { recursive: true });
            }
        } catch (mkdirError) {
            console.error('Failed to create bin directory:', mkdirError);
            return false;
        }

        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const ytDlpPath = isWindows
            ? path.join(binDir, 'yt-dlp.exe')
            : path.join(binDir, 'yt-dlp');

        try {
            // Direct binary download - works on all platforms
            if (isWindows) {
                // Windows download
                try {
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${ytDlpPath}"`);
                } catch {
                    await execAsync(`powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '${ytDlpPath}'"`);
                }
            } else {
                // Linux/Mac download
                try {
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${ytDlpPath}"`);
                } catch {
                    await execAsync(`wget -O "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`);
                }

                // Make executable
                await execAsync(`chmod +x "${ytDlpPath}"`);
            }

            // Add to PATH for current process
            process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
            console.log(`yt-dlp installed at: ${ytDlpPath}`);

            // Only attempt pip installation if direct download failed
        } catch (directDownloadError) {
            console.log('Direct download failed, trying alternative methods...');

            try {
                // Try pip3 first (more common on modern systems)
                await execAsync('pip3 install yt-dlp');
                console.log('yt-dlp installed via pip3');
            } catch (pip3Error) {
                try {
                    // Fallback to pip
                    await execAsync('pip install yt-dlp');
                    console.log('yt-dlp installed via pip');
                } catch (pipError) {
                    try {
                        // Try with python -m pip
                        await execAsync('python -m pip install yt-dlp');
                        console.log('yt-dlp installed via python -m pip');
                    } catch (pythonPipError) {
                        try {
                            // Try with python3 -m pip
                            await execAsync('python3 -m pip install yt-dlp');
                            console.log('yt-dlp installed via python3 -m pip');
                        } catch (python3PipError) {
                            console.error('All installation methods failed');
                            console.error(directDownloadError);
                            return false;
                        }
                    }
                }
            }
        }

        // Final verification
        try {
            await execAsync('yt-dlp --version');
            return true;
        } catch (verificationError) {
            // Check if we have our local copy and try to verify that instead
            try {
                await execAsync(`"${ytDlpPath}" --version`);
                console.log(`Local yt-dlp verified at: ${ytDlpPath}`);
                return true;
            } catch (localVerificationError) {
                console.error('Installation verification failed:', verificationError);
                return false;
            }
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
 * - Uses explicit format selection for best quality with audio
 * - Sets a consistent output template to help with file tracking
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting video download...');
    console.log('Output path:', outputPath);

    // Get base filename without extension for consistent naming
    const baseOutputPath = outputPath.replace(/\.mp4$/, '');

    try {
        // Format selection prioritizing audio and video quality
        // Using consistent output template for better tracking
        const command = `yt-dlp "${url}" -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`;
        console.log('Executing command:', command);

        await execAsync(command);

        // Small delay for filesystem consistency
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (dlError) {
        console.error('Primary download failed:', dlError);
        await tryFallbackDownload(url, baseOutputPath);
    }
}

/**
 * Attempts alternative download strategies
 * - Uses progressive fallbacks with more permissive format options
 * - Maintains consistent output template pattern
 */
async function tryFallbackDownload(url: string, baseOutputPath: string): Promise<void> {
    console.log('Initiating fallback download methods...');

    try {
        // First fallback: Try with merged format
        await execAsync(`yt-dlp "${url}" -f "best" -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`);

        // If first fallback fails, try with specific audio/video format combo
        const files = fs.readdirSync(path.dirname(baseOutputPath));
        const baseFileName = path.basename(baseOutputPath);
        const downloadedFile = files.find(file => file.startsWith(baseFileName));

        if (!downloadedFile) {
            // Second fallback: More explicit about audio
            await execAsync(`yt-dlp "${url}" -f "bestvideo+bestaudio" --audio-format mp3 --prefer-ffmpeg -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`);
        }
    } catch (fallbackError) {
        console.error('Fallback methods failed:', fallbackError);
        throw new Error(`Download failed after multiple attempts: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
    }
}