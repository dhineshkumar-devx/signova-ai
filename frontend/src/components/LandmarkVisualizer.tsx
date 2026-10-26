import React, { useEffect, useRef } from 'react';
import { MediaPipeLandmarkFrame, JointAttentionData } from '../types/isl';
import { AFMETelemetry } from '../services/afme';

interface LandmarkVisualizerProps {
  landmarks: MediaPipeLandmarkFrame | null;
  show3DHand?: boolean;
  showLandmarks?: boolean;
  showConnections?: boolean;
  showFaceMesh?: boolean;
  afme?: AFMETelemetry | null;
  jointAttention?: JointAttentionData | null;
}

// MediaPipe Hand bone connection topology
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // Index
  [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17]              // Palm base
];

// Face Mesh key contour paths
const FACE_CONTOURS = {
  oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  leftEyebrow: [70, 63, 105, 66, 107],
  rightEyebrow: [300, 293, 334, 296, 336],
  leftEye: [33, 160, 158, 133, 153, 144, 33],
  rightEye: [362, 385, 387, 263, 373, 380, 362],
  lips: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 61],
  nose: [168, 6, 197, 195, 5, 4],
};

const TIP_INDICES: Record<string, number> = {
  THUMB: 4,
  INDEX: 8,
  MIDDLE: 12,
  RING: 16,
  PINKY: 20,
};

export const LandmarkVisualizer: React.FC<LandmarkVisualizerProps> = ({
  landmarks,
  show3DHand = true,
  showLandmarks = true,
  showConnections = true,
  showFaceMesh = true,
  afme = null,
  jointAttention = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    // ────────────────────────────────────────────────────────────
    // 1. COMPUTER VISION FACE MESH & NMM VISUALIZATION
    // ────────────────────────────────────────────────────────────
    if (showFaceMesh && landmarks.face && landmarks.face.length > 50) {
      const facePts = landmarks.face;

      const projectFacePt = (idx: number) => {
        const pt = facePts[idx];
        if (!pt) return null;
        return {
          x: pt.x * canvas.width,
          y: pt.y * canvas.height,
        };
      };

      // Draw Contours (Oval, Eyes, Eyebrows, Lips)
      const drawContourPath = (indices: number[], strokeColor: string, lineWidth: number = 1.5) => {
        ctx.beginPath();
        let started = false;
        indices.forEach((idx) => {
          const pt = projectFacePt(idx);
          if (pt) {
            if (!started) {
              ctx.moveTo(pt.x, pt.y);
              started = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
        });
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      };

      // Face Oval (Cyber Cyan)
      drawContourPath(FACE_CONTOURS.oval, 'rgba(6, 182, 212, 0.45)', 1.5);

      // Eyebrows (Highlight in Green if Raised)
      const isBrowRaised = Boolean(landmarks.nmm_markers?.eyebrow_raised);
      const browColor = isBrowRaised ? '#10b981' : 'rgba(59, 130, 246, 0.7)';
      drawContourPath(FACE_CONTOURS.leftEyebrow, browColor, isBrowRaised ? 3 : 2);
      drawContourPath(FACE_CONTOURS.rightEyebrow, browColor, isBrowRaised ? 3 : 2);

      // Eyes
      drawContourPath(FACE_CONTOURS.leftEye, 'rgba(147, 197, 253, 0.6)', 1.5);
      drawContourPath(FACE_CONTOURS.rightEye, 'rgba(147, 197, 253, 0.6)', 1.5);

      // Nose
      drawContourPath(FACE_CONTOURS.nose, 'rgba(148, 163, 184, 0.4)', 1.2);

      // Lips (Highlight in Amber if Mouth Open)
      const isMouthOpen = Boolean(landmarks.nmm_markers?.mouth_open);
      const lipColor = isMouthOpen ? '#f59e0b' : 'rgba(236, 72, 153, 0.6)';
      drawContourPath(FACE_CONTOURS.lips, lipColor, isMouthOpen ? 2.5 : 1.5);
    }

    // ────────────────────────────────────────────────────────────
    // 2. 3D HAND SKELETON + JOINT ATTENTION + AFME MOTION VECTORS
    // ────────────────────────────────────────────────────────────
    const drawHand3DSkeleton = (handPoints: any[], baseColor: string, jointColor: string) => {
      if (!handPoints || handPoints.length < 21) return;

      const projected = handPoints.map((pt) => {
        const zDepth = pt.z || 0;
        const depthParallax = show3DHand ? zDepth * 150 : 0;
        return {
          x: pt.x * canvas.width - depthParallax * 0.3,
          y: pt.y * canvas.height - depthParallax * 0.3,
          z: zDepth,
        };
      });

      // 1. Draw 3D Connection Lines (Bones)
      if (showConnections) {
        HAND_CONNECTIONS.forEach(([start, end]) => {
          const p1 = projected[start];
          const p2 = projected[end];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);

            if (show3DHand) {
              const avgDepth = (p1.z + p2.z) / 2;
              const alpha = Math.max(0.3, Math.min(1.0, 0.8 - avgDepth * 2));
              ctx.strokeStyle = baseColor.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
              ctx.lineWidth = Math.max(2, Math.min(8, 5 - avgDepth * 10));
            } else {
              ctx.strokeStyle = baseColor;
              ctx.lineWidth = 3;
            }
            ctx.stroke();
          }
        });
      }

      // 2. Draw 3D Joint Nodes + Attention Importance Heatmap Aura
      if (showLandmarks) {
        projected.forEach((pt, idx) => {
          const attentionWeight = jointAttention?.joint_weights?.[idx] || 0;
          const baseRadius = idx === 0 ? 8 : idx % 4 === 0 ? 6 : 4;
          const depthRadius = show3DHand
            ? Math.max(3, Math.min(12, baseRadius - pt.z * 15))
            : baseRadius;

          // If joint has high attention (> 5%), draw glowing attention halo
          if (attentionWeight > 0.05) {
            ctx.save();
            ctx.beginPath();
            const haloRadius = depthRadius + attentionWeight * 45;
            ctx.arc(pt.x, pt.y, haloRadius, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(168, 85, 247, ${Math.min(0.7, attentionWeight * 4)})`;
            ctx.shadowColor = '#c084fc';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.restore();
          }

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, depthRadius, 0, 2 * Math.PI);

          if (show3DHand) {
            const grad = ctx.createRadialGradient(
              pt.x - depthRadius * 0.3,
              pt.y - depthRadius * 0.3,
              1,
              pt.x,
              pt.y,
              depthRadius
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, jointColor);
            grad.addColorStop(1, '#0f172a');
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = jointColor;
          }

          ctx.fill();

          if (show3DHand) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      }

      // 3. Draw AFME Fingertip Kinematic Velocity Vectors
      if (afme && afme.finger_kinematics) {
        Object.entries(TIP_INDICES).forEach(([fingerName, tipIdx]) => {
          const kin = afme.finger_kinematics[fingerName];
          const tipPt = projected[tipIdx];
          if (kin && tipPt && kin.velocity > 0.01) {
            const vx = kin.direction[0] * Math.min(60, kin.velocity * 600);
            const vy = kin.direction[1] * Math.min(60, kin.velocity * 600);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(tipPt.x, tipPt.y);
            ctx.lineTo(tipPt.x + vx, tipPt.y + vy);
            ctx.strokeStyle = kin.is_active ? '#34d399' : '#94a3b8';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.arc(tipPt.x + vx, tipPt.y + vy, 3, 0, Math.PI * 2);
            ctx.fillStyle = kin.is_active ? '#10b981' : '#64748b';
            ctx.fill();
            ctx.restore();
          }
        });
      }
    };

    // Draw Left Hand 3D Skeleton (Emerald Green)
    drawHand3DSkeleton(landmarks.left_hand, 'rgb(16, 185, 129)', '#34d399');

    // Draw Right Hand 3D Skeleton (Amber / Gold)
    drawHand3DSkeleton(landmarks.right_hand, 'rgb(245, 158, 11)', '#fbbf24');

    // ────────────────────────────────────────────────────────────
    // 3. AFME KINEMATICS & ADAPTIVE MOTION STATE HUD
    // ────────────────────────────────────────────────────────────
    if (afme) {
      ctx.save();
      const hudX = canvas.width - 320;
      const hudY = 16;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle =
        afme.motion_state === 'ACTIVE_SIGNING'
          ? 'rgba(16, 185, 129, 0.8)'
          : afme.motion_state === 'TRANSITIONING'
          ? 'rgba(245, 158, 11, 0.8)'
          : 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.roundRect ? ctx.roundRect(hudX, hudY, 304, 100, 8) : ctx.rect(hudX, hudY, 304, 100);
      ctx.fill();
      ctx.stroke();

      // Header
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#60a5fa';
      ctx.fillText('⚡ AFME KINEMATICS & GRAPH ATTENTION', hudX + 12, hudY + 18);

      // State Badge
      const stateColor =
        afme.motion_state === 'ACTIVE_SIGNING'
          ? '#10b981'
          : afme.motion_state === 'TRANSITIONING'
          ? '#f59e0b'
          : '#94a3b8';
      ctx.fillStyle = stateColor;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`● STATE: ${afme.motion_state} (${afme.recommended_sample_rate}Hz)`, hudX + 12, hudY + 36);

      // Velocity & Curvature
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        `Velocity: ${afme.overall_velocity.toFixed(3)} | Accel: ${afme.overall_acceleration.toFixed(2)}`,
        hudX + 12,
        hudY + 54
      );
      ctx.fillText(
        `Trajectory Curvature: ${afme.trajectory_curvature.toFixed(2)} | Duration: ${afme.motion_duration_ms}ms`,
        hudX + 12,
        hudY + 70
      );

      // Active Fingers
      const activeStr = afme.active_fingers.length > 0 ? afme.active_fingers.join(', ') : 'None (Stable)';
      ctx.fillStyle = afme.active_fingers.length > 0 ? '#34d399' : '#64748b';
      ctx.fillText(`Active Fingers: [${activeStr}]`, hudX + 12, hudY + 86);

      ctx.restore();
    }
  }, [landmarks, show3DHand, showLandmarks, showConnections, showFaceMesh, afme, jointAttention]);

  return (
    <canvas
      ref={canvasRef}
      className="landmark-canvas"
      width={1280}
      height={720}
    />
  );
};
