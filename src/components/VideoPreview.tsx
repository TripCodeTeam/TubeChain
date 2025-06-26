"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";

interface VideoPreviewProps {
  videoSource: string;  // Path to the video file
  thumbnail: string;    // Thumbnail URL
  title: string;        // Video title
  uploader?: string;    // Optional uploader name
}

const VideoPreview = ({ videoSource, thumbnail, title, uploader }: VideoPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Add validation for videoSource
  if (!videoSource) {
    console.error("VideoPreview: videoSource is required but was not provided");
    return (
      <div className="relative w-full aspect-video bg-black overflow-hidden rounded-lg flex items-center justify-center">
        <p className="text-white text-center px-4">
          Error: No video source provided
        </p>
      </div>
    );
  }

  // Fixed path logic - use videoSource directly if it's already a full URL
  const filePath = videoSource.startsWith('http') || videoSource.startsWith('/')
    ? videoSource  // Use as-is if it's already a full URL or absolute path
    : `/temp/${videoSource}`; // Only add /temp/ prefix if it's a relative filename

  console.log("Original videoSource:", videoSource);
  console.log("Constructed filePath:", filePath);

  // Reset error state when source changes
  useEffect(() => {
    setIsError(false);
  }, [videoSource]);

  // Handle play/pause with proper state management
  const handlePlayClick = () => {
    if (isLoading || isError) return;

    if (videoRef.current) {
      setIsLoading(true);

      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        setIsLoading(false);
      } else {
        // Reset the video if it ended
        if (videoRef.current.ended) {
          videoRef.current.currentTime = 0;
        }

        const playPromise = videoRef.current.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(error => {
              console.error("Play error:", error);
              setIsError(true);
            })
            .finally(() => {
              setIsLoading(false);
            });
        } else {
          setIsPlaying(true);
          setIsLoading(false);
        }
      }
    }
  };

  // Toggle mute state
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMutedState = !videoRef.current.muted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = (e: Event) => {
      console.error("Video error encountered:", e);
      console.error("Failed to load video from:", filePath);
      setIsError(true);
      setIsPlaying(false);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      console.log("Video started loading from:", filePath);
    };

    const handleCanPlay = () => {
      console.log("Video can play:", filePath);
    };

    // Add event listeners
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);

    // Cleanup
    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [filePath]);

  return (
    <div className="relative w-full aspect-video bg-black overflow-hidden rounded-lg">
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted={isMuted}
        poster={thumbnail}
        onClick={handlePlayClick}
        onContextMenu={e => e.preventDefault()}
        controlsList="nodownload"
      >
        <source src={filePath} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
          <p className="text-white text-center px-4 mb-2">
            Error playing video. The file may be corrupted or in an unsupported format.
          </p>
          <p className="text-white/70 text-sm text-center px-4 mb-4">
            Attempted to load: {filePath}
          </p>
          <button
            className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-md"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      )}

      {/* Controls overlay - always visible but transparent when playing */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
          }`}
      >
        {/* Play button centered */}
        {!isPlaying && !isLoading && !isError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              onClick={handlePlayClick}
            >
              <Play size={32} />
            </button>
          </div>
        )}

        {/* Bottom controls bar */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            {/* Play/Pause button */}
            <button
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              onClick={handlePlayClick}
              disabled={isLoading || isError}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            {/* Title in center */}
            <div className="flex-grow mx-3">
              <h3 className="text-white font-medium truncate text-center">{title}</h3>
              {uploader && (
                <p className="text-white/70 text-xs text-center truncate">{uploader}</p>
              )}
            </div>

            {/* Mute/Unmute button */}
            <button
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              onClick={toggleMute}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;