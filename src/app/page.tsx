"use client";
import useYoutube from "@/hooks/useYoutube";
import { Download, Youtube, Search, Info } from "lucide-react";
import VideoPreview from "@/components/VideoPreview";

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
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '';

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hrs > 0) {
      parts.push(`${hrs}:${mins.toString().padStart(2, '0')}`);
    } else {
      parts.push(mins.toString());
    }
    parts.push(secs.toString().padStart(2, '0'));

    return parts.join(':');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <Youtube size={40} className="text-red-500" />
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-pink-500">
              YouTube Downloader
            </h1>
          </div>

          {/* Search Box */}
          <div className="bg-gray-800 rounded-xl p-6 shadow-xl border border-gray-700 mb-8">
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Pega la URL del video de YouTube..."
                  className="w-full p-4 pl-5 pr-16 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-white placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="absolute right-2 top-2 p-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-gray-500 transition-colors duration-200"
                >
                  <Search size={24} />
                </button>
              </div>
            </form>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 mb-8 bg-red-900 border border-red-700 text-red-100 rounded-lg flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-3 animate-pulse"></div>
              {error}
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400">Buscando y procesando el video...</p>
            </div>
          )}

          {/* Video Result */}
          {videoInfo && (
            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-700 transform transition-all duration-300">
              {/* Video Preview */}
              {videoInfo.videoId ? (
                <VideoPreview
                  videoId={videoInfo.videoId}
                  thumbnail={videoInfo.thumbnail}
                  title={videoInfo.title}
                  uploader={videoInfo.uploader ?? ""}
                />
              ) : (
                <div className="aspect-video bg-black relative">
                  {videoInfo.thumbnail ? (
                    <div className="relative">
                      <img
                        src={videoInfo.thumbnail}
                        alt={videoInfo.title}
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>

                      {/* Play Icon Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-red-500/30 backdrop-blur-sm flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M8 5V19L19 12L8 5Z" fill="white" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                      <Youtube size={64} className="text-gray-700" />
                    </div>
                  )}
                </div>
              )}

              {/* Video Info */}
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-3 line-clamp-2">{videoInfo.title}</h2>

                {/* Video metadata */}
                {videoInfo.uploader || videoInfo.duration || videoInfo.fileSize ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-gray-400">
                    {videoInfo.uploader && (
                      <div className="flex items-center gap-1">
                        <Youtube size={14} />
                        <span>{videoInfo.uploader}</span>
                      </div>
                    )}
                    {videoInfo.duration && (
                      <div className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>{formatDuration(videoInfo.duration)}</span>
                      </div>
                    )}
                    {videoInfo.fileSize && (
                      <div className="flex items-center gap-1">
                        <Info size={14} />
                        <span>{videoInfo.fileSize}</span>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="flex flex-col gap-4">
                  <button
                    onClick={downloadVideo}
                    className="flex items-center justify-center gap-2 w-full p-4 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 transition-all duration-300 font-medium text-white shadow-lg"
                  >
                    <Download size={20} />
                    Descargar video
                  </button>
                  <p className="text-gray-400 text-sm text-center">
                    Video listo para descargar en máxima calidad
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-12 text-center text-gray-500 text-sm">
            <p>Descarga videos de YouTube en máxima calidad</p>
          </footer>
        </div>
      </div>
    </main>
  );
}