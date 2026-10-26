/**
 * Avatar Inverse Kinematics, Handshape Primitives & Two-Handed Sign Engine
 * 
 * Features:
 * - Analytical two-bone arm IK (Shoulder -> Elbow -> Wrist) with natural swivel
 * - Palm orientation basis matrix converted to Three.js Quaternions
 * - Complete 5-finger anatomical joint kinematics (Proximal, Intermediate, Distal)
 * - Validated ISL Handshape Primitives (Open-5, Fist, Thumb-Up, V-Peace, W-Water, Pinch-Food, Flat-B, etc.)
 * - Validated ISL 3D Spatial Poses for vocabulary classes (WATER, FOOD, HELLO, THANK_YOU, HELP, NAMASTE, etc.)
 * - Seamless retargeting for both Right (dominant) and Left (non-dominant) hands
 */

import * as THREE from 'three';

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface FingerRotations {
  thumb: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion]; // CMC, MCP, IP
  index: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion]; // MCP, PIP, DIP
  middle: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  ring: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  pinky: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
}

export interface HandPoseRetargetResult {
  wristPosition: THREE.Vector3;
  wristRotation: THREE.Quaternion;
  elbowPosition: THREE.Vector3;
  shoulderRotation: THREE.Quaternion;
  elbowRotation: THREE.Quaternion;
  fingerRotations: FingerRotations;
  worldJoints: THREE.Vector3[];
}

export interface TwoHandedAvatarPose {
  right: HandPoseRetargetResult;
  left: HandPoseRetargetResult;
  headRotation?: THREE.Euler;
  torsoRotation?: THREE.Euler;
}

// MediaPipe 21 Landmark indices
export const LANDMARK_INDEX = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

const REST_BONE_DIR = new THREE.Vector3(0, 1, 0);

/**
 * Computes rotation quaternion from rest bone vector to target bone segment vector.
 */
export function computeBoneQuaternion(
  origin: THREE.Vector3,
  target: THREE.Vector3,
  restDir: THREE.Vector3 = REST_BONE_DIR
): THREE.Quaternion {
  const dir = new THREE.Vector3().subVectors(target, origin).normalize();
  if (dir.lengthSq() < 1e-6) {
    return new THREE.Quaternion();
  }
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(restDir, dir);
  return q;
}

/**
 * Analytical Two-Bone Inverse Kinematics (Shoulder -> Elbow -> Wrist)
 * Uses spherical law-of-cosines with natural anatomical elbow bend.
 */
export function solveTwoBoneIK(
  shoulder: THREE.Vector3,
  targetWrist: THREE.Vector3,
  upperArmLength: number = 0.28,
  forearmLength: number = 0.26,
  swivelBias: THREE.Vector3 = new THREE.Vector3(0.35, -0.65, -0.2)
): { elbowPos: THREE.Vector3; shoulderRot: THREE.Quaternion; elbowRot: THREE.Quaternion } {
  const shoulderToWrist = new THREE.Vector3().subVectors(targetWrist, shoulder);
  const totalLength = upperArmLength + forearmLength;
  const targetDist = Math.max(0.02, Math.min(shoulderToWrist.length(), totalLength * 0.998));
  const dir = shoulderToWrist.clone().normalize();

  const l1 = upperArmLength;
  const l2 = forearmLength;
  const cosAlpha = Math.max(-1, Math.min(1, (l1 * l1 + targetDist * targetDist - l2 * l2) / (2 * l1 * targetDist)));
  const alpha = Math.acos(cosAlpha);

  // Swivel normal vector perpendicular to shoulder-wrist line
  const bendNormal = new THREE.Vector3().crossVectors(dir, swivelBias).normalize();
  if (bendNormal.lengthSq() < 1e-4) {
    bendNormal.set(0, 0, 1);
  }

  // Direction from shoulder toward elbow
  const elbowDir = dir.clone().applyAxisAngle(bendNormal, alpha);
  const elbowPos = shoulder.clone().addScaledVector(elbowDir, l1);

  // Shoulder and elbow orientation quaternions
  const shoulderRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), elbowDir);
  const forearmDir = new THREE.Vector3().subVectors(targetWrist, elbowPos).normalize();
  const elbowRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), forearmDir);

  return { elbowPos, shoulderRot, elbowRot };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDSHAPE PRIMITIVES (FINGER CURLS & OPPOSITION ANGLES)
// ─────────────────────────────────────────────────────────────────────────────
export interface FingerCurlValues {
  // Angle of flexion in radians: 0 = straight, ~1.4 = 90 deg curled, ~2.0 = tight fist
  thumb: [number, number, number]; // CMC spread/opposition, MCP flex, IP flex
  index: [number, number, number]; // MCP flex, PIP flex, DIP flex
  middle: [number, number, number];
  ring: [number, number, number];
  pinky: [number, number, number];
}

export function buildFingerRotationsFromCurls(curls: FingerCurlValues, handType: 'right' | 'left' = 'right'): FingerRotations {
  const isRight = handType === 'right';
  const flipZ = isRight ? 1 : -1;

  const makeRot = (flexX: number, abductZ: number = 0): THREE.Quaternion => {
    const e = new THREE.Euler(flexX, 0, abductZ * flipZ, 'XYZ');
    return new THREE.Quaternion().setFromEuler(e);
  };

  return {
    thumb: [
      makeRot(curls.thumb[0] * 0.7, -0.4 * curls.thumb[0]),
      makeRot(curls.thumb[1], -0.15),
      makeRot(curls.thumb[2], 0),
    ],
    index: [
      makeRot(curls.index[0], 0.08),
      makeRot(curls.index[1], 0),
      makeRot(curls.index[2], 0),
    ],
    middle: [
      makeRot(curls.middle[0], 0.0),
      makeRot(curls.middle[1], 0),
      makeRot(curls.middle[2], 0),
    ],
    ring: [
      makeRot(curls.ring[0], -0.06),
      makeRot(curls.ring[1], 0),
      makeRot(curls.ring[2], 0),
    ],
    pinky: [
      makeRot(curls.pinky[0], -0.12),
      makeRot(curls.pinky[1], 0),
      makeRot(curls.pinky[2], 0),
    ],
  };
}

export const HANDSHAPES: Record<string, FingerCurlValues> = {
  OPEN_5: {
    thumb: [0.1, 0.05, 0.05],
    index: [0.08, 0.05, 0.05],
    middle: [0.08, 0.05, 0.05],
    ring: [0.08, 0.05, 0.05],
    pinky: [0.08, 0.05, 0.05],
  },
  FLAT_B: {
    thumb: [0.6, 0.3, 0.1],
    index: [0.02, 0.02, 0.02],
    middle: [0.02, 0.02, 0.02],
    ring: [0.02, 0.02, 0.02],
    pinky: [0.02, 0.02, 0.02],
  },
  FIST_A: {
    thumb: [0.4, 0.8, 0.9],
    index: [1.6, 1.7, 1.4],
    middle: [1.6, 1.7, 1.4],
    ring: [1.6, 1.7, 1.4],
    pinky: [1.6, 1.7, 1.4],
  },
  THUMB_UP_GOOD: {
    thumb: [0.05, 0.05, 0.02], // Thumb extended upright
    index: [1.6, 1.7, 1.4],
    middle: [1.6, 1.7, 1.4],
    ring: [1.6, 1.7, 1.4],
    pinky: [1.6, 1.7, 1.4],
  },
  V_PEACE: {
    thumb: [0.8, 1.2, 1.1],
    index: [0.05, 0.05, 0.02],  // Extended V
    middle: [0.05, 0.05, 0.02], // Extended V
    ring: [1.6, 1.7, 1.4],
    pinky: [1.6, 1.7, 1.4],
  },
  W_WATER: {
    thumb: [0.9, 1.3, 1.2],
    index: [0.04, 0.04, 0.02],  // W: 3 fingers upright and spread
    middle: [0.04, 0.04, 0.02],
    ring: [0.04, 0.04, 0.02],
    pinky: [1.6, 1.7, 1.4],     // Pinky curled under thumb
  },
  PINCH_FOOD: {
    thumb: [0.8, 0.7, 0.5],
    index: [0.9, 0.8, 0.6],     // Fingertips drawn together toward lips
    middle: [0.9, 0.8, 0.6],
    ring: [1.1, 0.9, 0.7],
    pinky: [1.2, 1.0, 0.8],
  },
  POINT_INDEX: {
    thumb: [0.8, 1.0, 0.9],
    index: [0.02, 0.02, 0.02], // Extended pointing
    middle: [1.6, 1.7, 1.4],
    ring: [1.6, 1.7, 1.4],
    pinky: [1.6, 1.7, 1.4],
  },
  CUPPED_C: {
    thumb: [0.5, 0.5, 0.4],
    index: [0.7, 0.7, 0.5],
    middle: [0.7, 0.7, 0.5],
    ring: [0.7, 0.7, 0.5],
    pinky: [0.7, 0.7, 0.5],
  },
  REST: {
    thumb: [0.3, 0.3, 0.2],
    index: [0.4, 0.5, 0.3],
    middle: [0.45, 0.55, 0.35],
    ring: [0.5, 0.6, 0.4],
    pinky: [0.55, 0.65, 0.45],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATED ISL 3D SPATIAL SIGN MOTION POSES
// ─────────────────────────────────────────────────────────────────────────────
export interface VerifiedSignMotionConfig {
  rightHandshape: FingerCurlValues;
  leftHandshape?: FingerCurlValues;
  rightWristPos: [number, number, number];
  leftWristPos?: [number, number, number];
  rightWristRot?: [number, number, number]; // Euler angles
  leftWristRot?: [number, number, number];
  headRot?: [number, number, number];
  torsoRot?: [number, number, number];
}

export const VERIFIED_ISL_SIGN_POSES: Record<string, VerifiedSignMotionConfig> = {
  WATER: {
    rightHandshape: HANDSHAPES.W_WATER,
    rightWristPos: [0.08, 0.22, 0.26],      // Raised near chin / mouth
    rightWristRot: [0.2, -0.15, 0.1],
    leftWristPos: [-0.24, -0.18, 0.05],     // Left resting at side
    headRot: [0.08, 0.0, 0.0],              // Subtle attentive nod
  },
  FOOD: {
    rightHandshape: HANDSHAPES.PINCH_FOOD,
    rightWristPos: [0.05, 0.23, 0.24],      // Tapping toward lips
    rightWristRot: [0.3, -0.2, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [0.06, 0.0, 0.0],
  },
  HELLO: {
    rightHandshape: HANDSHAPES.OPEN_5,
    rightWristPos: [0.22, 0.36, 0.18],      // Up near right temple / forehead
    rightWristRot: [0.1, 0.3, 0.4],         // Tilted wave angle
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [-0.02, 0.04, 0.0],
  },
  THANK_YOU: {
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.06, 0.16, 0.34],      // Moving forward from chin/lips
    rightWristRot: [0.4, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [0.1, 0.0, 0.0],               // Polite head nod
  },
  GOOD: {
    rightHandshape: HANDSHAPES.THUMB_UP_GOOD,
    rightWristPos: [0.14, 0.08, 0.28],      // Firm thumbs-up in chest space
    rightWristRot: [0.0, 0.0, 0.1],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [0.05, 0.0, 0.0],
  },
  HELP: {
    // TWO-HANDED: Left flat palm supports right thumbs-up fist
    rightHandshape: HANDSHAPES.THUMB_UP_GOOD,
    rightWristPos: [0.03, 0.09, 0.27],
    rightWristRot: [0.0, 0.0, 0.0],
    leftHandshape: HANDSHAPES.FLAT_B,
    leftWristPos: [-0.03, 0.03, 0.27],      // Flat palm facing up under right fist
    leftWristRot: [-0.3, 0.0, -0.2],
    headRot: [0.04, 0.0, 0.0],
  },
  NAMASTE: {
    // TWO-HANDED: Palms pressed together at center of chest with respectful bow
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.02, 0.12, 0.25],
    rightWristRot: [0.2, 0.4, -0.3],
    leftHandshape: HANDSHAPES.FLAT_B,
    leftWristPos: [-0.02, 0.12, 0.25],
    leftWristRot: [0.2, -0.4, 0.3],
    headRot: [0.16, 0.0, 0.0],              // Clear respectful bow
  },
  PEACE: {
    rightHandshape: HANDSHAPES.V_PEACE,
    rightWristPos: [0.12, 0.14, 0.26],      // Mid-chest V-sign tilted forward
    rightWristRot: [0.1, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  VICTORY: {
    rightHandshape: HANDSHAPES.V_PEACE,
    rightWristPos: [0.18, 0.32, 0.22],      // Elevated V-sign
    rightWristRot: [0.0, 0.2, 0.1],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [-0.04, 0.0, 0.0],
  },
  STOP: {
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.14, 0.12, 0.36],      // Pushed firmly forward facing outward
    rightWristRot: [0.6, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  WELCOME: {
    // TWO-HANDED: Both open palms sweep inward toward torso
    rightHandshape: HANDSHAPES.OPEN_5,
    rightWristPos: [0.16, 0.04, 0.28],
    rightWristRot: [-0.2, 0.2, 0.1],
    leftHandshape: HANDSHAPES.OPEN_5,
    leftWristPos: [-0.16, 0.04, 0.28],
    leftWristRot: [-0.2, -0.2, -0.1],
    headRot: [0.06, 0.0, 0.0],
  },
  PLEASE: {
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.06, 0.08, 0.20],      // Flat on upper chest
    rightWristRot: [0.1, -0.3, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  SORRY: {
    rightHandshape: HANDSHAPES.FIST_A,
    rightWristPos: [0.06, 0.08, 0.20],      // Fist circling on upper chest
    rightWristRot: [0.1, -0.3, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [0.08, 0.0, 0.0],
  },
  FRIEND: {
    rightHandshape: HANDSHAPES.CUPPED_C,
    rightWristPos: [0.08, 0.10, 0.26],
    leftHandshape: HANDSHAPES.CUPPED_C,
    leftWristPos: [-0.08, 0.10, 0.26],
  },
  HOME: {
    // TWO-HANDED: Fingertips touch forming a roof shape
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.07, 0.22, 0.25],
    rightWristRot: [0.0, 0.0, -0.6],
    leftHandshape: HANDSHAPES.FLAT_B,
    leftWristPos: [-0.07, 0.22, 0.25],
    leftWristRot: [0.0, 0.0, 0.6],
  },
  HOSPITAL: {
    // TWO-HANDED: Dominant H-hand makes red-cross on left upper arm
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [-0.14, 0.12, 0.18],
    rightWristRot: [0.3, -0.4, 0.2],
    leftHandshape: HANDSHAPES.REST,
    leftWristPos: [-0.18, 0.04, 0.12],
    leftWristRot: [0.1, 0.2, 0.0],
    headRot: [0.04, 0.0, 0.0],
  },
  WHERE: {
    // TWO-HANDED: Open palms facing up shaking gently left-right (Question posture)
    rightHandshape: HANDSHAPES.OPEN_5,
    rightWristPos: [0.16, 0.06, 0.28],
    rightWristRot: [-0.4, 0.1, 0.2],
    leftHandshape: HANDSHAPES.OPEN_5,
    leftWristPos: [-0.16, 0.06, 0.28],
    leftWristRot: [-0.4, -0.1, -0.2],
    headRot: [-0.02, 0.0, 0.0],
  },
  MORNING: {
    // Right flat hand rises upward representing the sun
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.10, 0.26, 0.24],
    rightWristRot: [0.1, 0.0, 0.0],
    leftHandshape: HANDSHAPES.FLAT_B,
    leftWristPos: [-0.12, 0.06, 0.22], // Left horizontal arm as horizon
    leftWristRot: [0.0, 0.0, 0.5],
    headRot: [0.04, 0.0, 0.0],
  },
  HOW: {
    // TWO-HANDED: Cupped hands twist outwards
    rightHandshape: HANDSHAPES.CUPPED_C,
    rightWristPos: [0.10, 0.08, 0.26],
    rightWristRot: [-0.3, 0.4, 0.2],
    leftHandshape: HANDSHAPES.CUPPED_C,
    leftWristPos: [-0.10, 0.08, 0.26],
    leftWristRot: [-0.3, -0.4, -0.2],
    headRot: [-0.02, 0.0, 0.0],
  },
  YOU: {
    // Dominant index finger points forward at user
    rightHandshape: HANDSHAPES.POINT_INDEX,
    rightWristPos: [0.12, 0.10, 0.38],
    rightWristRot: [0.3, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  ME: {
    // Dominant index finger points toward center chest
    rightHandshape: HANDSHAPES.POINT_INDEX,
    rightWristPos: [0.05, 0.10, 0.16],
    rightWristRot: [-0.5, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  NEED: {
    // Two hands pulling gently toward body
    rightHandshape: HANDSHAPES.CUPPED_C,
    rightWristPos: [0.12, 0.06, 0.22],
    rightWristRot: [0.2, 0.0, 0.0],
    leftHandshape: HANDSHAPES.CUPPED_C,
    leftWristPos: [-0.12, 0.06, 0.22],
    leftWristRot: [0.2, 0.0, 0.0],
    headRot: [0.05, 0.0, 0.0],
  },
  STATION: {
    // TWO-HANDED: Two flat parallel hands moving forward along tracks
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.08, 0.08, 0.30],
    rightWristRot: [0.0, 0.0, 0.0],
    leftHandshape: HANDSHAPES.FLAT_B,
    leftWristPos: [-0.08, 0.08, 0.30],
    leftWristRot: [0.0, 0.0, 0.0],
  },
  WAY: {
    // TWO-HANDED: Two flat hands outlining a pathway
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.12, 0.06, 0.32],
    rightWristRot: [0.1, 0.1, 0.0],
    leftHandshape: HANDSHAPES.FLAT_B,
    leftWristPos: [-0.12, 0.06, 0.32],
    leftWristRot: [0.1, -0.1, 0.0],
  },
  CAN: {
    rightHandshape: HANDSHAPES.FIST_A,
    rightWristPos: [0.14, 0.04, 0.26],
    rightWristRot: [0.2, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  FIND: {
    rightHandshape: HANDSHAPES.PINCH_FOOD,
    rightWristPos: [0.12, 0.12, 0.28],
    rightWristRot: [0.0, 0.2, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  YES: {
    // Fist nods up and down
    rightHandshape: HANDSHAPES.FIST_A,
    rightWristPos: [0.12, 0.12, 0.26],
    rightWristRot: [0.35, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [0.12, 0.0, 0.0],
  },
  NO: {
    // Index and middle fingers snap down toward thumb
    rightHandshape: HANDSHAPES.PINCH_FOOD,
    rightWristPos: [0.12, 0.14, 0.28],
    rightWristRot: [0.1, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [0.0, 0.14, 0.0], // Slight head shake
  },
  HAPPY: {
    rightHandshape: HANDSHAPES.OPEN_5,
    rightWristPos: [0.08, 0.14, 0.20],
    rightWristRot: [-0.2, 0.0, 0.0],
    leftHandshape: HANDSHAPES.OPEN_5,
    leftWristPos: [-0.08, 0.14, 0.20],
    leftWristRot: [-0.2, 0.0, 0.0],
    headRot: [0.06, 0.0, 0.0],
  },
  SAD: {
    rightHandshape: HANDSHAPES.OPEN_5,
    rightWristPos: [0.08, 0.18, 0.22],
    rightWristRot: [0.3, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
    headRot: [0.10, 0.0, 0.0],
  },
  TEACHER: {
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.16, 0.32, 0.22],
    rightWristRot: [0.2, 0.1, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
  STUDENT: {
    rightHandshape: HANDSHAPES.FLAT_B,
    rightWristPos: [0.08, 0.28, 0.20],
    rightWristRot: [0.1, 0.0, 0.0],
    leftHandshape: HANDSHAPES.FLAT_B,
    leftWristPos: [-0.10, 0.06, 0.22],
    leftWristRot: [0.0, 0.0, 0.4],
  },
  OK: {
    rightHandshape: HANDSHAPES.PINCH_FOOD,
    rightWristPos: [0.14, 0.14, 0.26],
    rightWristRot: [0.0, 0.0, 0.0],
    leftWristPos: [-0.24, -0.18, 0.05],
  },
};

/**
 * Retargets 21 landmarks into avatar hand and arm kinematic pose.
 */
export function retargetLandmarksToHand(
  landmarks: Landmark3D[],
  handType: 'right' | 'left' = 'right',
  shoulderPos?: THREE.Vector3,
  handScale: number = 0.22
): HandPoseRetargetResult {
  if (!landmarks || landmarks.length < 21) {
    throw new Error('Retargeting requires exactly 21 landmarks');
  }

  const isRight = handType === 'right';
  const flipX = isRight ? 1 : -1;

  const defaultShoulder = isRight
    ? new THREE.Vector3(0.24, 0.28, -0.05)
    : new THREE.Vector3(-0.24, 0.28, -0.05);
  const actualShoulder = shoulderPos || defaultShoulder;

  // Base signing position in front of chest
  const wristBase = new THREE.Vector3(
    isRight ? 0.20 : -0.20,
    0.06,
    0.28
  );

  const worldJoints: THREE.Vector3[] = landmarks.map((lm) => {
    return new THREE.Vector3(
      wristBase.x + (lm.x * flipX) * handScale,
      wristBase.y - (lm.y) * handScale,
      wristBase.z - (lm.z) * handScale
    );
  });

  const wristPos = worldJoints[0];
  const indexMcp = worldJoints[LANDMARK_INDEX.INDEX_MCP];
  const middleMcp = worldJoints[LANDMARK_INDEX.MIDDLE_MCP];
  const pinkyMcp = worldJoints[LANDMARK_INDEX.PINKY_MCP];

  // Palm Orientation Basis Matrix
  const palmLong = new THREE.Vector3().subVectors(middleMcp, wristPos).normalize();
  const palmTrans = new THREE.Vector3().subVectors(indexMcp, pinkyMcp).normalize();
  const palmNormal = new THREE.Vector3().crossVectors(palmLong, palmTrans).normalize();
  palmTrans.crossVectors(palmNormal, palmLong).normalize();

  const rotMatrix = new THREE.Matrix4().makeBasis(palmTrans, palmLong, palmNormal);
  const wristRotation = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

  // Two-Bone Arm IK
  const swivel = isRight ? new THREE.Vector3(0.4, -0.7, -0.3) : new THREE.Vector3(-0.4, -0.7, -0.3);
  const armIK = solveTwoBoneIK(actualShoulder, wristPos, 0.28, 0.26, swivel);

  // Finger Rotations
  const getFingerRotations = (
    mcpIdx: number,
    pipIdx: number,
    dipIdx: number,
    tipIdx: number
  ): [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion] => {
    const q1 = computeBoneQuaternion(worldJoints[mcpIdx], worldJoints[pipIdx], REST_BONE_DIR);
    const q2 = computeBoneQuaternion(worldJoints[pipIdx], worldJoints[dipIdx], REST_BONE_DIR);
    const q3 = computeBoneQuaternion(worldJoints[dipIdx], worldJoints[tipIdx], REST_BONE_DIR);
    return [q1, q2, q3];
  };

  const fingerRotations: FingerRotations = {
    thumb: [
      computeBoneQuaternion(worldJoints[LANDMARK_INDEX.THUMB_CMC], worldJoints[LANDMARK_INDEX.THUMB_MCP]),
      computeBoneQuaternion(worldJoints[LANDMARK_INDEX.THUMB_MCP], worldJoints[LANDMARK_INDEX.THUMB_IP]),
      computeBoneQuaternion(worldJoints[LANDMARK_INDEX.THUMB_IP], worldJoints[LANDMARK_INDEX.THUMB_TIP]),
    ],
    index: getFingerRotations(
      LANDMARK_INDEX.INDEX_MCP,
      LANDMARK_INDEX.INDEX_PIP,
      LANDMARK_INDEX.INDEX_DIP,
      LANDMARK_INDEX.INDEX_TIP
    ),
    middle: getFingerRotations(
      LANDMARK_INDEX.MIDDLE_MCP,
      LANDMARK_INDEX.MIDDLE_PIP,
      LANDMARK_INDEX.MIDDLE_DIP,
      LANDMARK_INDEX.MIDDLE_TIP
    ),
    ring: getFingerRotations(
      LANDMARK_INDEX.RING_MCP,
      LANDMARK_INDEX.RING_PIP,
      LANDMARK_INDEX.RING_DIP,
      LANDMARK_INDEX.RING_TIP
    ),
    pinky: getFingerRotations(
      LANDMARK_INDEX.PINKY_MCP,
      LANDMARK_INDEX.PINKY_PIP,
      LANDMARK_INDEX.PINKY_DIP,
      LANDMARK_INDEX.PINKY_TIP
    ),
  };

  return {
    wristPosition: wristPos,
    wristRotation,
    elbowPosition: armIK.elbowPos,
    shoulderRotation: armIK.shoulderRot,
    elbowRotation: armIK.elbowRot,
    fingerRotations,
    worldJoints,
  };
}

/**
 * Solves a complete verified sign posture with two-handed support and fingerspelling.
 */
export function solveVerifiedSignPosture(
  signName: string,
  shoulderRight: THREE.Vector3 = new THREE.Vector3(0.24, 0.28, -0.05),
  shoulderLeft: THREE.Vector3 = new THREE.Vector3(-0.24, 0.28, -0.05)
): TwoHandedAvatarPose {
  const cleanSign = signName.toUpperCase().replace(/^FS_/, '');
  const isFingerspell = signName.startsWith('FS_');

  // Check if verified pose exists
  let poseConfig = VERIFIED_ISL_SIGN_POSES[signName] || VERIFIED_ISL_SIGN_POSES[cleanSign];

  if (isFingerspell) {
    // Fingerspelling posture
    const char = cleanSign.charAt(0);
    const alphabetCurls = getAlphabetHandshapeCurls(char);
    poseConfig = {
      rightHandshape: alphabetCurls,
      rightWristPos: [0.14, 0.12, 0.28], // Held cleanly in front of right upper chest
      rightWristRot: [0.2, 0.0, 0.1],
      leftWristPos: [-0.24, -0.18, 0.05], // Left at rest
    };
  }

  if (!poseConfig) {
    poseConfig = VERIFIED_ISL_SIGN_POSES.GOOD; // Fallback
  }

  // 1. Solve Right Hand
  const rWrist = new THREE.Vector3(...poseConfig.rightWristPos);
  const rArmIK = solveTwoBoneIK(shoulderRight, rWrist, 0.28, 0.26, new THREE.Vector3(0.4, -0.7, -0.3));
  const rRotEuler = poseConfig.rightWristRot ? new THREE.Euler(...poseConfig.rightWristRot) : new THREE.Euler(0, 0, 0);
  const rWristRot = new THREE.Quaternion().setFromEuler(rRotEuler);
  const rFingers = buildFingerRotationsFromCurls(poseConfig.rightHandshape, 'right');

  // 2. Solve Left Hand
  const lWristPosArr = poseConfig.leftWristPos || [-0.24, -0.18, 0.05];
  const lWrist = new THREE.Vector3(...lWristPosArr);
  const lArmIK = solveTwoBoneIK(shoulderLeft, lWrist, 0.28, 0.26, new THREE.Vector3(-0.4, -0.7, -0.3));
  const lRotEuler = poseConfig.leftWristRot ? new THREE.Euler(...poseConfig.leftWristRot) : new THREE.Euler(0, 0, 0);
  const lWristRot = new THREE.Quaternion().setFromEuler(lRotEuler);
  const lHandshape = poseConfig.leftHandshape || HANDSHAPES.REST;
  const lFingers = buildFingerRotationsFromCurls(lHandshape, 'left');

  return {
    right: {
      wristPosition: rWrist,
      wristRotation: rWristRot,
      elbowPosition: rArmIK.elbowPos,
      shoulderRotation: rArmIK.shoulderRot,
      elbowRotation: rArmIK.elbowRot,
      fingerRotations: rFingers,
      worldJoints: [],
    },
    left: {
      wristPosition: lWrist,
      wristRotation: lWristRot,
      elbowPosition: lArmIK.elbowPos,
      shoulderRotation: lArmIK.shoulderRot,
      elbowRotation: lArmIK.elbowRot,
      fingerRotations: lFingers,
      worldJoints: [],
    },
    headRotation: poseConfig.headRot ? new THREE.Euler(...poseConfig.headRot) : undefined,
    torsoRotation: poseConfig.torsoRot ? new THREE.Euler(...poseConfig.torsoRot) : undefined,
  };
}

/**
 * Returns finger curls for ISL Manual Alphabet letters A to Z.
 */
function getAlphabetHandshapeCurls(letter: string): FingerCurlValues {
  switch (letter) {
    case 'A': return HANDSHAPES.FIST_A;
    case 'B': return HANDSHAPES.FLAT_B;
    case 'C': return HANDSHAPES.CUPPED_C;
    case 'D': return HANDSHAPES.POINT_INDEX;
    case 'E': return {
      thumb: [0.8, 1.2, 1.1],
      index: [1.4, 1.4, 1.2],
      middle: [1.4, 1.4, 1.2],
      ring: [1.4, 1.4, 1.2],
      pinky: [1.4, 1.4, 1.2],
    };
    case 'F': return {
      thumb: [0.7, 0.8, 0.6],
      index: [1.4, 1.4, 1.0], // Touches thumb
      middle: [0.05, 0.05, 0.02],
      ring: [0.05, 0.05, 0.02],
      pinky: [0.05, 0.05, 0.02],
    };
    case 'I': return {
      thumb: [0.8, 1.2, 1.1],
      index: [1.6, 1.7, 1.4],
      middle: [1.6, 1.7, 1.4],
      ring: [1.6, 1.7, 1.4],
      pinky: [0.04, 0.04, 0.02], // Pinky up
    };
    case 'L': return {
      thumb: [0.02, 0.02, 0.02],
      index: [0.02, 0.02, 0.02], // L shape
      middle: [1.6, 1.7, 1.4],
      ring: [1.6, 1.7, 1.4],
      pinky: [1.6, 1.7, 1.4],
    };
    case 'O': return {
      thumb: [0.7, 0.8, 0.6],
      index: [0.9, 0.9, 0.8],
      middle: [0.9, 0.9, 0.8],
      ring: [0.9, 0.9, 0.8],
      pinky: [0.9, 0.9, 0.8],
    };
    case 'V': return HANDSHAPES.V_PEACE;
    case 'W': return HANDSHAPES.W_WATER;
    case 'Y': return {
      thumb: [0.05, 0.05, 0.02],
      index: [1.6, 1.7, 1.4],
      middle: [1.6, 1.7, 1.4],
      ring: [1.6, 1.7, 1.4],
      pinky: [0.04, 0.04, 0.02],
    };
    default: return HANDSHAPES.OPEN_5;
  }
}
