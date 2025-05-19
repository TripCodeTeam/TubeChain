"use client";

import { useState } from "react";

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
 * Custom React Hook for YouTube video download functionality
 * - Manages form state and validation
 * - Handles video metadata extraction
 * - Coordinates API calls for download process
 */
function useYoutube() {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [error, setError] = useState('');

    /**
     * Extracts YouTube video ID from various URL formats
     * @param url - Input YouTube URL (watch, short, embed, etc.)
     * @returns Video ID or null if invalid
     */
    const extractVideoId = (url: string): string | null => {
        // Match against common YouTube URL patterns
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/i,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/i,
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
     * Handles form submission for video download request
     * - Validates input URL
     * - Calls backend API for metadata
     * - Updates state with response data
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!url) {
            setError('Please enter a YouTube URL');
            return;
        }

        setError('');
        setIsLoading(true);
        setVideoInfo(null);

        try {
            const videoId = extractVideoId(url);

            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }

            // Fetch video metadata from API endpoint
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Video download failed');
            }

            const data = await response.json();

            // Store response data with video ID
            setVideoInfo({
                ...data,
                videoId
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Initiates video file download
     * Triggers browser download via API endpoint
     */
    const downloadVideo = () => {
        if (videoInfo) {
            window.location.href = `/api/file?filename=${encodeURIComponent(videoInfo.filename)}`;
        }
    };

    return {
        url,
        setUrl,
        isLoading,
        videoInfo,
        error,
        downloadVideo,
        setIsLoading,
        handleSubmit
    };
}

export default useYoutube;