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
            nodeDownloader?: any; // Store the downloader directly in memory
        }
    }
}

/**
 * Detects the exact CPU architecture to download the correct binary
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
 * Creates a Node-based downloader and loads it directly into memory
 * Avoids file system dependency issues in serverless environments
 */
function createInMemoryDownloader(): any {
    console.log('Creating in-memory Node.js downloader');

    // Simple YouTube downloader functions
    const nodeDownloader = {
        getVideoInfo: async function (url: string): Promise<any> {
            console.log('Getting video info with in-memory downloader');

            // Extract video ID from URL
            const videoId = extractVideoId(url);
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }

            try {
                // Try to get some basic info about the video
                const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);

                if (response.ok) {
                    const data = await response.json();
                    return {
                        title: data.title || `YouTube Video ${videoId}`,
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        uploader: data.author_name || 'Unknown',
                        duration: 0,
                        videoId
                    };
                }
            } catch (error) {
                console.log('Error fetching oembed data:', error);
            }

            // Fallback to minimal info if oembed fails
            return {
                title: `YouTube Video ${videoId}`,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                uploader: 'Unknown',
                duration: 0,
                videoId
            };
        },

        downloadVideo: async function (url: string, outputPath: string): Promise<void> {
            console.log('Downloading video with in-memory downloader');
            const videoId = extractVideoId(url);
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }

            try {
                // Approach 1: Try using the Invidious API
                const invidiousInstances = [
                    'https://invidious.snopyta.org',
                    'https://invidious.kavin.rocks',
                    'https://vid.puffyan.us'
                ];

                for (const instance of invidiousInstances) {
                    try {
                        console.log(`Trying Invidious instance: ${instance}`);
                        const apiUrl = `${instance}/api/v1/videos/${videoId}`;
                        const response = await fetch(apiUrl);

                        if (response.ok) {
                            const data = await response.json();
                            if (data.formatStreams && data.formatStreams.length > 0) {
                                // Find a good quality stream
                                const formatStream = data.formatStreams.find((s: any) => s.resolution === '720p') ||
                                    data.formatStreams.find((s: any) => s.resolution === '360p') ||
                                    data.formatStreams[0];

                                if (formatStream && formatStream.url) {
                                    console.log(`Found stream URL from Invidious: ${formatStream.resolution}`);
                                    // Download the file
                                    await downloadFile(formatStream.url, outputPath);
                                    return;
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`Error with Invidious instance ${instance}:`, error);
                        // Continue to next instance
                    }
                }

                // Approach 2: Try using a web-based API service (as fallback)
                try {
                    const apiUrl = `https://api.vevioz.com/api/button/videos/${videoId}`;
                    const response = await fetch(apiUrl);

                    if (response.ok) {
                        const html = await response.text();
                        const downloadLinkMatch = html.match(/href="(https?:\/\/[^"]+download[^"]+)"/);

                        if (downloadLinkMatch && downloadLinkMatch[1]) {
                            console.log('Found download link from Vevioz API');
                            await downloadFile(downloadLinkMatch[1], outputPath);
                            return;
                        }
                    }
                } catch (error) {
                    console.log('Error with Vevioz API:', error);
                }

                // Approach 3: Final fallback - use YouTube page to get direct links
                console.log('Using YouTube page approach to find stream URLs');
                const ytpageUrl = `https://www.youtube.com/watch?v=${videoId}`;
                const ytResponse = await fetch(ytpageUrl);

                if (ytResponse.ok) {
                    const html = await ytResponse.text();

                    // Look for URL encoded streams
                    const urlEncodedMatch = html.match(/(?:"url_encoded_fmt_stream_map":)(".*?")/);
                    if (urlEncodedMatch && urlEncodedMatch[1]) {
                        try {
                            const formats = JSON.parse(urlEncodedMatch[1]);
                            const urls = formats.match(/https?:\/\/[^"]+/g);

                            if (urls && urls.length > 0) {
                                console.log('Found URL from YouTube page');
                                await downloadFile(urls[0], outputPath);
                                return;
                            }
                        } catch (parseError) {
                            console.log('Error parsing URL encoded formats:', parseError);
                        }
                    }

                    // Look for videoplayback URLs
                    const videoPlaybackUrls = html.match(/https:\/\/[^"]*videoplayback[^"]*/g);
                    if (videoPlaybackUrls && videoPlaybackUrls.length > 0) {
                        console.log('Found videoplayback URL from YouTube page');
                        await downloadFile(videoPlaybackUrls[0], outputPath);
                        return;
                    }
                }

                throw new Error('Could not find any valid stream URL');
            } catch (error) {
                console.error('All download methods failed:', error);
                throw error;
            }
        }
    };

    // Helper function to extract video ID
    function extractVideoId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?\s]+)/,
            /youtube\.com\/embed\/([^&?\s]+)/,
            /youtube\.com\/v\/([^&?\s]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }

        return null;
    }

    // Helper function to download file using fetch API
    async function downloadFile(url: string, outputPath: string): Promise<void> {
        console.log(`Downloading file from ${url} to ${outputPath}`);

        try {
            // Use curl for better compatibility with serverless environments
            await execAsync(`curl -L "${url}" -o "${outputPath}"`);
            console.log('Download completed using curl');
        } catch (curlError) {
            console.error('Curl download failed:', curlError);

            // Fallback to fetch + node file API if curl fails
            try {
                console.log('Trying fetch API download fallback');
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const buffer = await response.arrayBuffer();
                fs.writeFileSync(outputPath, Buffer.from(buffer));
                console.log('Download completed using fetch API');
            } catch (fetchError) {
                console.error('Fetch download failed:', fetchError);
                throw fetchError;
            }
        }
    }

    return nodeDownloader;
}

/**
 * Ensures the YouTube download capability is available
 */
export async function ensureYtDlp(): Promise<boolean> {
    // If already initialized, don't repeat
    if ((global as NodeJS.Global).ytdlpInitialized) {
        return true;
    }

    // First, try to use system yt-dlp
    try {
        await execAsync('yt-dlp --version');
        console.log('yt-dlp is already installed in the system.');
        (global as NodeJS.Global).ytdlpInitialized = true;
        return true;
    } catch (systemError) {
        console.log('System yt-dlp not found. Creating in-memory downloader...');

        // Create in-memory downloader
        (global as NodeJS.Global).nodeDownloader = createInMemoryDownloader();
        (global as NodeJS.Global).ytdlpInitialized = true;
        (global as NodeJS.Global).ytDlpPath = 'in-memory';

        return true;
    }
}

/**
 * Retrieves video metadata
 */
export async function getVideoInfo(url: string, infoPath: string): Promise<any> {
    console.log('Fetching video metadata...');

    // Ensure we have a downloader
    if (!(global as NodeJS.Global).ytdlpInitialized) {
        await ensureYtDlp();
    }

    // Handle in-memory downloader
    if ((global as NodeJS.Global).ytDlpPath === 'in-memory' && (global as NodeJS.Global).nodeDownloader) {
        try {
            console.log('Using in-memory downloader for metadata');
            const info = await (global as NodeJS.Global).nodeDownloader.getVideoInfo(url);

            // Save the info to the specified path
            fs.writeFileSync(infoPath, JSON.stringify(info));

            return info;
        } catch (error) {
            console.error('In-memory downloader failed:', error);

            // Fallback to minimal info
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

    // System yt-dlp approach (if we got here, we know it's available)
    try {
        await execAsync(`yt-dlp "${url}" --dump-json --no-check-certificate --no-warnings > "${infoPath}"`);
        return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch (error) {
        console.log('JSON parsing failed. Using text-based extraction...', error);

        try {
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
 * Downloads video file
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting video download...');
    console.log('Output path:', outputPath);

    // Ensure we have a downloader
    if (!(global as NodeJS.Global).ytdlpInitialized) {
        await ensureYtDlp();
    }

    // Handle in-memory downloader
    if ((global as NodeJS.Global).ytDlpPath === 'in-memory' && (global as NodeJS.Global).nodeDownloader) {
        try {
            console.log('Using in-memory downloader for video');
            await (global as NodeJS.Global).nodeDownloader.downloadVideo(url, outputPath);
            return;
        } catch (error) {
            console.error('In-memory downloader failed:', error);
            throw error;
        }
    }

    // Standard yt-dlp approach (we'll only get here if system yt-dlp is available)
    // Get base filename without extension for consistent naming
    const baseOutputPath = outputPath.replace(/\.mp4$/, '');

    try {
        // Format selection prioritizing audio and video quality
        const command = `yt-dlp "${url}" -f "bestvideo+bestaudio/best" --merge-output-format mp4 -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`;
        console.log('Executing command:', command);

        await execAsync(command);
    } catch (dlError) {
        console.error('Primary download failed:', dlError);

        // Try simpler approach
        try {
            await execAsync(`yt-dlp "${url}" -f "best" -o "${baseOutputPath}.%(ext)s" --no-check-certificate --no-warnings`);
        } catch (simpleError) {
            console.error('Simple download failed:', simpleError);

            // Fallback to in-memory downloader as last resort
            if (!(global as NodeJS.Global).nodeDownloader) {
                (global as NodeJS.Global).nodeDownloader = createInMemoryDownloader();
            }

            console.log('Using in-memory downloader as fallback');
            await (global as NodeJS.Global).nodeDownloader.downloadVideo(url, outputPath);
        }
    }
}