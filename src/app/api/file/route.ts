import { NextRequest, NextResponse } from 'next/server';
import { head, list } from '@vercel/blob';

/**
 * API Route for serving video files from Vercel Blob Storage with detailed debugging
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Blob file request received:', request.url);
    
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

    console.log('Looking for blob file:', filename);

    try {
      // First, try to get file metadata from Blob Storage
      const { blobs } = await list({
        prefix: filename,
        limit: 1
      });

      console.log('Blob search results:', blobs);

      if (blobs.length === 0) {
        // If exact match not found, try to list all files for debugging
        console.log('Exact match not found, listing all files...');
        
        try {
          const { blobs: allBlobs } = await list({ limit: 100 });
          console.log('All blobs in storage:', allBlobs.map(b => b.pathname));
          
          // Try to find a partial match
          const partialMatch = allBlobs.find(blob => 
            blob.pathname.includes(filename!) || filename!.includes(blob.pathname)
          );
          
          if (partialMatch) {
            console.log('Found partial match:', partialMatch.pathname);
            filename = partialMatch.pathname;
          } else {
            return NextResponse.json({
              error: 'File not found in Blob Storage',
              filename: filename,
              availableFiles: allBlobs.map(b => b.pathname).slice(0, 10) // Show first 10 files
            }, { status: 404 });
          }
        } catch (listError) {
          console.error('Error listing blobs:', listError);
          return NextResponse.json({
            error: 'File not found and could not list available files',
            filename: filename,
            details: listError instanceof Error ? listError.message : String(listError)
          }, { status: 404 });
        }
      } else {
        // Use the exact match
        filename = blobs[0].pathname;
        console.log('Using exact match:', filename);
      }

      // Get file metadata
      const blobInfo = await head(filename);
      console.log('Blob info:', {
        url: blobInfo.url,
        size: blobInfo.size,
        contentType: blobInfo.contentType,
        pathname: blobInfo.pathname
      });

      // Determine content type
      let contentType = blobInfo.contentType || 'application/octet-stream';
      
      // If content type is not set, determine from filename
      if (contentType === 'application/octet-stream') {
        const extension = filename.split('.').pop()?.toLowerCase();
        console.log('File extension:', extension);
        
        switch (extension) {
          case 'mp4': contentType = 'video/mp4'; break;
          case 'webm': contentType = 'video/webm'; break;
          case 'mov': contentType = 'video/quicktime'; break;
          case 'avi': contentType = 'video/x-msvideo'; break;
          case 'mkv': contentType = 'video/x-matroska'; break;
          default: contentType = 'video/mp4'; // Default to mp4
        }
      }
      
      console.log('Final content type:', contentType);

      // Check if client wants range requests (for video streaming)
      const range = request.headers.get('range');
      console.log('Range header:', range);

      if (range && blobInfo.size) {
        // Handle range requests for video streaming
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : blobInfo.size - 1;
        const chunkSize = end - start + 1;
        
        console.log(`Streaming range: ${start}-${end}/${blobInfo.size}`);
        
        // For range requests, we need to fetch the blob and slice it
        // Note: This is not the most efficient for large files
        // For production, consider using a CDN or direct blob URL
        
        try {
          const response = await fetch(blobInfo.url, {
            headers: {
              'Range': `bytes=${start}-${end}`
            }
          });

          if (response.status === 206 || response.status === 200) {
            const headers = {
              'Content-Range': `bytes ${start}-${end}/${blobInfo.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize.toString(),
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            };

            return new NextResponse(response.body, {
              status: 206,
              headers: headers,
            });
          } else {
            throw new Error(`Failed to fetch range from blob: ${response.status}`);
          }
        } catch (rangeError) {
          console.error('Error handling range request:', rangeError);
          // Fallback to full file if range request fails
        }
      }

      // For non-range requests or when range request fails
      // Redirect to the blob URL directly (most efficient)
      const shouldRedirect = url.searchParams.get('redirect') !== 'false';
      
      if (shouldRedirect) {
        console.log('Redirecting to blob URL:', blobInfo.url);
        return NextResponse.redirect(blobInfo.url, 302);
      } else {
        // Proxy the file through our API (less efficient but more control)
        console.log('Proxying file through API');
        
        const blobResponse = await fetch(blobInfo.url);
        
        if (!blobResponse.ok) {
          throw new Error(`Failed to fetch blob: ${blobResponse.status} ${blobResponse.statusText}`);
        }

        const headers = {
          'Content-Type': contentType,
          'Content-Length': blobInfo.size?.toString() || '',
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'Content-Disposition': `inline; filename="${filename}"`,
        };

        return new NextResponse(blobResponse.body, {
          status: 200,
          headers: headers,
        });
      }

    } catch (blobError) {
      console.error('Error accessing blob:', blobError);
      
      // Try to list available files for debugging
      try {
        const { blobs } = await list({ limit: 10 });
        return NextResponse.json({
          error: 'Error accessing blob file',
          filename: filename,
          details: blobError instanceof Error ? blobError.message : String(blobError),
          availableFiles: blobs.map(b => b.pathname)
        }, { status: 500 });
      } catch (listError) {
        return NextResponse.json({
          error: 'Error accessing blob file and could not list files',
          filename: filename,
          details: blobError instanceof Error ? blobError.message : String(blobError)
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('Error serving video from blob:', error);
    return NextResponse.json({
      error: 'Failed to serve video file from Blob Storage',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Handle DELETE requests to remove files from Blob Storage
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    
    if (!filename) {
      return NextResponse.json({
        error: 'Filename is required for deletion'
      }, { status: 400 });
    }

    console.log('Attempting to delete blob:', filename);

    // Import del method dynamically
    const { del } = await import('@vercel/blob');
    
    await del(filename);
    
    console.log('Successfully deleted blob:', filename);
    
    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
      filename: filename
    });

  } catch (error) {
    console.error('Error deleting blob:', error);
    return NextResponse.json({
      error: 'Failed to delete file',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}