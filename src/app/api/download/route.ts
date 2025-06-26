import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

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
 * - Uploads video to Vercel Blob Storage
 * - Returns JSON response with video details and blob URL
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

    console.log(`Uploading video to Blob Storage as: ${uniqueFilename}`);

    // Convert response to stream for Vercel Blob
    const videoStream = backendResponse.body;
    
    if (!videoStream) {
      throw new Error('No video stream received from backend');
    }

    // Upload to Vercel Blob Storage
    const blobResult = await put(uniqueFilename, videoStream, {
      access: 'public',
      contentType: backendResponse.headers.get('Content-Type') || 'video/mp4',
    });

    console.log(`Video uploaded successfully to Blob Storage: ${blobResult.url}`);

    // Get file size from response headers or calculate from stream
    const contentLength = backendResponse.headers.get('Content-Length');
    const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

    // Return success response with video info and blob details
    const response = {
      success: true,
      message: 'Video downloaded and saved successfully to Blob Storage',
      videoInfo: {
        title: videoInfo.title || 'Unknown Title',
        duration: videoInfo.duration || 'Unknown Duration',
        quality: videoInfo.quality || 'Unknown Quality',
        author: videoInfo.author || 'Unknown Author',
        viewCount: videoInfo.viewCount || 0,
        fileSize: fileSize,
        ...videoInfo
      },
      file: {
        filename: uniqueFilename,
        originalFilename: originalFilename,
        size: fileSize,
        url: blobResult.url,
        downloadUrl: blobResult.downloadUrl,
        contentType: backendResponse.headers.get('Content-Type') || 'video/mp4'
      },
      downloadUrl: blobResult.url,
      timestamp: new Date().toISOString()
    };

    console.log('Download and upload completed successfully');
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error in POST handler:', error);

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