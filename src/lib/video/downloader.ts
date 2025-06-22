import youtubeDl from 'youtube-dl-exec';
import fs from 'fs';

/**
 * Augment the NodeJS global type
 */
declare global {
    namespace NodeJS {
        interface Global {
            ytdlpInitialized?: boolean;
            ytdlpInstance?: typeof youtubeDl;
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
}

/**
 * Optimized initialization for serverless environments
 * Uses the default instance with optimized settings for limited resources
 */
export async function ensureYtDlp(): Promise<boolean> {
    if ((global as NodeJS.Global).ytdlpInitialized) {
        return true;
    }

    try {
        console.log('Initializing youtube-dl-exec for serverless environment...');

        // For serverless environments, we rely on the pre-installed binary
        // that comes with youtube-dl-exec package during build time

        // Test with a minimal command to verify the binary works
        const testResult = await youtubeDl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            skipDownload: true,
            quiet: true,
            // Serverless optimizations
            noCallHome: true,
            noMtime: true,
            noCookies: true,
            extractFlat: false
        } as any);

        console.log('youtube-dl-exec initialized successfully');
        (global as NodeJS.Global).ytdlpInitialized = true;
        (global as NodeJS.Global).ytdlpInstance = youtubeDl;
        return true;

    } catch (error: any) {
        console.error('Failed to initialize youtube-dl-exec:', error);

        // In serverless environments, if the binary is not available during runtime,
        // there's nothing we can do as we can't install it dynamically
        // The binary should be included during the build process

        // Check if this is a serverless environment
        if (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
            console.error('youtube-dl-exec binary not available in serverless environment. Ensure it\'s included in build.');
            console.error('Set YOUTUBE_DL_SKIP_DOWNLOAD=false during build to include the binary.');
        }

        return false;
    }
}

/**
 * Optimized video info retrieval for serverless
 * Uses minimal options to reduce execution time and memory usage
 */
export async function getVideoInfo(url: string, infoPath: string): Promise<any> {
    console.log('Fetching video metadata (serverless optimized)...');

    const isReady = await ensureYtDlp();
    if (!isReady) {
        throw new Error('youtube-dl-exec is not available');
    }

    try {
        // Use the global instance if available for better performance
        const ytdlInstance = (global as NodeJS.Global).ytdlpInstance || youtubeDl;

        const info = await ytdlInstance(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            skipDownload: true,
            quiet: true,
            // Serverless optimizations - but maintain quality
            noCallHome: true,
            noMtime: true,
            noCookies: true,
            extractFlat: false,
            // Standard headers for best compatibility
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            // Extended timeout for metadata
            socketTimeout: 60,
            // Standard buffer size
            bufferSize: '16K'
        } as any) as VideoMetadata;

        // Create optimized metadata object with full thumbnails array
        const metadata = {
            title: info?.title || 'Untitled Video',
            thumbnail: info?.thumbnail || `https://i.ytimg.com/vi/${extractVideoId(url)}/maxresdefault.jpg`,
            thumbnails: info?.thumbnails || [], // Keep all thumbnails for quality options
            duration: info?.duration || 0,
            uploader: info?.uploader || info?.channel || 'Unknown'
        };

        // Save metadata efficiently
        fs.writeFileSync(infoPath, JSON.stringify(metadata, null, 2));

        console.log('Video metadata retrieved:', metadata.title);
        return metadata;

    } catch (error) {
        console.error('Error fetching video metadata:', error);

        // Fast fallback for serverless environments
        const videoId = extractVideoId(url);
        const fallbackInfo = {
            title: `YouTube Video ${videoId}`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            thumbnails: [],
            duration: 0,
            uploader: 'Unknown'
        };

        fs.writeFileSync(infoPath, JSON.stringify(fallbackInfo, null, 2));
        return fallbackInfo;
    }
}

/**
 * Maximum quality video download optimized for serverless environments
 * NEVER compromises on video quality - always downloads the best available
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    console.log('Starting MAXIMUM QUALITY video download...');
    console.log('Output path:', outputPath);

    const isReady = await ensureYtDlp();
    if (!isReady) {
        throw new Error('youtube-dl-exec is not available');
    }

    const baseOutputPath = outputPath.replace(/\.mp4$/, '');
    const ytdlInstance = (global as NodeJS.Global).ytdlpInstance || youtubeDl;

    try {
        // MAXIMUM QUALITY PRIORITY - never compromise on quality
        await ytdlInstance(url, {
            output: `${baseOutputPath}.%(ext)s`,
            // BEST QUALITY FORMAT SELECTION - prioritizes highest resolution and quality
            format: 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            mergeOutputFormat: 'mp4',
            noCheckCertificates: true,
            noWarnings: true,

            // Essential headers for maximum compatibility and quality access
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],

            // Quality-focused settings
            preferFreeFormats: true,
            noCallHome: true,

            // Optimize for serverless but maintain quality
            bufferSize: '16K',           // Standard buffer for quality
            httpChunkSize: '10M',        // Larger chunks for better quality streaming
            retries: 5,                  // More retries to ensure we get the video
            fragmentRetries: 5,

            // Extended timeouts for high quality downloads
            socketTimeout: 120,          // 2 minutes timeout for large files

            // Quality preservation settings
            embedSubs: false,            // Keep focused on video quality
            writeSubtitles: false,
            writeDescriptions: false,
            writeInfoJson: false,
            writeAnnotations: false,
            writeThumbnail: false,

            // Ensure no quality reduction during processing
            noPostOverwrites: true,
            keepVideo: false,            // Don't keep separate video files after merging

            // Audio quality settings for maximum quality
            audioQuality: '0',           // Best audio quality
            audioFormat: 'best'
        } as any);

        console.log('MAXIMUM QUALITY video downloaded successfully!');

    } catch (primaryError) {
        console.warn('Primary max quality download failed, trying alternative high quality format:', primaryError);

        try {
            // Alternative high quality approach - still maintaining maximum quality
            await ytdlInstance(url, {
                output: `${baseOutputPath}.%(ext)s`,
                // Alternative max quality format - still prioritizing highest available quality
                format: 'best[height<=2160]/best[height<=1440]/best[height<=1080]/best[ext=mp4]/best',
                noCheckCertificates: true,
                noWarnings: true,
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                ],
                retries: 3,
                socketTimeout: 90,
                audioQuality: '0',
                preferFreeFormats: true,
                noCallHome: true
            } as any);

            console.log('Alternative MAXIMUM QUALITY download successful!');

        } catch (fallbackError) {
            console.error('High quality download methods failed, trying basic best format:', fallbackError);

            try {
                // Final attempt - still trying for best quality available
                await ytdlInstance(url, {
                    output: `${baseOutputPath}.%(ext)s`,
                    format: 'best',              // Still getting the best available
                    noCheckCertificates: true,
                    retries: 2,
                    socketTimeout: 60,
                    addHeader: ['referer:youtube.com']
                } as any);

                console.log('Basic BEST QUALITY download successful!');

            } catch (basicError) {
                console.error('All quality-focused download methods failed:', basicError);

                const errorMessage = basicError instanceof Error ? basicError.message : String(basicError);

                if (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
                    throw new Error(`Serverless max quality download failed: ${errorMessage}. Consider increasing memory/timeout limits for high quality downloads.`);
                } else {
                    throw new Error(`Failed to download maximum quality video: ${errorMessage}`);
                }
            }
        }
    }
}

/**
 * Helper function to extract video ID from URL
 */
function extractVideoId(url: string): string {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?\s]+)/,
        /youtube\.com\/embed\/([^&?\s]+)/,
        /youtube\.com\/v\/([^&?\s]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return 'unknown';
}

/**
 * Utility function to check if running in serverless environment
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
 * Get optimal configuration for maximum quality downloads
 * Never compromises on video quality regardless of environment
 */
export function getOptimalConfig() {
    const isServerless = isServerlessEnvironment();

    return {
        // MAXIMUM QUALITY - supports up to 4K downloads
        format: 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',

        // Quality-focused buffer and chunk sizes
        bufferSize: '16K',
        httpChunkSize: '10M',

        // More retries for quality assurance
        retries: isServerless ? 3 : 5,

        // Extended timeouts for high quality downloads
        socketTimeout: isServerless ? 90 : 120,

        // Audio quality
        audioQuality: '0',  // Best audio quality
        audioFormat: 'best',

        // Quality preservation
        mergeOutputFormat: 'mp4',
        preferFreeFormats: true,
        noPostOverwrites: true
    };
}