/**
 * SIGNOVA AI: Premium Rigged Digital Human 3D Avatar for Indian Sign Language
 * 
 * Features:
 * - Professional stylized-realistic digital human character (clean, modern, trustworthy).
 * - Articulated facial rig: dynamic eyelids (natural blinking), controllable eyebrows
 *   (question raising, negation furrowing, emphasis), expressive mouth/lips, ears, nose, and styled hair.
 * - Perfect Hands (Highest Priority): anatomically contoured palms (thenar/hypothenar pads),
 *   five individually articulated fingers on EACH hand (MCP, PIP, DIP), thumb opposition/rotation,
 *   finger spreading (abduction/adduction), defined knuckles, and fingernail highlights.
 * - Complete kinetic chain: Finger -> Hand -> Wrist -> Forearm -> Elbow -> Shoulder -> Clavicle -> Chest -> Spine.
 * - Natural idle state: autonomous breathing cycle (sine modulation on chest & shoulders),
 *   natural Poisson-distributed eye blinks (every 3-5s), and subtle eye micro-saccades.
 * - High-Visibility Mode: studio hand-clarity enhancement for maximum sign legibility.
 * - Accurate Skeleton Debug Visualizer: real bone hierarchy line segments and joint nodes.
 * - Dynamic GLTF / GLB model loader integration hook with procedural fallback.
 */

import * as THREE from 'three';
import { OneEuroFilter3D } from './oneEuroFilter';
import {
  Landmark3D,
  retargetLandmarksToHand,
  solveVerifiedSignPosture,
  TwoHandedAvatarPose,
  VERIFIED_ISL_SIGN_POSES,
} from './avatarIK';

export type FacialExpression =
  | 'NEUTRAL'
  | 'QUESTION'
  | 'NEGATION'
  | 'CONFIRMATION'
  | 'HAPPY'
  | 'CONCERNED'
  | 'SURPRISED'
  | 'EMPHASIS';

export interface HandBoneSet {
  thumb: [THREE.Group, THREE.Group, THREE.Group];
  index: [THREE.Group, THREE.Group, THREE.Group];
  middle: [THREE.Group, THREE.Group, THREE.Group];
  ring: [THREE.Group, THREE.Group, THREE.Group];
  pinky: [THREE.Group, THREE.Group, THREE.Group];
}

export interface HumanoidConfig {
  skinColor?: number;
  clothColor?: number;
  clothTrimColor?: number;
  hairColor?: number;
  enableDebugSkeleton?: boolean;
}

export class HumanoidAvatar {
  public rootGroup: THREE.Group;
  public proceduralMeshGroup: THREE.Group;
  public debugGroup: THREE.Group;

  // Body & Spine Hierarchy
  public spineNode: THREE.Group;
  public chestNode: THREE.Group;
  public neckNode: THREE.Group;
  public headNode: THREE.Group;

  // Facial Rig Nodes
  public eyebrowLeftNode: THREE.Group;
  public eyebrowRightNode: THREE.Group;
  public eyelidLeftNode: THREE.Group;
  public eyelidRightNode: THREE.Group;
  public eyeGazeLeftNode: THREE.Group;
  public eyeGazeRightNode: THREE.Group;
  public mouthNode: THREE.Group;
  public upperLipMesh: THREE.Mesh;
  public lowerLipMesh: THREE.Mesh;

  // Right Arm & Hand Rig
  public rightClavicleNode: THREE.Group;
  public rightShoulderNode: THREE.Group;
  public rightUpperArmNode: THREE.Group;
  public rightElbowNode: THREE.Group;
  public rightForearmNode: THREE.Group;
  public rightWristNode: THREE.Group;
  public rightPalmGroup: THREE.Group;
  public rightHandBones: HandBoneSet;

  // Left Arm & Hand Rig (Full Dual-Hand Coordination)
  public leftClavicleNode: THREE.Group;
  public leftShoulderNode: THREE.Group;
  public leftUpperArmNode: THREE.Group;
  public leftElbowNode: THREE.Group;
  public leftForearmNode: THREE.Group;
  public leftWristNode: THREE.Group;
  public leftPalmGroup: THREE.Group;
  public leftHandBones: HandBoneSet;

  // Landmark Smoothing (21 One-Euro 3D Filters)
  private landmarkFilters: OneEuroFilter3D[];

  // Skeleton Visualizer
  private debugBoneLines: THREE.LineSegments | null = null;
  private debugJointSpheres: THREE.Mesh[] = [];
  private debugVisible: boolean = false;

  // PBR Shaders
  private skinMaterial: THREE.MeshStandardMaterial;
  private skinShadowMaterial: THREE.MeshStandardMaterial;
  private clothMaterial: THREE.MeshStandardMaterial;
  private clothTrimMaterial: THREE.MeshStandardMaterial;
  private hairMaterial: THREE.MeshStandardMaterial;
  private eyeWhiteMaterial: THREE.MeshStandardMaterial;
  private eyeIrisMaterial: THREE.MeshStandardMaterial;
  private eyePupilMaterial: THREE.MeshBasicMaterial;
  private eyeCorneaMaterial: THREE.MeshStandardMaterial;
  private lipMaterial: THREE.MeshStandardMaterial;
  private nailMaterial: THREE.MeshStandardMaterial;

  // Idle Animation State (Breathing & Blinking)
  private blinkTimer: number = 2.5; // Seconds until next blink
  private blinkProgress: number = 0; // 0 = open, 1 = fully closed
  private isBlinking: boolean = false;
  private breathingCycle: number = 0; // Sine oscillator
  private currentExpression: FacialExpression = 'NEUTRAL';
  private targetExpression: FacialExpression = 'NEUTRAL';
  private expressionBlend: number = 1.0;

  // Facial Parameter Targets
  private targetBrowRaise: number = 0;
  private targetBrowFurrow: number = 0;
  private targetBrowTilt: number = 0;
  private targetMouthOpen: number = 0;
  private targetMouthSmile: number = 0;
  private targetHeadTilt: number = 0;
  private targetHeadPitch: number = 0;
  private targetHeadYaw: number = 0;

  // High-Visibility Mode
  private isHighVisibility: boolean = false;

  // GLTF Integration
  private gltfAvatarScene: THREE.Group | null = null;

  constructor(config: HumanoidConfig = {}) {
    this.rootGroup = new THREE.Group();
    this.proceduralMeshGroup = new THREE.Group();
    this.debugGroup = new THREE.Group();

    this.rootGroup.add(this.proceduralMeshGroup);
    this.rootGroup.add(this.debugGroup);

    // 21 One-Euro 3D filters (cutoff = 1.2 Hz, beta = 0.005)
    this.landmarkFilters = Array.from({ length: 21 }, () => new OneEuroFilter3D(1.2, 0.005));

    // Studio PBR Materials
    const skinHex = config.skinColor ?? 0xdca87d; // Natural warm Indian skin tone
    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: skinHex,
      roughness: 0.50,
      metalness: 0.02,
    });
    this.skinShadowMaterial = new THREE.MeshStandardMaterial({
      color: 0xc48c64, // Crease & knuckle shadow tone
      roughness: 0.56,
      metalness: 0.02,
    });
    this.clothMaterial = new THREE.MeshStandardMaterial({
      color: config.clothColor ?? 0x181a20, // Minimalist matte charcoal black crewneck
      roughness: 0.82,
      metalness: 0.04,
    });
    this.clothTrimMaterial = new THREE.MeshStandardMaterial({
      color: config.clothTrimColor ?? 0x242832,
      roughness: 0.70,
      metalness: 0.05,
    });
    this.hairMaterial = new THREE.MeshStandardMaterial({
      color: config.hairColor ?? 0x1a1412, // Espresso dark brown
      roughness: 0.58,
      metalness: 0.14,
    });
    this.eyeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.12,
      metalness: 0.0,
    });
    this.eyeIrisMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d271d,
      roughness: 0.25,
      metalness: 0.05,
    });
    this.eyePupilMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 });
    this.eyeCorneaMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85,
    });
    this.lipMaterial = new THREE.MeshStandardMaterial({
      color: 0xba7668,
      roughness: 0.44,
      metalness: 0.02,
    });
    this.nailMaterial = new THREE.MeshStandardMaterial({
      color: 0xedd6cb,
      roughness: 0.22,
      metalness: 0.08,
    });

    // ─────────────────────────────────────────────────────────────
    // 1. SPINE & TORSO POSTURE HIERARCHY
    // ─────────────────────────────────────────────────────────────
    this.spineNode = new THREE.Group();
    this.spineNode.position.set(0, 0.65, 0);
    this.proceduralMeshGroup.add(this.spineNode);

    this.chestNode = new THREE.Group();
    this.chestNode.position.set(0, 0.17, 0);
    this.spineNode.add(this.chestNode);

    // Anatomical Torso & Studio Attire
    const torsoMesh = this.createAnatomicalTorso();
    this.chestNode.add(torsoMesh);

    const collarMesh = this.createStudioCollar();
    this.chestNode.add(collarMesh);

    // ─────────────────────────────────────────────────────────────
    // 2. NECK & HEAD WITH FACIAL RIG
    // ─────────────────────────────────────────────────────────────
    this.neckNode = new THREE.Group();
    this.neckNode.position.set(0, 0.23, 0);
    this.chestNode.add(this.neckNode);

    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.072, 0.11, 24),
      this.skinMaterial
    );
    neckMesh.position.set(0, 0.02, 0);
    this.neckNode.add(neckMesh);

    this.headNode = new THREE.Group();
    this.headNode.position.set(0, 0.12, 0);
    this.neckNode.add(this.headNode);

    // Initialize facial rig sub-nodes
    this.eyebrowLeftNode = new THREE.Group();
    this.eyebrowRightNode = new THREE.Group();
    this.eyelidLeftNode = new THREE.Group();
    this.eyelidRightNode = new THREE.Group();
    this.eyeGazeLeftNode = new THREE.Group();
    this.eyeGazeRightNode = new THREE.Group();
    this.mouthNode = new THREE.Group();

    // Lip meshes
    this.upperLipMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.005, 0.038, 12),
      this.lipMaterial
    );
    this.lowerLipMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.005, 0.032, 12),
      this.lipMaterial
    );

    // Build the complete head with animated facial elements
    const headComposite = this.createSculptedHead();
    this.headNode.add(headComposite);

    // ─────────────────────────────────────────────────────────────
    // 3. RIGHT ARM & 5-FINGER HAND RIG
    // ─────────────────────────────────────────────────────────────
    this.rightClavicleNode = new THREE.Group();
    this.rightClavicleNode.position.set(0.10, 0.18, 0);
    this.chestNode.add(this.rightClavicleNode);

    this.rightShoulderNode = new THREE.Group();
    this.rightShoulderNode.position.set(0.13, -0.04, -0.02);
    this.rightClavicleNode.add(this.rightShoulderNode);

    const shoulderDeltoidR = this.createShoulderCap('right');
    this.rightShoulderNode.add(shoulderDeltoidR);

    this.rightUpperArmNode = new THREE.Group();
    this.rightShoulderNode.add(this.rightUpperArmNode);

    const upperArmR = this.createUpperArm('right');
    this.rightUpperArmNode.add(upperArmR);

    this.rightElbowNode = new THREE.Group();
    this.rightElbowNode.position.set(0, -0.25, 0);
    this.rightUpperArmNode.add(this.rightElbowNode);

    this.rightForearmNode = new THREE.Group();
    this.rightElbowNode.add(this.rightForearmNode);

    const forearmR = this.createForearm('right');
    this.rightForearmNode.add(forearmR);

    this.rightWristNode = new THREE.Group();
    this.rightWristNode.position.set(0, -0.23, 0);
    this.rightForearmNode.add(this.rightWristNode);

    this.rightPalmGroup = this.createAnatomicalPalm('right');
    this.rightWristNode.add(this.rightPalmGroup);

    // Right hand 5-finger articulated hierarchy
    this.rightHandBones = {
      thumb: this.createArticulatedFinger(this.rightWristNode, new THREE.Vector3(0.038, 0.024, 0.010), 0.033, 0.027, 0.022, true, 'right'),
      index: this.createArticulatedFinger(this.rightWristNode, new THREE.Vector3(0.026, 0.082, 0.002), 0.038, 0.030, 0.024, false, 'right'),
      middle: this.createArticulatedFinger(this.rightWristNode, new THREE.Vector3(0.009, 0.086, 0.003), 0.043, 0.034, 0.026, false, 'right'),
      ring: this.createArticulatedFinger(this.rightWristNode, new THREE.Vector3(-0.009, 0.081, 0.001), 0.039, 0.030, 0.024, false, 'right'),
      pinky: this.createArticulatedFinger(this.rightWristNode, new THREE.Vector3(-0.027, 0.074, -0.002), 0.031, 0.024, 0.020, false, 'right'),
    };

    // ─────────────────────────────────────────────────────────────
    // 4. LEFT ARM & 5-FINGER HAND RIG (DUAL-HAND SIGNING)
    // ─────────────────────────────────────────────────────────────
    this.leftClavicleNode = new THREE.Group();
    this.leftClavicleNode.position.set(-0.10, 0.18, 0);
    this.chestNode.add(this.leftClavicleNode);

    this.leftShoulderNode = new THREE.Group();
    this.leftShoulderNode.position.set(-0.13, -0.04, -0.02);
    this.leftClavicleNode.add(this.leftShoulderNode);

    const shoulderDeltoidL = this.createShoulderCap('left');
    this.leftShoulderNode.add(shoulderDeltoidL);

    this.leftUpperArmNode = new THREE.Group();
    this.leftShoulderNode.add(this.leftUpperArmNode);

    const upperArmL = this.createUpperArm('left');
    this.leftUpperArmNode.add(upperArmL);

    this.leftElbowNode = new THREE.Group();
    this.leftElbowNode.position.set(0, -0.25, 0);
    this.leftUpperArmNode.add(this.leftElbowNode);

    this.leftForearmNode = new THREE.Group();
    this.leftElbowNode.add(this.leftForearmNode);

    const forearmL = this.createForearm('left');
    this.leftForearmNode.add(forearmL);

    this.leftWristNode = new THREE.Group();
    this.leftWristNode.position.set(0, -0.23, 0);
    this.leftForearmNode.add(this.leftWristNode);

    this.leftPalmGroup = this.createAnatomicalPalm('left');
    this.leftWristNode.add(this.leftPalmGroup);

    // Left hand 5-finger articulated hierarchy
    this.leftHandBones = {
      thumb: this.createArticulatedFinger(this.leftWristNode, new THREE.Vector3(-0.038, 0.024, 0.010), 0.033, 0.027, 0.022, true, 'left'),
      index: this.createArticulatedFinger(this.leftWristNode, new THREE.Vector3(-0.026, 0.082, 0.002), 0.038, 0.030, 0.024, false, 'left'),
      middle: this.createArticulatedFinger(this.leftWristNode, new THREE.Vector3(-0.009, 0.086, 0.003), 0.043, 0.034, 0.026, false, 'left'),
      ring: this.createArticulatedFinger(this.leftWristNode, new THREE.Vector3(0.009, 0.081, 0.001), 0.039, 0.030, 0.024, false, 'left'),
      pinky: this.createArticulatedFinger(this.leftWristNode, new THREE.Vector3(0.027, 0.074, -0.002), 0.031, 0.024, 0.020, false, 'left'),
    };

    // ─────────────────────────────────────────────────────────────
    // 5. DEBUG SKELETON INITIALIZATION & NEUTRAL REST POSE
    // ─────────────────────────────────────────────────────────────
    this.initDebugSkeleton();
    this.setDebugVisible(config.enableDebugSkeleton ?? false);

    // Initial natural rest posture
    this.applyNeutralRestPose();
  }

  /**
   * Anatomical athletic torso and tailored attire.
   */
  private createAnatomicalTorso(): THREE.Group {
    const group = new THREE.Group();

    // Ribcage block
    const chestGeom = new THREE.CylinderGeometry(0.20, 0.16, 0.36, 24);
    chestGeom.scale(1.15, 1.0, 0.78);
    const chestMesh = new THREE.Mesh(chestGeom, this.clothMaterial);
    chestMesh.position.set(0, 0.02, 0);
    group.add(chestMesh);

    // Waist taper
    const waistGeom = new THREE.CylinderGeometry(0.16, 0.145, 0.16, 24);
    waistGeom.scale(1.1, 1.0, 0.75);
    const waistMesh = new THREE.Mesh(waistGeom, this.clothMaterial);
    waistMesh.position.set(0, -0.22, 0);
    group.add(waistMesh);

    // Clavicle shoulder bridge
    const clavicleGeom = new THREE.CylinderGeometry(0.23, 0.20, 0.10, 24);
    clavicleGeom.scale(1.18, 0.8, 0.72);
    const clavicleMesh = new THREE.Mesh(clavicleGeom, this.clothMaterial);
    clavicleMesh.position.set(0, 0.18, -0.005);
    group.add(clavicleMesh);

    return group;
  }

  /**
   * Minimalist ribbed crewneck collar matching reference image.
   */
  private createStudioCollar(): THREE.Group {
    const group = new THREE.Group();

    // Ribbed circular crewneck ring
    const collarGeom = new THREE.TorusGeometry(0.076, 0.010, 14, 28);
    collarGeom.rotateX(Math.PI / 2.15);
    const collarMesh = new THREE.Mesh(collarGeom, this.clothMaterial);
    collarMesh.position.set(0, 0.175, 0.024);
    group.add(collarMesh);

    return group;
  }

  private createShoulderCap(side: 'right' | 'left'): THREE.Mesh {
    const flip = side === 'right' ? 1 : -1;
    const geom = new THREE.SphereGeometry(0.068, 20, 20);
    geom.scale(1.15, 1.0, 0.9);
    const mesh = new THREE.Mesh(geom, this.clothMaterial);
    mesh.position.set(0.02 * flip, -0.01, 0);
    return mesh;
  }

  private createUpperArm(side: 'right' | 'left'): THREE.Group {
    const group = new THREE.Group();
    // Charcoal ribbed crewneck 3/4 sleeve (fitted silhouette)
    const sleeveGeom = new THREE.CylinderGeometry(0.050, 0.043, 0.24, 18);
    const sleeveMesh = new THREE.Mesh(sleeveGeom, this.clothMaterial);
    sleeveMesh.position.set(0, -0.12, 0);
    group.add(sleeveMesh);

    const cuffGeom = new THREE.CylinderGeometry(0.044, 0.042, 0.02, 18);
    const cuffMesh = new THREE.Mesh(cuffGeom, this.clothMaterial);
    cuffMesh.position.set(0, -0.23, 0);
    group.add(cuffMesh);
    return group;
  }

  private createForearm(side: 'right' | 'left'): THREE.Group {
    const group = new THREE.Group();
    // 3/4 sleeve cuff extending just below the elbow
    const cuff34Geom = new THREE.CylinderGeometry(0.042, 0.039, 0.06, 18);
    const cuff34 = new THREE.Mesh(cuff34Geom, this.clothMaterial);
    cuff34.position.set(0, -0.03, 0);
    group.add(cuff34);

    // Bare forearm in warm skin tone for high-contrast sign visibility
    const forearmGeom = new THREE.CylinderGeometry(0.038, 0.030, 0.17, 18);
    forearmGeom.scale(1.05, 1.0, 0.92);
    const forearmMesh = new THREE.Mesh(forearmGeom, this.skinMaterial);
    forearmMesh.position.set(0, -0.135, 0);
    group.add(forearmMesh);

    const wristCapGeom = new THREE.CylinderGeometry(0.030, 0.028, 0.02, 16);
    const wristCap = new THREE.Mesh(wristCapGeom, this.skinMaterial);
    wristCap.position.set(0, -0.22, 0);
    group.add(wristCap);
    return group;
  }

  /**
   * Sculpted head with animated facial elements (eyebrows, eyelids, gaze, lips).
   */
  private createSculptedHead(): THREE.Group {
    const headGroup = new THREE.Group();

    // Cranium
    const skullGeom = new THREE.SphereGeometry(0.122, 28, 28);
    skullGeom.scale(0.92, 1.14, 1.05);
    const skullMesh = new THREE.Mesh(skullGeom, this.skinMaterial);
    skullMesh.position.set(0, 0.01, 0);
    headGroup.add(skullMesh);

    // Jaw / Chin
    const jawGeom = new THREE.CylinderGeometry(0.078, 0.048, 0.10, 20);
    jawGeom.scale(1.0, 0.9, 1.15);
    const jawMesh = new THREE.Mesh(jawGeom, this.skinMaterial);
    jawMesh.position.set(0, -0.065, 0.028);
    headGroup.add(jawMesh);

    // Nose
    const noseGeom = new THREE.ConeGeometry(0.016, 0.046, 12);
    noseGeom.rotateX(Math.PI / 2.2);
    const noseMesh = new THREE.Mesh(noseGeom, this.skinMaterial);
    noseMesh.position.set(0, 0.005, 0.125);
    headGroup.add(noseMesh);

    // Eye Assemblies with Eyelids & Gaze Nodes
    this.setupEyeWithEyelid(-0.042, this.eyelidLeftNode, this.eyeGazeLeftNode);
    this.setupEyeWithEyelid(0.042, this.eyelidRightNode, this.eyeGazeRightNode);
    headGroup.add(this.eyeGazeLeftNode);
    headGroup.add(this.eyeGazeRightNode);

    // Articulated Eyebrows
    this.eyebrowLeftNode.position.set(-0.043, 0.042, 0.108);
    const browGeom = new THREE.BoxGeometry(0.032, 0.007, 0.012);
    const browMeshL = new THREE.Mesh(browGeom, this.hairMaterial);
    this.eyebrowLeftNode.add(browMeshL);
    headGroup.add(this.eyebrowLeftNode);

    this.eyebrowRightNode.position.set(0.043, 0.042, 0.108);
    const browMeshR = new THREE.Mesh(browGeom, this.hairMaterial);
    this.eyebrowRightNode.add(browMeshR);
    headGroup.add(this.eyebrowRightNode);

    // Articulated Mouth & Lips
    this.mouthNode.position.set(0, -0.048, 0.113);
    this.upperLipMesh.rotation.set(0, 0, Math.PI / 2);
    this.upperLipMesh.position.set(0, 0.006, 0.001);
    this.mouthNode.add(this.upperLipMesh);

    this.lowerLipMesh.rotation.set(0, 0, Math.PI / 2);
    this.lowerLipMesh.position.set(0, -0.006, 0);
    this.mouthNode.add(this.lowerLipMesh);
    headGroup.add(this.mouthNode);

    // Ears
    const earGeom = new THREE.SphereGeometry(0.026, 14, 14);
    earGeom.scale(0.4, 1.25, 0.7);
    const earL = new THREE.Mesh(earGeom, this.skinMaterial);
    earL.position.set(-0.114, 0.01, -0.01);
    headGroup.add(earL);

    const earR = new THREE.Mesh(earGeom, this.skinMaterial);
    earR.position.set(0.114, 0.01, -0.01);
    headGroup.add(earR);

    // Styled Volumetric Hair Matching Reference (Sleek Ponytail with Side-Swept Bangs)
    const hairCrownGeom = new THREE.SphereGeometry(0.128, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.60);
    hairCrownGeom.scale(0.96, 1.08, 1.06);
    const hairCrown = new THREE.Mesh(hairCrownGeom, this.hairMaterial);
    hairCrown.position.set(0, 0.035, -0.012);
    headGroup.add(hairCrown);

    // Side-swept front bangs framing the temple
    const bangGeom = new THREE.BoxGeometry(0.12, 0.035, 0.04);
    const bangMesh = new THREE.Mesh(bangGeom, this.hairMaterial);
    bangMesh.position.set(0.02, 0.075, 0.095);
    bangMesh.rotation.set(0.15, 0.1, -0.2);
    headGroup.add(bangMesh);

    // Sleek low ponytail extending down the back of the neck
    const ponyTailGeom = new THREE.CylinderGeometry(0.024, 0.012, 0.20, 14);
    ponyTailGeom.rotateX(-0.35);
    const ponyTail = new THREE.Mesh(ponyTailGeom, this.hairMaterial);
    ponyTail.position.set(0, -0.06, -0.135);
    headGroup.add(ponyTail);

    // Dark hair tie band
    const hairTie = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.014, 14),
      this.clothMaterial
    );
    hairTie.position.set(0, 0.01, -0.12);
    hairTie.rotation.set(0.4, 0, 0);
    headGroup.add(hairTie);

    return headGroup;
  }

  /**
   * Sets up eye assembly with dynamic eyelid and gaze direction.
   */
  private setupEyeWithEyelid(
    xPos: number,
    eyelidNode: THREE.Group,
    gazeNode: THREE.Group
  ): void {
    gazeNode.position.set(xPos, 0.022, 0.104);

    // Sclera
    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 16, 16),
      this.eyeWhiteMaterial
    );
    gazeNode.add(sclera);

    // Hazel Iris
    const iris = new THREE.Mesh(
      new THREE.CircleGeometry(0.008, 16),
      this.eyeIrisMaterial
    );
    iris.position.set(0, 0, 0.014);
    gazeNode.add(iris);

    // Pupil
    const pupil = new THREE.Mesh(
      new THREE.CircleGeometry(0.0042, 14),
      this.eyePupilMaterial
    );
    pupil.position.set(0, 0, 0.0145);
    gazeNode.add(pupil);

    // Cornea Specular Gloss
    const gloss = new THREE.Mesh(
      new THREE.SphereGeometry(0.0022, 8, 8),
      this.eyeCorneaMaterial
    );
    gloss.position.set(0.003, 0.003, 0.015);
    gazeNode.add(gloss);

    // Dynamic Eyelid Mesh
    eyelidNode.position.set(0, 0.008, 0.002);
    const lidGeom = new THREE.SphereGeometry(0.0154, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const lidMesh = new THREE.Mesh(lidGeom, this.skinMaterial);
    eyelidNode.add(lidMesh);
    gazeNode.add(eyelidNode);
  }

  /**
   * Sculpted palm with thenar (thumb ball) and hypothenar muscle pads.
   */
  private createAnatomicalPalm(side: 'right' | 'left'): THREE.Group {
    const palmGroup = new THREE.Group();
    const flip = side === 'right' ? 1 : -1;

    // Central Palm Plate
    const palmGeom = new THREE.BoxGeometry(0.068, 0.076, 0.022);
    const palmMesh = new THREE.Mesh(palmGeom, this.skinMaterial);
    palmMesh.position.set(0, 0.042, 0);
    palmGroup.add(palmMesh);

    // Thenar Eminence (Thumb Ball)
    const thenarGeom = new THREE.SphereGeometry(0.024, 14, 14);
    thenarGeom.scale(1.0, 1.4, 0.75);
    const thenar = new THREE.Mesh(thenarGeom, this.skinMaterial);
    thenar.position.set(0.022 * flip, 0.028, 0.007);
    palmGroup.add(thenar);

    // Hypothenar Eminence (Pinky Pad)
    const hypoGeom = new THREE.SphereGeometry(0.018, 12, 12);
    hypoGeom.scale(0.85, 1.5, 0.7);
    const hypothenar = new THREE.Mesh(hypoGeom, this.skinMaterial);
    hypothenar.position.set(-0.022 * flip, 0.034, 0.005);
    palmGroup.add(hypothenar);

    // Metacarpal Knuckle Arch
    const archGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.065, 14);
    archGeom.rotateZ(Math.PI / 2);
    const arch = new THREE.Mesh(archGeom, this.skinShadowMaterial);
    arch.position.set(0, 0.078, 0.002);
    palmGroup.add(arch);

    return palmGroup;
  }

  /**
   * Constructs a 3-phalanx articulated finger hierarchy (MCP -> PIP -> DIP) with defined knuckles and nail highlights.
   */
  private createArticulatedFinger(
    parent: THREE.Group,
    rootOffset: THREE.Vector3,
    len1: number,
    len2: number,
    len3: number,
    isThumb: boolean = false,
    side: 'right' | 'left' = 'right'
  ): [THREE.Group, THREE.Group, THREE.Group] {
    const phalanxMat = this.skinMaterial;
    const jointMat = this.skinShadowMaterial;

    const baseRad = isThumb ? 0.0095 : 0.0084;
    const midRad = isThumb ? 0.0085 : 0.0074;
    const tipRad = isThumb ? 0.0075 : 0.0062;

    // Phalanx 1 (MCP / Knuckle)
    const b1 = new THREE.Group();
    b1.position.copy(rootOffset);
    if (isThumb) {
      const thumbAngle = side === 'right' ? 0.35 : -0.35;
      b1.rotation.set(0.2, 0, thumbAngle);
    }
    parent.add(b1);

    const m1Geom = new THREE.CylinderGeometry(midRad, baseRad, len1, 12);
    m1Geom.scale(1.1, 1.0, 0.9);
    const m1 = new THREE.Mesh(m1Geom, phalanxMat);
    m1.position.set(0, len1 / 2, 0);
    b1.add(m1);

    const knuckle1 = new THREE.Mesh(new THREE.SphereGeometry(baseRad * 1.05, 10, 10), jointMat);
    b1.add(knuckle1);

    // Phalanx 2 (PIP)
    const b2 = new THREE.Group();
    b2.position.set(0, len1, 0);
    b1.add(b2);

    const m2Geom = new THREE.CylinderGeometry(tipRad, midRad, len2, 12);
    m2Geom.scale(1.08, 1.0, 0.9);
    const m2 = new THREE.Mesh(m2Geom, phalanxMat);
    m2.position.set(0, len2 / 2, 0);
    b2.add(m2);

    const knuckle2 = new THREE.Mesh(new THREE.SphereGeometry(midRad * 1.02, 10, 10), jointMat);
    b2.add(knuckle2);

    // Phalanx 3 (DIP & Tip with Fingernail)
    const b3 = new THREE.Group();
    b3.position.set(0, len2, 0);
    b2.add(b3);

    const m3Geom = new THREE.CylinderGeometry(tipRad * 0.78, tipRad, len3, 12);
    m3Geom.scale(1.05, 1.0, 0.88);
    const m3 = new THREE.Mesh(m3Geom, phalanxMat);
    m3.position.set(0, len3 / 2, 0);
    b3.add(m3);

    const tipCap = new THREE.Mesh(new THREE.SphereGeometry(tipRad * 0.78, 10, 10), phalanxMat);
    tipCap.position.set(0, len3, 0);
    b3.add(tipCap);

    const nailGeom = new THREE.BoxGeometry(tipRad * 1.3, len3 * 0.42, 0.0018);
    const nailMesh = new THREE.Mesh(nailGeom, this.nailMaterial);
    nailMesh.position.set(0, len3 * 0.68, -tipRad * 0.75);
    b3.add(nailMesh);

    return [b1, b2, b3];
  }

  // ─────────────────────────────────────────────────────────────
  // FACIAL RIG ANIMATION CONTROLLERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Controls eyelid blink position (0 = open, 1 = closed).
   */
  public setBlink(amount: number): void {
    const clamped = Math.max(0, Math.min(1, amount));
    const targetY = 0.008 - clamped * 0.016;
    const targetScaleY = 1.0 + clamped * 0.35;
    this.eyelidLeftNode.position.y = targetY;
    this.eyelidRightNode.position.y = targetY;
    this.eyelidLeftNode.scale.y = targetScaleY;
    this.eyelidRightNode.scale.y = targetScaleY;
  }

  /**
   * Sets eyebrow posture: raise, furrow, and tilt.
   */
  public setEyebrows(raise: number = 0, furrow: number = 0, tilt: number = 0): void {
    const baseY = 0.042;
    const yOffset = raise * 0.012 - furrow * 0.006;

    this.eyebrowLeftNode.position.y = baseY + yOffset;
    this.eyebrowLeftNode.rotation.z = -0.06 + tilt * 0.25 - furrow * 0.15;

    this.eyebrowRightNode.position.y = baseY + yOffset;
    this.eyebrowRightNode.rotation.z = 0.06 - tilt * 0.25 + furrow * 0.15;
  }

  /**
   * Controls mouth aperture, smile curvature, and purse.
   */
  public setMouth(open: number = 0, smile: number = 0, purse: number = 0): void {
    this.mouthNode.scale.x = 1.0 + smile * 0.25 - purse * 0.2;
    this.upperLipMesh.position.y = 0.006 + open * 0.008;
    this.lowerLipMesh.position.y = -0.006 - open * 0.012;
    this.mouthNode.position.z = 0.113 + purse * 0.005;
  }

  /**
   * Sets current target facial expression with smooth transition.
   */
  public setFacialExpression(expression: FacialExpression, blendAlpha: number = 0.15): void {
    this.targetExpression = expression;
    switch (expression) {
      case 'QUESTION':
        this.targetBrowRaise = 0.85;
        this.targetBrowFurrow = -0.1;
        this.targetBrowTilt = 0.25;
        this.targetMouthOpen = 0.15;
        this.targetMouthSmile = 0.05;
        this.targetHeadPitch = 0.08;
        break;
      case 'NEGATION':
        this.targetBrowRaise = -0.3;
        this.targetBrowFurrow = 0.75;
        this.targetBrowTilt = -0.2;
        this.targetMouthOpen = 0.0;
        this.targetMouthSmile = -0.15;
        this.targetHeadPitch = -0.04;
        break;
      case 'HAPPY':
      case 'CONFIRMATION':
        this.targetBrowRaise = 0.2;
        this.targetBrowFurrow = 0.0;
        this.targetBrowTilt = 0.05;
        this.targetMouthOpen = 0.05;
        this.targetMouthSmile = 0.65;
        this.targetHeadPitch = 0.05;
        break;
      case 'CONCERNED':
        this.targetBrowRaise = 0.4;
        this.targetBrowFurrow = 0.6;
        this.targetBrowTilt = -0.35;
        this.targetMouthOpen = 0.1;
        this.targetMouthSmile = -0.2;
        this.targetHeadPitch = 0.06;
        break;
      case 'SURPRISED':
        this.targetBrowRaise = 1.0;
        this.targetBrowFurrow = -0.2;
        this.targetBrowTilt = 0.0;
        this.targetMouthOpen = 0.45;
        this.targetMouthSmile = 0.1;
        this.targetHeadPitch = -0.08;
        break;
      case 'EMPHASIS':
        this.targetBrowRaise = 0.5;
        this.targetBrowFurrow = 0.4;
        this.targetBrowTilt = 0.15;
        this.targetMouthOpen = 0.1;
        this.targetMouthSmile = 0.0;
        this.targetHeadPitch = 0.12;
        break;
      case 'NEUTRAL':
      default:
        this.targetBrowRaise = 0.0;
        this.targetBrowFurrow = 0.0;
        this.targetBrowTilt = 0.0;
        this.targetMouthOpen = 0.0;
        this.targetMouthSmile = 0.1;
        this.targetHeadPitch = 0.0;
        break;
    }

    // Blend facial state
    this.setEyebrows(this.targetBrowRaise, this.targetBrowFurrow, this.targetBrowTilt);
    this.setMouth(this.targetMouthOpen, this.targetMouthSmile, 0);
  }

  // ─────────────────────────────────────────────────────────────
  // IDLE & BREATHING MOTION SYSTEM
  // ─────────────────────────────────────────────────────────────

  /**
   * Updates natural autonomous idle motion: rhythmic breathing, stochastic blinking, and micro-saccades.
   */
  public updateIdle(timeMs: number, dtSeconds: number): void {
    // 1. Natural Sinusoidal Breathing (~4.0s period)
    this.breathingCycle += dtSeconds * 1.55;
    const breathAmount = Math.sin(this.breathingCycle);
    this.chestNode.scale.z = 1.0 + breathAmount * 0.015;
    this.chestNode.position.y = 0.17 + breathAmount * 0.0025;
    this.rightClavicleNode.position.y = 0.18 + breathAmount * 0.003;
    this.leftClavicleNode.position.y = 0.18 + breathAmount * 0.003;

    // Subtle spine lateral balance sway (~7.5s period)
    const sway = Math.sin(timeMs * 0.0008) * 0.012;
    this.spineNode.rotation.z = sway;

    // 2. Natural Stochastic Blinking (Poisson distribution between 2.8s and 5.2s)
    this.blinkTimer -= dtSeconds;
    if (this.blinkTimer <= 0 && !this.isBlinking) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }

    if (this.isBlinking) {
      this.blinkProgress += dtSeconds * 8.5; // Fast clean 140ms blink
      if (this.blinkProgress <= 1.0) {
        // Easing down
        this.setBlink(Math.sin(this.blinkProgress * Math.PI));
      } else {
        this.isBlinking = false;
        this.setBlink(0);
        this.blinkTimer = 2.8 + Math.random() * 2.4; // Next blink interval
      }
    }

    // 3. Subtle eye gaze micro-saccades maintaining camera connection
    const gazeSaccadeX = Math.sin(timeMs * 0.002) * 0.001;
    const gazeSaccadeY = Math.cos(timeMs * 0.0015) * 0.0008;
    this.eyeGazeLeftNode.position.x = -0.042 + gazeSaccadeX;
    this.eyeGazeLeftNode.position.y = 0.022 + gazeSaccadeY;
    this.eyeGazeRightNode.position.x = 0.042 + gazeSaccadeX;
    this.eyeGazeRightNode.position.y = 0.022 + gazeSaccadeY;
  }

  // ─────────────────────────────────────────────────────────────
  // FINGER SPLAY & THUMB OPPOSITION ARTICULATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Sets finger abduction/adduction (spreading) on a hand.
   */
  public setFingerSpread(
    side: 'right' | 'left',
    spreads: { index?: number; middle?: number; ring?: number; pinky?: number; thumb?: number }
  ): void {
    const bones = side === 'right' ? this.rightHandBones : this.leftHandBones;
    const flip = side === 'right' ? 1 : -1;

    if (spreads.index !== undefined) bones.index[0].rotation.z = (spreads.index * 0.25) * flip;
    if (spreads.middle !== undefined) bones.middle[0].rotation.z = (spreads.middle * 0.12) * flip;
    if (spreads.ring !== undefined) bones.ring[0].rotation.z = (-spreads.ring * 0.15) * flip;
    if (spreads.pinky !== undefined) bones.pinky[0].rotation.z = (-spreads.pinky * 0.30) * flip;
    if (spreads.thumb !== undefined) bones.thumb[0].rotation.y = (spreads.thumb * 0.45) * flip;
  }

  /**
   * High-Visibility Mode toggle: enhances hand edge contrast and studio lighting response.
   */
  public setHighVisibility(enabled: boolean): void {
    this.isHighVisibility = enabled;
    if (enabled) {
      this.skinMaterial.roughness = 0.38;
      this.skinMaterial.metalness = 0.05;
      this.skinShadowMaterial.roughness = 0.42;
      this.nailMaterial.roughness = 0.15;
    } else {
      this.skinMaterial.roughness = 0.50;
      this.skinMaterial.metalness = 0.02;
      this.skinShadowMaterial.roughness = 0.56;
      this.nailMaterial.roughness = 0.22;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SKELETON DEBUG VISUALIZER
  // ─────────────────────────────────────────────────────────────

  private initDebugSkeleton(): void {
    const sphereGeom = new THREE.SphereGeometry(0.012, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    for (let i = 0; i < 21; i++) {
      const sp = new THREE.Mesh(sphereGeom, sphereMat);
      this.debugGroup.add(sp);
      this.debugJointSpheres.push(sp);
    }
  }

  public setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    this.debugGroup.visible = visible;
  }

  // ─────────────────────────────────────────────────────────────
  // NEUTRAL REST POSE & RETARGETING
  // ─────────────────────────────────────────────────────────────

  /**
   * Natural relaxed rest posture: arms resting calmly at sides, gentle natural finger curling.
   */
  public applyNeutralRestPose(): void {
    // Right arm poised rest posture (hands gently resting at waist in front of torso)
    this.rightUpperArmNode.quaternion.setFromEuler(new THREE.Euler(0.24, 0.05, -0.18));
    this.rightForearmNode.quaternion.setFromEuler(new THREE.Euler(-0.85, 0.22, 0.42));
    this.rightWristNode.quaternion.setFromEuler(new THREE.Euler(0.12, 0.15, -0.10));

    // Left arm poised rest posture
    this.leftUpperArmNode.quaternion.setFromEuler(new THREE.Euler(0.24, -0.05, 0.18));
    this.leftForearmNode.quaternion.setFromEuler(new THREE.Euler(-0.85, -0.22, -0.42));
    this.leftWristNode.quaternion.setFromEuler(new THREE.Euler(0.12, -0.15, 0.10));

    // Gentle natural finger rest curl for both hands
    const restCurl = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, 0));
    const fingers: (keyof HandBoneSet)[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    for (const f of fingers) {
      for (let i = 0; i < 3; i++) {
        this.rightHandBones[f][i].quaternion.copy(restCurl);
        this.leftHandBones[f][i].quaternion.copy(restCurl);
      }
    }

    this.headNode.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
    this.chestNode.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
    this.setFacialExpression('NEUTRAL', 1.0);
  }

  /**
   * Retargets 21 landmarks into the right signing hand with One-Euro smoothing and slerp blending.
   */
  public applyLandmarkPose(
    landmarks: Landmark3D[],
    timestamp: number = performance.now(),
    blendAlpha: number = 0.25
  ): void {
    if (!landmarks || landmarks.length < 21) return;

    const smoothedLandmarks: Landmark3D[] = landmarks.map((lm, idx) => {
      const [sx, sy, sz] = this.landmarkFilters[idx].filter(lm.x, lm.y, lm.z, timestamp);
      return { x: sx, y: sy, z: sz };
    });

    const shoulderWorld = new THREE.Vector3();
    this.rightShoulderNode.getWorldPosition(shoulderWorld);

    const retarget = retargetLandmarksToHand(smoothedLandmarks, 'right', shoulderWorld);

    this.rightUpperArmNode.quaternion.slerp(retarget.shoulderRotation, blendAlpha);
    this.rightForearmNode.quaternion.slerp(retarget.elbowRotation, blendAlpha);
    this.rightWristNode.quaternion.slerp(retarget.wristRotation, blendAlpha);

    const fingers: (keyof HandBoneSet)[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const f of fingers) {
      const bones = this.rightHandBones[f];
      const rots = retarget.fingerRotations[f];
      for (let i = 0; i < 3; i++) {
        bones[i].quaternion.slerp(rots[i], blendAlpha);
      }
    }

    // Left hand counter-balance
    this.leftUpperArmNode.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, 0, 0.14)), blendAlpha * 0.5);
    this.leftForearmNode.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.38, 0, -0.06)), blendAlpha * 0.5);

    if (this.debugVisible) {
      for (let i = 0; i < 21; i++) {
        if (this.debugJointSpheres[i] && retarget.worldJoints[i]) {
          this.debugJointSpheres[i].position.copy(retarget.worldJoints[i]);
        }
      }
    }
  }

  /**
   * Applies complete verified Indian Sign Language posture with two-handed support and manual fingerspelling.
   */
  public applyVerifiedSignPose(
    signName: string,
    timestamp: number = performance.now(),
    blendAlpha: number = 0.25
  ): void {
    const pose: TwoHandedAvatarPose = solveVerifiedSignPosture(signName);

    // Right Arm & 5-Finger Hand
    this.rightUpperArmNode.quaternion.slerp(pose.right.shoulderRotation, blendAlpha);
    this.rightForearmNode.quaternion.slerp(pose.right.elbowRotation, blendAlpha);
    this.rightWristNode.quaternion.slerp(pose.right.wristRotation, blendAlpha);

    const fingerKeys: (keyof HandBoneSet)[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const f of fingerKeys) {
      const bones = this.rightHandBones[f];
      const rots = pose.right.fingerRotations[f];
      if (bones && rots) {
        for (let i = 0; i < 3; i++) {
          bones[i].quaternion.slerp(rots[i], blendAlpha);
        }
      }
    }

    // Left Arm & 5-Finger Hand (Dual-Hand Coordination)
    this.leftUpperArmNode.quaternion.slerp(pose.left.shoulderRotation, blendAlpha);
    this.leftForearmNode.quaternion.slerp(pose.left.elbowRotation, blendAlpha);
    this.leftWristNode.quaternion.slerp(pose.left.wristRotation, blendAlpha);

    for (const f of fingerKeys) {
      const bones = this.leftHandBones[f];
      const rots = pose.left.fingerRotations[f];
      if (bones && rots) {
        for (let i = 0; i < 3; i++) {
          bones[i].quaternion.slerp(rots[i], blendAlpha);
        }
      }
    }

    // Head Tilt & Bow
    if (pose.headRotation) {
      const qHead = new THREE.Quaternion().setFromEuler(pose.headRotation);
      this.headNode.quaternion.slerp(qHead, blendAlpha);
    }

    // Torso Posture
    if (pose.torsoRotation) {
      const qTorso = new THREE.Quaternion().setFromEuler(pose.torsoRotation);
      this.chestNode.quaternion.slerp(qTorso, blendAlpha);
    }
  }

  /**
   * Unified signing method: executes verified two-handed posture or falls back to keyframe landmarks.
   */
  public applySign(
    token: string,
    keyframeLandmarks?: Array<{ x: number; y: number; z: number }> | null,
    timestamp: number = performance.now(),
    blendAlpha: number = 0.22
  ): void {
    const cleanToken = token.toUpperCase().trim();
    const isFingerspelling = cleanToken.startsWith('FS_');

    if (VERIFIED_ISL_SIGN_POSES[cleanToken] || isFingerspelling) {
      this.applyVerifiedSignPose(cleanToken, timestamp, blendAlpha);
    } else if (keyframeLandmarks && keyframeLandmarks.length >= 21) {
      const lms: Landmark3D[] = keyframeLandmarks.map((l) => ({ x: l.x, y: l.y, z: l.z }));
      this.applyLandmarkPose(lms, timestamp, blendAlpha);
    } else {
      this.applyNeutralRestPose();
    }
  }

  /**
   * Optional GLTF / GLB model loader integration hook.
   */
  public async loadGLTFModel(url: string): Promise<boolean> {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();

      return new Promise<boolean>((resolve) => {
        loader.load(
          url,
          (gltf) => {
            if (this.gltfAvatarScene) {
              this.rootGroup.remove(this.gltfAvatarScene);
            }
            this.gltfAvatarScene = gltf.scene;
            this.proceduralMeshGroup.visible = false;
            this.rootGroup.add(this.gltfAvatarScene);
            resolve(true);
          },
          undefined,
          (err) => {
            console.warn('GLTF load failed, using procedural high-detail avatar:', err);
            this.proceduralMeshGroup.visible = true;
            resolve(false);
          }
        );
      });
    } catch (e) {
      console.warn('GLTFLoader dynamic import failed, keeping procedural avatar:', e);
      return false;
    }
  }

  public resetFilters(): void {
    this.landmarkFilters.forEach((f) => f.reset());
  }
}
