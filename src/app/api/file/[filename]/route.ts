import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { TEMP_DIR } from '@/lib/utils/file-system';

/**
 * API Route for serving video files
 * This is necessary if videos need additional protection or processing
 */
export async function GET(request: NextRequest) {
  try {
    // Extract filename from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(TEMP_DIR, sanitizedFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const fileType = 'video/mp4';

    // Handle range requests for video streaming
    const range = request.headers.get('range');
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      const file = fs.createReadStream(filePath, { start, end });
      
      // Note: This is only needed if you want to manually stream the file
      // Otherwise, Next.js static file serving will handle this
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': fileType,
      };

      return new NextResponse(file as any, {
        status: 206,
        headers: headers,
      });
    } else {
      // If no range requested, serve entire file
      const headers = {
        'Content-Length': fileSize.toString(),
        'Content-Type': fileType,
      };

      const file = fs.readFileSync(filePath);
      return new NextResponse(file, {
        status: 200,
        headers: headers,
      });
    }
  } catch (error) {
    console.error('Error serving video:', error);
    return NextResponse.json({
      error: 'Failed to serve video file',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}