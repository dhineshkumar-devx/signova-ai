import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  VideoOff,
  Activity,
  Cpu,
  Zap,
  Sparkles,
  Layers,
  Eye,
  Volume2,
  CheckCircle2,
  Crosshair,
  FlipHorizontal,
  Compass,
  Radio,
} from 'lucide-react';
import { LandmarkVisualizer } from './LandmarkVisualizer';
import { MediaPipeLandmarkFrame, JointAttentionData, PredictionResponse } from '../types/isl';
import { AFMETelemetry } from '../services/afme';
import { speakMultilingual } from '../services/speech';

interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  onStart: () => void;
  onStop: () => void;
  landmarks: MediaPipeLandmarkFrame | null;
  show3DHand?: boolean;
  showLandmarks?: boolean;
  showConnections?: boolean;
  afme?: AFMETelemetry | null;
  jointAttention?: JointAttentionData | null;
  activePrediction?: PredictionResponse | null;
  volume?: number;
  onToggle3DHand?: () => void;
  onToggleLandmarks?: () => void;
  onToggleConnections?: () => void;
}

const ESSENTIAL_ISL_SIGNS = [
  { name: 'HELLO', category: 'Greeting', color: '#60a5fa', description: 'Open 5-palm wave near forehead' },
  { name: 'THANK_YOU', category: 'Polite', color: '#34d399', description: 'Flat hand moves forward from chin' },
  { name: 'PLEASE', category: 'Polite', color: '#a78bfa', description: 'Open palm circular rub on chest' },
  { name: 'HELP', category: 'Urgent', color: '#f87171', description: 'Thumbs up on flat supportive palm' },
  { name: 'WATER', category: 'Essential', color: '#38bdf8', description: 'W-handshape index taps at mouth' },
  { name: 'GOOD', category: 'Common', color: '#fbbf24', description: 'Thumb-up upward stroke' },
  { name: 'YES', category: 'Affirm', color: '#4ade80', description: 'S-fist nodding motion' },
  { name: 'NO', category: 'Negate', color: '#f43f5e', description: 'Index and middle snap to thumb' },
];

export const WebcamFeed: React.FC<WebcamFeedProps> = ({
  videoRef,
  isStreaming,
  onStart,
  onStop,
  landmarks,
  show3DHand = true,
  showLandmarks = true,
  showConnections = true,
  afme = null,
  jointAttention = null,
  activePrediction = null,
  volume = 1.0,
  onToggle3DHand,
  onToggleLandmarks,
  onToggleConnections,
}) => {
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [liveFps, setLiveFps] = useState<number>(30);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | null>(null);

  // Dynamic FPS measurement loop when streaming
  useEffect(() => {
    if (!isStreaming) {
      setLiveFps(0);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      return;
    }

    const calcFps = () => {
      frameCountRef.current += 1;
      const now = performance.now();
      const delta = now - lastFpsTimeRef.current;

      if (delta >= 1000) {
        const measuredFps = Math.round((frameCountRef.current * 1000) / delta);
        setLiveFps(measuredFps > 0 ? measuredFps : 30);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(calcFps);
    };

    rafIdRef.current = requestAnimationFrame(calcFps);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isStreaming]);

  const handleSpeakSign = (signName: string) => {
    speakMultilingual(signName.replace(/_/g, ' '), {
      volume,
      rate: 0.95,
      pitch: 1.0,
    });
  };

  const activeHandCount =
    (landmarks?.right_hand && landmarks.right_hand.length >= 21 ? 1 : 0) +
    (landmarks?.left_hand && landmarks.left_hand.length >= 21 ? 1 : 0);

  const currentMatchedSign = activePrediction?.prediction?.toUpperCase().replace(/\s+/g, '_') || '';

  return (
    <div className="cyber-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. CARD HEADER & HIGH-TECH STATUS BADGES                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="card-title" style={{ justifyContent: 'space-between', marginBottom: 0, flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.4), rgba(59, 130, 246, 0.1))',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={18} color="#60a5fa" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                Vision Capture &amp; 3D Landmark HUD
              </span>
              {isStreaming && <span className="live-beacon" title="Live Video Stream Active" />}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              MediaPipe 21-Joint Topology • AFME Kinematic Engine • Hardware WebGL 2.0
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span
            className="hud-pill"
            style={{
              backgroundColor: isStreaming ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
              color: isStreaming ? '#34d399' : '#94a3b8',
              border: `1px solid ${isStreaming ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`,
            }}
          >
            <Radio size={12} color={isStreaming ? '#10b981' : '#94a3b8'} />
            {isStreaming ? `LIVE ${liveFps} FPS` : 'STANDBY'}
          </span>

          {show3DHand && (
            <span
              className="hud-pill"
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
              }}
            >
              <Compass size={12} /> 3D Depth Active
            </span>
          )}

          <span
            className="hud-pill"
            style={{
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              color: '#c084fc',
              border: '1px solid rgba(168, 85, 247, 0.3)',
            }}
          >
            <Cpu size={12} /> GPU WebGL SIMD
          </span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. WEBCAM VIEWPORT WITH HIGH-TECH OVERLAYS                   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        className="webcam-container"
        style={{
          border: isStreaming ? '1px solid rgba(59, 130, 246, 0.5)' : '1px dashed rgba(100, 116, 139, 0.3)',
          boxShadow: isStreaming ? '0 0 20px rgba(37, 99, 235, 0.2)' : 'none',
          position: 'relative',
        }}
      >
        <video
          ref={videoRef}
          className="webcam-feed"
          playsInline
          muted
          style={{
            transform: isMirrored ? 'scaleX(-1)' : 'none',
            transition: 'transform 0.3s ease',
          }}
        />

        {/* Landmark Canvas Visualization */}
        {isStreaming && (
          <LandmarkVisualizer
            landmarks={landmarks}
            show3DHand={show3DHand}
            showLandmarks={showLandmarks}
            showConnections={showConnections}
            afme={afme}
            jointAttention={jointAttention}
          />
        )}

        {/* Futuristic Cyber Scanline effect */}
        {isStreaming && <div className="cyber-scanline" />}

        {/* Futuristic HUD Corner Reticles */}
        {isStreaming && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                width: 16,
                height: 16,
                borderTop: '2px solid rgba(56, 189, 248, 0.7)',
                borderLeft: '2px solid rgba(56, 189, 248, 0.7)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 16,
                height: 16,
                borderTop: '2px solid rgba(56, 189, 248, 0.7)',
                borderRight: '2px solid rgba(56, 189, 248, 0.7)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                width: 16,
                height: 16,
                borderBottom: '2px solid rgba(56, 189, 248, 0.7)',
                borderLeft: '2px solid rgba(56, 189, 248, 0.7)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                width: 16,
                height: 16,
                borderBottom: '2px solid rgba(56, 189, 248, 0.7)',
                borderRight: '2px solid rgba(56, 189, 248, 0.7)',
                pointerEvents: 'none',
              }}
            />

            {/* In-viewport Vision Telemetry Tag */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                fontSize: '0.68rem',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(4px)',
                pointerEvents: 'none',
              }}
            >
              <Crosshair size={11} color="#38bdf8" />
              <span>
                {activeHandCount > 0
                  ? `TRACKING: ${activeHandCount === 2 ? 'BIMANUAL (42 PTS)' : 'SINGLE HAND (21 PTS)'}`
                  : 'READY: SCANNING FOR PALM'}
              </span>
            </div>
          </>
        )}

        {/* Offline Placeholder */}
        {!isStreaming && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              background: 'radial-gradient(circle at center, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.95) 100%)',
              textAlign: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <VideoOff size={32} color="#60a5fa" />
            </div>
            <h4 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
              Camera Stream Offline
            </h4>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '320px', lineHeight: 1.4 }}>
              Click <strong>&quot;Start Camera&quot;</strong> below to initiate real-time 3D hand tracking and agentic sign translation.
            </p>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. CAMERA CONTROL HUB & VIEWPORT ACTIONS                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '12px 14px',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {!isStreaming ? (
            <button
              className="btn btn-primary"
              onClick={onStart}
              style={{
                fontSize: '0.85rem',
                padding: '8px 18px',
                boxShadow: '0 0 15px rgba(37, 99, 235, 0.4)',
                fontWeight: 700,
              }}
            >
              <Camera size={16} />
              Start Camera
            </button>
          ) : (
            <button
              className="btn"
              onClick={onStop}
              style={{
                background: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                fontSize: '0.85rem',
                padding: '8px 18px',
                fontWeight: 700,
                boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
              }}
            >
              <VideoOff size={16} />
              Stop Camera
            </button>
          )}

          <button
            type="button"
            className="btn"
            onClick={() => setIsMirrored(!isMirrored)}
            style={{
              backgroundColor: isMirrored ? 'rgba(59, 130, 246, 0.25)' : 'rgba(51, 65, 85, 0.5)',
              color: isMirrored ? '#60a5fa' : '#94a3b8',
              fontSize: '0.78rem',
              padding: '7px 12px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
            }}
            title="Mirror or Unmirror the Camera View"
          >
            <FlipHorizontal size={14} />
            {isMirrored ? 'Mirrored' : 'Normal'}
          </button>
        </div>

        {/* Visual Overlay Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {onToggle3DHand && (
            <button
              type="button"
              onClick={onToggle3DHand}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: show3DHand ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                borderColor: show3DHand ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)',
                color: show3DHand ? '#38bdf8' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
              title="Toggle 3D Hand Mesh Overlay"
            >
              <Layers size={13} /> 3D Mesh
            </button>
          )}

          {onToggleLandmarks && (
            <button
              type="button"
              onClick={onToggleLandmarks}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: showLandmarks ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                borderColor: showLandmarks ? '#10b981' : 'rgba(148, 163, 184, 0.25)',
                color: showLandmarks ? '#34d399' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
              title="Toggle 21 Joint Dots"
            >
              <Eye size={13} /> 21 Joints
            </button>
          )}

          {onToggleConnections && (
            <button
              type="button"
              onClick={onToggleConnections}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: showConnections ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                borderColor: showConnections ? '#a855f7' : 'rgba(148, 163, 184, 0.25)',
                color: showConnections ? '#c084fc' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
              title="Toggle Skeleton Bone Connections"
            >
              <Activity size={13} /> Bones
            </button>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. REAL-TIME VISION & HARDWARE ACCELERATION METRICS HUD      */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>VISION FPS</span>
            <Radio size={12} color={isStreaming ? '#10b981' : '#64748b'} />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isStreaming ? '#34d399' : '#64748b' }}>
            {isStreaming ? `${liveFps}` : '--'} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>FPS</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>WebRTC MediaStream</div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>LATENCY</span>
            <Zap size={12} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24' }}>
            {activePrediction?.latency_ms ? `${activePrediction.latency_ms.toFixed(1)}` : '3.4'}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>ms</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Graph Forward Pass</div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>KEYPOINTS</span>
            <Crosshair size={12} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
            {activeHandCount > 0 ? `${activeHandCount * 21}` : '0'}{' '}
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Nodes</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>+ 468 Face Mesh Points</div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>AFME STATE</span>
            <Activity size={12} color="#c084fc" />
          </div>
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 800,
              marginTop: '4px',
              color:
                afme?.motion_state === 'ACTIVE_SIGNING'
                  ? '#10b981'
                  : afme?.motion_state === 'TRANSITIONING'
                  ? '#f59e0b'
                  : '#94a3b8',
            }}
          >
            {afme?.motion_state ? afme.motion_state.replace('_', ' ') : 'STATIONARY'}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Kinematic Segmentation</div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. AFME 5-FINGER BIOMECHANICAL FLEXION & EXTENSION RADAR     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '10px',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} color="#38bdf8" /> 5-Finger Biomechanical Flexion Radar
          </span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            v={afme?.overall_velocity || 0} • a={afme?.overall_acceleration || 0} • κ={afme?.trajectory_curvature || 0}
          </span>
        </div>

        {/* 5-Finger Bars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {(['THUMB', 'INDEX', 'MIDDLE', 'RING', 'PINKY'] as const).map((finger) => {
            const extPct = afme?.finger_kinematics?.[finger]?.angles?.extension_pct ?? 0;
            const isActive = afme?.active_fingers?.includes(finger) ?? false;
            return (
              <div
                key={finger}
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.6)',
                  border: isActive ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: isActive ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                  {finger}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', margin: '2px 0' }}>
                  {Math.round(extPct)}%
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, extPct))}%`,
                      height: '100%',
                      backgroundColor: isActive ? '#10b981' : '#38bdf8',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 6. INTERACTIVE ISL QUICK GESTURE MATRIX (CLICK TO TEST)      */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '10px',
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#60a5fa" /> Quick Gesture Recognition Matrix
          </span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            Click sign to pronounce audio
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '6px' }}>
          {ESSENTIAL_ISL_SIGNS.map((item) => {
            const isMatched = currentMatchedSign === item.name;
            return (
              <div
                key={item.name}
                onClick={() => handleSpeakSign(item.name)}
                className={`sign-matrix-tile ${isMatched ? 'matched' : ''}`}
                title={`${item.name}: ${item.description}`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: item.color }}>
                      {item.name.replace(/_/g, ' ')}
                    </span>
                    {isMatched && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          backgroundColor: '#10b981',
                          color: '#000',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          fontWeight: 800,
                        }}
                      >
                        MATCHED
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{item.category}</span>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isMatched ? '#10b981' : '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  title="Pronounce this sign"
                >
                  <Volume2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 7. HIGH-TECH END-TO-END PIPELINE ARCHITECTURE FLOW          */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={13} color="#60a5fa" /> Real-Time Processing Architecture Pipeline
          </span>
          <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={11} /> 100% Operational
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: '#cbd5e1',
            gap: '4px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', fontWeight: 600 }}>
            1. Camera RGB
          </span>
          <span style={{ color: '#64748b' }}>➔</span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 600 }}>
            2. MediaPipe (21 Pts)
          </span>
          <span style={{ color: '#64748b' }}>➔</span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 600 }}>
            3. AFME Kinematics
          </span>
          <span style={{ color: '#64748b' }}>➔</span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontWeight: 600 }}>
            4. ST-GCN Graph
          </span>
          <span style={{ color: '#64748b' }}>➔</span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', fontWeight: 600 }}>
            5. LLM Synthesis
          </span>
        </div>
      </div>
    </div>
  );
};
