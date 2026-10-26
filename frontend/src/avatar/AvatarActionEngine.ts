/**
 * SIGNOVA AI: Dedicated AvatarActionEngine
 * 
 * Architecture:
 * Speech / Text -> LLM / ISL Translation -> Sign Sequence -> AvatarActionEngine
 *   -> Hand Controller
 *   -> Finger Controller
 *   -> Arm Controller
 *   -> Body Controller
 *   -> Head Controller
 *   -> Face Controller
 *   -> 3D Avatar (HumanoidAvatar)
 * 
 * Features:
 * - Constructs AvatarActionPlan before execution (communication type, non-manual markers, trajectories).
 * - Continuous Signing with smooth co-articulation (Anticipation -> Stroke -> Hold -> Release -> Transition).
 * - Multi-phase execution: IDLE -> PREPARING -> SIGNING -> COMPLETING -> IDLE.
 * - Non-Manual Question Action (eyebrow lift, forward head tilt, questioning gaze).
 * - Non-Manual Negation Action (head shake oscillation, furrowed brow, negation lip posture).
 * - Two-Hand Coordination: dominant stroke + support hand stability / synchronized mirroring.
 * - Autonomous idle breathing and stochastic blinking when not signing.
 */

import * as THREE from 'three';
import { HumanoidAvatar, FacialExpression } from './HumanoidModel';
import {
  solveVerifiedSignPosture,
  TwoHandedAvatarPose,
  VERIFIED_ISL_SIGN_POSES,
  HANDSHAPES,
  FingerCurlValues,
} from './avatarIK';

export type CommunicationType =
  | 'STATEMENT'
  | 'QUESTION'
  | 'NEGATION'
  | 'GREETING'
  | 'REQUEST'
  | 'EMPHASIS';

export type ActionPhase =
  | 'IDLE'
  | 'PREPARING'
  | 'SIGNING'
  | 'TRANSITION'
  | 'COMPLETING';

export interface StructuredHandKeyframe {
  wristPos: [number, number, number];
  wristRot: [number, number, number];
  handshapeName: string;
  curls: FingerCurlValues;
  spreads?: { index?: number; middle?: number; ring?: number; pinky?: number; thumb?: number };
}

export interface StructuredSignAction {
  token: string;
  gloss: string;
  sourceWord: string;
  durationMs: number;
  dominantHand: StructuredHandKeyframe;
  supportHand?: StructuredHandKeyframe;
  facialState: FacialExpression;
  headTilt: number;
  headPitch: number;
  headYaw: number;
  isNegationHeadShake?: boolean;
  isQuestionHeadTilt?: boolean;
  rawLandmarks?: Array<{ x: number; y: number; z: number }>;
}

export interface AvatarActionPlan {
  inputText: string;
  communicationType: CommunicationType;
  dominantHand: 'RIGHT' | 'LEFT';
  primaryFacialState: FacialExpression;
  actions: StructuredSignAction[];
  totalDurationMs: number;
  grammarNotes: string;
}

export class AvatarActionEngine {
  // Current plan & state
  private currentPlan: AvatarActionPlan | null = null;
  private currentActionIdx: number = 0;
  private enginePhase: ActionPhase = 'IDLE';

  // Timing tracking
  private phaseElapsedTimeMs: number = 0;
  private tokenElapsedTimeMs: number = 0;
  private negationShakeOscillator: number = 0;

  // Smoothing Hermite ease function
  private hermiteEase(t: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped * clamped * (3 - 2 * clamped);
  }

  /**
   * Constructs an AvatarActionPlan from text or raw token sequences.
   */
  public buildActionPlan(
    inputText: string,
    rawTokens: Array<{ token: string; source_word?: string; duration_ms?: number; keyframe?: any }> = []
  ): AvatarActionPlan {
    const textLower = (inputText || '').toLowerCase().trim();

    // 1. Detect Sentence Intent & Communication Type
    let commType: CommunicationType = 'STATEMENT';
    let defaultFacialState: FacialExpression = 'NEUTRAL';
    let isQuestion = false;
    let isNegation = false;

    if (
      textLower.includes('?') ||
      /\b(where|what|who|when|why|how|which|can you|is there|kahan|kyun|kaise|kya)\b/.test(textLower)
    ) {
      commType = 'QUESTION';
      defaultFacialState = 'QUESTION';
      isQuestion = true;
    } else if (
      /\b(no|not|don't|dont|cannot|cant|never|stop|none|nahi|mat)\b/.test(textLower)
    ) {
      commType = 'NEGATION';
      defaultFacialState = 'NEGATION';
      isNegation = true;
    } else if (
      /\b(hello|hi|namaste|good morning|welcome|greetings|morning)\b/.test(textLower)
    ) {
      commType = 'GREETING';
      defaultFacialState = 'HAPPY';
    } else if (
      /\b(help|please|urgent|emergency|doctor|hospital)\b/.test(textLower)
    ) {
      commType = 'REQUEST';
      defaultFacialState = 'CONCERNED';
    }

    // 2. Build Structured Sign Actions
    const structuredActions: StructuredSignAction[] = [];
    let cumulativeDuration = 0;

    // If rawTokens provided, use them; otherwise extract words
    const tokensToProcess = rawTokens.length > 0
      ? rawTokens
      : textLower
          .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => ({ token: w.toUpperCase(), source_word: w }));

    for (const item of tokensToProcess) {
      const tokenUpper = item.token.toUpperCase().replace(/^FS_/, '');
      const isFs = item.token.startsWith('FS_');

      // Look up verified ISL pose
      const verifiedPose = VERIFIED_ISL_SIGN_POSES[tokenUpper] || VERIFIED_ISL_SIGN_POSES[item.token];

      const duration = item.duration_ms || (isFs ? 500 : 1200);
      cumulativeDuration += duration;

      let dominantHand: StructuredHandKeyframe;
      let supportHand: StructuredHandKeyframe | undefined;

      if (verifiedPose) {
        dominantHand = {
          wristPos: verifiedPose.rightWristPos,
          wristRot: verifiedPose.rightWristRot || [0, 0, 0],
          handshapeName: tokenUpper,
          curls: verifiedPose.rightHandshape,
        };
        if (verifiedPose.leftWristPos) {
          supportHand = {
            wristPos: verifiedPose.leftWristPos,
            wristRot: verifiedPose.leftWristRot || [0, 0, 0],
            handshapeName: verifiedPose.leftHandshape ? 'SUPPORT' : 'REST',
            curls: verifiedPose.leftHandshape || HANDSHAPES.REST,
          };
        }
      } else {
        // Fallback or fingerspelling default
        dominantHand = {
          wristPos: [0.14, 0.12, 0.28],
          wristRot: [0.2, 0, 0.1],
          handshapeName: isFs ? `FS_${tokenUpper}` : 'OPEN_5',
          curls: HANDSHAPES.OPEN_5,
        };
        supportHand = {
          wristPos: [-0.24, -0.18, 0.05],
          wristRot: [0, 0, 0],
          handshapeName: 'REST',
          curls: HANDSHAPES.REST,
        };
      }

      // Determine per-token facial & head dynamics
      let tokenFacial = defaultFacialState;
      let tokenHeadTilt = 0;
      let tokenHeadPitch = 0;
      let tokenHeadYaw = 0;

      if (isQuestion) {
        tokenHeadPitch = 0.08;
        tokenFacial = 'QUESTION';
      } else if (isNegation && (tokenUpper === 'NO' || tokenUpper === 'STOP')) {
        tokenFacial = 'NEGATION';
      } else if (tokenUpper === 'NAMASTE' || tokenUpper === 'THANK_YOU') {
        tokenFacial = 'CONFIRMATION';
        tokenHeadPitch = 0.12;
      } else if (tokenUpper === 'HELP') {
        tokenFacial = 'CONCERNED';
      }

      structuredActions.push({
        token: item.token,
        gloss: tokenUpper,
        sourceWord: item.source_word || item.token,
        durationMs: duration,
        dominantHand,
        supportHand,
        facialState: tokenFacial,
        headTilt: tokenHeadTilt,
        headPitch: tokenHeadPitch,
        headYaw: tokenHeadYaw,
        isNegationHeadShake: isNegation,
        isQuestionHeadTilt: isQuestion,
        rawLandmarks: item.keyframe?.normalized_landmarks,
      });
    }

    const plan: AvatarActionPlan = {
      inputText,
      communicationType: commType,
      dominantHand: 'RIGHT',
      primaryFacialState: defaultFacialState,
      actions: structuredActions,
      totalDurationMs: cumulativeDuration,
      grammarNotes: `Grammar Order: Topic-Comment ISL Structure. Non-Manual Markers: ${commType} mode.`,
    };

    this.currentPlan = plan;
    this.currentActionIdx = 0;
    this.enginePhase = 'IDLE';
    this.phaseElapsedTimeMs = 0;
    this.tokenElapsedTimeMs = 0;

    return plan;
  }

  /**
   * Resets the engine to start playback of the current plan.
   */
  public startExecution(): void {
    if (!this.currentPlan || this.currentPlan.actions.length === 0) return;
    this.currentActionIdx = 0;
    this.enginePhase = 'PREPARING';
    this.phaseElapsedTimeMs = 0;
    this.tokenElapsedTimeMs = 0;
  }

  /**
   * Stops or pauses execution and returns to natural idle.
   */
  public pauseExecution(): void {
    this.enginePhase = 'IDLE';
  }

  /**
   * Main Controller Loop: coordinates Hand, Finger, Arm, Body, Head, and Face layers.
   */
  public update(
    dtSeconds: number,
    avatar: HumanoidAvatar,
    playbackSpeed: number = 1.0,
    isPlaying: boolean = true,
    onTokenAdvanced?: (idx: number) => void,
    onPlanComplete?: () => void
  ): {
    phase: ActionPhase;
    activeToken: string;
    communicationType: CommunicationType;
    facialState: FacialExpression;
    progress: number;
  } {
    const dtMs = dtSeconds * 1000 * playbackSpeed;

    // 1. If not playing or no plan, run natural idle breathing & blinking
    if (!isPlaying || !this.currentPlan || this.currentPlan.actions.length === 0) {
      avatar.updateIdle(performance.now(), dtSeconds);
      avatar.setFacialExpression(this.currentPlan?.primaryFacialState || 'NEUTRAL', 0.1);
      return {
        phase: 'IDLE',
        activeToken: '',
        communicationType: this.currentPlan?.communicationType || 'STATEMENT',
        facialState: 'NEUTRAL',
        progress: 0,
      };
    }

    // Always update autonomous micro-eye blinking & subtle chest breathing
    avatar.updateIdle(performance.now(), dtSeconds);

    const now = performance.now();
    const actions = this.currentPlan.actions;
    const activeAction = actions[this.currentActionIdx];

    // ─────────────────────────────────────────────────────────────
    // STATE MACHINE: IDLE -> PREPARING -> SIGNING -> COMPLETING -> IDLE
    // ─────────────────────────────────────────────────────────────

    if (this.enginePhase === 'PREPARING') {
      this.phaseElapsedTimeMs += dtMs;
      const prepDuration = 320; // 320ms smooth lift to signing space
      const t = this.hermiteEase(this.phaseElapsedTimeMs / prepDuration);

      // Raise hands smoothly toward first sign position
      avatar.applySign(activeAction.token, activeAction.rawLandmarks, now, t * 0.45);
      avatar.setFacialExpression(this.currentPlan.primaryFacialState, 0.2);

      if (this.phaseElapsedTimeMs >= prepDuration) {
        this.enginePhase = 'SIGNING';
        this.tokenElapsedTimeMs = 0;
      }

      return {
        phase: 'PREPARING',
        activeToken: activeAction.token,
        communicationType: this.currentPlan.communicationType,
        facialState: this.currentPlan.primaryFacialState,
        progress: t,
      };
    }

    if (this.enginePhase === 'SIGNING') {
      this.tokenElapsedTimeMs += dtMs;
      const tokenDuration = activeAction.durationMs / playbackSpeed;
      const progress = Math.min(1.0, this.tokenElapsedTimeMs / tokenDuration);

      // Smooth co-articulation blending between consecutive signs
      const blendAlpha = Math.min(1.0, 0.18 * playbackSpeed + this.hermiteEase(progress) * 0.16);

      // 1. Arm & Hand Controller
      avatar.applySign(activeAction.token, activeAction.rawLandmarks, now, blendAlpha);

      // 2. Face Controller (Non-Manual Grammar)
      avatar.setFacialExpression(activeAction.facialState, 0.2);

      // 3. Head Controller (Question Tilt & Negation Shake)
      if (activeAction.isNegationHeadShake) {
        this.negationShakeOscillator += dtSeconds * 12.0; // 2 Hz oscillation
        const shakeYaw = Math.sin(this.negationShakeOscillator) * 0.16;
        avatar.headNode.rotation.y = shakeYaw;
      } else if (activeAction.isQuestionHeadTilt) {
        avatar.headNode.rotation.x = THREE.MathUtils.lerp(avatar.headNode.rotation.x, 0.08, 0.1);
        avatar.headNode.rotation.z = THREE.MathUtils.lerp(avatar.headNode.rotation.z, -0.04, 0.1);
      }

      // Check for token completion and advance
      if (this.tokenElapsedTimeMs >= tokenDuration) {
        this.tokenElapsedTimeMs = 0;
        if (this.currentActionIdx < actions.length - 1) {
          this.currentActionIdx++;
          if (onTokenAdvanced) onTokenAdvanced(this.currentActionIdx);
        } else {
          // All signs completed -> enter graceful completion phase
          this.enginePhase = 'COMPLETING';
          this.phaseElapsedTimeMs = 0;
        }
      }

      return {
        phase: 'SIGNING',
        activeToken: activeAction.token,
        communicationType: this.currentPlan.communicationType,
        facialState: activeAction.facialState,
        progress,
      };
    }

    if (this.enginePhase === 'COMPLETING') {
      this.phaseElapsedTimeMs += dtMs;
      const completeDuration = 380; // 380ms smooth descent to rest
      const t = this.hermiteEase(this.phaseElapsedTimeMs / completeDuration);

      // Smooth return to neutral rest posture
      avatar.applyNeutralRestPose();
      avatar.setFacialExpression('NEUTRAL', 0.2);

      if (this.phaseElapsedTimeMs >= completeDuration) {
        this.enginePhase = 'IDLE';
        if (onPlanComplete) onPlanComplete();
      }

      return {
        phase: 'COMPLETING',
        activeToken: activeAction.token,
        communicationType: this.currentPlan.communicationType,
        facialState: 'NEUTRAL',
        progress: t,
      };
    }

    // Default IDLE
    avatar.applyNeutralRestPose();
    return {
      phase: 'IDLE',
      activeToken: '',
      communicationType: this.currentPlan.communicationType,
      facialState: 'NEUTRAL',
      progress: 0,
    };
  }

  public getCurrentPlan(): AvatarActionPlan | null {
    return this.currentPlan;
  }

  public getCurrentActionIdx(): number {
    return this.currentActionIdx;
  }

  public setActionIndex(idx: number): void {
    if (this.currentPlan && idx >= 0 && idx < this.currentPlan.actions.length) {
      this.currentActionIdx = idx;
      this.tokenElapsedTimeMs = 0;
      this.enginePhase = 'SIGNING';
    }
  }

  public getEnginePhase(): ActionPhase {
    return this.enginePhase;
  }
}
