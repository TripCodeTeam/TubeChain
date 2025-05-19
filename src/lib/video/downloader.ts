import { execAsync } from '../utils/execute';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

/**
 * Augment the NodeJS global type to include ytDlpPath
 */
declare global {
    namespace NodeJS {
        interface Global {
            ytDlpPath?: string;
            ytdlpInitialized?: boolean;
        }
    }
}

/**
 * Detects the exact CPU architecture to download the correct binary
 * This is crucial for serverless environments where the architecture might not be standard
 */
async function detectArchitecture(): Promise<string> {
    try {
        // Get detailed CPU information
        const cpuInfo = await execAsync('cat /proc/cpuinfo');
        console.log('CPU Info snippets:', cpuInfo.stdout.substring(0, 200) + '...');

        // Look for architecture identifiers
        if (cpuInfo.stdout.includes('aarch64') || cpuInfo.stdout.includes('ARM64')) {
            return 'aarch64';
        } else if (cpuInfo.stdout.includes('armv7') || cpuInfo.stdout.includes('ARM')) {
            return 'armv7';
        } else {
            // Default to x86_64 which is most common
            return 'x86_64';
        }
    } catch (error) {
        console.log('Could not detect CPU architecture via /proc/cpuinfo, trying uname');

        try {
            const unameResult = await execAsync('uname -m');
            console.log('uname -m result:', unameResult.stdout.trim());

            if (unameResult.stdout.includes('aarch64')) {
                return 'aarch64';
            } else if (unameResult.stdout.includes('armv7')) {
                return 'armv7';
            } else if (unameResult.stdout.includes('x86_64')) {
                return 'x86_64';
            } else {
                console.log('Using default x86_64 architecture');
                return 'x86_64';
            }
        } catch (unameError) {
            console.log('Architecture detection failed, defaulting to x86_64');
            return 'x86_64';
        }
    }
}

/**
 * Creates a simple node-based YouTube downloader script as a fallback method
 * Useful when neither binary nor Python methods work
 */
async function createNodeBasedDownloader(binDir: string): Promise<boolean> {
    const downloaderPath = path.join(binDir, 'node-ytdl.js');

    // Simple Node.js script that can download videos without external dependencies
    const nodeScript = `
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple YouTube downloader using Node.js built-in modules
async function getVideoInfo(url) {
    // Get video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }
    
    // API endpoint to get video info
    const apiUrl = \`https://www.youtube.com/watch?v=\${videoId}\`;
    
    // Get HTML content
    const html = await fetchUrl(apiUrl);
    
    // Extract title
    const titleMatch = html.match(/"title":"([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : 'Unknown Title';
    
    // Extract thumbnail
    const thumbnailUrl = \`https://i.ytimg.com/vi/\${videoId}/hqdefault.jpg\`;
    
    // Basic metadata
    return {
        title,
        thumbnail: thumbnailUrl,
        uploader: 'Unknown',
        duration: 0,
        videoId
    };
}

function extractVideoId(url) {
    // Handle various YouTube URL formats
    const patterns = [
        /(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([^&?\\s]+)/,
        /youtube\\.com\\/embed\\/([^&?\\s]+)/,
        /youtube\\.com\\/v\\/([^&?\\s]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(\`Request failed with status \${res.statusCode}\`));
                return;
            }
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', reject);
    });
}

async function downloadVideo(url, outputPath) {
    try {
        // For actual download, we'll use curl as a fallback since it's available in most environments
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }
        
        // Try to get the direct video URL using youtube-dl-exec
        const tempHtmlPath = outputPath + '.html';
        
        // Download the page HTML
        execSync(\`curl -s "https://www.youtube.com/watch?v=\${videoId}" -o "\${tempHtmlPath}"\`);
        
        // Read the downloaded HTML
        const html = fs.readFileSync(tempHtmlPath, 'utf8');
        
        // Look for formats in the HTML (this is a simplified approach)
        const urlEncodedFormats = html.match(/(?:"url_encoded_fmt_stream_map":)(".*?")/);
        
        if (urlEncodedFormats && urlEncodedFormats[1]) {
            const formats = JSON.parse(urlEncodedFormats[1]);
            const urls = formats.match(/https?:\\/\\/[^"]+/g);
            
            if (urls && urls.length > 0) {
                // Take the first URL we find
                execSync(\`curl -L "\${urls[0]}" -o "\${outputPath}"\`);
                return;
            }
        }
        
        // If we couldn't extract URLs, use a YouTube downloader service as fallback
        // Note: This approach relies on external services which may change
        const ytdlService = \`https://api.vevioz.com/api/button/mp4/\${videoId}\`;
        
        // Download the service page
        execSync(\`curl -s "\${ytdlService}" -o "\${tempHtmlPath}"\`);
        
        // Read the service page HTML
        const serviceHtml = fs.readFileSync(tempHtmlPath, 'utf8');
        
        // Extract download links
        const downloadLinks = serviceHtml.match(/href="(https?:\\/\\/[^"]+download[^"]+)"/g);
        
        if (downloadLinks && downloadLinks.length > 0) {
            // Extract the URL
            const dlUrl = downloadLinks[0].match(/href="([^"]+)"/)[1];
            
            // Download the video
            execSync(\`curl -L "\${dlUrl}" -o "\${outputPath}"\`);
        } else {
            throw new Error('Could not find download links');
        }
        
        // Clean up
        if (fs.existsSync(tempHtmlPath)) {
            fs.unlinkSync(tempHtmlPath);
        }
    } catch (error) {
        console.error('Node downloader error:', error);
        throw error;
    }
}

// Export functions
module.exports = { getVideoInfo, downloadVideo };
    `;

    // Write the script to disk
    try {
        fs.writeFileSync(downloaderPath, nodeScript);
        console.log(`Created Node.js based downloader at ${downloaderPath}`);

        // Set the global path to use our Node.js script
        (global as NodeJS.Global).ytDlpPath = 'node ' + downloaderPath;
        (global as NodeJS.Global).ytdlpInitialized = true;

        return true;
    } catch (error) {
        console.error('Failed to create Node.js downloader:', error);
        return false;
    }
}

/**
 * Ensures some form of video downloading capability is available
 * - Tries multiple binary architectures
 * - Implements Node.js fallback for restricted environments
 */
export async function ensureYtDlp(): Promise<boolean> {
    // If already initialized, don't repeat
    if ((global as NodeJS.Global).ytdlpInitialized) {
        return true;
    }

    try {
        // Verify existing installation
        await execAsync('yt-dlp --version');
        console.log('yt-dlp is already installed.');
        (global as NodeJS.Global).ytdlpInitialized = true;
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
            // Even if directory creation fails, continue to try Node-based solution
        }

        // Try to detect the architecture for more accurate binary selection
        const arch = await detectArchitecture();
        console.log(`Detected architecture: ${arch}`);

        // Track attempts to avoid redundant tries
        let binarySuccess = false;

        // Try each architecture-specific binary
        const architectures = [arch, 'x86_64', 'aarch64', 'armv7'];

        for (const architecture of architectures) {
            if (binarySuccess) break;

            const ytDlpPath = path.join(binDir, 'yt-dlp');
            const binaryUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_${architecture}`;

            try {
                console.log(`Trying binary for ${architecture}...`);
                await execAsync(`curl -L "${binaryUrl}" -o "${ytDlpPath}"`);
                await execAsync(`chmod +x "${ytDlpPath}"`);

                // Verify it works
                try {
                    await execAsync(`"${ytDlpPath}" --version`);
                    console.log(`Binary for ${architecture} works!`);

                    (global as NodeJS.Global).ytDlpPath = ytDlpPath;
                    (global as NodeJS.Global).ytdlpInitialized = true;
                    binarySuccess = true;
                    break;
                } catch (verifyError) {
                    console.log(`Binary for ${architecture} failed verification:`, verifyError);
                }
            } catch (downloadError) {
                console.log(`Failed to download binary for ${architecture}:`, downloadError);
            }
        }

        // If binary approach failed, try curl-based solution
        if (!binarySuccess) {
            console.log('All binaries failed, creating Node.js fallback downloader...');
            const nodeDownloaderCreated = await createNodeBasedDownloader(binDir);

            if (nodeDownloaderCreated) {
                return true;
            }

            // Last resort: create a shell script wrapper that uses curl
            try {
                const shellScriptPath = path.join(binDir, 'yt-dlp-curl.sh');

                // Create a shell script that uses curl to download videos
                const shellScript = `#!/bin/sh
# Simple curl-based YouTube downloader
url="$1"
output="$2"

# Extract video ID
video_id=$(echo "$url" | sed -E 's/.*v=([^&]+).*/\\1/')

# Get webpage
curl -s "https://www.youtube.com/watch?v=$video_id" > "\${output}.html"

# Extract info
title=$(grep -o '"title":"[^"]*"' "$output.html" | head -1 | cut -d'"' -f4)
uploader=$(grep -o '"ownerChannelName":"[^"]*"' "$output.html" | head -1 | cut -d'"' -f4)

# Create JSON info
echo "{
  \\"title\\": \\"$title\\",
  \\"uploader\\": \\"$uploader\\",
  \\"thumbnail\\": \\"https://i.ytimg.com/vi/$video_id/hqdefault.jpg\\",
  \\"duration\\": 0
}" > "$3"

# Try to get direct video URL (simplified)
dl_url=$(grep -o 'https://[^"]*videoplayback[^"]*' "$output.html" | head -1)

if [ -n "$dl_url" ]; then
  curl -L "$dl_url" -o "$output"
else
  echo "Failed to find direct download URL"
  exit 1
fi

# Clean up
rm "$output.html"
`;

                // Write shell script
                fs.writeFileSync(shellScriptPath, shellScript);
                await execAsync(`chmod +x "${shellScriptPath}"`);

                (global as NodeJS.Global).ytDlpPath = shellScriptPath;
                (global as NodeJS.Global).ytdlpInitialized = true;
                console.log('Created shell script fallback at:', shellScriptPath);
                return true;
            } catch (shellError) {
                console.error('Shell script creation failed:', shellError);
                return false;
            }
        }

        return binarySuccess;
    }
}

/**
 * Retrieves video metadata using the available method
 */
export async function getVideoInfo(url: string, infoPath: string): Promise<any> {
    console.log('Fetching video metadata...');

    // Ensure we have a downloader
    if (!(global as NodeJS.Global).ytdlpInitialized) {
        await ensureYtDlp();
    }

    // Handle Node.js downloader method
    if (typeof (global as NodeJS.Global).ytDlpPath === 'string' && (global as NodeJS.Global).ytDlpPath && ((global as NodeJS.Global).ytDlpPath?.includes('node-ytdl.js'))) {
        try {
            // Dynamically load the Node.js downloader
            const downloaderPath = ((global as NodeJS.Global).ytDlpPath as string).split(' ')[1];
            const nodeDownloader = require(downloaderPath);

            // Use the Node.js downloader to get video info
            const info = await nodeDownloader.getVideoInfo(url);

            // Save the info to the specified path
            fs.writeFileSync(infoPath, JSON.stringify(info));

            return info;
        } catch (nodeError) {
            console.error('Node.js downloader failed:', nodeError);
            // Fall through to shell script method
        }
    }

    // Handle shell script method
    if (((global as NodeJS.Global).ytDlpPath ?? '').includes('yt-dlp-curl.sh')) {
        try {
            await execAsync(`"${(global as NodeJS.Global).ytDlpPath}" "${url}" "dummy.mp4" "${infoPath}"`);
            return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        } catch (shellError) {
            console.error('Shell script downloader failed:', shellError);

            // Return minimal info as last resort
            const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)?.[1] || 'unknown';
            const fallbackInfo = {
                title: `YouTube Video ${videoId}`,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: 0,
                uploader: 'Unknown'
            };

            fs.writeFileSync(infoPath, JSON.stringify(fallbackInfo));
            return fallbackInfo;
        }
    }

    // Standard yt-dlp binary approach
    try {
        // Use the stored path if available
        const ytDlpCommand = (global as NodeJS.Global).ytDlpPath ? `"${(global as NodeJS.Global).ytDlpPath}"` : 'yt-dlp';

        // Primary method: structured JSON output
        await execAsync(`${ytDlpCommand} "${url}" --dump-json --no-check-certificate --no-warnings > "${infoPath}"`);

        return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch (error) {
        console.log('JSON parsing failed. Using text-based extraction...', error);

        try {
            // Fallback method: raw field extraction
            const ytDlpCommand = (global as NodeJS.Global).ytDlpPath ? `"${(global as NodeJS.Global).ytDlpPath}"` : 'yt-dlp';
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
        } catch (textError) {
            console.error('Text extraction failed:', textError);

            // Ultimate fallback - extract video ID and return minimal info
            const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)?.[1] || 'unknown';
            const fallbackInfo = {
                title: `YouTube Video ${videoId}`,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                duration: 0,
                uploader: 'Unknown'
            };

            fs.writeFileSync(infoPath, JSON.stringify(fallbackInfo));
            return fallbackInfo;
        }
    }
}

/**
 * Downloads video using the available method
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting video download...');
    console.log('Output path:', outputPath);

    // Ensure we have a downloader
    if (!(global as NodeJS.Global).ytdlpInitialized) {
        await ensureYtDlp();
    }

    // Handle Node.js downloader method
    if (((global as NodeJS.Global).ytDlpPath ?? '').includes('node-ytdl.js')) {
        try {
            // Dynamically load the Node.js downloader
            const downloaderPath = ((global as NodeJS.Global).ytDlpPath as string).split(' ')[1];
            const nodeDownloader = require(downloaderPath);

            // Use the Node.js downloader
            await nodeDownloader.downloadVideo(url, outputPath);
            return;
        } catch (nodeError) {
            console.error('Node.js downloader failed:', nodeError);
            // Fall through to shell script method
        }
    }

    // Handle shell script method
    if ((global as NodeJS.Global).ytDlpPath?.includes('yt-dlp-curl.sh')) {
        try {
            // The third parameter is for info JSON but it's not important here
            await execAsync(`"${(global as NodeJS.Global).ytDlpPath}" "${url}" "${outputPath}" "${outputPath}.info.json"`);
            return;
        } catch (shellError) {
            console.error('Shell script downloader failed:', shellError);
            throw shellError;
        }
    }

    // Standard yt-dlp binary approach
    const ytDlpCommand = (global as NodeJS.Global).ytDlpPath ? `"${(global as NodeJS.Global).ytDlpPath}"` : 'yt-dlp';

    // Get base filename without extension for consistent naming
    const baseOutputPath = outputPath.replace(/\.mp4$/, '');

    try {
        // Format selection prioritizing audio and video quality
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
 * Attempts alternative download strategies
 */
async function tryFallbackDownload(url: string, baseOutputPath: string): Promise<void> {
    console.log('Initiating fallback download methods...');

    // Use the stored path if available
    const ytDlpCommand = (global as NodeJS.Global).ytDlpPath ? `"${(global as NodeJS.Global).ytDlpPath}"` : 'yt-dlp';

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

        // Last resort: Try direct curl download if possible
        try {
            // Extract video ID
            const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/)?.[1];

            if (!videoId) {
                throw new Error('Could not extract video ID');
            }

            // Get webpage to search for direct URLs
            const htmlPath = `${baseOutputPath}.html`;
            await execAsync(`curl -s "https://www.youtube.com/watch?v=${videoId}" -o "${htmlPath}"`);

            // Read the HTML
            const html = fs.readFileSync(htmlPath, 'utf8');

            // Look for direct video URLs (simplified approach)
            const directUrls = html.match(/https:\/\/[^"]*videoplayback[^"]*/g);

            if (directUrls && directUrls.length > 0) {
                // Use the first direct URL
                await execAsync(`curl -L "${directUrls[0]}" -o "${baseOutputPath}.mp4"`);
                console.log('Downloaded using direct URL extraction');

                // Clean up
                fs.unlinkSync(htmlPath);
                return;
            }

            // Clean up
            fs.unlinkSync(htmlPath);
            throw new Error('No direct URLs found in page');
        } catch (curlError) {
            console.error('Direct curl download failed:', curlError);
            throw new Error(`Download failed after multiple attempts: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
    }
}