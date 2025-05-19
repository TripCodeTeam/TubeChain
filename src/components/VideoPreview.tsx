"use client";

import { useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface VideoPreviewProps {
    videoId: string;
    thumbnail: string;
    title: string;
    uploader: string
}

const VideoPreview = ({ videoId, thumbnail, title }: VideoPreviewProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    // Función para crear el iframe de YouTube cuando se hace clic en reproducir
    const handlePlayClick = () => {
        if (!isPlayerReady) {
            setIsPlayerReady(true);
        }
        setIsPlaying(!isPlaying);
    };

    // Alternar mute/unmute
    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    return (
        <div className="relative w-full aspect-video bg-black overflow-hidden rounded-t-lg">
            {isPlayerReady ? (
                <div className="w-full h-full">
                    <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&showinfo=0&rel=0`}
                        title={title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>

                    {/* Controles superpuestos */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handlePlayClick}
                                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                            >
                                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                            </button>

                            <button
                                onClick={toggleMute}
                                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                            >
                                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                // Miniatura con botón de reproducción
                <div
                    className="relative w-full h-full cursor-pointer"
                    onClick={handlePlayClick}
                >
                    <img
                        src={thumbnail}
                        alt={title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-red-500/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                                <Play size={24} className="text-white ml-1" />
                            </div>
                        </div>
                    </div>

                    {/* Título superpuesto */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <h3 className="text-white font-medium truncate">{title}</h3>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPreview;