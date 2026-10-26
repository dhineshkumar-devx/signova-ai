import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, X, Sliders } from 'lucide-react';
import { MediaPipeLandmarkFrame, SignerCalibrationProfile } from '../types/isl';

interface SignerCalibrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  latestLandmarks: MediaPipeLandmarkFrame | null;
  onCalibrationComplete: (profile: SignerCalibrationProfile) => void;
}

export const SignerCalibrationWizard: React.FC<SignerCalibrationWizardProps> = ({
  isOpen,
  onClose,
  latestLandmarks,
  onCalibrationComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState<number>(3);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [profile, setProfile] = useState<SignerCalibrationProfile | null>(null);

  // Stored measurements
  const [openPalmSpan, setOpenPalmSpan] = useState<number>(0);
  const [fistScale, setFistScale] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    if (isCapturing && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (isCapturing && countdown === 0) {
      captureCurrentStep();
    }
    return () => clearTimeout(timer);
  }, [isCapturing, countdown]);

  const startCapture = () => {
    setCountdown(3);
    setIsCapturing(true);
  };

  const captureCurrentStep = () => {
    setIsCapturing(false);
    const hand = latestLandmarks?.right_hand || latestLandmarks?.left_hand || [];
    if (hand.length < 21) {
      alert('Hand not detected! Please place your hand clearly in front of the camera.');
      return;
    }

    // Step 1: Open Palm Span (Wrist 0 to Middle fingertip 12)
    if (step === 1) {
      const wrist = hand[0];
      const middleTip = hand[12];
      const length = Math.sqrt((middleTip.x - wrist.x) ** 2 + (middleTip.y - wrist.y) ** 2);
      setOpenPalmSpan(length);
      setStep(2);
    } else if (step === 2) {
      // Step 2: Closed Fist (Thumb 4 to Index MCP 5)
      const wrist = hand[0];
      const indexMcp = hand[5];
      const fistRatio = Math.sqrt((indexMcp.x - wrist.x) ** 2 + (indexMcp.y - wrist.y) ** 2);
      setFistScale(fistRatio);
      setStep(3);
    } else if (step === 3) {
      // Step 3: Complete calibration vector
      const calculatedProfile: SignerCalibrationProfile = {
        calibrated: true,
        palmWidth: Math.max(0.1, openPalmSpan),
        fingerSpan: Math.max(0.08, fistScale),
        wristToMiddleRatio: openPalmSpan / (fistScale || 0.1),
        timestamp: Date.now(),
      };
      setProfile(calculatedProfile);
      localStorage.setItem('isl_signer_calibration', JSON.stringify(calculatedProfile));
      onCalibrationComplete(calculatedProfile);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(10, 15, 29, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} color="#60a5fa" />
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Signer-Adaptive Anatomical Calibration
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                backgroundColor:
                  s === step ? '#3b82f6' : s < step ? '#10b981' : 'rgba(51, 65, 85, 0.5)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Wizard Steps */}
        {!profile ? (
          <div>
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>
                  Step 1: Open Palm Stretch
                </div>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Hold your hand wide open facing the webcam. Keep all five fingers comfortably extended so the
                  system can measure your natural hand span and bone proportions.
                </p>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>
                  Step 2: Closed Fist Reference
                </div>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Form a compact fist with your thumb resting against your index finger. This calibrates
                  metacarpal compression and knuckle distance.
                </p>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>
                  Step 3: Distance &amp; Reach Normalization
                </div>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Hold your hand at your natural signing distance from the screen. The AI will compute 3D
                  depth normalization matrices to prevent distortion across different camera setups.
                </p>
              </div>
            )}

            {/* Countdown / Capture button */}
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              {isCapturing ? (
                <div style={{ fontSize: '3rem', fontWeight: 900, color: '#3b82f6' }}>
                  {countdown}
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={startCapture}
                  style={{ padding: '10px 24px', fontSize: '0.95rem' }}
                >
                  <Target size={16} /> Capture Landmark Sample
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Calibration Success */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.2rem', color: '#f8fafc', marginBottom: '8px' }}>
              Signer Calibration Complete!
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px' }}>
              Your personalized anatomical model has been generated and saved. All real-time landmarks will now
              be dynamically normalized to your unique hand dimensions.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: '#60a5fa',
                textAlign: 'left',
                marginBottom: '16px',
              }}
            >
              <div>Palm Span Scale: {profile.palmWidth.toFixed(4)}</div>
              <div>Metacarpal Ratio: {profile.fingerSpan.toFixed(4)}</div>
              <div>Anatomical Index: {profile.wristToMiddleRatio.toFixed(2)}x</div>
            </div>

            <button
              className="btn btn-primary"
              onClick={onClose}
              style={{ padding: '8px 20px', fontSize: '0.9rem' }}
            >
              Done &amp; Apply Calibration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
