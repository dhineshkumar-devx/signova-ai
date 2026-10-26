import React from 'react';
import { X, Sparkles, Camera, Play, CheckCircle2 } from 'lucide-react';

interface OnboardingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartVisually?: () => void;
}

export const OnboardingGuideModal: React.FC<OnboardingGuideModalProps> = ({
  isOpen,
  onClose,
  onStartVisually,
}) => {
  if (!isOpen) return null;

  const steps = [
    {
      num: 1,
      title: 'Position yourself',
      description: 'Make sure you are clearly visible in the camera frame with good lighting',
    },
    {
      num: 2,
      title: 'Turn on the camera',
      description: 'Toggle the camera switch to enable your webcam',
    },
    {
      num: 3,
      title: 'Start detection',
      description: "Click the 'Start' button to begin",
    },
    {
      num: 4,
      title: 'View translation',
      description: 'Perform signs and see text appear instantly',
    },
  ];

  const handleGotIt = () => {
    localStorage.setItem('signova_onboarding_completed', 'true');
    if (onStartVisually) {
      onStartVisually();
    } else {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 24, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#0c1322',
          borderRadius: '20px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(59, 130, 246, 0.15)',
          padding: '36px 32px 32px 32px',
          position: 'relative',
          animation: 'modalSlideIn 0.25s ease-out',
        }}
      >
        {/* Close Icon */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f8fafc';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#f8fafc',
              margin: '0 0 6px 0',
              letterSpacing: '-0.01em',
            }}
          >
            How to Use SIGNOVA AI
          </h2>
          <p
            style={{
              fontSize: '0.92rem',
              color: '#94a3b8',
              margin: 0,
            }}
          >
            Follow these steps to translate sign language
          </p>
        </div>

        {/* Steps List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
          {steps.map((st) => (
            <div
              key={st.num}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              {/* Number Badge */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  border: '1.5px solid #2563eb',
                  color: '#60a5fa',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                {st.num}
              </div>

              {/* Step Info */}
              <div style={{ paddingTop: '2px' }}>
                <h4
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    margin: '0 0 4px 0',
                  }}
                >
                  {st.title}
                </h4>
                <p
                  style={{
                    fontSize: '0.88rem',
                    color: '#94a3b8',
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  {st.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={handleGotIt}
          style={{
            width: '100%',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '14px 20px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(37, 99, 235, 0.45)',
            transition: 'background-color 0.2s, transform 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1d4ed8';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Got it (Show me visually)
        </button>
      </div>

      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};
