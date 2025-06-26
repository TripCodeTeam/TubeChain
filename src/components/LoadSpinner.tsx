"use client";

function LoadSpinner() {
    return (
        <div className="flex flex-col items-center justify-center py-10">
            <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin mb-3"></div>
            <p className="text-slate-400 text-sm">Procesando video...</p>
        </div>
    )
}

export default LoadSpinner;