/**
 * SequenceAvatarCanvas: 3D Digital Human Sequence Signer for Indian Sign Language
 * 
 * Powered by AvatarActionEngine:
 * - Constructs an AvatarActionPlan before execution (communication type, non-manual markers, co-articulation).
 * - Multi-phase execution: IDLE -> PREPARING -> SIGNING -> COMPLETING -> IDLE.
 * - Non-Manual Question Action: eyebrow lift, forward head tilt, questioning gaze.
 * - Non-Manual Negation Action: head shake oscillation, furrowed brow, negation lip posture.
 * - Two-Hand Coordination: dominant stroke + support hand stability / synchronized mirroring.
 * - Natural idle state: autonomous breathing cycle (sine wave on chest & shoulders) and stochastic blinking.
 * - High-Visibility Mode toggle: enhanced studio lighting and edge contrast for clear finger reading.
 * - Accurate Skeleton Wireframe toggle: real bone hierarchy line segments and joint nodes.
 * - Accessible subtitles, interactive timeline scrub bar, replay, loop, and speed controls.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Activity,
  Sparkles,
  Repeat,
  Layers,
  Eye,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { HumanoidAvatar, FacialExpression } from './HumanoidModel';
import {
  AvatarActionEngine,
  AvatarActionPlan,
  CommunicationType,
  ActionPhase,
} from './AvatarActionEngine';
import { fetchSignSequence, SignSequenceResponse } from '../services/api';

export interface SequenceItem {
  token: string;
  type: 'library_sign' | 'fingerspelling';
  source_word: string;
  duration_ms: number;
  keyframe?: {
    normalized_landmarks: Array<{ x: number; y: number; z: number }>;
  } | null;
}

interface SequenceAvatarCanvasProps {
  initialSequence?: SequenceItem[];
  inputText?: string;
  autoPlay?: boolean;
  onSequenceComplete?: () => void;
  speed?: number;
}

export const SequenceAvatarCanvas: React.FC<SequenceAvatarCanvasProps> = ({
  initialSequence = [],
  inputText = '',
  autoPlay = true,
  onSequenceComplete,
  speed = 1.0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const avatarRef = useRef<HumanoidAvatar | null>(null);

  // Dedicated AvatarActionEngine
  const actionEngineRef = useRef<AvatarActionEngine>(new AvatarActionEngine());

  // Sequence and Engine State
  const [sequence, setSequence] = useState<SequenceItem[]>(initialSequence);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(speed);
  const [loop, setLoop] = useState<boolean>(false);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);
  const [highVisibility, setHighVisibility] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Communication & Action Plan Metadata
  const [commType, setCommType] = useState<CommunicationType>('STATEMENT');
  const [currentPhase, setCurrentPhase] = useState<ActionPhase>('IDLE');
  const [activeFacial, setActiveFacial] = useState<FacialExpression>('NEUTRAL');

  // Timing & Performance
  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());

  // Orbit camera drag state
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraAngleRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0,
    phi: 0.08,
    radius: 1.55,
  });

  // 1. Build or fetch sequence when inputText or initialSequence changes
  useEffect(() => {
    let isMounted = true;
    const loadSequenceFromText = async () => {
      if (!inputText || initialSequence.length > 0) return;
      setIsLoading(true);
      try {
        const res: SignSequenceResponse = await fetchSignSequence({ text: inputText });
        if (isMounted && res.sequence) {
          setSequence(res.sequence as any);
          setCurrentIdx(0);
          const plan = actionEngineRef.current.buildActionPlan(inputText, res.sequence as any);
          setCommType(plan.communicationType);
          setActiveFacial(plan.primaryFacialState);
          if (autoPlay) actionEngineRef.current.startExecution();
        }
      } catch (err) {
        console.error('Failed to fetch sign sequence:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (inputText && initialSequence.length === 0) {
      loadSequenceFromText();
    } else if (initialSequence.length > 0) {
      setSequence(initialSequence);
      setCurrentIdx(0);
      const plan = actionEngineRef.current.buildActionPlan(inputText, initialSequence);
      setCommType(plan.communicationType);
      setActiveFacial(plan.primaryFacialState);
      if (autoPlay) actionEngineRef.current.startExecution();
    }

    return () => { isMounted = false; };
  }, [inputText, initialSequence, autoPlay]);

  // Sync isPlaying with Engine
  useEffect(() => {
    if (isPlaying) {
      if (actionEngineRef.current.getEnginePhase() === 'IDLE') {
        actionEngineRef.current.startExecution();
      }
    } else {
      actionEngineRef.current.pauseExecution();
    }
  }, [isPlaying]);

  // 2. Setup Three.js WebGL Scene with 4-Point Studio Lighting
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Portrait Signing Space Camera ($36^\circ$ FOV)
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.82, 1.55);
    camera.lookAt(0, 0.82, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // 4-Point Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    // Warm Key Light (Front-Right Upper)
    const keyLight = new THREE.DirectionalLight(0xfff7ee, 1.6);
    keyLight.position.set(1.8, 2.5, 2.2);
    scene.add(keyLight);

    // Cool Soft Fill Light (Front-Left)
    const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.9);
    fillLight.position.set(-1.8, 1.4, 1.6);
    scene.add(fillLight);

    // Crisp Cyan Rim / Hair Light (Back-Top)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(0, 2.6, -2.0);
    scene.add(rimLight);

    // Under-Chin Warm Bounce Light
    const bounceLight = new THREE.DirectionalLight(0xfef08a, 0.35);
    bounceLight.position.set(0, -0.6, 1.2);
    scene.add(bounceLight);

    // Shadow Grid Floor
    const gridHelper = new THREE.GridHelper(4, 20, 0x3b82f6, 0x1e293b);
    gridHelper.position.set(0, 0, 0);
    scene.add(gridHelper);

    // Upgraded Digital Human HumanoidAvatar
    const avatar = new HumanoidAvatar({
      skinColor: 0xdca87d,
      clothColor: 0x1e273a,
      clothTrimColor: 0x334155,
      hairColor: 0x1f1917,
      enableDebugSkeleton: showSkeleton,
    });
    scene.add(avatar.rootGroup);
    avatarRef.current = avatar;

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  // Update Skeleton Visibility
  useEffect(() => {
    if (avatarRef.current) {
      avatarRef.current.setDebugVisible(showSkeleton);
    }
  }, [showSkeleton]);

  // Update High-Visibility Mode
  useEffect(() => {
    if (avatarRef.current) {
      avatarRef.current.setHighVisibility(highVisibility);
    }
  }, [highVisibility]);

  // 3. Animation Loop Driven by AvatarActionEngine
  const animate = useCallback((now: number) => {
    frameCountRef.current++;
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)));
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    const dtSeconds = Math.min(0.05, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;

    if (avatarRef.current) {
      // Execute coordinated engine step
      const updateResult = actionEngineRef.current.update(
        dtSeconds,
        avatarRef.current,
        playbackSpeed,
        isPlaying,
        (newIdx) => {
          setCurrentIdx(newIdx);
        },
        () => {
          if (loop) {
            actionEngineRef.current.startExecution();
          } else {
            setIsPlaying(false);
            if (onSequenceComplete) onSequenceComplete();
          }
        }
      );

      setCurrentPhase(updateResult.phase);
      setActiveFacial(updateResult.facialState);
    }

    // Camera Orbit Updates
    if (cameraRef.current) {
      const { theta, phi, radius } = cameraAngleRef.current;
      const targetY = 0.82;
      const x = radius * Math.sin(theta) * Math.cos(phi);
      const y = targetY + radius * Math.sin(phi);
      const z = radius * Math.cos(theta) * Math.cos(phi);
      cameraRef.current.position.set(x, y, z);
      cameraRef.current.lookAt(0, targetY, 0);
    }

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    reqIdRef.current = requestAnimationFrame(animate);
  }, [isPlaying, playbackSpeed, loop, onSequenceComplete]);

  useEffect(() => {
    reqIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [animate]);

  // Orbit Mouse Controls
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    cameraAngleRef.current.theta -= dx * 0.008;
    cameraAngleRef.current.phi = Math.max(-0.35, Math.min(0.55, cameraAngleRef.current.phi + dy * 0.008));
  };

  const handleMouseUp = () => { isDraggingRef.current = false; };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraAngleRef.current.radius = Math.max(1.1, Math.min(2.8, cameraAngleRef.current.radius + e.deltaY * 0.0018));
  };

  const handleReset = () => {
    actionEngineRef.current.startExecution();
    setCurrentIdx(0);
    setIsPlaying(true);
  };

  const activeItem = sequence[currentIdx];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: '#0f172a',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid rgba(59, 130, 246, 0.25)',
      }}
    >
      {/* Header Info Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="#38bdf8" /> 3D Digital Human Sign Interpreter
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              color: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Activity size={12} /> {fps} FPS WebGL
          </span>
          {/* Communication Type Badge */}
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: commType === 'QUESTION' ? '#fbbf24' : commType === 'NEGATION' ? '#f87171' : '#34d399',
              backgroundColor: commType === 'QUESTION' ? 'rgba(251, 191, 36, 0.15)' : commType === 'NEGATION' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(52, 211, 153, 0.15)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: `1px solid ${commType === 'QUESTION' ? 'rgba(251, 191, 36, 0.4)' : commType === 'NEGATION' ? 'rgba(248, 113, 113, 0.4)' : 'rgba(52, 211, 153, 0.4)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {commType === 'QUESTION' && <HelpCircle size={12} />}
            {commType === 'NEGATION' && <AlertCircle size={12} />}
            {commType === 'STATEMENT' && <CheckCircle2 size={12} />}
            {commType} (NMM Active)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Sign Visibility Mode Toggle */}
          <button
            onClick={() => setHighVisibility(!highVisibility)}
            style={{
              background: highVisibility ? 'rgba(234, 179, 8, 0.25)' : 'rgba(30, 41, 59, 0.6)',
              border: highVisibility ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid rgba(148, 163, 184, 0.2)',
              color: highVisibility ? '#facc15' : '#94a3b8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Enhance finger clarity and studio contrast"
          >
            <Eye size={12} /> {highVisibility ? '✓ High-Visibility On' : 'High-Visibility Mode'}
          </button>

          {/* Skeleton Wireframe Toggle */}
          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            style={{
              background: showSkeleton ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: showSkeleton ? '#38bdf8' : '#94a3b8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {showSkeleton ? '✓ Skeleton Active' : 'Skeleton Wireframe'}
          </button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '380px',
          borderRadius: '10px',
          overflow: 'hidden',
          cursor: 'grab',
          background: '#0a0f1d',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Synchronized Subtitles (Large, Accessible, High-Contrast) */}
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '8px',
            padding: '10px 24px',
            textAlign: 'center',
            minWidth: '320px',
            maxWidth: '90%',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeItem?.type === 'fingerspelling' ? 'Manual Fingerspelling' : 'ISL Vocabulary Sign'} • Phase: {currentPhase}
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
            {activeItem?.token.replace(/_/g, ' ') || 'IDLE BREATHING'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#93c5fd', marginTop: '2px' }}>
            Source: <strong>{activeItem?.source_word || (inputText ? inputText.slice(0, 30) : 'Natural Eye Contact')}</strong>
          </div>
        </div>

        {/* Step Indicator Top-Left */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            color: '#e2e8f0',
          }}
        >
          Sign <strong style={{ color: '#60a5fa' }}>{sequence.length > 0 ? currentIdx + 1 : 0}</strong> of <strong>{sequence.length}</strong>
        </div>

        {/* Orbit Hint Top-Right */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.7rem',
            color: '#94a3b8',
          }}
        >
          Drag to rotate • Scroll to zoom
        </div>
      </div>

      {/* Sequence Timeline Pill Bar (Click to scrub / jump) */}
      {sequence.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Continuous Sequence Timeline (Click any sign to jump):
          </div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {sequence.map((item, idx) => {
              const isCurrent = idx === currentIdx;
              const isLibrary = item.type === 'library_sign';
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentIdx(idx);
                    actionEngineRef.current.setActionIndex(idx);
                    if (avatarRef.current) avatarRef.current.resetFilters();
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: isCurrent
                      ? '1px solid #38bdf8'
                      : '1px solid rgba(148, 163, 184, 0.2)',
                    cursor: 'pointer',
                    backgroundColor: isCurrent
                      ? (isLibrary ? '#2563eb' : '#d97706')
                      : 'rgba(30, 41, 59, 0.6)',
                    color: isCurrent ? '#ffffff' : '#94a3b8',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {idx + 1}. {item.token}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Playback Controls & Speed Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(148, 163, 184, 0.2)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Play Sequence'}
          </button>
          <button
            className="btn"
            onClick={handleReset}
            style={{ background: '#334155', color: 'white', fontSize: '0.8rem', padding: '6px 14px' }}
          >
            <RotateCcw size={14} /> Replay
          </button>
          <button
            onClick={() => setLoop(!loop)}
            style={{
              background: loop ? 'rgba(59, 130, 246, 0.3)' : 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: loop ? '#60a5fa' : '#94a3b8',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Repeat size={14} /> {loop ? 'Looping' : 'Loop'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FastForward size={14} color="#94a3b8" />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Playback Speed:</span>
          {[0.5, 0.75, 1.0, 1.5, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              style={{
                background: playbackSpeed === s ? '#3b82f6' : 'rgba(51, 65, 85, 0.5)',
                color: playbackSpeed === s ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
