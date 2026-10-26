import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, Eye, Sparkles, Box } from 'lucide-react';
import { SequenceAvatarCanvas } from '../avatar/SequenceAvatarCanvas';

interface SignAvatar3DProps {
  glossSequence: string[];
  autoPlay?: boolean;
  onAnimationComplete?: () => void;
  speed?: number;
}


// MediaPipe 21 hand joints connection topology
const BONE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // Index
  [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17], [0, 5], [0, 17] // Palm structure
];

// 3D Avatar Keyframe Configurations for ISL Vocabulary
// Coordinates normalized around (x: 0..1, y: 0..1, z: -0.1..0.1)
type Joint3D = { x: number; y: number; z: number };

const SIGN_KEYFRAMES: Record<string, { right: Joint3D[]; left?: Joint3D[]; bodyMotion?: { headTilt: number; chestX: number } }> = {
  REST: {
    right: [
      { x: 0.60, y: 0.70, z: 0.00 }, // 0: Wrist
      { x: 0.58, y: 0.65, z: 0.01 }, { x: 0.56, y: 0.61, z: 0.02 }, { x: 0.55, y: 0.58, z: 0.02 }, { x: 0.54, y: 0.55, z: 0.03 }, // Thumb
      { x: 0.60, y: 0.60, z: 0.01 }, { x: 0.60, y: 0.54, z: 0.02 }, { x: 0.60, y: 0.50, z: 0.02 }, { x: 0.60, y: 0.46, z: 0.03 }, // Index
      { x: 0.63, y: 0.60, z: 0.01 }, { x: 0.63, y: 0.53, z: 0.02 }, { x: 0.63, y: 0.49, z: 0.02 }, { x: 0.63, y: 0.45, z: 0.03 }, // Middle
      { x: 0.66, y: 0.61, z: 0.01 }, { x: 0.66, y: 0.55, z: 0.02 }, { x: 0.66, y: 0.51, z: 0.02 }, { x: 0.66, y: 0.47, z: 0.03 }, // Ring
      { x: 0.68, y: 0.63, z: 0.01 }, { x: 0.69, y: 0.58, z: 0.02 }, { x: 0.70, y: 0.54, z: 0.02 }, { x: 0.70, y: 0.50, z: 0.03 }  // Pinky
    ]
  },
  HELLO: {
    right: [
      { x: 0.72, y: 0.40, z: -0.05 },
      { x: 0.75, y: 0.38, z: -0.04 }, { x: 0.78, y: 0.36, z: -0.03 }, { x: 0.81, y: 0.35, z: -0.02 }, { x: 0.84, y: 0.34, z: -0.01 },
      { x: 0.73, y: 0.30, z: -0.05 }, { x: 0.74, y: 0.24, z: -0.06 }, { x: 0.75, y: 0.18, z: -0.06 }, { x: 0.76, y: 0.12, z: -0.07 },
      { x: 0.70, y: 0.29, z: -0.05 }, { x: 0.70, y: 0.23, z: -0.06 }, { x: 0.70, y: 0.17, z: -0.06 }, { x: 0.70, y: 0.11, z: -0.07 },
      { x: 0.67, y: 0.30, z: -0.05 }, { x: 0.66, y: 0.24, z: -0.06 }, { x: 0.65, y: 0.19, z: -0.06 }, { x: 0.64, y: 0.13, z: -0.07 },
      { x: 0.64, y: 0.32, z: -0.04 }, { x: 0.63, y: 0.27, z: -0.05 }, { x: 0.62, y: 0.22, z: -0.05 }, { x: 0.61, y: 0.17, z: -0.06 }
    ]
  },
  THANK_YOU: {
    right: [
      { x: 0.50, y: 0.48, z: 0.08 },
      { x: 0.47, y: 0.44, z: 0.07 }, { x: 0.45, y: 0.41, z: 0.06 }, { x: 0.43, y: 0.38, z: 0.05 }, { x: 0.41, y: 0.35, z: 0.04 },
      { x: 0.49, y: 0.40, z: 0.06 }, { x: 0.49, y: 0.34, z: 0.04 }, { x: 0.49, y: 0.29, z: 0.02 }, { x: 0.49, y: 0.24, z: 0.00 },
      { x: 0.52, y: 0.40, z: 0.06 }, { x: 0.52, y: 0.33, z: 0.04 }, { x: 0.52, y: 0.28, z: 0.02 }, { x: 0.52, y: 0.23, z: 0.00 },
      { x: 0.55, y: 0.41, z: 0.06 }, { x: 0.55, y: 0.35, z: 0.04 }, { x: 0.55, y: 0.30, z: 0.02 }, { x: 0.55, y: 0.25, z: 0.00 },
      { x: 0.58, y: 0.43, z: 0.05 }, { x: 0.58, y: 0.38, z: 0.04 }, { x: 0.58, y: 0.33, z: 0.02 }, { x: 0.58, y: 0.29, z: 0.01 }
    ]
  },
  GOOD: {
    right: [
      { x: 0.58, y: 0.52, z: 0.02 },
      { x: 0.58, y: 0.46, z: 0.03 }, { x: 0.58, y: 0.40, z: 0.04 }, { x: 0.58, y: 0.34, z: 0.05 }, { x: 0.58, y: 0.28, z: 0.06 }, // Thumb upright
      { x: 0.55, y: 0.49, z: 0.01 }, { x: 0.54, y: 0.51, z: 0.00 }, { x: 0.53, y: 0.53, z: -0.01 }, { x: 0.52, y: 0.55, z: -0.02 }, // Closed fingers
      { x: 0.57, y: 0.50, z: 0.01 }, { x: 0.57, y: 0.52, z: 0.00 }, { x: 0.57, y: 0.54, z: -0.01 }, { x: 0.57, y: 0.56, z: -0.02 },
      { x: 0.59, y: 0.51, z: 0.01 }, { x: 0.60, y: 0.53, z: 0.00 }, { x: 0.61, y: 0.55, z: -0.01 }, { x: 0.62, y: 0.57, z: -0.02 },
      { x: 0.61, y: 0.52, z: 0.01 }, { x: 0.63, y: 0.54, z: 0.00 }, { x: 0.64, y: 0.56, z: -0.01 }, { x: 0.65, y: 0.58, z: -0.02 }
    ]
  },
  HELP: {
    // Both hands: Left flat palm supporting right thumbs-up fist
    right: [
      { x: 0.52, y: 0.44, z: 0.04 },
      { x: 0.52, y: 0.38, z: 0.05 }, { x: 0.52, y: 0.32, z: 0.06 }, { x: 0.52, y: 0.27, z: 0.07 }, { x: 0.52, y: 0.22, z: 0.08 },
      { x: 0.49, y: 0.42, z: 0.02 }, { x: 0.48, y: 0.44, z: 0.01 }, { x: 0.47, y: 0.46, z: 0.00 }, { x: 0.46, y: 0.48, z: -0.01 },
      { x: 0.51, y: 0.43, z: 0.02 }, { x: 0.51, y: 0.45, z: 0.01 }, { x: 0.51, y: 0.47, z: 0.00 }, { x: 0.51, y: 0.49, z: -0.01 },
      { x: 0.53, y: 0.43, z: 0.02 }, { x: 0.54, y: 0.45, z: 0.01 }, { x: 0.55, y: 0.47, z: 0.00 }, { x: 0.56, y: 0.49, z: -0.01 },
      { x: 0.55, y: 0.44, z: 0.02 }, { x: 0.57, y: 0.46, z: 0.01 }, { x: 0.58, y: 0.48, z: 0.00 }, { x: 0.59, y: 0.50, z: -0.01 }
    ],
    left: [
      { x: 0.50, y: 0.54, z: 0.02 },
      { x: 0.45, y: 0.52, z: 0.02 }, { x: 0.41, y: 0.50, z: 0.02 }, { x: 0.37, y: 0.48, z: 0.02 }, { x: 0.33, y: 0.47, z: 0.02 },
      { x: 0.48, y: 0.49, z: 0.02 }, { x: 0.48, y: 0.44, z: 0.02 }, { x: 0.48, y: 0.39, z: 0.02 }, { x: 0.48, y: 0.35, z: 0.02 },
      { x: 0.52, y: 0.49, z: 0.02 }, { x: 0.52, y: 0.43, z: 0.02 }, { x: 0.52, y: 0.38, z: 0.02 }, { x: 0.52, y: 0.34, z: 0.02 },
      { x: 0.55, y: 0.50, z: 0.02 }, { x: 0.55, y: 0.45, z: 0.02 }, { x: 0.55, y: 0.40, z: 0.02 }, { x: 0.55, y: 0.36, z: 0.02 },
      { x: 0.58, y: 0.51, z: 0.02 }, { x: 0.59, y: 0.47, z: 0.02 }, { x: 0.60, y: 0.43, z: 0.02 }, { x: 0.61, y: 0.39, z: 0.02 }
    ]
  },
  PEACE: {
    right: [
      { x: 0.58, y: 0.52, z: 0.00 },
      { x: 0.56, y: 0.50, z: 0.01 }, { x: 0.54, y: 0.52, z: 0.00 }, { x: 0.53, y: 0.54, z: -0.01 }, { x: 0.52, y: 0.55, z: -0.02 },
      { x: 0.56, y: 0.42, z: 0.01 }, { x: 0.54, y: 0.33, z: 0.02 }, { x: 0.52, y: 0.25, z: 0.03 }, { x: 0.50, y: 0.17, z: 0.04 }, // Index extended
      { x: 0.60, y: 0.42, z: 0.01 }, { x: 0.62, y: 0.33, z: 0.02 }, { x: 0.64, y: 0.25, z: 0.03 }, { x: 0.66, y: 0.17, z: 0.04 }, // Middle extended (V)
      { x: 0.60, y: 0.50, z: 0.00 }, { x: 0.61, y: 0.53, z: -0.01 }, { x: 0.62, y: 0.55, z: -0.02 }, { x: 0.63, y: 0.57, z: -0.02 },
      { x: 0.62, y: 0.51, z: 0.00 }, { x: 0.64, y: 0.54, z: -0.01 }, { x: 0.65, y: 0.56, z: -0.02 }, { x: 0.66, y: 0.58, z: -0.02 }
    ]
  },
  DOCTOR: {
    // Pulse tap: Right fingers tapping left wrist
    right: [
      { x: 0.46, y: 0.48, z: 0.05 },
      { x: 0.48, y: 0.46, z: 0.04 }, { x: 0.50, y: 0.47, z: 0.03 }, { x: 0.51, y: 0.49, z: 0.02 }, { x: 0.52, y: 0.50, z: 0.01 },
      { x: 0.44, y: 0.52, z: 0.06 }, { x: 0.42, y: 0.55, z: 0.07 }, { x: 0.40, y: 0.58, z: 0.08 }, { x: 0.38, y: 0.60, z: 0.09 }, // Tapping index
      { x: 0.45, y: 0.51, z: 0.06 }, { x: 0.44, y: 0.54, z: 0.07 }, { x: 0.42, y: 0.57, z: 0.08 }, { x: 0.40, y: 0.60, z: 0.09 }, // Tapping middle
      { x: 0.47, y: 0.49, z: 0.04 }, { x: 0.48, y: 0.50, z: 0.03 }, { x: 0.49, y: 0.52, z: 0.02 }, { x: 0.50, y: 0.54, z: 0.01 },
      { x: 0.49, y: 0.49, z: 0.03 }, { x: 0.50, y: 0.51, z: 0.02 }, { x: 0.51, y: 0.53, z: 0.01 }, { x: 0.52, y: 0.55, z: 0.00 }
    ],
    left: [
      { x: 0.38, y: 0.60, z: 0.00 },
      { x: 0.35, y: 0.62, z: 0.01 }, { x: 0.32, y: 0.64, z: 0.02 }, { x: 0.30, y: 0.65, z: 0.02 }, { x: 0.28, y: 0.66, z: 0.03 },
      { x: 0.37, y: 0.66, z: 0.01 }, { x: 0.36, y: 0.70, z: 0.02 }, { x: 0.35, y: 0.74, z: 0.02 }, { x: 0.34, y: 0.78, z: 0.03 },
      { x: 0.39, y: 0.66, z: 0.01 }, { x: 0.39, y: 0.70, z: 0.02 }, { x: 0.39, y: 0.75, z: 0.02 }, { x: 0.39, y: 0.79, z: 0.03 },
      { x: 0.41, y: 0.66, z: 0.01 }, { x: 0.42, y: 0.70, z: 0.02 }, { x: 0.43, y: 0.74, z: 0.02 }, { x: 0.44, y: 0.78, z: 0.03 },
      { x: 0.43, y: 0.65, z: 0.01 }, { x: 0.45, y: 0.69, z: 0.02 }, { x: 0.47, y: 0.73, z: 0.02 }, { x: 0.48, y: 0.77, z: 0.03 }
    ]
  },
  STOP: {
    right: [
      { x: 0.50, y: 0.55, z: -0.06 },
      { x: 0.45, y: 0.52, z: -0.06 }, { x: 0.40, y: 0.50, z: -0.06 }, { x: 0.36, y: 0.49, z: -0.06 }, { x: 0.32, y: 0.48, z: -0.06 },
      { x: 0.47, y: 0.43, z: -0.07 }, { x: 0.47, y: 0.34, z: -0.08 }, { x: 0.47, y: 0.25, z: -0.09 }, { x: 0.47, y: 0.16, z: -0.10 },
      { x: 0.51, y: 0.42, z: -0.07 }, { x: 0.51, y: 0.33, z: -0.08 }, { x: 0.51, y: 0.24, z: -0.09 }, { x: 0.51, y: 0.15, z: -0.10 },
      { x: 0.55, y: 0.43, z: -0.07 }, { x: 0.55, y: 0.35, z: -0.08 }, { x: 0.55, y: 0.27, z: -0.09 }, { x: 0.55, y: 0.18, z: -0.10 },
      { x: 0.58, y: 0.45, z: -0.06 }, { x: 0.59, y: 0.39, z: -0.07 }, { x: 0.60, y: 0.32, z: -0.08 }, { x: 0.61, y: 0.25, z: -0.09 }
    ]
  }
};

export const SignAvatar3D: React.FC<SignAvatar3DProps> = ({
  glossSequence,
  autoPlay = true,
  onAnimationComplete,
  speed = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [avatarEngine, setAvatarEngine] = useState<'threejs' | 'kinematic'>('threejs');
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [currentGlossIndex, setCurrentGlossIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(speed);
  const [cameraAngle, setCameraAngle] = useState<{ rotX: number; rotY: number }>({ rotX: 0, rotY: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });


  // Current interpolated landmark poses
  const currentPoseRef = useRef<{ right: Joint3D[]; left?: Joint3D[] }>({
    right: JSON.parse(JSON.stringify(SIGN_KEYFRAMES.REST.right)),
  });

  const animProgressRef = useRef<number>(0);
  const reqIdRef = useRef<number | null>(null);

  // Get active keyframe target
  const activeSign = glossSequence[currentGlossIndex] || 'REST';
  const targetKeyframe = SIGN_KEYFRAMES[activeSign] || SIGN_KEYFRAMES.GOOD || SIGN_KEYFRAMES.REST;

  // Linear interpolation utility for 3D joints
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // Render & Animation Loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Progress animation interpolation
    if (isPlaying && glossSequence.length > 0) {
      animProgressRef.current += 0.025 * playbackSpeed;
      if (animProgressRef.current >= 1.0) {
        animProgressRef.current = 0.0;
        if (currentGlossIndex < glossSequence.length - 1) {
          setCurrentGlossIndex((prev) => prev + 1);
        } else {
          // Completed sequence
          if (onAnimationComplete) onAnimationComplete();
          setIsPlaying(false);
        }
      }
    }

    // Smoothly interpolate joints toward target keyframe
    const currentRight = currentPoseRef.current.right;
    const targetRight = targetKeyframe.right;
    for (let i = 0; i < currentRight.length; i++) {
      if (targetRight[i]) {
        currentRight[i].x = lerp(currentRight[i].x, targetRight[i].x, 0.12 * playbackSpeed);
        currentRight[i].y = lerp(currentRight[i].y, targetRight[i].y, 0.12 * playbackSpeed);
        currentRight[i].z = lerp(currentRight[i].z, targetRight[i].z, 0.12 * playbackSpeed);
      }
    }

    // Clear frame with futuristic cyber background gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0a0f1d');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#050811');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid floor perspective lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)';
    ctx.lineWidth = 1;
    const centerY = canvas.height * 0.85;
    for (let x = -canvas.width; x < canvas.width * 2; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + cameraAngle.rotY * 50, centerY);
      ctx.lineTo((x - canvas.width * 0.5) * 2.5 + canvas.width * 0.5, canvas.height);
      ctx.stroke();
    }

    // Draw Avatar Torso & Head Hologram Silhouette
    const headX = canvas.width * 0.5 + cameraAngle.rotY * 20;
    const headY = canvas.height * 0.28;

    // Avatar Head Circle with Glow
    ctx.beginPath();
    ctx.arc(headX, headY, 34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Avatar Eyes & Facial Expression
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.arc(headX - 12, headY - 4, 4, 0, Math.PI * 2);
    ctx.arc(headX + 12, headY - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Smile / Expression
    ctx.beginPath();
    ctx.arc(headX, headY + 8, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Avatar Shoulders & Neck
    ctx.beginPath();
    ctx.moveTo(headX, headY + 34);
    ctx.lineTo(headX, headY + 54);
    ctx.lineTo(headX - 90, headY + 110);
    ctx.lineTo(headX + 90, headY + 110);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.stroke();

    // 3D Skeleton Rendering Function
    const renderHand3D = (joints: Joint3D[], primaryColor: string, jointGlow: string) => {
      // Perspective projection
      const proj = joints.map((j) => {
        const rotYOffset = cameraAngle.rotY * 0.15;
        const x3d = j.x + rotYOffset;
        const z3d = j.z;
        const scale = 1 / (1 + z3d * 2.0);
        return {
          x: canvas.width * 0.15 + x3d * canvas.width * 0.7,
          y: canvas.height * 0.15 + j.y * canvas.height * 0.7,
          z: z3d,
          scale,
        };
      });

      // 1. Draw Bones
      BONE_CONNECTIONS.forEach(([s, e]) => {
        const p1 = proj[s];
        const p2 = proj[e];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = Math.max(3, 6 * ((p1.scale + p2.scale) / 2));
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      });

      // 2. Draw 3D Joints
      proj.forEach((pt, idx) => {
        const radius = idx === 0 ? 9 * pt.scale : (idx % 4 === 0 ? 6 * pt.scale : 4.5 * pt.scale);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);

        const radGrad = ctx.createRadialGradient(pt.x - 2, pt.y - 2, 1, pt.x, pt.y, radius);
        radGrad.addColorStop(0, '#ffffff');
        radGrad.addColorStop(0.5, jointGlow);
        radGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = radGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };

    // Render Right Hand 3D (Gold / Amber cybernetic glow)
    renderHand3D(currentPoseRef.current.right, 'rgba(245, 158, 11, 0.8)', '#fbbf24');

    // Render Left Hand if dual-handed sign
    if (targetKeyframe.left) {
      if (!currentPoseRef.current.left) {
        currentPoseRef.current.left = JSON.parse(JSON.stringify(targetKeyframe.left));
      } else {
        for (let i = 0; i < currentPoseRef.current.left.length; i++) {
          if (targetKeyframe.left[i]) {
            currentPoseRef.current.left[i].x = lerp(currentPoseRef.current.left[i].x, targetKeyframe.left[i].x, 0.12 * playbackSpeed);
            currentPoseRef.current.left[i].y = lerp(currentPoseRef.current.left[i].y, targetKeyframe.left[i].y, 0.12 * playbackSpeed);
            currentPoseRef.current.left[i].z = lerp(currentPoseRef.current.left[i].z, targetKeyframe.left[i].z, 0.12 * playbackSpeed);
          }
        }
      }
      if (currentPoseRef.current.left) {
        renderHand3D(currentPoseRef.current.left, 'rgba(16, 185, 129, 0.8)', '#34d399');
      }
    }

    reqIdRef.current = requestAnimationFrame(animate);
  }, [isPlaying, currentGlossIndex, glossSequence, targetKeyframe, playbackSpeed, cameraAngle, onAnimationComplete]);

  useEffect(() => {
    reqIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [animate]);

  // Mouse drag 3D orbit controls
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    setCameraAngle((prev) => ({
      rotX: prev.rotX,
      rotY: Math.max(-0.6, Math.min(0.6, prev.rotY + dx * 0.005)),
    }));
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleReset = () => {
    setCurrentGlossIndex(0);
    animProgressRef.current = 0;
    setIsPlaying(true);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
        border: '1px solid rgba(96, 165, 250, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Avatar Header & Engine Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#60a5fa" />
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
            3D Indian Sign Language Avatar
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              padding: '2px 8px',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
            }}
          >
            {avatarEngine === 'threejs' ? 'Three.js Articulated Rig' : 'Kinematic Hologram'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setAvatarEngine('threejs')}
            style={{
              padding: '3px 8px',
              fontSize: '0.72rem',
              borderRadius: '6px',
              border: avatarEngine === 'threejs' ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
              backgroundColor: avatarEngine === 'threejs' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.5)',
              color: avatarEngine === 'threejs' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            3D Humanoid
          </button>
          <button
            onClick={() => setAvatarEngine('kinematic')}
            style={{
              padding: '3px 8px',
              fontSize: '0.72rem',
              borderRadius: '6px',
              border: avatarEngine === 'kinematic' ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
              backgroundColor: avatarEngine === 'kinematic' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.5)',
              color: avatarEngine === 'kinematic' ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Kinematic Canvas
          </button>
        </div>
      </div>

      {avatarEngine === 'threejs' ? (
        <SequenceAvatarCanvas
          inputText={glossSequence.join(' ')}
          autoPlay={autoPlay}
          speed={playbackSpeed}
          onSequenceComplete={onAnimationComplete}
        />
      ) : (
        <>
      {/* 3D Canvas Viewport */}

      <div style={{ position: 'relative', width: '100%', height: '340px', borderRadius: '10px', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={640}
          height={400}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        />

        {/* Current Active Sign Badge Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(96, 165, 250, 0.4)',
            borderRadius: '8px',
            padding: '8px 14px',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Active ISL Gesture</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#60a5fa' }}>
            {activeSign.replace(/_/g, ' ')}
          </div>
        </div>

        {/* Gloss Sequence Step Indicator */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            color: '#e2e8f0',
          }}
        >
          Sign {glossSequence.length > 0 ? currentGlossIndex + 1 : 0} of {glossSequence.length}
        </div>
      </div>

      {/* Gloss Sequence Timeline Pill List */}
      {glossSequence.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
          {glossSequence.map((gloss, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentGlossIndex(idx);
                animProgressRef.current = 0;
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor:
                  idx === currentGlossIndex ? '#2563eb' : 'rgba(51, 65, 85, 0.5)',
                color: idx === currentGlossIndex ? '#ffffff' : '#94a3b8',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {idx + 1}. {gloss.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Playback Controls & Speed Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(148, 163, 184, 0.2)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause Avatar' : 'Play Gestures'}
          </button>
          <button
            className="btn"
            onClick={handleReset}
            style={{ background: '#334155', color: 'white', fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <RotateCcw size={14} /> Restart
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FastForward size={14} color="#94a3b8" />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Speed:</span>
          {[0.5, 1.0, 1.5].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              style={{
                background: playbackSpeed === s ? '#3b82f6' : 'rgba(51, 65, 85, 0.5)',
                color: playbackSpeed === s ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
};

