import { Innertube, ClientType } from 'youtubei.js';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * Augment the NodeJS global type
 */
declare global {
    namespace NodeJS {
        interface Global {
            innertubeInitialized?: boolean;
            innertubeInstance?: Innertube;
        }
    }
}

/**
 * Interface for video metadata
 */
interface VideoMetadata {
    title?: string;
    thumbnail?: string;
    thumbnails?: Array<{
        url: string;
        width?: number;
        height?: number;
    }>;
    duration?: number;
    uploader?: string;
    channel?: string;
    viewCount?: number;
    publishDate?: string;
}

/**
 * Download configuration for different quality levels
 */
interface DownloadConfig {
    quality: 'highest' | 'high' | 'medium' | 'audio_only';
    format: 'mp4' | 'webm' | 'any';
    includeAudio: boolean;
}

interface AdaptiveFormat {
    mime_type?: string;
    quality_label?: string;
    bitrate?: number;
    has_audio?: boolean;
    decipher: (player: any) => string;
    [key: string]: any;
}

interface Thumbnail {
    url: string;
    width?: number;
    height?: number;
}

// Tipo para VideoInfo basado en la respuesta real de YouTube.js
type VideoInfo = Awaited<ReturnType<Innertube['getInfo']>>;

/**
 * Optimized initialization for serverless environments (Vercel)
 * Uses YouTube.js with optional cookie authentication
 */
export async function ensureInnertube(cookie?: string): Promise<Innertube> {
    if ((global as NodeJS.Global).innertubeInitialized && (global as NodeJS.Global).innertubeInstance) {
        return (global as NodeJS.Global).innertubeInstance!;
    }

    try {
        console.log('Initializing YouTube.js for Vercel serverless environment...');

        const innertube = await Innertube.create({
            // Use cookie authentication if provided (recommended for better access)
            ...(cookie && { cookie }),

            // Optimize for serverless environments like Vercel
            enable_session_cache: false,

            // Client configuration for better compatibility
            client_type: ClientType.WEB,

            // Add visitor data for better reliability
            visitor_data: undefined,

            // Optimize for Vercel's memory limits
            cache: undefined
        });

        console.log('YouTube.js initialized successfully for Vercel');
        (global as NodeJS.Global).innertubeInitialized = true;
        (global as NodeJS.Global).innertubeInstance = innertube;

        return innertube;

    } catch (error: any) {
        console.error('Failed to initialize YouTube.js:', error);

        // Fallback without authentication for Vercel
        try {
            console.log('Retrying without authentication for Vercel...');
            const innertube = await Innertube.create({
                enable_session_cache: false,
                client_type: ClientType.WEB,
                cache: undefined
            });

            (global as NodeJS.Global).innertubeInitialized = true;
            (global as NodeJS.Global).innertubeInstance = innertube;

            return innertube;
        } catch (fallbackError) {
            throw new Error(`Failed to initialize YouTube.js on Vercel: ${fallbackError}`);
        }
    }
}

/**
 * Helper function to safely get nested properties
 */
function safeGet(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
}


/**
 * Optimized video info retrieval for Vercel serverless
 * Uses YouTube.js for fast metadata extraction
 */
export async function getVideoInfo(url: string, infoPath: string, cookie?: string): Promise<VideoMetadata> {
    console.log('Fetching video metadata with YouTube.js on Vercel...');

    const innertube = await ensureInnertube(cookie);

    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        const videoInfo = await innertube.getInfo(videoId);

        // Extract comprehensive metadata using safe property access
        const basicInfo = videoInfo.basic_info;
        
        // Acceso seguro a las propiedades
        const title = safeGet(basicInfo, ['title']) || 'Untitled Video';
        const thumbnails = safeGet(basicInfo, ['thumbnail']) || [];
        const duration = safeGet(basicInfo, ['duration', 'seconds_total']) || 0;
        const author = safeGet(basicInfo, ['author']) || 'Unknown';
        const channelName = safeGet(basicInfo, ['channel', 'name']) || author;
        const viewCount = safeGet(basicInfo, ['view_count']) || 0;
        
        // Para publish_date, necesitamos acceder a microformat o primary_info
        let publishDate: string | undefined;
        try {
            // Intentar obtener la fecha de publicación de diferentes lugares
            publishDate = safeGet(videoInfo, ['microformat', 'microformat_data_renderer', 'publish_date']) ||
                         safeGet(videoInfo, ['primary_info', 'published']) ||
                         safeGet(videoInfo, ['secondary_info', 'owner', 'subscriber_count_text']) ||
                         undefined;
        } catch (e) {
            console.warn('Could not extract publish date:', e);
        }

        const metadata: VideoMetadata = {
            title: title,
            thumbnail: thumbnails[0]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            thumbnails: thumbnails.map((thumb: any) => ({
                url: thumb.url,
                width: thumb.width,
                height: thumb.height
            })),
            duration: duration,
            uploader: author,
            channel: channelName,
            viewCount: Number(viewCount) || 0,
            publishDate: publishDate
        };

        // Save metadata efficiently for Vercel
        fs.writeFileSync(infoPath, JSON.stringify(metadata, null, 2));

        console.log('Video metadata retrieved on Vercel:', metadata.title);
        return metadata;

    } catch (error) {
        console.error('Error fetching video metadata on Vercel:', error);

        // Fast fallback for Vercel serverless environments
        const videoId = extractVideoId(url);
        const fallbackInfo: VideoMetadata = {
            title: `YouTube Video ${videoId}`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            thumbnails: [],
            duration: 0,
            uploader: 'Unknown',
            channel: 'Unknown'
        };

        fs.writeFileSync(infoPath, JSON.stringify(fallbackInfo, null, 2));
        return fallbackInfo;
    }
}

/**
 * Maximum quality video download using YouTube.js optimized for Vercel
 * Downloads the highest quality available stream
 */
export async function downloadVideo(
    url: string,
    outputPath: string,
    config: DownloadConfig = { quality: 'highest', format: 'mp4', includeAudio: true },
    cookie?: string
): Promise<void> {
    console.log('Starting MAXIMUM QUALITY video download with YouTube.js on Vercel...');
    console.log('Output path:', outputPath);

    const innertube = await ensureInnertube(cookie);
    const videoId = extractVideoId(url);

    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }

    try {
        const videoInfo = await innertube.getInfo(videoId);

        // Get the best quality stream based on configuration
        const stream = getBestQualityStream(videoInfo, config);

        if (!stream) {
            throw new Error('No suitable stream found for the specified quality');
        }

        console.log(`Downloading stream on Vercel: ${stream.quality_label || 'Best Available'} - ${stream.mime_type}`);

        // Download the stream with Vercel timeout considerations
        await downloadStreamWithTimeout(stream.decipher(innertube.session.player), outputPath);

        console.log('MAXIMUM QUALITY video downloaded successfully on Vercel!');

    } catch (error) {
        console.error('Error downloading video on Vercel:', error);

        // Fallback to adaptive streams if direct download fails
        try {
            console.log('Trying adaptive stream download on Vercel...');
            await downloadAdaptiveStreams(innertube, videoId, outputPath, config);
            console.log('Adaptive stream download successful on Vercel!');
        } catch (fallbackError) {
            throw new Error(`Failed to download video on Vercel: ${fallbackError}`);
        }
    }
}

/**
 * Get the best quality stream from available formats
 */
function getBestQualityStream(videoInfo: VideoInfo, config: DownloadConfig): any {
    const formats = safeGet(videoInfo, ['streaming_data', 'formats']) || [];
    const adaptiveFormats = safeGet(videoInfo, ['streaming_data', 'adaptive_formats']) || [];

    // Combine all available streams
    const allStreams = [...formats, ...adaptiveFormats];

    if (config.quality === 'audio_only') {
        // Find best audio stream
        return allStreams
            .filter(stream => stream.mime_type?.includes('audio'))
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    }

    // Filter by format preference if specified
    let filteredStreams = allStreams;
    if (config.format !== 'any') {
        filteredStreams = allStreams.filter(stream =>
            stream.mime_type?.includes(config.format)
        );

        // Fallback to any format if preferred format not available
        if (filteredStreams.length === 0) {
            filteredStreams = allStreams;
        }
    }

    // Filter for video streams if audio is required to be included
    if (config.includeAudio) {
        const videoWithAudio = filteredStreams.filter(stream =>
            stream.mime_type?.includes('video') && stream.has_audio
        );

        if (videoWithAudio.length > 0) {
            filteredStreams = videoWithAudio;
        }
    }

    // Sort by quality based on preference
    switch (config.quality) {
        case 'highest':
            return filteredStreams
                .filter(stream => stream.mime_type?.includes('video'))
                .sort((a, b) => {
                    // Prioritize by resolution, then bitrate
                    const aRes = parseInt(a.quality_label?.replace('p', '') || '0');
                    const bRes = parseInt(b.quality_label?.replace('p', '') || '0');
                    if (aRes !== bRes) return bRes - aRes;
                    return (b.bitrate || 0) - (a.bitrate || 0);
                })[0];

        case 'high':
            return filteredStreams
                .filter(stream => {
                    const res = parseInt(stream.quality_label?.replace('p', '') || '0');
                    return res <= 1080 && res >= 720 && stream.mime_type?.includes('video');
                })
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        case 'medium':
            return filteredStreams
                .filter(stream => {
                    const res = parseInt(stream.quality_label?.replace('p', '') || '0');
                    return res <= 720 && res >= 480 && stream.mime_type?.includes('video');
                })
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        default:
            return filteredStreams[0];
    }
}

/**
 * Download stream data to file with Vercel timeout handling
 */
async function downloadStreamWithTimeout(streamUrl: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const url = new URL(streamUrl);
        const client = url.protocol === 'https:' ? https : http;

        const request = client.get(streamUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }

            const writeStream = fs.createWriteStream(outputPath);

            response.pipe(writeStream);

            writeStream.on('finish', () => {
                writeStream.close();
                resolve();
            });

            writeStream.on('error', reject);
        });

        request.on('error', reject);
        
        // Shorter timeout for Vercel serverless functions (max 60s)
        request.setTimeout(50000, () => {
            request.destroy();
            reject(new Error('Download timeout - Vercel function limit'));
        });
    });
}

/**
 * Download adaptive streams (video + audio separately, then merge)
 * Optimized for Vercel serverless constraints
 */
async function downloadAdaptiveStreams(
    innertube: Innertube,
    videoId: string,
    outputPath: string,
    config: DownloadConfig
): Promise<void> {
    const videoInfo = await innertube.getInfo(videoId);
    const adaptiveFormats = safeGet(videoInfo, ['streaming_data', 'adaptive_formats']) || [];

    // Find best video stream
    const videoStream: AdaptiveFormat | undefined = (adaptiveFormats as AdaptiveFormat[])
        .filter((stream: AdaptiveFormat) => stream.mime_type?.includes('video'))
        .sort((a: AdaptiveFormat, b: AdaptiveFormat) => {
            const aRes = parseInt(a.quality_label?.replace('p', '') || '0');
            const bRes = parseInt(b.quality_label?.replace('p', '') || '0');
            return bRes - aRes;
        })[0];

    if (!videoStream) {
        throw new Error('No video stream found');
    }

    // For Vercel, download just the video stream to avoid complexity
    // In production, you might want to merge video + audio using ffmpeg
    const streamUrl = videoStream.decipher(innertube.session.player);
    await downloadStreamWithTimeout(streamUrl, outputPath);
}

/**
 * Helper function to extract video ID from URL
 */
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

/**
 * Utility function to check if running in Vercel environment
 */
export function isVercelEnvironment(): boolean {
    return !!(
        process.env.VERCEL ||
        process.env.VERCEL_ENV ||
        process.env.VERCEL_URL
    );
}

/**
 * Utility function to check if running in any serverless environment
 */
export function isServerlessEnvironment(): boolean {
    return !!(
        process.env.VERCEL ||
        process.env.NETLIFY ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.AZURE_FUNCTIONS_ENVIRONMENT ||
        process.env.GOOGLE_CLOUD_PROJECT
    );
}

/**
 * Get optimal configuration for maximum quality downloads on Vercel
 * Supports up to 4K downloads when available
 */
export function getOptimalConfig(): DownloadConfig {
    return {
        quality: 'highest',      // Always prioritize maximum quality
        format: 'mp4',          // Prefer MP4 for compatibility
        includeAudio: true      // Include audio in video downloads
    };
}

/**
 * Advanced download with custom options optimized for Vercel
 */
export async function downloadVideoAdvanced(
    url: string,
    outputPath: string,
    options: {
        cookie?: string;
        quality?: 'highest' | 'high' | 'medium' | 'audio_only';
        format?: 'mp4' | 'webm' | 'any';
        includeAudio?: boolean;
        maxRetries?: number;
    } = {}
): Promise<VideoMetadata> {
    const config: DownloadConfig = {
        quality: options.quality || 'highest',
        format: options.format || 'mp4',
        includeAudio: options.includeAudio !== false
    };

    const maxRetries = options.maxRetries || 2; // Reduced for Vercel timeout limits
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Vercel download attempt ${attempt}/${maxRetries}`);

            // Get video info first
            const infoPath = outputPath.replace(/\.[^.]+$/, '.info.json');
            const metadata = await getVideoInfo(url, infoPath, options.cookie);

            // Download the video
            await downloadVideo(url, outputPath, config, options.cookie);

            return metadata;

        } catch (error) {
            lastError = error as Error;
            console.error(`Vercel attempt ${attempt} failed:`, error);

            if (attempt < maxRetries) {
                console.log(`Retrying in ${attempt} seconds for Vercel...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts on Vercel: ${lastError?.message}`);
}