import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import {
    downloadVideo,
    getVideoInfo,
    downloadVideoAdvanced,
    getOptimalConfig
} from '@/lib/video/downloader';
import {
    cleanExtraFiles,
    cleanTempDirectory,
    ensureTempDirectoryExists,
    generateSafeFilename,
    TEMP_DIR
} from '@/lib/utils/file-system';
import {
    VideoInfo,
    VideoMetadata
} from '@/lib/video/model';
import {
    calculateFileSize,
    getBestThumbnail
} from '@/lib/video/helpers';

/**
 * Handles POST requests to download a video using youtubei.js
 * - Validates input
 * - Fetches metadata using youtubei.js
 * - Downloads the video file
 * - Returns JSON response with video details or error
 */
export async function POST(request: NextRequest) {
    try {
        const { url, quality = 'highest', format = 'mp4', cookie } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        console.log('Processing URL with youtubei.js:', url);

        // Initialize temporary directory and clear old files
        ensureTempDirectoryExists();
        await cleanTempDirectory();

        // Generate a unique filename for storing video metadata
        const timestamp = Date.now();
        const infoFilename = `video_info_${timestamp}.json`;
        const infoPath = path.join(TEMP_DIR, infoFilename);

        // Fetch video metadata using youtubei.js
        let info: VideoMetadata;
        try {
            console.log('Fetching video metadata with youtubei.js...');
            info = await getVideoInfo(url, infoPath, cookie);
            console.log('Video title:', info.title);

            if (!info || !info.title) {
                return NextResponse.json({
                    error: 'Valid video information could not be retrieved'
                }, { status: 404 });
            }
        } catch (error) {
            console.error('Error fetching video metadata:', error);
            return NextResponse.json({
                error: 'Could not retrieve video metadata. Please verify the URL.',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }

        // Get the best available thumbnail
        const thumbnail = getBestThumbnail(info.thumbnails || []) || info.thumbnail || '';

        // Generate output filename and path
        const baseName = generateSafeFilename(info.title || 'video', timestamp);
        const outputFilename = baseName.endsWith('.mp4') ? baseName : `${baseName}.mp4`;
        const outputPath = path.join(TEMP_DIR, outputFilename);

        // Download the video using youtubei.js
        try {
            console.log('Starting video download with youtubei.js...');

            // Use the advanced download function with custom options
            await downloadVideoAdvanced(url, outputPath, {
                cookie,
                quality: quality as 'highest' | 'high' | 'medium' | 'audio_only',
                format: format as 'mp4' | 'webm' | 'any',
                includeAudio: true,
                maxRetries: 2
            });

            console.log('Video downloaded successfully!');
        } catch (error) {
            console.error('Error downloading video:', error);
            return NextResponse.json({
                error: 'Failed to download video. Please check the URL.',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }

        // Verify the downloaded file exists
        let actualFilePath = outputPath;
        let fileExists = fs.existsSync(actualFilePath);

        if (!fileExists) {
            // Search for files matching the base name pattern
            const files = fs.readdirSync(TEMP_DIR);
            const matchingFile = files.find(file =>
                file.startsWith(baseName.replace('.mp4', '')) &&
                (file.endsWith('.mp4') || file.endsWith('.webm'))
            );

            if (matchingFile) {
                actualFilePath = path.join(TEMP_DIR, matchingFile);
                fileExists = true;
                console.log(`Found matching file: ${matchingFile}`);
            }
        }

        // Final verification that we found a file
        if (!fileExists) {
            return NextResponse.json({
                error: 'Downloaded file was not found after successful download attempt',
                details: `Expected at path: ${outputPath}`
            }, { status: 500 });
        }

        // Calculate file size
        const fileSize = calculateFileSize(actualFilePath);

        // Remove temporary metadata file
        if (fs.existsSync(infoPath)) {
            fs.unlinkSync(infoPath);
        }

        // Clean up extra temporary files related to this download
        const safeTitle = (info.title || 'video').replace(/[^\w]/g, '_').replace(/_+/g, '_');
        cleanExtraFiles(safeTitle, path.basename(actualFilePath));

        // Get actual filename that will be used in the response
        const actualFilename = path.basename(actualFilePath);

        // Prepare response payload with enhanced metadata
        const response: VideoInfo = {
            title: info.title || 'Unknown Title',
            filename: actualFilename,
            thumbnail: thumbnail,
            duration: info.duration || 0,
            uploader: info.uploader || info.channel || 'Unknown',
            fileSize: fileSize,
            // Optional enhanced metadata fields
            ...(info.viewCount !== undefined && { viewCount: info.viewCount }),
            ...(info.publishDate !== undefined && { publishDate: info.publishDate }),
            ...(info.channel !== undefined && { channel: info.channel })
        };

        console.log('Video processing completed successfully:', {
            title: response.title,
            filename: response.filename,
            fileSize: response.fileSize
        });

        return NextResponse.json(response);

    } catch (error) {
        console.error('Unexpected error during video processing:', error);
        return NextResponse.json(
            {
                error: 'An unexpected error occurred while processing the video.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint para obtener solo metadata sin descargar
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');
        const cookie = searchParams.get('cookie');

        if (!url) {
            return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
        }

        console.log('Fetching metadata only for:', url);

        // Generate temporary path for metadata
        const timestamp = Date.now();
        const infoFilename = `temp_info_${timestamp}.json`;
        const infoPath = path.join(TEMP_DIR, infoFilename);

        try {
            const info: VideoMetadata = await getVideoInfo(url, infoPath, cookie || undefined);

            // Clean up temp file
            if (fs.existsSync(infoPath)) {
                fs.unlinkSync(infoPath);
            }

            const response = {
                title: info.title || 'Unknown Title',
                thumbnail: getBestThumbnail(info.thumbnails || []) || info.thumbnail || '',
                duration: info.duration || 0,
                uploader: info.uploader || info.channel || 'Unknown',
                ...(info.channel && { channel: info.channel }),
                ...(info.viewCount !== undefined && { viewCount: info.viewCount }),
                ...(info.publishDate && { publishDate: info.publishDate }),
                thumbnails: info.thumbnails || []
            };

            return NextResponse.json(response);

        } catch (error) {
            // Clean up temp file in case of error
            if (fs.existsSync(infoPath)) {
                fs.unlinkSync(infoPath);
            }

            throw error;
        }

    } catch (error) {
        console.error('Error fetching video metadata:', error);
        return NextResponse.json({
            error: 'Could not retrieve video metadata',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

/**
 * OPTIONS endpoint para CORS
 */
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}