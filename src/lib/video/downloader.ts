import { execAsync } from '../utils/execute';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { Stream } from 'stream';
import { promisify } from 'util';
import { spawn } from 'child_process';

const pipeline = promisify(Stream.pipeline);

/**
 * Augment the NodeJS global type to include videoDownloader
 */
declare global {
    // eslint-disable-next-line no-var
    var videoDownloaderMethod: 'ytdlp' | 'node' | undefined;
}

/**
 * Main function to ensure a video downloader is available
 * Multiple fallback strategies for different environments
 */
export async function ensureVideoDownloader(): Promise<boolean> {
    try {
        // First try: Check if yt-dlp is already installed
        await execAsync('yt-dlp --version');
        console.log('yt-dlp is already installed, using it as primary downloader.');
        global.videoDownloaderMethod = 'ytdlp';
        return true;
    } catch (ytdlpError) {
        console.log('yt-dlp not found, trying alternative methods...');

        // Try to install yt-dlp
        if (await tryInstallYtDlp()) {
            global.videoDownloaderMethod = 'ytdlp';
            return true;
        }

        // If all fails, use Node.js native implementation
        console.log('Using Node.js native video downloader as fallback.');
        global.videoDownloaderMethod = 'node';
        return true;
    }
}

/**
 * Attempts to install yt-dlp using various methods
 */
async function tryInstallYtDlp(): Promise<boolean> {
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

    // Try architecture-specific binaries
    const architectures = ['x86_64', 'aarch64', ''];
    let installed = false;

    for (const arch of architectures) {
        if (installed) break;

        try {
            if (!isWindows && !isMac) {
                // Linux download with architecture specification
                const archSuffix = arch ? `_linux_${arch}` : '_linux';
                console.log(`Trying to download Linux binary (${arch || 'default'})...`);
                await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp${archSuffix} -o "${ytDlpPath}"`);
            } else if (isWindows) {
                // Windows download
                await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o "${ytDlpPath}"`);
            } else {
                // Mac download
                await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o "${ytDlpPath}"`);
            }

            // Make executable
            if (!isWindows) {
                await execAsync(`chmod +x "${ytDlpPath}"`);
            }

            // Add to PATH for current process
            process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;

            // Verify it works
            await execAsync(`"${ytDlpPath}" --version`);
            console.log(`yt-dlp successfully installed at: ${ytDlpPath}`);
            installed = true;
        } catch (error) {
            console.error(`Installation attempt failed for architecture ${arch || 'default'}:`, error);
        }
    }

    if (installed) return true;

    // Try Python installation methods if binary fails
    try {
        for (const pythonCmd of ['python3', 'python', 'python2']) {
            try {
                await execAsync(`${pythonCmd} --version`);
                await execAsync(`${pythonCmd} -m pip install --user yt-dlp`);
                await execAsync(`${pythonCmd} -m yt_dlp --version`);
                console.log(`Successfully installed yt-dlp via ${pythonCmd} pip`);
                return true;
            } catch (err) {
                console.log(`${pythonCmd} installation method failed.`);
            }
        }
    } catch (pythonError) {
        console.error('All Python installation methods failed:', pythonError);
    }

    return false;
}

/**
 * Retrieves video metadata from URL using available method
 */
export async function getVideoInfo(url: string, infoPath: string): Promise<any> {
    console.log('Fetching video metadata...');

    if (global.videoDownloaderMethod === 'ytdlp') {
        return await getVideoInfoYtDlp(url, infoPath);
    } else {
        return await getVideoInfoNode(url, infoPath);
    }
}

/**
 * Gets video metadata using yt-dlp
 */
async function getVideoInfoYtDlp(url: string, infoPath: string): Promise<any> {
    try {
        // Primary method: structured JSON output
        await execAsync(`yt-dlp "${url}" --dump-json --no-check-certificate --no-warnings > "${infoPath}"`);

        return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch (error) {
        console.log('JSON parsing failed. Using text-based extraction...', error);

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
 * Gets video metadata using Node.js (YouTube only)
 */
async function getVideoInfoNode(url: string, infoPath: string): Promise<any> {
    console.log('Using Node.js native method to fetch video info');

    try {
        // Extract video ID from YouTube URL
        const videoId = extractYouTubeId(url);
        if (!videoId) {
            throw new Error('Could not extract YouTube video ID from URL');
        }

        // Fetch video info from YouTube oEmbed endpoint
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedData = await fetchJson(oembedUrl);

        // Get video details from YouTube data API (no key required for basic info)
        const videoDetailsUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const htmlContent = await fetchText(videoDetailsUrl);

        // Extract duration from HTML (approximate method)
        let duration = 0;
        const durationMatch = htmlContent.match(/"lengthSeconds":"(\d+)"/);
        if (durationMatch && durationMatch[1]) {
            duration = parseInt(durationMatch[1], 10);
        }

        // Create metadata object
        const metadata = {
            title: oembedData.title || 'Untitled Video',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: duration,
            uploader: oembedData.author_name || 'Unknown',
            id: videoId,
            webpage_url: `https://www.youtube.com/watch?v=${videoId}`
        };

        // Save metadata to file
        fs.writeFileSync(infoPath, JSON.stringify(metadata));

        return metadata;
    } catch (error) {
        console.error('Error fetching video info with Node method:', error);

        // Create minimal metadata as fallback
        const videoId = extractYouTubeId(url) || 'unknown';
        const metadata = {
            title: `YouTube Video (${videoId})`,
            thumbnail: videoId !== 'unknown' ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '',
            duration: 0,
            uploader: 'Unknown',
            id: videoId,
            webpage_url: url
        };

        fs.writeFileSync(infoPath, JSON.stringify(metadata));
        return metadata;
    }
}

/**
 * Downloads video using available method
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting video download...');
    console.log('Output path:', outputPath);

    if (global.videoDownloaderMethod === 'ytdlp') {
        await downloadVideoYtDlp(url, outputPath);
    } else {
        await downloadVideoNode(url, outputPath);
    }
}

/**
 * Downloads video using yt-dlp
 */
async function downloadVideoYtDlp(url: string, outputPath: string): Promise<void> {
    // Get base filename without extension for consistent naming
    const baseOutputPath = outputPath.replace(/\.mp4$/, '');

    try {
        // Format selection prioritizing audio and video quality
        const command = `yt-dlp "${url}" -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`;
        console.log('Executing command:', command);

        await execAsync(command);

        // Small delay for filesystem consistency
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (dlError) {
        console.error('Primary download failed:', dlError);

        try {
            // First fallback: Try with merged format
            await execAsync(`yt-dlp "${url}" -f "best" -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`);
        } catch (fallbackError) {
            console.error('Fallback download failed:', fallbackError);
            throw new Error(`Download failed after multiple attempts: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
    }
}

/**
 * Downloads video using Node.js (YouTube only)
 */
async function downloadVideoNode(url: string, outputPath: string): Promise<void> {
    console.log('Using Node.js native method to download video');

    try {
        // Extract video ID from YouTube URL
        const videoId = extractYouTubeId(url);
        if (!videoId) {
            throw new Error('Could not extract YouTube video ID from URL');
        }

        // Get available formats
        const formatInfo = await getYouTubeFormatInfo(videoId);
        if (!formatInfo || !formatInfo.formats || formatInfo.formats.length === 0) {
            throw new Error('Could not get video format information');
        }

        // Find the best format (prioritize mp4 with audio)
        const selectedFormat = findBestFormat(formatInfo.formats);
        if (!selectedFormat || !selectedFormat.url) {
            throw new Error('Could not find a suitable video format to download');
        }

        console.log(`Downloading format: ${selectedFormat.qualityLabel || 'best available'} (${selectedFormat.mimeType || 'unknown'})`);

        // Download the video
        await downloadFile(selectedFormat.url, outputPath);

        console.log(`Video downloaded successfully to ${outputPath}`);
    } catch (error) {
        console.error('Error downloading video with Node method:', error);
        throw error;
    }
}

/**
 * Helper function to extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
    // Handle youtu.be URLs
    if (url.includes('youtu.be/')) {
        const match = url.match(/youtu\.be\/([^?&]+)/);
        if (match && match[1]) return match[1];
    }

    // Handle youtube.com URLs
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

/**
 * Helper function to fetch and parse JSON from a URL
 */
async function fetchJson(url: string): Promise<any> {
    const text = await fetchText(url);
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Failed to parse JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Helper function to fetch text content from a URL
 */
async function fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Handle redirects
                if (res.headers.location) {
                    fetchText(res.headers.location).then(resolve).catch(reject);
                    return;
                }
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP error ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Helper function to download a file from a URL to a local path
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Handle redirects
                if (res.headers.location) {
                    downloadFile(res.headers.location, outputPath).then(resolve).catch(reject);
                    return;
                }
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP error ${res.statusCode}: ${res.statusMessage}`));
                return;
            }

            const fileStream = fs.createWriteStream(outputPath);
            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });

            fileStream.on('error', (error) => {
                fs.unlink(outputPath, () => { }); // Delete the file on error
                reject(error);
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Gets information about available video formats for a YouTube video
 */
async function getYouTubeFormatInfo(videoId: string): Promise<any> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await fetchText(url);

    // Extract the ytInitialPlayerResponse object which contains format information
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerResponseMatch || !playerResponseMatch[1]) {
        throw new Error('Could not find player response in YouTube page');
    }

    try {
        return JSON.parse(playerResponseMatch[1]).streamingData;
    } catch (error) {
        throw new Error(`Failed to parse YouTube format data: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Selects the best format from available YouTube formats
 */
function findBestFormat(formats: any[]): any {
    // First try to find an MP4 format with both video and audio
    const mp4WithAudio = formats.filter(f =>
        f.mimeType && f.mimeType.includes('mp4') &&
        f.audioQuality &&
        f.url
    ).sort((a, b) => {
        // Extract height from qualityLabel (e.g., "720p")
        const heightA = parseInt((a.qualityLabel || '').replace(/[^0-9]/g, '')) || 0;
        const heightB = parseInt((b.qualityLabel || '').replace(/[^0-9]/g, '')) || 0;
        return heightB - heightA; // Sort by height descending
    });

    if (mp4WithAudio.length > 0) {
        return mp4WithAudio[0];
    }

    // If no MP4 with audio found, try any format with audio and video
    const anyWithAudio = formats.filter(f =>
        f.audioQuality &&
        f.url
    ).sort((a, b) => {
        const heightA = parseInt((a.qualityLabel || '').replace(/[^0-9]/g, '')) || 0;
        const heightB = parseInt((b.qualityLabel || '').replace(/[^0-9]/g, '')) || 0;
        return heightB - heightA;
    });

    if (anyWithAudio.length > 0) {
        return anyWithAudio[0];
    }

    // Last resort - just get highest quality video
    return formats
        .filter(f => f.url)
        .sort((a, b) => {
            const heightA = parseInt((a.qualityLabel || '').replace(/[^0-9]/g, '')) || 0;
            const heightB = parseInt((b.qualityLabel || '').replace(/[^0-9]/g, '')) || 0;
            return heightB - heightA;
        })[0];
}