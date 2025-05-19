"use client";

import { useState, useEffect } from "react";

// Interface for video metadata used in the UI
type VideoInfo = {
    title: string;          // Original video title
    filename: string;       // Local filename after download
    thumbnail: string;      // Best available thumbnail URL
    videoId?: string;       // YouTube video identifier
    uploader?: string;      // Content creator name
    duration?: number;      // Video length in seconds
    fileSize?: string;      // File size in human-readable format
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
    const [error, setError] = useState('');
    const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'complete' | 'error'>('idle');

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
     * Handles form submission with improved validation and error handling
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Reset states
        setError('');
        setVideoInfo(null);
        setDownloadProgress(null);

        // Validate URL first
        const validation = validateYoutubeUrl(url);
        if (!validation.valid) {
            setError(validation.message || 'Invalid YouTube URL');
            return;
        }

        setIsLoading(true);

        try {
            const videoId = extractVideoId(url);

            // Call the API with abort controller for cancellation support
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 60000); // 60s timeout

            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
                signal: abortController.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMessage = 'Video download failed';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use the status text
                    errorMessage = `Error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // Store complete video info
            setVideoInfo({
                ...data,
                videoId
            });

            setDownloadStatus('complete');
        } catch (err) {
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
        if (!videoInfo) return;

        setDownloadStatus('downloading');
        setError('');

        try {
            // Create a download link and trigger it
            const downloadUrl = `/api/file?filename=${encodeURIComponent(videoInfo.filename)}`;
            console.log('Requesting file download from:', downloadUrl);

            // First check if the file exists with a HEAD request
            const checkResponse = await fetch(downloadUrl, { method: 'HEAD' });

            if (!checkResponse.ok) {
                console.error('File availability check failed:', checkResponse.status, checkResponse.statusText);

                // Get more details about why the file isn't available
                const errorDetails = await checkResponse.json().catch(() => ({}));
                console.error('Error details:', errorDetails);

                throw new Error(`File not available: ${errorDetails.error || checkResponse.statusText}`);
            }

            // The file exists, now download it
            console.log('File is available, starting download');

            // Create an anchor element and trigger download
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = videoInfo.filename; // Suggest filename to browser
            document.body.appendChild(downloadLink);
            downloadLink.click();

            // Remove the link after a brief delay
            setTimeout(() => {
                if (document.body.contains(downloadLink)) {
                    document.body.removeChild(downloadLink);
                }
            }, 2000);

            // Change status after a brief delay
            setTimeout(() => {
                setDownloadStatus('complete');
            }, 1500);
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
        setError('');
        setIsLoading(false);
        setDownloadProgress(null);
        setDownloadStatus('idle');
    };

    return {
        url,
        setUrl,
        isLoading,
        videoInfo,
        error,
        downloadVideo,
        handleSubmit,
        resetForm,
        downloadStatus,
        downloadProgress
    };
}

export default useYoutube;