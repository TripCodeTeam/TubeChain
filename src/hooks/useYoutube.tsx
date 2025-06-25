"use client";

import { useState, useEffect } from "react";

// Interface for video metadata used in the UI - Updated to match the component needs
type VideoInfo = {
    title: string;          // Original video title
    duration: string | number; // Duration can be formatted string or seconds number
    quality: string;        // Video quality (e.g., "1080p")
    author: string;         // Content creator name (changed from 'uploader' to match API)
    viewCount: number;      // View count
    fileSize: number;       // File size in bytes
    thumbnail?: string;     // Thumbnail URL if available
    videoId?: string;       // YouTube video identifier
};

type FileInfo = {
    filename: string;       // Local filename after download
    originalFilename: string; // Original filename from backend
    size: number;          // File size in bytes
    path: string;          // Relative path to file
    fullUrl: string;       // Full URL to access file
    contentType: string;   // MIME type
};

type DownloadResponse = {
    success: boolean;
    message: string;
    videoInfo: VideoInfo;
    file: FileInfo;
    downloadUrl: string;
    timestamp: string;
};

/**
 * Enhanced React Hook for YouTube video download functionality
 * - Manages video playback and download state
 * - Handles video metadata extraction with improved validation
 * - Provides better error handling and loading states
 */
function useYoutube() {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [error, setError] = useState('');
    const [downloadStatus, setDownloadStatus] = useState<'idle' | 'processing' | 'ready' | 'downloading' | 'complete' | 'error'>('idle');

    // Clear error when URL changes
    useEffect(() => {
        if (error) setError('');
    }, [url]);

    /**
     * Extracts YouTube video ID from various URL formats
     * Support for more YouTube URL patterns and validation
     */
    const extractVideoId = (url: string): string | null => {
        // Support for more URL patterns including shorts
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?&]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([^?&]+)/i
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    };

    /**
     * Validates a YouTube URL with better feedback
     */
    const validateYoutubeUrl = (url: string): { valid: boolean; message?: string } => {
        if (!url.trim()) {
            return { valid: false, message: 'Please enter a YouTube URL' };
        }

        // Check if it contains youtube domain
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return { valid: false, message: 'This does not appear to be a YouTube URL' };
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
            return { valid: false, message: 'Could not extract video ID from URL' };
        }

        return { valid: true };
    };

    /**
     * Formats file size from bytes to human readable format
     */
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    /**
     * Handles form submission with improved validation and error handling
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Reset states
        setError('');
        setVideoInfo(null);
        setFileInfo(null);
        setDownloadProgress(null);

        // Validate URL first
        const validation = validateYoutubeUrl(url);
        if (!validation.valid) {
            setError(validation.message || 'Invalid YouTube URL');
            return;
        }

        setIsLoading(true);
        setDownloadStatus('processing');

        try {
            const videoId = extractVideoId(url);

            // Call the API with abort controller for cancellation support
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 120000); // 2 minute timeout for video processing

            console.log('Sending request to /api/download with URL:', url);

            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
                signal: abortController.signal
            });

            clearTimeout(timeoutId);

            console.log('Response status:', response.status);

            if (!response.ok) {
                let errorMessage = 'Video download failed';
                try {
                    const errorData = await response.json();
                    console.error('Error response:', errorData);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use the status text
                    errorMessage = `Error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const data: DownloadResponse = await response.json();
            console.log('Success response:', data);

            // Store video and file info with proper mapping
            setVideoInfo({
                ...data.videoInfo,
                videoId: videoId ?? undefined,
                // Ensure author field is populated (map from uploader if needed)
                author: data.videoInfo.author || (data.videoInfo as any).uploader || 'Unknown'
            });
            setFileInfo(data.file);

            setDownloadStatus('ready');
        } catch (err) {
            console.error('Processing error:', err);
            if (err instanceof Error) {
                if (err.name === 'AbortError') {
                    setError('Request timed out. Please try again.');
                } else {
                    setError(err.message);
                }
            } else {
                setError('Unknown error occurred');
            }
            setDownloadStatus('error');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Initiates video file download with improved error handling and feedback
     */
    const downloadVideo = async () => {
        if (!fileInfo) {
            setError('No file information available');
            return;
        }

        setDownloadStatus('downloading');
        setError('');

        try {
            // Use the full URL from the API response
            const downloadUrl = fileInfo.fullUrl;
            console.log('Downloading file from:', downloadUrl);

            // First check if the file exists
            const checkResponse = await fetch(downloadUrl, { method: 'HEAD' });

            if (!checkResponse.ok) {
                console.error('File availability check failed:', checkResponse.status, checkResponse.statusText);
                throw new Error(`File not available (${checkResponse.status})`);
            }

            console.log('File is available, starting download...');

            // Create an anchor element and trigger download
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = fileInfo.originalFilename; // Use original filename
            downloadLink.target = '_blank'; // Open in new tab as fallback

            // Add to DOM temporarily
            document.body.appendChild(downloadLink);
            downloadLink.click();

            // Clean up
            setTimeout(() => {
                if (document.body.contains(downloadLink)) {
                    document.body.removeChild(downloadLink);
                }
            }, 1000);

            // Update status after brief delay
            setTimeout(() => {
                setDownloadStatus('complete');
            }, 1000);

        } catch (err) {
            console.error('Download error:', err);
            setDownloadStatus('error');

            if (err instanceof Error) {
                setError(`Download failed: ${err.message}`);
            } else {
                setError('Download failed. Please try again.');
            }
        }
    };

    /**
     * Resets the form and states
     */
    const resetForm = () => {
        setUrl('');
        setVideoInfo(null);
        setFileInfo(null);
        setError('');
        setIsLoading(false);
        setDownloadProgress(null);
        setDownloadStatus('idle');
    };

    /**
     * Gets formatted file size string
     */
    const getFormattedFileSize = (): string => {
        if (!fileInfo) return '';
        return formatFileSize(fileInfo.size);
    };

    /**
     * Checks if video is ready for download
     */
    const isReadyToDownload = (): boolean => {
        return downloadStatus === 'ready' && videoInfo !== null && fileInfo !== null;
    };

    return {
        // State
        url,
        setUrl,
        isLoading,
        videoInfo,
        fileInfo,
        error,
        downloadStatus,
        downloadProgress,

        // Actions
        handleSubmit,
        downloadVideo,
        resetForm,

        // Computed values
        getFormattedFileSize,
        isReadyToDownload,

        // Utils (in case you need them in components)
        validateYoutubeUrl,
        extractVideoId
    };
}

export default useYoutube;