import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebcamFeed } from '../components/WebcamFeed';
import { PredictionCard } from '../components/PredictionCard';
import { SettingsPanel, FeatureToggles } from '../components/SettingsPanel';
import { ISLGuide } from '../components/ISLGuide';
import { SignerCalibrationWizard } from '../components/SignerCalibrationWizard';
import { useWebcam } from '../hooks/useWebcam';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { clientAFME, AFMETelemetry } from '../services/afme';
import { onDeviceInference } from '../services/onDeviceInference';
import { PredictionResponse, MediaPipeLandmarkFrame } from '../types/isl';
import { Sliders, Cpu, Cloud, Zap, HelpCircle } from 'lucide-react';
import { OnboardingGuideModal } from '../components/OnboardingGuideModal';
import { VoiceGender, VoiceTone } from '../services/speech';

export type InferenceMode = 'hybrid' | 'client' | 'server';

export const LiveRecognition: React.FC = () => {
  const { videoRef, isStreaming, startWebcam, stopWebcam } = useWebcam();
  const { prediction: serverPrediction, isConnected, sendLandmarkFrame } = useWebSocket();

  // Active prediction to display (server, client, or hybrid)
  const [activePrediction, setActivePrediction] = useState<PredictionResponse | null>(null);
  const [activeAFME, setActiveAFME] = useState<AFMETelemetry | null>(null);
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>('hybrid');

  // System State & Feature Toggles
  const [toggles, setToggles] = useState<FeatureToggles>({
    show3DHand: true,
    showLandmarks: true,
    showConnections: true,
    showConfidence: true,
    showRecognizedText: true,
    automaticVoice: true,
    predictionStabilization: true,
    showSignHistory: true,
    debugMode: false,
  });

  const [volume, setVolume] = useState<number>(1.0);
  const [rate, setRate] = useState<number>(0.95);
  const [pitch, setPitch] = useState<number>(1.0);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.60);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [voiceTone, setVoiceTone] = useState<VoiceTone>('natural');
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    return !localStorage.getItem('signova_onboarding_completed');
  });

  // Frame throttle for adaptive processing
  const lastServerSendRef = useRef<number>(0);

  // Hook into MediaPipe frames with adaptive processing pipeline
  const handleFrameExtracted = useCallback(
    (frame: MediaPipeLandmarkFrame) => {
      const hand = (frame.right_hand && frame.right_hand.length >= 21)
        ? frame.right_hand
        : (frame.left_hand && frame.left_hand.length >= 21)
        ? frame.left_hand
        : [];

      // 1. Run Adaptive Finger Motion Engine (AFME) on client
      const afmeTelemetry = clientAFME.processFrame(hand);
      setActiveAFME(afmeTelemetry);

      const now = performance.now();

      if (inferenceMode === 'client') {
        // Run purely on-device in browser
        const localPred = onDeviceInference.predict(hand, afmeTelemetry);
        setActivePrediction(localPred);
      } else if (inferenceMode === 'server') {
        // Send every frame to WebSocket server
        sendLandmarkFrame(frame);
      } else {
        // Hybrid Adaptive:
        // When stationary, evaluate locally at low rate (saving network & compute)
        // When active signing or transitioning, stream to WebSocket server for deep ST-GCN graph inference
        if (afmeTelemetry.motion_state === 'STATIONARY') {
          // Send to server only once every 800ms heartbeat
          if (now - lastServerSendRef.current > 800) {
            sendLandmarkFrame(frame);
            lastServerSendRef.current = now;
          } else {
            // Keep lightweight on-device tracking active
            const localPred = onDeviceInference.predict(hand, afmeTelemetry);
            setActivePrediction(localPred);
          }
        } else {
          // Dynamic gesture detected -> full server ST-GCN inference stream!
          sendLandmarkFrame(frame);
          lastServerSendRef.current = now;
        }
      }
    },
    [inferenceMode, sendLandmarkFrame]
  );

  const { latestLandmarks } = useMediaPipe(videoRef, handleFrameExtracted);

  // Synchronize server prediction when active
  useEffect(() => {
    if (serverPrediction && inferenceMode !== 'client') {
      setActivePrediction({
        ...serverPrediction,
        afme: activeAFME || serverPrediction.afme,
      });
    }
  }, [serverPrediction, inferenceMode, activeAFME]);

  return (
    <div>
      {/* Top Banner with Calibration & Inference Engine Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {/* Inference Engine Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Inference Architecture:
          </span>
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '2px',
            }}
          >
            <button
              onClick={() => setInferenceMode('hybrid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: inferenceMode === 'hybrid' ? 'rgba(37, 99, 235, 0.3)' : 'transparent',
                color: inferenceMode === 'hybrid' ? '#60a5fa' : 'var(--text-muted)',
              }}
            >
              <Zap size={13} color="#60a5fa" />
              Hybrid Adaptive (AFME + ST-GCN)
            </button>
            <button
              onClick={() => setInferenceMode('client')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: inferenceMode === 'client' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                color: inferenceMode === 'client' ? '#34d399' : 'var(--text-muted)',
              }}
            >
              <Cpu size={13} color="#34d399" />
              On-Device (WASM / Browser)
            </button>
            <button
              onClick={() => setInferenceMode('server')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: inferenceMode === 'server' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                color: inferenceMode === 'server' ? '#c084fc' : 'var(--text-muted)',
              }}
            >
              <Cloud size={13} color="#c084fc" />
              Dedicated Server Stream
            </button>
          </div>
        </div>

        {/* Calibration button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={() => setIsOnboardingOpen(true)}
            style={{
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#93c5fd',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <HelpCircle size={14} color="#60a5fa" />
            How to Use
          </button>
          <button
            className="btn"
            onClick={() => setIsCalibrationOpen(true)}
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              fontSize: '0.8rem',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sliders size={14} />
            Calibrate Hand Anatomy
          </button>
        </div>
      </div>

      <div className="grid-two-col">
        <WebcamFeed
          videoRef={videoRef}
          isStreaming={isStreaming}
          onStart={startWebcam}
          onStop={stopWebcam}
          landmarks={latestLandmarks}
          show3DHand={toggles.show3DHand}
          showLandmarks={toggles.showLandmarks}
          showConnections={toggles.showConnections}
          afme={activeAFME}
          jointAttention={activePrediction?.joint_attention}
          activePrediction={activePrediction}
          volume={volume}
          onToggle3DHand={() => setToggles((t) => ({ ...t, show3DHand: !t.show3DHand }))}
          onToggleLandmarks={() => setToggles((t) => ({ ...t, showLandmarks: !t.showLandmarks }))}
          onToggleConnections={() => setToggles((t) => ({ ...t, showConnections: !t.showConnections }))}
        />
        <PredictionCard
          prediction={activePrediction}
          isConnected={isConnected}
          toggles={toggles}
          volume={volume}
          rate={rate}
          pitch={pitch}
          confidenceThreshold={confidenceThreshold}
          voiceGender={voiceGender}
          setVoiceGender={setVoiceGender}
          voiceTone={voiceTone}
          setVoiceTone={setVoiceTone}
        />
      </div>

      <SettingsPanel
        toggles={toggles}
        setToggles={setToggles}
        volume={volume}
        setVolume={setVolume}
        rate={rate}
        setRate={setRate}
        pitch={pitch}
        setPitch={setPitch}
        confidenceThreshold={confidenceThreshold}
        setConfidenceThreshold={setConfidenceThreshold}
        voiceGender={voiceGender}
        setVoiceGender={setVoiceGender}
        voiceTone={voiceTone}
        setVoiceTone={setVoiceTone}
      />

      <ISLGuide />

      <SignerCalibrationWizard
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        latestLandmarks={latestLandmarks}
        onCalibrationComplete={() => setIsCalibrationOpen(false)}
      />

      <OnboardingGuideModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onStartVisually={() => {
          setIsOnboardingOpen(false);
          startWebcam();
        }}
      />
    </div>
  );
};
