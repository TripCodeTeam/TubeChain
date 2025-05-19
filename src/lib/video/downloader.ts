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
 * - Falls back to Python pip installation if standalone fails
 * - Has multiple fallback strategies for different environments
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

        // Track if we've tried the static binary
        let triedStaticBinary = false;

        try {
            // First attempt: Use static binary for Linux environments
            if (!isWindows && !isMac) {
                console.log('Downloading static binary for Linux...');
                // Use the -static version which has fewer dependencies
                await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64 -o "${ytDlpPath}"`);
                triedStaticBinary = true;
            } else if (isWindows) {
                // Windows download
                try {
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${ytDlpPath}"`);
                } catch {
                    await execAsync(`powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '${ytDlpPath}'"`);
                }
            } else {
                // Mac download
                try {
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o "${ytDlpPath}"`);
                } catch {
                    await execAsync(`wget -O "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos`);
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
            console.error('Direct download error details:', directDownloadError);

            // If not Windows and we just tried the static binary, try another architecture
            if (!isWindows && !isMac && triedStaticBinary) {
                try {
                    console.log('Trying alternate architecture binary for Linux...');
                    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o "${ytDlpPath}"`);
                    await execAsync(`chmod +x "${ytDlpPath}"`);
                } catch (altArchError) {
                    console.error('Alternate architecture download failed:', altArchError);
                }
            }
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

            // Try Python-based installation as fallback
            return await tryPythonInstallation(binDir);
        }
    }
}

/**
 * Attempts to install yt-dlp using Python pip as a fallback method
 */
async function tryPythonInstallation(binDir: string): Promise<boolean> {
    console.log('Trying Python-based installation as fallback...');

    try {
        // Check if Python is available
        await execAsync('python3 --version');

        // Install yt-dlp via pip to user directory
        await execAsync('python3 -m pip install --user yt-dlp');

        // Check if installation succeeded
        await execAsync('python3 -m yt_dlp --version');

        // Set the command to use Python module
        global.ytDlpPath = 'python3 -m yt_dlp';

        console.log('Successfully installed yt-dlp via Python pip');
        return true;
    } catch (pythonError) {
        console.error('Python-based installation failed:', pythonError);

        try {
            // Try with python instead of python3
            await execAsync('python --version');
            await execAsync('python -m pip install --user yt-dlp');
            await execAsync('python -m yt_dlp --version');

            global.ytDlpPath = 'python -m yt_dlp';

            console.log('Successfully installed yt-dlp via Python pip (using python command)');
            return true;
        } catch (altPythonError) {
            console.error('Alternative Python installation failed:', altPythonError);
            return false;
        }
    }
}

/**
 * Retrieves video metadata from URL using the available yt-dlp installation
 */
export async function getVideoInfo(url: string, infoPath: string): Promise<any> {
    console.log('Fetching video metadata...');

    // Use the stored method if available
    const ytDlpCommand = getYtDlpCommand();

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
 * Downloads video with format prioritization using the available yt-dlp installation
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting video download...');
    console.log('Output path:', outputPath);

    // Use the available command
    const ytDlpCommand = getYtDlpCommand();

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
 * Helper function to get the proper yt-dlp command based on installation method
 */
function getYtDlpCommand(): string {
    if (!global.ytDlpPath) {
        return 'yt-dlp';
    }

    // If it's a Python module command
    if (global.ytDlpPath.includes('python')) {
        return global.ytDlpPath;
    }

    // Otherwise it's a path to the binary
    return `"${global.ytDlpPath}"`;
}

/**
 * Attempts alternative download strategies using the available yt-dlp installation
 */
async function tryFallbackDownload(url: string, baseOutputPath: string): Promise<void> {
    console.log('Initiating fallback download methods...');

    // Use the available command
    const ytDlpCommand = getYtDlpCommand();

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