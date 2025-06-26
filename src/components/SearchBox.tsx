"use client";

import useYoutube from "@/hooks/useYoutube";
import { Search, Clipboard } from "lucide-react";

function SearchBox() {
    const {
        url,
        isLoading,
        setUrl,
        handleSubmit,
    } = useYoutube();

    async function handlePaste(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): Promise<void> {
        event.preventDefault();
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setUrl(text);
            }
        } catch (error) {
            // Optionally handle clipboard read errors
            console.error("Failed to read clipboard: ", error);
        }
    }

    return (
        <div className="mb-10">
            <form onSubmit={handleSubmit} className="relative">
                <button
                    type="button"
                    onClick={handlePaste}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors duration-200 text-slate-500"
                >
                    <Clipboard size={16} />
                </button>
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Pega la URL del video..."
                    className="w-full p-3 pl-16 pr-16 rounded-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent text-slate-700 placeholder-slate-400 shadow-sm"
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 transition-colors duration-200 text-slate-500"
                >
                    <Search size={16} />
                </button>
            </form>
        </div>
    )
}

export default SearchBox;