"use client";

import useYoutube, { VideoInfo } from "@/hooks/useYoutube";
import VideoPreview from "./VideoPreview";
import { Clock7, Download, Info, Rss, Youtube } from "lucide-react";

interface FormatDuration {
    (seconds: number | string | undefined | null): string;
}

function VideoResult({ videoInfo }: { videoInfo: VideoInfo }) {
    const {
        url,
        setUrl,
        fileInfo,
        downloadVideo,
        getFormattedFileSize,
    } = useYoutube();

    // Función para formatear la duración del video
    const formatDuration: FormatDuration = (duration) => {
        if (!duration) return '';

        // Si ya es una cadena formateada, la devolvemos tal como está
        if (typeof duration === 'string') {
            return duration;
        }

        // Si es un número, lo convertimos a formato de tiempo
        if (typeof duration === 'number') {
            const hrs = Math.floor(duration / 3600);
            const mins = Math.floor((duration % 3600) / 60);
            const secs = Math.floor(duration % 60);

            const parts: string[] = [];
            if (hrs > 0) {
                parts.push(`${hrs}:${mins.toString().padStart(2, '0')}`);
            } else {
                parts.push(mins.toString());
            }
            parts.push(secs.toString().padStart(2, '0'));

            return parts.join(':');
        }

        return '';
    };
    return (
        <div className="rounded-xl overflow-hidden transition-all duration-300">
            {/* Video Preview */}
            {videoInfo.videoId && fileInfo ? (
                <VideoPreview
                    videoSource={fileInfo.fullUrl}
                    thumbnail={videoInfo.thumbnail || ""}
                    title={videoInfo.title}
                    uploader={videoInfo.author}
                />
            ) : (
                <div className="aspect-video bg-slate-100 relative">
                    {videoInfo.thumbnail ? (
                        <div className="relative">
                            <img
                                src={videoInfo.thumbnail}
                                alt={videoInfo.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>

                            {/* Play Icon Overlay - Simplificado */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 5V19L19 12L8 5Z" fill="#475569" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <Youtube size={48} className="text-slate-300" />
                        </div>
                    )}
                </div>
            )}

            {/* Video Info - Más limpio */}
            <div className="p-5">
                <h2 className="text-lg font-medium mb-2 line-clamp-2 text-slate-700">{videoInfo.title}</h2>

                {/* Video metadata - Minimalista */}
                {(videoInfo.author || videoInfo.duration || fileInfo) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5 text-slate-500 text-sm">
                        {videoInfo.author && (
                            <div className="flex items-center gap-1">
                                <Rss size={18} />
                                <span>{videoInfo.author}</span>
                            </div>
                        )}
                        {videoInfo.duration && (
                            <div className="flex items-center gap-1">
                                <Clock7 size={18} />
                                <span>{formatDuration(videoInfo.duration)}</span>
                            </div>
                        )}
                        {fileInfo && (
                            <div className="flex items-center gap-1">
                                <Info size={18} />
                                <span>{getFormattedFileSize()}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={downloadVideo}
                        disabled={!fileInfo}
                        className="flex items-center justify-center gap-2 w-full p-3 rounded-full bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-200 font-medium text-white shadow-sm"
                    >
                        <Download size={18} />
                        Descargar
                    </button>
                </div>
            </div>
        </div>
    )
}

export default VideoResult;