"""
Adaptive Finger Motion Engine (AFME) - Backend Module
ISL Bridge AI - Final-Year Academic Engineering Research Project

AFME operates directly on structured 3D hand landmarks (MCP, PIP, DIP, TIP)
and upper-body pose keypoints. It calculates kinematic features:
- Joint flexion angles via 3D vector dot product: θ = arccos((u · v) / (||u|| * ||v||))
- Fingertip position relative to wrist and MCP bases
- Velocity: v = Δx / Δt
- Acceleration: a = Δv / Δt
- 3D Trajectory curvature and displacement
- Deadband filtering against camera noise and micro-tremors
- Adaptive motion state determination: STATIONARY, TRANSITIONING, ACTIVE_SIGNING
"""

import math
import time
from typing import Dict, List, Any, Optional, Tuple
from collections import deque
import numpy as np

# Anatomical landmark indices for MediaPipe Hand
HAND_LANDMARKS = {
    "WRIST": 0,
    "THUMB": {"CMC": 1, "MCP": 2, "IP": 3, "TIP": 4},
    "INDEX": {"MCP": 5, "PIP": 6, "DIP": 7, "TIP": 8},
    "MIDDLE": {"MCP": 9, "PIP": 10, "DIP": 11, "TIP": 12},
    "RING": {"MCP": 13, "PIP": 14, "DIP": 15, "TIP": 16},
    "PINKY": {"MCP": 17, "PIP": 18, "DIP": 19, "TIP": 20},
}

# Centralized default motion thresholds
DEFAULT_THRESHOLDS = {
    "TREMOR_DEADBAND": 0.0035,        # Below this normalized distance, treat as sensor noise
    "MOTION_VELOCITY_MIN": 0.015,     # Threshold to transition from STATIONARY to TRANSITIONING
    "MOTION_VELOCITY_ACTIVE": 0.040,  # Threshold for ACTIVE_SIGNING
    "ACCELERATION_BURST": 0.080,      # Rapid gesture initiation threshold
    "JOINT_ANGLE_DELTA_MIN": 6.0,     # Degrees of joint angle change to register movement
    "BUFFER_WINDOW_FRAMES": 15,       # Number of temporal frames to buffer
}

class AdaptiveFingerMotionEngine:
    """
    Adaptive Finger Motion Engine (AFME)
    Processes structured 3D landmarks across consecutive frames to extract
    kinematic joint states and dynamically control inference intensity.
    """

    def __init__(self, thresholds: Optional[Dict[str, float]] = None):
        self.thresholds = dict(DEFAULT_THRESHOLDS)
        if thresholds:
            self.thresholds.update(thresholds)

        self.history = deque(maxlen=self.thresholds["BUFFER_WINDOW_FRAMES"])
        self.last_timestamp = 0.0
        self.motion_state = "STATIONARY"  # STATIONARY | TRANSITIONING | ACTIVE_SIGNING
        self.signing_duration_ms = 0.0
        self.motion_start_time = 0.0

    def reset(self):
        """Reset internal temporal buffers."""
        self.history.clear()
        self.last_timestamp = 0.0
        self.motion_state = "STATIONARY"
        self.signing_duration_ms = 0.0
        self.motion_start_time = 0.0

    @staticmethod
    def _to_numpy_point(pt: Any) -> np.ndarray:
        if isinstance(pt, dict):
            return np.array([pt.get("x", 0.0), pt.get("y", 0.0), pt.get("z", 0.0)], dtype=np.float32)
        return np.array([getattr(pt, "x", 0.0), getattr(pt, "y", 0.0), getattr(pt, "z", 0.0)], dtype=np.float32)

    @staticmethod
    def calculate_joint_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
        """
        Calculates 3D interior angle at vertex p2 formed by vectors (p1 - p2) and (p3 - p2).
        Returns angle in degrees [0.0, 180.0].
        """
        v1 = p1 - p2
        v2 = p3 - p2
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 < 1e-6 or norm2 < 1e-6:
            return 180.0
        cosine = np.dot(v1, v2) / (norm1 * norm2)
        cosine = np.clip(cosine, -1.0, 1.0)
        return float(np.degrees(np.arccos(cosine)))

    def extract_kinematics(self, raw_landmarks: List[Any], timestamp: Optional[float] = None) -> Dict[str, Any]:
        """
        Analyzes a single frame's hand landmarks relative to temporal history.
        Returns detailed kinematic telemetry, joint angles, velocities, and motion state.
        """
        now = timestamp or time.time()
        dt = (now - self.last_timestamp) if (self.last_timestamp > 0) else 0.033
        if dt <= 0:
            dt = 0.033
        self.last_timestamp = now

        if not raw_landmarks or len(raw_landmarks) < 21:
            self.reset()
            return {
                "motion_state": "STATIONARY",
                "overall_velocity": 0.0,
                "overall_acceleration": 0.0,
                "active_fingers": [],
                "finger_kinematics": {},
                "trajectory_curvature": 0.0,
                "motion_duration_ms": 0.0,
                "hand_detected": False,
            }

        # Convert landmarks to structured numpy array (21, 3)
        pts = np.array([self._to_numpy_point(p) for p in raw_landmarks[:21]], dtype=np.float32)
        wrist = pts[0]

        # Calculate joint angles for each finger
        joint_angles = {}
        for finger_name, indices in HAND_LANDMARKS.items():
            if finger_name == "WRIST":
                continue
            if finger_name == "THUMB":
                # Thumb angles: MCP angle (Wrist -> CMC -> MCP), IP angle (CMC -> MCP -> IP), Tip angle (MCP -> IP -> TIP)
                angle_mcp = self.calculate_joint_angle(wrist, pts[indices["CMC"]], pts[indices["MCP"]])
                angle_ip = self.calculate_joint_angle(pts[indices["CMC"]], pts[indices["MCP"]], pts[indices["IP"]])
                angle_tip = self.calculate_joint_angle(pts[indices["MCP"]], pts[indices["IP"]], pts[indices["TIP"]])
                joint_angles[finger_name] = {
                    "mcp_deg": round(angle_mcp, 1),
                    "ip_deg": round(angle_ip, 1),
                    "tip_deg": round(angle_tip, 1),
                    "extension_pct": round(min(100.0, max(0.0, (angle_tip / 170.0) * 100.0)), 1),
                }
            else:
                # Other fingers: MCP (Wrist -> MCP -> PIP), PIP (MCP -> PIP -> DIP), DIP (PIP -> DIP -> TIP)
                angle_mcp = self.calculate_joint_angle(wrist, pts[indices["MCP"]], pts[indices["PIP"]])
                angle_pip = self.calculate_joint_angle(pts[indices["MCP"]], pts[indices["PIP"]], pts[indices["DIP"]])
                angle_dip = self.calculate_joint_angle(pts[indices["PIP"]], pts[indices["DIP"]], pts[indices["TIP"]])
                # Flexion measure: fully extended is close to 180 degrees
                extension_score = ((angle_mcp + angle_pip + angle_dip) / 540.0) * 100.0
                joint_angles[finger_name] = {
                    "mcp_deg": round(angle_mcp, 1),
                    "pip_deg": round(angle_pip, 1),
                    "dip_deg": round(angle_dip, 1),
                    "extension_pct": round(min(100.0, max(0.0, extension_score)), 1),
                }

        # Calculate tip positions relative to wrist
        tip_indices = [4, 8, 12, 16, 20]
        tip_names = ["THUMB", "INDEX", "MIDDLE", "RING", "PINKY"]
        tip_positions = {name: pts[idx] - wrist for name, idx in zip(tip_names, tip_indices)}

        # Temporal kinematics: compare with previous frame if in history
        finger_kinematics = {}
        active_fingers = []
        tip_velocities = []
        tip_accelerations = []

        if len(self.history) > 0:
            prev_entry = self.history[-1]
            prev_pts = prev_entry["pts"]
            prev_vels = prev_entry.get("tip_velocities", {})

            for name, idx in zip(tip_names, tip_indices):
                curr_tip = pts[idx]
                prev_tip = prev_pts[idx]
                disp = curr_tip - prev_tip
                disp_norm = float(np.linalg.norm(disp))

                # Apply tremor deadband filter
                if disp_norm < self.thresholds["TREMOR_DEADBAND"]:
                    disp_norm = 0.0
                    vel_vec = np.zeros(3, dtype=np.float32)
                else:
                    vel_vec = disp / dt

                vel_mag = float(np.linalg.norm(vel_vec))
                prev_vel_mag = prev_vels.get(name, 0.0)
                accel = abs(vel_mag - prev_vel_mag) / dt

                tip_velocities.append(vel_mag)
                tip_accelerations.append(accel)

                is_active = vel_mag >= self.thresholds["MOTION_VELOCITY_MIN"]
                if is_active:
                    active_fingers.append(name)

                finger_kinematics[name] = {
                    "velocity": round(vel_mag, 4),
                    "acceleration": round(accel, 4),
                    "displacement": round(disp_norm, 4),
                    "angles": joint_angles.get(name, {}),
                    "direction": [round(float(v), 3) for v in (vel_vec / (vel_mag + 1e-6)).tolist()],
                    "is_active": is_active,
                }
        else:
            for name in tip_names:
                finger_kinematics[name] = {
                    "velocity": 0.0,
                    "acceleration": 0.0,
                    "displacement": 0.0,
                    "angles": joint_angles.get(name, {}),
                    "direction": [0.0, 0.0, 0.0],
                    "is_active": False,
                }
                tip_velocities.append(0.0)
                tip_accelerations.append(0.0)

        overall_velocity = float(np.mean(tip_velocities)) if tip_velocities else 0.0
        overall_acceleration = float(np.mean(tip_accelerations)) if tip_accelerations else 0.0

        # Trajectory curvature calculation across window (discrete Frenet-Serret curvature approximation)
        curvature = 0.0
        if len(self.history) >= 4:
            wrist_traj = [h["pts"][0] for h in self.history] + [wrist]
            diffs1 = np.diff(wrist_traj, axis=0)  # 1st derivative (velocity)
            diffs2 = np.diff(diffs1, axis=0)      # 2nd derivative (acceleration)
            if len(diffs1) > 1 and len(diffs2) > 0:
                v_vec = diffs1[-1]
                a_vec = diffs2[-1]
                v_norm = np.linalg.norm(v_vec)
                if v_norm > 1e-4:
                    cross_norm = np.linalg.norm(np.cross(v_vec, a_vec))
                    curvature = float(cross_norm / (v_norm ** 3 + 1e-6))
                    curvature = round(min(curvature, 25.0), 3)

        # Adaptive Motion State Machine
        if overall_velocity >= self.thresholds["MOTION_VELOCITY_ACTIVE"] or overall_acceleration >= self.thresholds["ACCELERATION_BURST"]:
            if self.motion_state != "ACTIVE_SIGNING":
                self.motion_start_time = now
            self.motion_state = "ACTIVE_SIGNING"
            self.signing_duration_ms = (now - self.motion_start_time) * 1000.0
        elif overall_velocity >= self.thresholds["MOTION_VELOCITY_MIN"]:
            self.motion_state = "TRANSITIONING"
            if self.motion_start_time > 0:
                self.signing_duration_ms = (now - self.motion_start_time) * 1000.0
        else:
            self.motion_state = "STATIONARY"
            self.signing_duration_ms = 0.0
            self.motion_start_time = 0.0

        # Store to temporal window
        curr_entry = {
            "pts": pts,
            "tip_velocities": {name: finger_kinematics[name]["velocity"] for name in tip_names},
            "timestamp": now,
        }
        self.history.append(curr_entry)

        return {
            "motion_state": self.motion_state,
            "overall_velocity": round(overall_velocity, 4),
            "overall_acceleration": round(overall_acceleration, 4),
            "active_fingers": active_fingers,
            "finger_kinematics": finger_kinematics,
            "trajectory_curvature": curvature,
            "motion_duration_ms": round(self.signing_duration_ms, 1),
            "hand_detected": True,
            "wrist_position": [round(float(w), 3) for w in wrist.tolist()],
        }

afme_engine = AdaptiveFingerMotionEngine()
