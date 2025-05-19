import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import {
    downloadVideo,
    ensureYtDlp,
    getVideoInfo
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
 * Handles POST requests to download a video based on a provided URL.
 * - Validates input
 * - Ensures dependencies are available
 * - Fetches metadata and thumbnail
 * - Downloads the video file
 * - Returns JSON response with video details or error
 */
export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        console.log('Processing URL:', url);

        // Initialize temporary directory and clear old files
        ensureTempDirectoryExists();
        await cleanTempDirectory();

        // Ensure yt-dlp binary is available
        const ytDlpInstalled = await ensureYtDlp();
        if (!ytDlpInstalled) {
            return NextResponse.json({
                error: 'Failed to install or locate yt-dlp. Please install it manually and ensure it is in the PATH.'
            }, { status: 500 });
        }

        // Generate a unique filename for storing video metadata
        const timestamp = Date.now();
        const infoFilename = `video_info_${timestamp}.json`;
        const infoPath = path.join(TEMP_DIR, infoFilename);

        // Fetch video metadata
        let info: VideoMetadata;
        try {
            info = await getVideoInfo(url, infoPath);
            console.log('Video title:', info.title);

            if (!info || !info.title) {
                return NextResponse.json({ error: 'Valid video information could not be retrieved' }, { status: 404 });
            }
        } catch (error) {
            console.error('Error fetching video metadata:', error);
            return NextResponse.json({
                error: 'Could not retrieve video metadata. Please verify the URL.',
                details: error
            }, { status: 500 });
        }

        // Get the best available thumbnail
        const thumbnail = getBestThumbnail(info.thumbnails || []) || info.thumbnail || '';

        // Generate output filename and path (base name without extension)
        const baseName = generateSafeFilename(info.title, timestamp).replace(/\.mp4$/, '');
        const expectedOutputPath = path.join(TEMP_DIR, `${baseName}.mp4`);

        // Download the video
        try {
            await downloadVideo(url, expectedOutputPath);
        } catch (error) {
            console.error('Error downloading video:', error);
            return NextResponse.json({
                error: 'Failed to download video. Please check the URL and write permissions.',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }

        // Find the actual downloaded file by searching for the base name pattern
        let actualFilePath = expectedOutputPath;
        let fileExists = fs.existsSync(actualFilePath);

        if (!fileExists) {
            // Search for files matching the base name pattern
            const files = fs.readdirSync(TEMP_DIR);
            const matchingFile = files.find(file => file.startsWith(baseName));

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
                details: `Expected at path: ${expectedOutputPath}`
            }, { status: 500 });
        }

        // Calculate file size
        const fileSize = calculateFileSize(actualFilePath);

        // Remove temporary metadata file
        if (fs.existsSync(infoPath)) {
            fs.unlinkSync(infoPath);
        }

        // Clean up extra temporary files related to this download
        const safeTitle = info.title.replace(/[^\w]/g, '_').replace(/_+/g, '_');
        cleanExtraFiles(safeTitle, path.basename(actualFilePath));

        // Get actual filename that will be used in the response
        const actualFilename = path.basename(actualFilePath);

        // Prepare response payload
        const response: VideoInfo = {
            title: info.title,
            filename: actualFilename,
            thumbnail: thumbnail,
            duration: info.duration,
            uploader: info.uploader,
            fileSize: fileSize,
        };

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