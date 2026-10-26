import { useEffect, useRef, useState, useCallback } from 'react';
import { MediaPipeLandmarkFrame, Keypoint3D, NonManualMarkers } from '../types/isl';

declare global {
  interface Window {
    Hands?: any;
    FaceMesh?: any;
    Camera?: any;
  }
}

export const useMediaPipe = (
  videoRef: React.RefObject<HTMLVideoElement>,
  onFrameExtracted?: (frame: MediaPipeLandmarkFrame) => void
) => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [latestLandmarks, setLatestLandmarks] = useState<MediaPipeLandmarkFrame | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCountRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);
  const handsInstanceRef = useRef<any>(null);
  const faceMeshInstanceRef = useRef<any>(null);

  // Cached face points between frames
  const cachedFacePointsRef = useRef<Keypoint3D[]>([]);
  const cachedNmmMarkersRef = useRef<NonManualMarkers>({
    eyebrow_raised: false,
    mouth_open: false,
    emotion: 'neutral',
  });

  // Cached hands
  const cachedRightHandRef = useRef<Keypoint3D[]>([]);
  const cachedLeftHandRef = useRef<Keypoint3D[]>([]);

  useEffect(() => {
    // 1. Initialize MediaPipe Hands
    if (window.Hands) {
      try {
        const hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: any) => {
          frameCountRef.current += 1;

          let rightHand: Keypoint3D[] = [];
          let leftHand: Keypoint3D[] = [];

          if (results.multiHandLandmarks && results.multiHandedness) {
            results.multiHandLandmarks.forEach((landmarks: any[], index: number) => {
              const label = results.multiHandedness[index]?.label;
              const pts: Keypoint3D[] = landmarks.map((pt: any) => ({
                x: pt.x,
                y: pt.y,
                z: pt.z || 0,
                visibility: pt.visibility ?? 1.0,
              }));

              if (label === 'Right') {
                rightHand = pts;
              } else {
                leftHand = pts;
              }

              if (rightHand.length === 0 && leftHand.length === 0) {
                rightHand = pts;
              }
            });
          }

          cachedRightHandRef.current = rightHand;
          cachedLeftHandRef.current = leftHand;

          const framePayload: MediaPipeLandmarkFrame = {
            timestamp: Date.now(),
            frame_index: frameCountRef.current,
            pose: [],
            left_hand: rightHand.length === 0 && leftHand.length > 0 ? leftHand : cachedLeftHandRef.current,
            right_hand: rightHand.length > 0 ? rightHand : cachedRightHandRef.current,
            face: cachedFacePointsRef.current,
            nmm_markers: cachedNmmMarkersRef.current,
          };

          setLatestLandmarks(framePayload);
          if (onFrameExtracted) {
            onFrameExtracted(framePayload);
          }
        });

        handsInstanceRef.current = hands;
      } catch (err) {
        console.error('[MediaPipe Hands] Initialization error:', err);
      }
    }

    // 2. Initialize MediaPipe FaceMesh (Computer Vision for Facial Non-Manual Markers)
    if (window.FaceMesh) {
      try {
        const faceMesh = new window.FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const facePoints = results.multiFaceLandmarks[0];
            const pts: Keypoint3D[] = facePoints.map((pt: any) => ({
              x: pt.x,
              y: pt.y,
              z: pt.z || 0,
              visibility: 1.0,
            }));
            cachedFacePointsRef.current = pts;

            // Computer Vision: Extract Facial NMM & Emotion Features
            // Key indices:
            // Eyebrow top: 70 (left), 300 (right)
            // Eye center: 159 (left), 386 (right)
            // Lips: 13 (upper), 14 (lower), 61 (left corner), 291 (right corner)
            // Forehead: 10, Chin: 152
            if (pts.length >= 400) {
              const faceHeight = Math.abs((pts[152]?.y || 1) - (pts[10]?.y || 0)) || 1.0;
              const browDistLeft = Math.abs((pts[159]?.y || 0) - (pts[70]?.y || 0));
              const browDistRight = Math.abs((pts[386]?.y || 0) - (pts[300]?.y || 0));
              const avgBrowRatio = (browDistLeft + browDistRight) / (2 * faceHeight);

              // Eyebrow raise detection (ISL Question marker)
              const eyebrowRaised = avgBrowRatio > 0.085;

              // Mouth openness (Emphasis / Articulation)
              const mouthHeight = Math.abs((pts[14]?.y || 0) - (pts[13]?.y || 0));
              const mouthWidth = Math.abs((pts[291]?.x || 0) - (pts[61]?.x || 0)) || 0.01;
              const mouthRatio = mouthHeight / mouthWidth;
              const mouthOpen = mouthRatio > 0.38;

              // Smile / Emotion detection
              // In smile, corners (61, 291) rise relative to lower lip center (14)
              const cornerAvgY = ((pts[61]?.y || 0) + (pts[291]?.y || 0)) / 2;
              const lipCenterY = pts[14]?.y || 0;
              let emotion: 'neutral' | 'happy' | 'sad' | 'urgent' = 'neutral';

              if (cornerAvgY < lipCenterY - 0.005) {
                emotion = 'happy';
              } else if (eyebrowRaised && mouthOpen) {
                emotion = 'urgent';
              } else if (cornerAvgY > lipCenterY + 0.008) {
                emotion = 'sad';
              }

              cachedNmmMarkersRef.current = {
                eyebrow_raised: eyebrowRaised,
                mouth_open: mouthOpen,
                emotion,
                urgency: emotion === 'urgent',
              };
            }
          }
        });

        faceMeshInstanceRef.current = faceMesh;
        console.log('[MediaPipe FaceMesh] Real client-side face computer vision tracking initialized.');
      } catch (err) {
        console.error('[MediaPipe FaceMesh] Initialization error:', err);
      }
    }

    setIsLoaded(true);
  }, [onFrameExtracted]);

  // Frame processing loop sending video frames to Hands and FaceMesh engines
  let frameCounter = 0;
  const processFrame = useCallback(async () => {
    if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
      frameCounter += 1;
      try {
        // Send to Hands engine
        if (handsInstanceRef.current) {
          await handsInstanceRef.current.send({ image: videoRef.current });
        }
        // Send to FaceMesh engine every 2nd frame for smooth 60fps throughput
        if (faceMeshInstanceRef.current && frameCounter % 2 === 0) {
          await faceMeshInstanceRef.current.send({ image: videoRef.current });
        }
      } catch (e) {
        // Ignore skip errors during tab switching
      }
    }
    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [videoRef]);

  useEffect(() => {
    animFrameIdRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [processFrame]);

  return { canvasRef, isLoaded, latestLandmarks, processFrame };
};
