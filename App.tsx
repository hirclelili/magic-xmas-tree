
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { InteractionMode } from './types';
import { useThreeScene } from './hooks/useThreeScene';
import { useMediaPipe } from './hooks/useMediaPipe';
import Loader from './components/Loader';
import GestureIndicator from './components/GestureIndicator';
import UILayer from './components/UILayer';
import WebcamPreview from './components/WebcamPreview';
import AudioPlayer from './components/AudioPlayer';

const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Summoning Winter Magic...');
    const [mode, setMode] = useState<InteractionMode>(InteractionMode.TREE);
    const [photos, setPhotos] = useState<string[]>([]);
    const [handDetected, setHandDetected] = useState(false);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
    
    const handleGestureChange = useCallback((newMode: InteractionMode, detected: boolean) => {
        setMode(newMode);
        setHandDetected(detected);
    }, []);

    const handleModeChangeRequest = useCallback((newMode: InteractionMode) => {
        setMode(newMode);
    }, []);

    const { gestureManager } = useMediaPipe({
        videoRef,
        canvasRef: webcamCanvasRef,
        onGestureChange: handleGestureChange,
        onLoaded: () => setLoadingMessage('Initializing 3D Scene...'),
    });

    const { sceneManager } = useThreeScene({
        containerRef: canvasContainerRef,
        mode,
        photos,
        gestureManager,
        onModeChangeRequest: handleModeChangeRequest,
    });

    useEffect(() => {
        // Simple loading simulation based on both hooks being ready
        if (gestureManager && sceneManager) {
            setTimeout(() => setIsLoading(false), 1000);
        }
    }, [gestureManager, sceneManager]);

    const handleFilesSelected = (files: FileList) => {
        if (files.length > 0) {
            const urls = Array.from(files).map(file => URL.createObjectURL(file));
            setPhotos(urls);
        }
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-[#020210]">
            {isLoading && <Loader message={loadingMessage} />}
            
            <div ref={canvasContainerRef} className="absolute top-0 left-0 w-full h-full" />

            <UILayer onFilesSelected={handleFilesSelected} />

            <GestureIndicator 
                isVisible={!isLoading} 
                handDetected={handDetected} 
                currentMode={mode} 
            />

            <WebcamPreview videoRef={videoRef} canvasRef={webcamCanvasRef} />
            <AudioPlayer />
        </div>
    );
};

export default App;