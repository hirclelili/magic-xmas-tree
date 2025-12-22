
import React from 'react';
import { InteractionMode } from '../types';

interface GestureIndicatorProps {
    isVisible: boolean;
    handDetected: boolean;
    currentMode: InteractionMode;
}

const GestureIndicator: React.FC<GestureIndicatorProps> = ({ isVisible, handDetected, currentMode }) => {
    if (!isVisible) return null;

    if (handDetected) {
        return (
            <div className="absolute top-5 left-5 z-20 border border-green-400 text-green-200 text-sm font-thin uppercase tracking-widest py-2 px-4 bg-black/50 backdrop-blur-sm shadow-[0_0_10px_rgba(0,255,128,0.2)] transition-all duration-300">
                Mode: {currentMode}
            </div>
        );
    }

    return (
        <div className="absolute top-5 left-5 z-20 border border-cyan-400 text-cyan-200 text-sm font-thin uppercase tracking-widest py-2 px-4 bg-black/50 backdrop-blur-sm shadow-[0_0_10px_rgba(136,204,255,0.2)] transition-all duration-300">
            No gesture detected - Please raise your hand
        </div>
    );
};

export default GestureIndicator;
