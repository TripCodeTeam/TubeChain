"use client";
import useYoutube from "@/hooks/useYoutube";
import { Download, Youtube, Search, Info, Clock7, Rss } from "lucide-react";
import VideoPreview from "@/components/VideoPreview";

interface FormatDuration {
  (seconds: number | undefined | null): string;
}

export default function Home() {
  const {
    url,
    setUrl,
    isLoading,
    videoInfo,
    error,
    downloadVideo,
    handleSubmit,
  } = useYoutube();

  // Función para formatear la duración del video
  const formatDuration: FormatDuration = (seconds) => {
    if (!seconds) return '';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (hrs > 0) {
      parts.push(`${hrs}:${mins.toString().padStart(2, '0')}`);
    } else {
      parts.push(mins.toString());
    }
    parts.push(secs.toString().padStart(2, '0'));

    return parts.join(':');
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header - Minimalista y ligero */}
          <div className="flex items-center justify-center gap-2 mb-12">
            <Youtube size={28} className="text-red-400" />
            <h1 className="text-3xl font-light text-slate-700">
              YouTube <span className="font-medium">Downloader</span>
            </h1>
          </div>

          {/* Search Box - Simplificado */}
          <div className="mb-10">
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Pega la URL del video..."
                className="w-full p-3 pl-4 pr-12 rounded-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent text-slate-700 placeholder-slate-400 shadow-sm"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-1 top-1 p-2 rounded-full bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 transition-colors duration-200 text-slate-500"
              >
                <Search size={20} />
              </button>
            </form>
          </div>

          {/* Error Message - Suavizado */}
          {error && (
            <div className="p-3 mb-8 bg-red-50 text-red-500 rounded-lg flex items-center text-sm">
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2 animate-pulse"></div>
              {error}
            </div>
          )}

          {/* Loading Indicator - Más elegante */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin mb-3"></div>
              <p className="text-slate-400 text-sm">Procesando video...</p>
            </div>
          )}

          {/* Video Result - Diseño minimalista y suave */}
          {videoInfo && (
            <div className="rounded-xl overflow-hidden transition-all duration-300">
              {/* Video Preview */}
              {videoInfo.videoId ? (
                <VideoPreview
                  videoSource={videoInfo.filename}
                  thumbnail={videoInfo.thumbnail}
                  title={videoInfo.title}
                  uploader={videoInfo.uploader ?? ""}
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
                {videoInfo.uploader || videoInfo.duration || videoInfo.fileSize ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5 text-slate-500 text-sm">
                    {videoInfo.uploader && (
                      <div className="flex items-center gap-1">
                        <Rss size={18} />
                        <span>{videoInfo.uploader}</span>
                      </div>
                    )}
                    {videoInfo.duration && (
                      <div className="flex items-center gap-1">
                        <Clock7 size={18} />
                        <span>{formatDuration(videoInfo.duration)}</span>
                      </div>
                    )}
                    {videoInfo.fileSize && (
                      <div className="flex items-center gap-1">
                        <Info size={18} />
                        <span>{videoInfo.fileSize}</span>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3">
                  <button
                    onClick={downloadVideo}
                    className="flex items-center justify-center gap-2 w-full p-3 rounded-full bg-slate-700 hover:bg-slate-800 transition-all duration-200 font-medium text-white shadow-sm"
                  >
                    <Download size={18} />
                    Descargar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer - Más minimalista */}
          <footer className="mt-12 text-center text-slate-400 text-xs">
            <p>Simple YouTube Downloader · Máxima calidad</p>
          </footer>
        </div>
      </div>
    </main>
  );
}