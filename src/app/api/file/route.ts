import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define temporary directory path for file storage
const TEMP_DIR = path.join(process.cwd(), 'temp');

/**
 * Handles GET requests to stream video files from the temp directory
 * - Validates filename parameter
 * - Prevents path traversal attacks
 * - Streams file content with proper download headers
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const filename = url.searchParams.get('filename');

        if (!filename) {
            return NextResponse.json({ error: 'Filename parameter is required' }, { status: 400 });
        }

        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(TEMP_DIR, sanitizedFilename);

        // Verify file exists before attempting to stream
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Read file into buffer for streaming
        const fileBuffer = fs.readFileSync(filePath);

        // Set headers for file download
        const headers = new Headers();
        headers.set('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
        headers.set('Content-Type', 'video/mp4');

        // Return streaming response
        return new NextResponse(fileBuffer, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error('Unexpected error during file streaming:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}