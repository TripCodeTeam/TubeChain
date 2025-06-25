import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { ensureDirExists, TEMP_DIR } from '@/lib/file-system';

/**
 * API Route for serving video files with detailed debugging
 */
export async function GET(request: NextRequest) {
  try {
    console.log('File request received:', request.url);
    console.log('TEMP_DIR path:', TEMP_DIR);
    
    // Get the URL and parse it
    const url = new URL(request.url);
    console.log('Parsed URL:', url.toString());
    console.log('Search params:', Object.fromEntries(url.searchParams.entries()));
    
    // Try to get filename from query parameters first
    let filename = url.searchParams.get('filename');
    console.log('Filename from query params:', filename);
    
    // If not found in query, try to extract from the URL path
    if (!filename) {
      const pathParts = url.pathname.split('/');
      console.log('Path parts:', pathParts);
      
      filename = pathParts[pathParts.length - 1];
      console.log('Filename from path:', filename);
      
      // If the last path segment is 'file', there's no filename in the path
      if (filename === 'file') {
        filename = null;
      }
    }
    
    if (!filename) {
      console.log('No filename found');
      return NextResponse.json({
        error: 'Filename is required',
        message: 'No filename found in path or query parameters'
      }, { status: 400 });
    }

    // Ensure temp directory exists
    console.log('Ensuring directory exists:', TEMP_DIR);
    ensureDirExists(TEMP_DIR);
    console.log('Directory exists:', fs.existsSync(TEMP_DIR));

    // Prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    console.log('Sanitized filename:', sanitizedFilename);
    
    const filePath = path.join(TEMP_DIR, sanitizedFilename);
    console.log('Looking for file at:', filePath);
    
    // Check if file exists
    const fileExists = fs.existsSync(filePath);
    console.log('File exists:', fileExists);
    
    if (!fileExists) {
      // List all files in the directory for debugging
      try {
        const dirFiles = fs.readdirSync(TEMP_DIR);
        console.log('Files in directory:', dirFiles);
      } catch (err) {
        console.log('Error reading directory:', err);
      }
      
      return NextResponse.json({
        error: 'File not found',
        filename: sanitizedFilename,
        path: filePath,
        tempDir: TEMP_DIR
      }, { status: 404 });
    }

    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    console.log('File size:', fileSize);
    
    // Determine file type based on extension
    const extension = path.extname(sanitizedFilename).toLowerCase();
    console.log('File extension:', extension);
    
    let fileType = 'application/octet-stream'; // Default
    
    // Set appropriate content type based on file extension
    if (extension === '.mp4') fileType = 'video/mp4';
    else if (extension === '.webm') fileType = 'video/webm';
    else if (extension === '.mov') fileType = 'video/quicktime';
    else if (extension === '.avi') fileType = 'video/x-msvideo';
    else if (extension === '.mkv') fileType = 'video/x-matroska';
    
    console.log('File type:', fileType);

    // Handle range requests for video streaming
    const range = request.headers.get('range');
    console.log('Range header:', range);
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      console.log(`Streaming range: ${start}-${end}/${fileSize}`);
      
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
      console.log('Serving entire file');
      
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