/**
 * Adaptive Finger Motion Engine (AFME) - Client-Side Engine
 * ISL Bridge AI - Final-Year Academic Engineering Research Project
 *
 * Implements browser-side finger-joint kinematic tracking:
 * - 3D joint angles (flexion angle at MCP, PIP, DIP via vector dot products)
 * - Fingertip velocities, accelerations, and displacement
 * - Trajectory curvature and directional trends
 * - Tremor deadband filtering (suppressing webcam jitter)
 * - Adaptive motion-triggered state machine (STATIONARY, TRANSITIONING, ACTIVE_SIGNING)
 */

import { Keypoint3D } from '../types/isl';

export interface FingerAngles {
  mcp_deg: number;
  pip_deg: number;
  dip_deg: number;
  extension_pct: number;
}

export interface FingerKinematic {
  velocity: number;
  acceleration: number;
  displacement: number;
  angles: FingerAngles;
  direction: [number, number, number];
  is_active: boolean;
}

export type MotionState = 'STATIONARY' | 'TRANSITIONING' | 'ACTIVE_SIGNING';

export interface AFMETelemetry {
  motion_state: MotionState;
  overall_velocity: number;
  overall_acceleration: number;
  active_fingers: string[];
  finger_kinematics: Record<string, FingerKinematic>;
  trajectory_curvature: number;
  motion_duration_ms: number;
  hand_detected: boolean;
  wrist_position: [number, number, number];
  recommended_sample_rate: number; // e.g. 5Hz when STATIONARY, 30Hz when ACTIVE_SIGNING
}

export interface AFMEConfig {
  tremor_deadband: number;        // Default: 0.0035
  motion_velocity_min: number;    // Default: 0.015
  motion_velocity_active: number; // Default: 0.040
  acceleration_burst: number;     // Default: 0.080
  buffer_window_frames: number;   // Default: 15
}

const DEFAULT_AFME_CONFIG: AFMEConfig = {
  tremor_deadband: 0.0035,
  motion_velocity_min: 0.015,
  motion_velocity_active: 0.040,
  acceleration_burst: 0.080,
  buffer_window_frames: 15,
};

// Finger Landmark Indices
const FINGER_MAP = {
  THUMB: { mcp: 2, ip: 3, tip: 4 },
  INDEX: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  MIDDLE: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  RING: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  PINKY: { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

export class ClientAFME {
  private config: AFMEConfig;
  private history: Array<{
    points: Keypoint3D[];
    velocities: Record<string, number>;
    timestamp: number;
  }> = [];
  private lastTimestamp = 0;
  private motionState: MotionState = 'STATIONARY';
  private motionStartTime = 0;

  constructor(config?: Partial<AFMEConfig>) {
    this.config = { ...DEFAULT_AFME_CONFIG, ...config };
  }

  public updateConfig(newConfig: Partial<AFMEConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): AFMEConfig {
    return { ...this.config };
  }

  public reset() {
    this.history = [];
    this.lastTimestamp = 0;
    this.motionState = 'STATIONARY';
    this.motionStartTime = 0;
  }

  private calculateAngle(p1: Keypoint3D, p2: Keypoint3D, p3: Keypoint3D): number {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: (p1.z || 0) - (p2.z || 0) };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: (p3.z || 0) - (p2.z || 0) };

    const norm1 = Math.hypot(v1.x, v1.y, v1.z);
    const norm2 = Math.hypot(v2.x, v2.y, v2.z);

    if (norm1 < 1e-6 || norm2 < 1e-6) return 180;

    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const cosine = Math.max(-1, Math.min(1, dot / (norm1 * norm2)));
    return (Math.acos(cosine) * 180) / Math.PI;
  }

  public processFrame(landmarks: Keypoint3D[], timestampMs?: number): AFMETelemetry {
    const now = timestampMs ?? performance.now();
    const dt = this.lastTimestamp > 0 ? Math.max(0.016, (now - this.lastTimestamp) / 1000) : 0.033;
    this.lastTimestamp = now;

    if (!landmarks || landmarks.length < 21) {
      this.reset();
      return {
        motion_state: 'STATIONARY',
        overall_velocity: 0,
        overall_acceleration: 0,
        active_fingers: [],
        finger_kinematics: {},
        trajectory_curvature: 0,
        motion_duration_ms: 0,
        hand_detected: false,
        wrist_position: [0, 0, 0],
        recommended_sample_rate: 5,
      };
    }

    const wrist = landmarks[0];

    // Compute joint flexion angles for all fingers
    const anglesRecord: Record<string, FingerAngles> = {};

    // 1. Thumb
    const thumbMcp = this.calculateAngle(wrist, landmarks[1], landmarks[2]);
    const thumbIp = this.calculateAngle(landmarks[1], landmarks[2], landmarks[3]);
    const thumbTip = this.calculateAngle(landmarks[2], landmarks[3], landmarks[4]);
    anglesRecord['THUMB'] = {
      mcp_deg: Math.round(thumbMcp * 10) / 10,
      pip_deg: Math.round(thumbIp * 10) / 10,
      dip_deg: Math.round(thumbTip * 10) / 10,
      extension_pct: Math.round(Math.min(100, Math.max(0, (thumbTip / 170) * 100)) * 10) / 10,
    };

    // 2. Index, Middle, Ring, Pinky
    const fingerNames = ['INDEX', 'MIDDLE', 'RING', 'PINKY'] as const;
    for (const name of fingerNames) {
      const idxs = FINGER_MAP[name];
      const mcp = this.calculateAngle(wrist, landmarks[idxs.mcp], landmarks[idxs.pip]);
      const pip = this.calculateAngle(landmarks[idxs.mcp], landmarks[idxs.pip], landmarks[idxs.dip]);
      const dip = this.calculateAngle(landmarks[idxs.pip], landmarks[idxs.dip], landmarks[idxs.tip]);
      const ext = Math.min(100, Math.max(0, ((mcp + pip + dip) / 540) * 100));
      anglesRecord[name] = {
        mcp_deg: Math.round(mcp * 10) / 10,
        pip_deg: Math.round(pip * 10) / 10,
        dip_deg: Math.round(dip * 10) / 10,
        extension_pct: Math.round(ext * 10) / 10,
      };
    }

    // Kinematic temporal analysis
    const allFingerNames = ['THUMB', 'INDEX', 'MIDDLE', 'RING', 'PINKY'];
    const fingerKinematics: Record<string, FingerKinematic> = {};
    const activeFingers: string[] = [];
    const tipVelocities: number[] = [];
    const tipAccelerations: number[] = [];
    const currentVelocities: Record<string, number> = {};

    const prevEntry = this.history.length > 0 ? this.history[this.history.length - 1] : null;

    for (const name of allFingerNames) {
      const tipIndex = name === 'THUMB' ? 4 : name === 'INDEX' ? 8 : name === 'MIDDLE' ? 12 : name === 'RING' ? 16 : 20;
      const currTip = landmarks[tipIndex];

      if (prevEntry) {
        const prevTip = prevEntry.points[tipIndex];
        const dx = currTip.x - prevTip.x;
        const dy = currTip.y - prevTip.y;
        const dz = (currTip.z || 0) - (prevTip.z || 0);
        let disp = Math.hypot(dx, dy, dz);

        // Deadband filter against sensor micro-tremor
        let vx = 0, vy = 0, vz = 0;
        if (disp < this.config.tremor_deadband) {
          disp = 0;
        } else {
          vx = dx / dt;
          vy = dy / dt;
          vz = dz / dt;
        }

        const vel = Math.hypot(vx, vy, vz);
        const prevVel = prevEntry.velocities[name] || 0;
        const accel = Math.abs(vel - prevVel) / dt;

        currentVelocities[name] = vel;
        tipVelocities.push(vel);
        tipAccelerations.push(accel);

        const isActive = vel >= this.config.motion_velocity_min;
        if (isActive) {
          activeFingers.push(name);
        }

        const dirNorm = vel > 1e-4 ? [vx / vel, vy / vel, vz / vel] : [0, 0, 0];
        fingerKinematics[name] = {
          velocity: Math.round(vel * 10000) / 10000,
          acceleration: Math.round(accel * 10000) / 10000,
          displacement: Math.round(disp * 10000) / 10000,
          angles: anglesRecord[name],
          direction: [
            Math.round(dirNorm[0] * 1000) / 1000,
            Math.round(dirNorm[1] * 1000) / 1000,
            Math.round(dirNorm[2] * 1000) / 1000,
          ],
          is_active: isActive,
        };
      } else {
        currentVelocities[name] = 0;
        fingerKinematics[name] = {
          velocity: 0,
          acceleration: 0,
          displacement: 0,
          angles: anglesRecord[name],
          direction: [0, 0, 0],
          is_active: false,
        };
        tipVelocities.push(0);
        tipAccelerations.push(0);
      }
    }

    const overallVel = tipVelocities.length ? tipVelocities.reduce((a, b) => a + b, 0) / tipVelocities.length : 0;
    const overallAccel = tipAccelerations.length ? tipAccelerations.reduce((a, b) => a + b, 0) / tipAccelerations.length : 0;

    // Trajectory curvature
    let curvature = 0;
    if (this.history.length >= 4) {
      const recentWrist = this.history.slice(-3).map((h) => h.points[0]).concat([wrist]);
      const dx1 = recentWrist[1].x - recentWrist[0].x;
      const dy1 = recentWrist[1].y - recentWrist[0].y;
      const dx2 = recentWrist[2].x - recentWrist[1].x;
      const dy2 = recentWrist[2].y - recentWrist[1].y;
      const vNorm = Math.hypot(dx2, dy2);
      if (vNorm > 1e-3) {
        const ddx = dx2 - dx1;
        const ddy = dy2 - dy1;
        const cross = Math.abs(dx2 * ddy - dy2 * ddx);
        curvature = Math.min(25, Math.round((cross / (Math.pow(vNorm, 3) + 1e-5)) * 100) / 100);
      }
    }

    // Adaptive Motion State Determination
    let durationMs = 0;
    if (overallVel >= this.config.motion_velocity_active || overallAccel >= this.config.acceleration_burst) {
      if (this.motionState !== 'ACTIVE_SIGNING') {
        this.motionStartTime = now;
      }
      this.motionState = 'ACTIVE_SIGNING';
      durationMs = now - this.motionStartTime;
    } else if (overallVel >= this.config.motion_velocity_min) {
      this.motionState = 'TRANSITIONING';
      if (this.motionStartTime > 0) {
        durationMs = now - this.motionStartTime;
      }
    } else {
      this.motionState = 'STATIONARY';
      this.motionStartTime = 0;
    }

    // Store in window buffer
    this.history.push({
      points: landmarks,
      velocities: currentVelocities,
      timestamp: now,
    });
    if (this.history.length > this.config.buffer_window_frames) {
      this.history.shift();
    }

    // Recommended sample rate for adaptive power/latency:
    // STATIONARY -> 5-8 FPS is sufficient
    // TRANSITIONING -> 15 FPS
    // ACTIVE_SIGNING -> 30 FPS (full intensity)
    const recommendedRate = this.motionState === 'ACTIVE_SIGNING' ? 30 : this.motionState === 'TRANSITIONING' ? 15 : 6;

    return {
      motion_state: this.motionState,
      overall_velocity: Math.round(overallVel * 10000) / 10000,
      overall_acceleration: Math.round(overallAccel * 10000) / 10000,
      active_fingers: activeFingers,
      finger_kinematics: fingerKinematics,
      trajectory_curvature: curvature,
      motion_duration_ms: Math.round(durationMs),
      hand_detected: true,
      wrist_position: [Math.round(wrist.x * 1000) / 1000, Math.round(wrist.y * 1000) / 1000, Math.round((wrist.z || 0) * 1000) / 1000],
      recommended_sample_rate: recommendedRate,
    };
  }
}

export const clientAFME = new ClientAFME();
