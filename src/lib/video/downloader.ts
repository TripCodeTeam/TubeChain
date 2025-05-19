import { execAsync } from '../utils/execute';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Augment the NodeJS global type to include ytDlpPath
 */
declare global {
    // eslint-disable-next-line no-var
    var ytDlpPath: string | undefined;
}

/**
 * Ensures yt-dlp binary is available in the system
 * - Uses standalone binary that doesn't require Python
 * - Works in environments without Python installed (like Vercel)
 */
export async function ensureYtDlp(): Promise<boolean> {
    try {
        // Verify existing installation
        await execAsync('yt-dlp --version');
        console.log('yt-dlp is already installed.');
        return true;
    } catch {
        console.log('yt-dlp not found. Attempting local installation...');

        // Create bin directory based on environment
        const binDir = process.env.NODE_ENV === 'production'
            ? path.join(os.tmpdir(), 'app-bin') // Use system temp in production
            : path.join(process.cwd(), 'bin');  // Use local bin in development

        try {
            if (!fs.existsSync(binDir)) {
                fs.mkdirSync(binDir, { recursive: true });
                console.log(`Created bin directory at: ${binDir}`);
            }
        } catch (mkdirError) {
            console.error(`Failed to create bin directory at ${binDir}:`, mkdirError);
            return false;
        }

        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const ytDlpPath = isWindows
            ? path.join(binDir, 'yt-dlp.exe')
            : path.join(binDir, 'yt-dlp');

        try {
            // Use the standalone binary version for Linux environments (like Vercel)
            if (!isWindows && !isMac && process.env.NODE_ENV === 'production') {
                console.log('Downloading standalone binary for Linux...');
                await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o "${ytDlpPath}"`);
            } else if (isWindows) {
                // Windows download
                try {
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${ytDlpPath}"`);
                } catch {
                    await execAsync(`powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '${ytDlpPath}'"`);
                }
            } else {
                // Mac/other Linux download
                try {
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${ytDlpPath}"`);
                } catch {
                    await execAsync(`wget -O "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`);
                }
            }

            // Make executable
            if (!isWindows) {
                await execAsync(`chmod +x "${ytDlpPath}"`);
            }

            // Add to PATH for current process
            process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
            console.log(`yt-dlp installed at: ${ytDlpPath}`);

        } catch (directDownloadError) {
            console.error('Download error details:', directDownloadError);
            return false;
        }

        // Final verification - use direct path instead of relying on PATH
        try {
            await execAsync(`"${ytDlpPath}" --version`);
            console.log(`Local yt-dlp verified at: ${ytDlpPath}`);

            // Save the path for later use
            global.ytDlpPath = ytDlpPath;

            return true;
        } catch (verificationError) {
            console.error('Installation verification failed:', verificationError);
            return false;
        }
    }
}

/**
 * Retrieves video metadata from URL using the local yt-dlp installation
 */
export async function getVideoInfo(url: string, infoPath: string): Promise<any> {
    console.log('Fetching video metadata...');

    // Use the stored path if available
    const ytDlpCommand = global.ytDlpPath ? `"${global.ytDlpPath}"` : 'yt-dlp';

    try {
        // Primary method: structured JSON output
        await execAsync(`${ytDlpCommand} "${url}" --dump-json --no-check-certificate --no-warnings > "${infoPath}"`);

        return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch (error) {
        console.log('JSON parsing failed. Using text-based extraction...', error);

        // Fallback method: raw field extraction
        await execAsync(`${ytDlpCommand} "${url}" --print title --print thumbnail --print duration --print uploader --no-check-certificate --no-warnings > "${infoPath}.txt"`);

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
 * Downloads video with format prioritization using the local yt-dlp installation
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting video download...');
    console.log('Output path:', outputPath);

    // Use the stored path if available
    const ytDlpCommand = global.ytDlpPath ? `"${global.ytDlpPath}"` : 'yt-dlp';

    // Get base filename without extension for consistent naming
    const baseOutputPath = outputPath.replace(/\.mp4$/, '');

    try {
        // Format selection prioritizing audio and video quality
        // Using consistent output template for better tracking
        const command = `${ytDlpCommand} "${url}" -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`;
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
 * Attempts alternative download strategies using the local yt-dlp installation
 */
async function tryFallbackDownload(url: string, baseOutputPath: string): Promise<void> {
    console.log('Initiating fallback download methods...');

    // Use the stored path if available
    const ytDlpCommand = global.ytDlpPath ? `"${global.ytDlpPath}"` : 'yt-dlp';

    try {
        // First fallback: Try with merged format
        await execAsync(`${ytDlpCommand} "${url}" -f "best" -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`);

        // If first fallback fails, try with specific audio/video format combo
        const files = fs.readdirSync(path.dirname(baseOutputPath));
        const baseFileName = path.basename(baseOutputPath);
        const downloadedFile = files.find(file => file.startsWith(baseFileName));

        if (!downloadedFile) {
            // Second fallback: More explicit about audio
            await execAsync(`${ytDlpCommand} "${url}" -f "bestvideo+bestaudio" --audio-format mp3 --prefer-ffmpeg -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`);
        }
    } catch (fallbackError) {
        console.error('Fallback methods failed:', fallbackError);
        throw new Error(`Download failed after multiple attempts: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
    }
}