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
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${exePath}"`);
                } catch {
                    // Fallback: PowerShell
                    await execAsync(`powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '${exePath}'"`);
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