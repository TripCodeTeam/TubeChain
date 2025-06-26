import { NextRequest, NextResponse } from 'next/server';

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

/**
 * Handles POST requests to download a video using the NestJS backend
 * - Validates input URL
 * - Makes request to NestJS backend
 * - Streams video directly to client (no persistence)
 * - Returns video stream with appropriate headers
 */
export async function POST(request: NextRequest) {
  try {
    console.log('POST request received for video download');

    // Parse request body
    const body = await request.json();
    const { url, returnInfo } = body;

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

    // If returnInfo is true, return video info instead of streaming
    if (returnInfo) {
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

      const contentLength = backendResponse.headers.get('Content-Length');
      const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

      // Consume the stream to prevent hanging
      await backendResponse.arrayBuffer();

      return NextResponse.json({
        success: true,
        message: 'Video info retrieved successfully',
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
          originalFilename: originalFilename,
          size: fileSize,
          contentType: backendResponse.headers.get('Content-Type') || 'video/mp4'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Stream video directly to client
    const videoStream = backendResponse.body;
    
    if (!videoStream) {
      throw new Error('No video stream received from backend');
    }

    // Get filename from Content-Disposition header
    const contentDisposition = backendResponse.headers.get('Content-Disposition');
    let filename = 'downloaded_video.mp4';
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=([^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Create response with appropriate headers for file download
    const response = new NextResponse(videoStream, {
      status: 200,
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') || 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': backendResponse.headers.get('Content-Length') || '',
        'Cache-Control': 'no-cache',
      },
    });

    console.log('Video stream initiated successfully');
    return response;

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