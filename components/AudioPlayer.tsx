
import React, { useState, useRef, useEffect } from 'react';

const DEFAULT_MUSIC_URL = 'https://assets.codepen.io/217233/frozen_in_time.mp3';

const AudioPlayer: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioSrc, setAudioSrc] = useState(DEFAULT_MUSIC_URL);
    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // When src changes, the browser loads it. We then try to play it.
        // This handles both the initial autoplay attempt and playing after a user uploads a file.
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Audio play was prevented by the browser.");
                // The onPause event handler will correctly set isPlaying to false.
            });
        }
    }, [audioSrc]); // Re-run this effect whenever the audio source changes

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (audio) {
            if (isPlaying) {
                audio.pause();
            } else {
                audio.play();
            }
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const newSrc = URL.createObjectURL(file);
            // Clean up the previous blob URL to avoid memory leaks
            if (audioSrc.startsWith('blob:')) {
                URL.revokeObjectURL(audioSrc);
            }
            setAudioSrc(newSrc);
        }
    };

    const PlayIcon = () => (
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-cyan-200 drop-shadow-[0_0_2px_rgba(204,255,255,0.5)]">
            <path d="M8 5v14l11-7z"/>
        </svg>
    );

    const PauseIcon = () => (
         <svg viewBox="0 0 24 24" className="w-6 h-6 fill-cyan-200 drop-shadow-[0_0_2px_rgba(204,255,255,0.5)]">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
    );

    const UploadIcon = () => (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-cyan-200 drop-shadow-[0_0_2px_rgba(204,255,255,0.5)]">
            <path d="M9 16h6v-6h4l-8-8-8 8h4v6zm-4 2h14v2H5v-2z"/>
        </svg>
    );

    return (
        <>
            <audio
                ref={audioRef}
                src={audioSrc}
                loop
                preload="auto"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            <input
                type="file"
                ref={fileInputRef}
                accept="audio/*"
                className="hidden"
                onChange={handleFileChange}
            />

            <button
                onClick={handleUploadClick}
                title="Upload Music"
                className="absolute bottom-8 right-[8.5rem] z-20 w-10 h-10 bg-black/40 border border-cyan-400/60 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:bg-cyan-400/20 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(136,204,255,0.3)]"
            >
                <UploadIcon />
            </button>
            
            <button
                onClick={togglePlayPause}
                title={isPlaying ? "Pause Music" : "Play Music"}
                className="absolute bottom-8 right-20 z-20 w-10 h-10 bg-black/40 border border-cyan-400/60 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all duration-300 hover:bg-cyan-400/20 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(136,204,255,0.3)]"
            >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
        </>
    );
};

export default AudioPlayer;
