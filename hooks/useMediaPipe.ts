
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { InteractionMode } from '../types';

const DEBOUNCE_FRAMES = 3; // Number of consecutive frames to confirm a gesture

interface UseMediaPipeProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    onGestureChange: (mode: InteractionMode, detected: boolean) => void;
    onLoaded: () => void;
}

export const useMediaPipe = ({ videoRef, canvasRef, onGestureChange, onLoaded }: UseMediaPipeProps) => {
    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const lastVideoTimeRef = useRef(-1);
    // Fix: Provide an explicit initial value to `useRef` to avoid a potential "Expected 1 arguments, but got 0" error from a faulty polyfill or environment.
    const animationFrameId = useRef<number | undefined>(undefined);
    const handPositionRef = useRef({ x: 0, y: 0 });
    const isHandDetectedRef = useRef(false);
    
    // Refs for debouncing logic
    const gestureDebounceRef = useRef<{ mode: InteractionMode; count: number }>({ mode: InteractionMode.TREE, count: 0 });
    const confirmedModeRef = useRef<InteractionMode>(InteractionMode.TREE);
    
    const [isInitialized, setIsInitialized] = useState(false);

    const predictWebcam = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const handLandmarker = handLandmarkerRef.current;
        
        if (!video || !canvas || !handLandmarker || video.readyState < 2) {
            animationFrameId.current = requestAnimationFrame(predictWebcam);
            return;
        }

        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const results = handLandmarker.detectForVideo(video, performance.now());
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.save();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.scale(-1, 1);
                ctx.translate(-canvas.width, 0);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                if (results.landmarks) {
                    for (const landmarks of results.landmarks) {
                        const drawingUtils = new DrawingUtils(ctx);
                        drawingUtils.drawLandmarks(landmarks, { color: '#00ffff', lineWidth: 1, radius: 2 });
                        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#ccffff', lineWidth: 1 });
                    }
                }
                ctx.restore();
            }

            let currentFrameMode: InteractionMode = InteractionMode.TREE;
            let isHandDetectedThisFrame = false;

            if (results.landmarks && results.landmarks.length > 0) {
                isHandDetectedThisFrame = true;
                const lm = results.landmarks[0];
                handPositionRef.current = { x: (lm[9].x - 0.5) * 2, y: (lm[9].y - 0.5) * 2 };

                // --- Dynamic Threshold Calculation ---
                const wrist = lm[0];
                const middleMcp = lm[9]; // Proxy for palm center
                const handSize = Math.max(0.01, Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y));

                // 1. Normalized Pinch Gesture (Focus)
                const thumbTip = lm[4];
                const indexTip = lm[8];
                const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) / handSize;

                // 2. Normalized Scatter Gesture
                const fingerTips = [lm[4], lm[8], lm[12], lm[16], lm[20]];
                const avgTipDist = fingerTips.reduce((sum, tip) => sum + Math.hypot(tip.x - middleMcp.x, tip.y - middleMcp.y), 0) / (fingerTips.length * handSize);
                
                if (pinchDist < 0.3) {
                    currentFrameMode = InteractionMode.FOCUS;
                } else if (avgTipDist > 0.8) {
                    currentFrameMode = InteractionMode.SCATTER;
                } else {
                    currentFrameMode = InteractionMode.TREE;
                }
            }

            // --- Debounce Logic ---
            const debounceState = gestureDebounceRef.current;
            if (isHandDetectedThisFrame) {
                if (debounceState.mode === currentFrameMode) {
                    debounceState.count++;
                } else {
                    debounceState.mode = currentFrameMode;
                    debounceState.count = 1;
                }

                if (debounceState.count >= DEBOUNCE_FRAMES) {
                    confirmedModeRef.current = debounceState.mode;
                }
            } else {
                // Reset immediately if hand is lost
                debounceState.mode = InteractionMode.TREE;
                debounceState.count = 0;
                confirmedModeRef.current = InteractionMode.TREE;
            }

            isHandDetectedRef.current = isHandDetectedThisFrame;
            onGestureChange(confirmedModeRef.current, isHandDetectedThisFrame);
        }

        animationFrameId.current = requestAnimationFrame(predictWebcam);
    }, [onGestureChange, videoRef, canvasRef]);

    useEffect(() => {
        const initialize = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
                );
                
                let handLandmarker;
                try {
                    // Attempt to initialize with GPU
                    handLandmarker = await HandLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                            delegate: "GPU"
                        },
                        runningMode: "VIDEO",
                        numHands: 1
                    });
                } catch (gpuError) {
                    console.warn("GPU delegate for HandLandmarker failed. Falling back to CPU.", gpuError);
                    // Fallback to CPU if GPU fails
                    handLandmarker = await HandLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                            delegate: "CPU"
                        },
                        runningMode: "VIDEO",
                        numHands: 1
                    });
                }
                
                handLandmarkerRef.current = handLandmarker;
                
                if (navigator.mediaDevices?.getUserMedia) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.addEventListener("loadeddata", () => {
                             if(canvasRef.current && videoRef.current) {
                                canvasRef.current.width = videoRef.current.videoWidth;
                                canvasRef.current.height = videoRef.current.videoHeight;
                            }
                            setIsInitialized(true);
                            onLoaded();
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to initialize MediaPipe:", error);
            }
        };

        initialize();

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            if(videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [videoRef, canvasRef, onLoaded, onGestureChange]);
    
    useEffect(() => {
        if(isInitialized){
            animationFrameId.current = requestAnimationFrame(predictWebcam);
        }
        return () => {
            if(animationFrameId.current){
                cancelAnimationFrame(animationFrameId.current);
            }
        }
    }, [isInitialized, predictWebcam]);
    
    const gestureManager = {
        // Fix: Use a ref to accurately report hand detection status. The previous implementation always returned true.
        isHandDetected: () => isHandDetectedRef.current,
        getHandPosition: () => handPositionRef.current
    };

    return { gestureManager };
};
