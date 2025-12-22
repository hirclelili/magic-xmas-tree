
import React, { useRef } from 'react';

interface UILayerProps {
    onFilesSelected: (files: FileList) => void;
}

const UILayer: React.FC<UILayerProps> = ({ onFilesSelected }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleTitleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onFilesSelected(event.target.files);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    };
    
    return (
        <>
            <div className="absolute top-0 left-0 z-10 flex flex-col items-center justify-start w-full h-full pt-10 pointer-events-none">
                <h1 
                    className="text-5xl md:text-8xl font-great-vibes text-glow text-glow-hover bg-gradient-to-b from-white to-cyan-300 bg-clip-text text-transparent opacity-95 cursor-pointer pointer-events-auto transition-all duration-300"
                    onClick={handleTitleClick}
                    title="Click to upload your photos"
                >
                    Frozen Wonderland
                </h1>
            </div>
            
            <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            <button
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
                className="absolute bottom-8 right-8 z-20 w-10 h-10 bg-black/40 border border-cyan-400/60 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:bg-cyan-400/20 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(136,204,255,0.3)]"
            >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-cyan-200 drop-shadow-[0_0_2px_rgba(204,255,255,0.5)]">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
            </button>
        </>
    );
};

export default UILayer;
