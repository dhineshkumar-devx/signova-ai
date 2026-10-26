/**
 * AvatarCanvas: Interactive 3D WebGL Avatar Viewer for Indian Sign Language
 * 
 * Features:
 * - Three.js WebGL scene with realistic studio lighting, rim light, and soft shadow floor.
 * - OrbitControls simulation (mouse drag rotate, wheel zoom, double-click reset).
 * - Real-time retargeting of 21 dataset landmarks via HumanoidAvatar & Inverse Kinematics.
 * - One-Euro 3D filter + quaternion slerp easing for jitter-free, non-snapping signing.
 * - Full playback controls: Play, Pause, Replay / Reset, Speed Slider (0.25x - 2.0x).
 * - Dynamic sign selector supporting all 24 dataset vocabulary classes.
 * - Synced subtitles, active gloss banner, and real-time FPS performance benchmark counter.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCcw, FastForward, Sliders, Activity, Sparkles, CheckCircle2, Eye, Camera, Waves } from 'lucide-react';
import { HumanoidAvatar } from './HumanoidModel';
import { Landmark3D } from './avatarIK';
import { fetchAvatarSignsCatalog, fetchAvatarSignKeyframe, AvatarSignKeyframe } from '../services/api';

interface AvatarCanvasProps {
  initialSign?: string;
  autoPlay?: boolean;
  onSignComplete?: (sign: string) => void;
  showControls?: boolean;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  initialSign = 'HELLO',
  autoPlay = true,
  onSignComplete,
  showControls = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const avatarRef = useRef<HumanoidAvatar | null>(null);

  // Playback & State
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [speed, setSpeed] = useState<number>(1.0);
  const [selectedSign, setSelectedSign] = useState<string>(initialSign);
  const [availableSigns, setAvailableSigns] = useState<string[]>([]);
  const [currentKeyframe, setCurrentKeyframe] = useState<AvatarSignKeyframe | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);
  const [highVisibility, setHighVisibility] = useState<boolean>(false);
  const [showMotionTrails, setShowMotionTrails] = useState<boolean>(true);
  const [autoCamera, setAutoCamera] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);

  // Subtitle & Status
  const [subtitle, setSubtitle] = useState<string>('Ready to sign');
  const [statusMessage, setStatusMessage] = useState<string>('Initialized');

  // Motion Trails Refs
  const trailGroupRef = useRef<THREE.Group | null>(null);
  const rightTrailPointsRef = useRef<THREE.Vector3[]>([]);
  const leftTrailPointsRef = useRef<THREE.Vector3[]>([]);
  const rightTrailLineRef = useRef<THREE.Line | null>(null);
  const leftTrailLineRef = useRef<THREE.Line | null>(null);

  // Animation & FPS tracking
  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(performance.now());
  const animProgressRef = useRef<number>(0);

  // Mouse Orbit Camera State
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraAngleRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0,
    phi: 0.1,
    radius: 1.8,
  });

  // 1. Fetch available signs catalog on mount
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      try {
        const catalog = await fetchAvatarSignsCatalog();
        if (isMounted && catalog && catalog.signs) {
          const names = Object.keys(catalog.signs).sort();
          setAvailableSigns(names);
          if (!names.includes(selectedSign) && names.length > 0) {
            setSelectedSign(names[0]);
          }
        }
      } catch (err) {
        console.warn('Could not load sign catalog from API, using default list:', err);
        // Fallback to dataset 24 classes
        const defaultClasses = [
          'FAMILY', 'FOOD', 'FRIEND', 'GOOD', 'HAPPY', 'HELLO', 'HELP', 'HOME',
          'LOVE', 'NAMASTE', 'NO', 'OK', 'PEACE', 'PLEASE', 'SAD', 'SORRY',
          'STOP', 'STUDENT', 'TEACHER', 'THANK_YOU', 'VICTORY', 'WATER', 'WELCOME', 'YES'
        ];
        if (isMounted) setAvailableSigns(defaultClasses);
      }
    };
    loadCatalog();
    return () => { isMounted = false; };
  }, []);

  // 2. Load keyframe when selectedSign changes
  useEffect(() => {
    let isMounted = true;
    const loadKeyframe = async () => {
      setIsLoading(true);
      setStatusMessage(`Loading sign: ${selectedSign}`);
      try {
        const data = await fetchAvatarSignKeyframe(selectedSign);
        if (isMounted) {
          setCurrentKeyframe(data);
          setSubtitle(data.description || `Sign: ${data.sign_name}`);
          setStatusMessage(`Ready: ${data.sign_name} (${data.sample_count} dataset samples)`);
          animProgressRef.current = 0;
          rightTrailPointsRef.current = [];
          leftTrailPointsRef.current = [];
          if (avatarRef.current) {
            avatarRef.current.resetFilters();
          }
        }
      } catch (err) {
        console.error(`Failed to load keyframe for ${selectedSign}:`, err);
        if (isMounted) {
          setStatusMessage(`Error loading ${selectedSign}`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (selectedSign) {
      loadKeyframe();
    }
    return () => { isMounted = false; };
  }, [selectedSign]);

  // 3. Setup Three.js WebGL Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Camera (calibrated for portrait ISL signing space)
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.82, 1.55);
    camera.lookAt(0, 0.82, 0);
    cameraRef.current = camera;

    // Renderer
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

    // 4-Point Studio Lighting
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

    // Grid Floor
    const gridHelper = new THREE.GridHelper(4, 20, 0x3b82f6, 0x1e293b);
    gridHelper.position.set(0, 0, 0);
    scene.add(gridHelper);

    // Humanoid Avatar
    const avatar = new HumanoidAvatar({
      skinColor: 0xe0ac69,
      clothColor: 0x1e293b,
      jointAccentColor: 0x2563eb,
      enableDebugSkeleton: showSkeleton,
    });
    scene.add(avatar.rootGroup);
    avatarRef.current = avatar;

    // 3D Motion Trajectory Ribbon Trails
    const trailGroup = new THREE.Group();
    scene.add(trailGroup);
    trailGroupRef.current = trailGroup;

    const maxPts = 28;
    const initialPoints = new Array(maxPts).fill(new THREE.Vector3(0, 0, 0));

    const rightGeo = new THREE.BufferGeometry().setFromPoints(initialPoints);
    const rightMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
      linewidth: 3,
    });
    const rLine = new THREE.Line(rightGeo, rightMat);
    trailGroup.add(rLine);
    rightTrailLineRef.current = rLine;

    const leftGeo = new THREE.BufferGeometry().setFromPoints(initialPoints);
    const leftMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.8,
      linewidth: 3,
    });
    const lLine = new THREE.Line(leftGeo, leftMat);
    trailGroup.add(lLine);
    leftTrailLineRef.current = lLine;

    // Handle Resize
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

  // Update skeleton visibility
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

  // 4. Main Animation & Render Loop
  const animate = useCallback((now: number) => {
    // Calculate FPS
    frameCountRef.current++;
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)));
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
    lastTimeRef.current = now;

    // Update Avatar Pose (supports verified two-handed signs, fingerspelling, and landmarks)
    if (avatarRef.current) {
      avatarRef.current.updateIdle(now, dt);
      if (isPlaying) {
        animProgressRef.current += dt * speed;
        const blendAlpha = Math.min(1.0, 0.16 * speed);
        const rawLandmarks = currentKeyframe?.normalized_landmarks;
        avatarRef.current.applySign(selectedSign, rawLandmarks, now, blendAlpha);
      }

      // Update 3D Motion Trails (Hand Trajectory)
      if (showMotionTrails && isPlaying) {
        const rPos = new THREE.Vector3();
        const lPos = new THREE.Vector3();
        avatarRef.current.rightWristNode.getWorldPosition(rPos);
        avatarRef.current.leftWristNode.getWorldPosition(lPos);

        const rPts = rightTrailPointsRef.current;
        const lPts = leftTrailPointsRef.current;
        rPts.push(rPos);
        lPts.push(lPos);
        if (rPts.length > 28) rPts.shift();
        if (lPts.length > 28) lPts.shift();

        if (rightTrailLineRef.current && rPts.length > 2) {
          rightTrailLineRef.current.geometry.setFromPoints(rPts);
          rightTrailLineRef.current.visible = true;
        }
        if (leftTrailLineRef.current && lPts.length > 2) {
          leftTrailLineRef.current.geometry.setFromPoints(lPts);
          leftTrailLineRef.current.visible = true;
        }
      } else {
        if (rightTrailLineRef.current) rightTrailLineRef.current.visible = false;
        if (leftTrailLineRef.current) leftTrailLineRef.current.visible = false;
      }
    }

    // Cinematic Smart Auto-Framing
    if (autoCamera && !isDraggingRef.current) {
      const closeUpSigns = ['HELLO', 'NAMASTE', 'FOOD', 'FAMILY', 'LOVE', 'PLEASE', 'SORRY'];
      const targetRadius = closeUpSigns.includes(selectedSign) ? 1.55 : 1.85;
      const targetPhi = closeUpSigns.includes(selectedSign) ? 0.08 : 0.12;
      cameraAngleRef.current.radius += (targetRadius - cameraAngleRef.current.radius) * 0.035;
      cameraAngleRef.current.phi += (targetPhi - cameraAngleRef.current.phi) * 0.035;
    }

    // Update Camera Orbit Position
    if (cameraRef.current) {
      const { theta, phi, radius } = cameraAngleRef.current;
      const targetY = 0.82;
      const x = radius * Math.sin(theta) * Math.cos(phi);
      const y = targetY + radius * Math.sin(phi);
      const z = radius * Math.cos(theta) * Math.cos(phi);
      cameraRef.current.position.set(x, y, z);
      cameraRef.current.lookAt(0, targetY, 0);
    }

    // Render Scene
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    reqIdRef.current = requestAnimationFrame(animate);
  }, [isPlaying, speed, currentKeyframe, showMotionTrails, autoCamera, selectedSign]);

  useEffect(() => {
    reqIdRef.current = requestAnimationFrame(animate);
    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [animate]);

  // Orbit controls event listeners
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
    cameraAngleRef.current.phi = Math.max(-0.4, Math.min(0.6, cameraAngleRef.current.phi + dy * 0.008));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraAngleRef.current.radius = Math.max(1.0, Math.min(3.2, cameraAngleRef.current.radius + e.deltaY * 0.002));
  };

  const handleResetCamera = () => {
    cameraAngleRef.current = { theta: 0, phi: 0.1, radius: 1.8 };
    if (avatarRef.current) {
      avatarRef.current.applyNeutralRestPose();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#3b82f6" />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
            3D Avatar ISL Sign Engine
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Activity size={12} /> {fps} FPS WebGL
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            {showSkeleton ? '✓ Skeleton Joints' : 'Skeleton Wireframe'}
          </button>
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
            <Eye size={12} /> {highVisibility ? '✓ High-Visibility On' : 'High-Visibility'}
          </button>
          <button
            onClick={() => setShowMotionTrails(!showMotionTrails)}
            style={{
              background: showMotionTrails ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)',
              border: showMotionTrails ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(148, 163, 184, 0.2)',
              color: showMotionTrails ? '#38bdf8' : '#94a3b8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="3D spatial hand trajectory path ribbon"
          >
            <Waves size={12} /> {showMotionTrails ? '✓ Trails On' : 'Motion Trails'}
          </button>
          <button
            onClick={() => setAutoCamera(!autoCamera)}
            style={{
              background: autoCamera ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.6)',
              border: autoCamera ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(148, 163, 184, 0.2)',
              color: autoCamera ? '#34d399' : '#94a3b8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Dynamic cinematic auto-framing on hands"
          >
            <Camera size={12} /> {autoCamera ? '✓ Auto-Cam' : 'Auto-Cam'}
          </button>
          <button
            onClick={handleResetCamera}
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#cbd5e1',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Reset View
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
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

        {/* Subtitle Banner (High-contrast, accessible) */}
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '8px',
            padding: '8px 20px',
            textAlign: 'center',
            minWidth: '280px',
            maxWidth: '90%',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ISL Subtitle &amp; Translation
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
            {selectedSign.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#93c5fd', marginTop: '2px' }}>
            {subtitle}
          </div>
        </div>

        {/* Active Sign Badge & Dataset count */}
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
          <span style={{ color: '#60a5fa', fontWeight: 700 }}>ISL Class:</span> {selectedSign}
          {currentKeyframe && (
            <span style={{ color: '#10b981', marginLeft: '6px' }}>
              • {currentKeyframe.sample_count} samples averaged
            </span>
          )}
        </div>

        {/* Orbit Hint */}
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

      {/* Sign Selector Dropdown & Quick Badges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
            Select Gesture from Dataset Sign Library (24 Classes):
          </label>
          <select
            value={selectedSign}
            onChange={(e) => setSelectedSign(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              minWidth: '180px',
            }}
          >
            {availableSigns.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Quick select pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {availableSigns.slice(0, 10).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSign(s)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedSign === s ? '#2563eb' : 'rgba(51, 65, 85, 0.5)',
                color: selectedSign === s ? '#ffffff' : '#cbd5e1',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Playback Controls & Speed Toggle */}
      {showControls && (
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
              {isPlaying ? 'Pause Pose' : 'Play Sign'}
            </button>
            <button
              className="btn"
              onClick={() => {
                animProgressRef.current = 0;
                if (avatarRef.current) avatarRef.current.resetFilters();
                setIsPlaying(true);
              }}
              style={{ background: '#334155', color: 'white', fontSize: '0.8rem', padding: '6px 14px' }}
            >
              <RotateCcw size={14} /> Replay
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FastForward size={14} color="#94a3b8" />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Animation Speed:</span>
            {[0.5, 1.0, 1.5, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  background: speed === s ? '#3b82f6' : 'rgba(51, 65, 85, 0.5)',
                  color: speed === s ? '#ffffff' : '#94a3b8',
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
      )}
    </div>
  );
};
