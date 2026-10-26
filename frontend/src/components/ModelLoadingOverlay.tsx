import React from 'react';
import { Hand } from 'lucide-react';

interface ModelLoadingOverlayProps {
  progress: number; // 0 to 100
  title?: string;
  statusText?: string;
  visible: boolean;
}

export const ModelLoadingOverlay: React.FC<ModelLoadingOverlayProps> = ({
  progress,
  title = 'Saving model for faster load next time...',
  statusText = 'Almost ready to translate...',
  visible,
}) => {
  if (!visible) return null;

  // SVG circular progress calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 24, 0.92)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#0c1322',
          borderRadius: '24px',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(59, 130, 246, 0.15)',
          padding: '48px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'fadeInScale 0.3s ease-out',
        }}
      >
        {/* Circular Progress Indicator with Hand Icon */}
        <div style={{ position: 'relative', width: '130px', height: '130px', marginBottom: '28px' }}>
          <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background Track */}
            <circle
              cx="65"
              cy="65"
              r={radius}
              stroke="rgba(30, 58, 138, 0.35)"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Active Progress Arc */}
            <circle
              cx="65"
              cy="65"
              r={radius}
              stroke="#38bdf8"
              strokeWidth="6"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 0.15s ease',
                filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))',
              }}
            />
          </svg>

          {/* Centered Hand Icon */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)',
              }}
            >
              <Hand size={30} color="#38bdf8" style={{ animation: 'pulse 1.8s infinite ease-in-out' }} />
            </div>
          </div>
        </div>

        {/* Title Text */}
        <h3
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            color: '#f8fafc',
            margin: '0 0 8px 0',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>

        {/* Percentage Display */}
        <div
          style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#38bdf8',
            fontVariantNumeric: 'tabular-nums',
            margin: '4px 0 12px 0',
            letterSpacing: '0.02em',
          }}
        >
          {progress.toFixed(2)}%
        </div>

        {/* Status Caption */}
        <p
          style={{
            fontSize: '0.92rem',
            color: '#94a3b8',
            margin: 0,
            fontWeight: 500,
          }}
        >
          {statusText}
        </p>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
