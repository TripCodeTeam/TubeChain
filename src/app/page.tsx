"use client";

import useYoutube from "@/hooks/useYoutube";
import LoadSpinner from "@/components/LoadSpinner";
import VideoResult from "@/components/VideoResult";
import SearchBox from "@/components/SearchBox";
import ErrorMessage from "@/components/ErrorMessage";
import Header from "@/components/Header";

export default function Home() {
  const {
    isLoading,
    videoInfo,
    error,
  } = useYoutube();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Header - Minimalista y ligero */}
          <Header />

          {/* Search Box - Simplificado */}
          <SearchBox />

          {/* Error Message - Suavizado */}
          {error && <ErrorMessage error={error} />}

          {/* Loading Indicator - Más elegante */}
          {isLoading && <LoadSpinner />}

          {/* Video Result - Diseño minimalista y suave */}
          {videoInfo && <VideoResult videoInfo={videoInfo} />}

          {/* Footer - Más minimalista */}
          <footer className="mt-12 text-center text-slate-400 text-xs">
            <p>TubeChain · Máxima calidad</p>
          </footer>
        </div>
      </div>
    </main>
  );
}