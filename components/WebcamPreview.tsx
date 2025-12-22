
import React from 'react';

interface WebcamPreviewProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

const WebcamPreview: React.FC<WebcamPreviewProps> = ({ videoRef, canvasRef }) => {
    return (
        <div className="absolute bottom-[5.5rem] right-8 w-32 h-24 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 overflow-hidden pointer-events-none opacity-50 transition-opacity duration-500 hover:opacity-100">
            <video ref={videoRef} autoPlay playsInline className="hidden"></video>
            <canvas ref={canvasRef} className="w-full h-full"></canvas>
        </div>
    );
};

export default WebcamPreview;
