import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// Interfaces para el tipo de respuesta
interface VideoInfo {
  id: string;
  title: string;
  description: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
  author: {
    name: string;
    channelId: string;
  };
  viewCount: number;
  uploadDate: string;
  quality: string;
  format: string;
  fileSize: number;
}

// Configuración del backend NestJS
const BACKEND_URL = process.env.BACKEND_URL!;
const TEMP_DIR = path.join(process.cwd(), 'public', 'temp');

// Función para asegurar que el directorio existe
function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directorio creado: ${dirPath}`);
  }
}

// Función para sanitizar nombres de archivo
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s-\.]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);
}

/**
 * Handles POST requests to download a video using the NestJS backend
 * - Validates input URL
 * - Makes request to NestJS backend
 * - Saves video file temporarily in /public/temp
 * - Returns JSON response with video details and file path
 */
export async function POST(request: NextRequest) {
  try {
    console.log('POST request received for video download');

    // Parse request body
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required',
        message: 'Please provide a valid YouTube URL'
      }, { status: 400 });
    }

    // Validate YouTube URL format
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL',
        message: 'Please provide a valid YouTube URL'
      }, { status: 400 });
    }

    console.log(`Processing YouTube URL: ${url}`);

    // Ensure temp directory exists
    ensureDirExists(TEMP_DIR);

    // Make request to NestJS backend
    console.log(`Making request to backend: ${BACKEND_URL}/youtube/download`);
    
    const backendResponse = await fetch(`${BACKEND_URL}/youtube/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    console.log(`Backend response status: ${backendResponse.status}`);

    if (!backendResponse.ok) {
      // Handle backend errors
      let errorMessage = 'Error downloading video from backend';
      let errorDetails = {};

      try {
        const errorData = await backendResponse.json();
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData;
      } catch (parseError) {
        console.error('Error parsing backend error response:', parseError);
      }

      return NextResponse.json({
        success: false,
        error: 'Backend Error',
        message: errorMessage,
        details: errorDetails,
        status: backendResponse.status
      }, { status: backendResponse.status });
    }

    // Get video info from headers
    const videoInfoHeader = backendResponse.headers.get('X-Video-Info');
    let videoInfo: Partial<VideoInfo> = {};

    if (videoInfoHeader) {
      try {
        videoInfo = JSON.parse(videoInfoHeader);
      } catch (parseError) {
        console.error('Error parsing video info from header:', parseError);
      }
    }

    // Get filename from Content-Disposition header
    const contentDisposition = backendResponse.headers.get('Content-Disposition');
    let originalFilename = 'downloaded_video.mp4';
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=([^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        originalFilename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Sanitize filename and ensure it's unique
    const sanitizedFilename = sanitizeFilename(originalFilename);
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`;
    const filePath = path.join(TEMP_DIR, uniqueFilename);

    console.log(`Saving video as: ${uniqueFilename}`);

    // Convert response to buffer and save file
    const arrayBuffer = await backendResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file to temp directory
    fs.writeFileSync(filePath, buffer);
    console.log(`Video saved successfully: ${filePath} (${buffer.length} bytes)`);

    // Construct the URL to access the saved file
    const fileUrl = `/temp/${uniqueFilename}`;
    const fullFileUrl = `${request.nextUrl.origin}${fileUrl}`;

    // Return success response with video info and file details
    const response = {
      success: true,
      message: 'Video downloaded and saved successfully',
      videoInfo: {
        title: videoInfo.title || 'Unknown Title',
        duration: videoInfo.duration || 'Unknown Duration',
        quality: videoInfo.quality || 'Unknown Quality',
        author: videoInfo.author || 'Unknown Author',
        viewCount: videoInfo.viewCount || 0,
        fileSize: buffer.length,
        ...videoInfo
      },
      file: {
        filename: uniqueFilename,
        originalFilename: originalFilename,
        size: buffer.length,
        path: fileUrl,
        fullUrl: fullFileUrl,
        contentType: backendResponse.headers.get('Content-Type') || 'video/mp4'
      },
      downloadUrl: fullFileUrl,
      timestamp: new Date().toISOString()
    };

    console.log('Download completed successfully');
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in POST handler:', error);

    // Clean up any partial file if it exists
    // (This is a basic cleanup - in production you might want more sophisticated error handling)

    return NextResponse.json({
      success: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: {
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    }, { status: 500 });
  }
}

// Optional: Add cleanup function for old files (can be called periodically)
export async function cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000) { // Default: 24 hours
  try {
    if (!fs.existsSync(TEMP_DIR)) return;

    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAgeMs) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}