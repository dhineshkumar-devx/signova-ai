import React from 'react';
import { Settings, Eye, Volume2, Shield, UserCheck } from 'lucide-react';
import { VoiceGender, VoiceTone, TONE_PRESETS } from '../services/speech';

export interface FeatureToggles {
  show3DHand: boolean;
  showLandmarks: boolean;
  showConnections: boolean;
  showConfidence: boolean;
  showRecognizedText: boolean;
  automaticVoice: boolean;
  predictionStabilization: boolean;
  showSignHistory: boolean;
  debugMode: boolean;
}

interface SettingsPanelProps {
  toggles: FeatureToggles;
  setToggles: React.Dispatch<React.SetStateAction<FeatureToggles>>;
  volume: number;
  setVolume: (v: number) => void;
  rate: number;
  setRate: (r: number) => void;
  pitch: number;
  setPitch: (p: number) => void;
  confidenceThreshold: number;
  setConfidenceThreshold: (c: number) => void;
  voiceGender?: VoiceGender;
  setVoiceGender?: (g: VoiceGender) => void;
  voiceTone?: VoiceTone;
  setVoiceTone?: (t: VoiceTone) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  toggles,
  setToggles,
  volume,
  setVolume,
  rate,
  setRate,
  pitch,
  setPitch,
  confidenceThreshold,
  setConfidenceThreshold,
  voiceGender = 'female',
  setVoiceGender,
  voiceTone = 'natural',
  setVoiceTone,
}) => {
  const handleToggleChange = (key: keyof FeatureToggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div className="card-title">
        <Settings size={20} color="#2563eb" />
        <span>System Settings & Feature Toggles Panel</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Section 1: Visual & Feature Toggles */}
        <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#60a5fa', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={16} /> Visualization & Feature Toggles
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>3D Hand Visualization</span>
              <input type="checkbox" checked={toggles.show3DHand} onChange={() => handleToggleChange('show3DHand')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Show Hand Keypoint Landmarks</span>
              <input type="checkbox" checked={toggles.showLandmarks} onChange={() => handleToggleChange('showLandmarks')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Show Bone Connection Lines</span>
              <input type="checkbox" checked={toggles.showConnections} onChange={() => handleToggleChange('showConnections')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Display Confidence Score</span>
              <input type="checkbox" checked={toggles.showConfidence} onChange={() => handleToggleChange('showConfidence')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Display Recognized Sentence Text</span>
              <input type="checkbox" checked={toggles.showRecognizedText} onChange={() => handleToggleChange('showRecognizedText')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Automatic Voice Output</span>
              <input type="checkbox" checked={toggles.automaticVoice} onChange={() => handleToggleChange('automaticVoice')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Prediction Stabilization (5-Frame Debouncing)</span>
              <input type="checkbox" checked={toggles.predictionStabilization} onChange={() => handleToggleChange('predictionStabilization')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Show Sign History Panel</span>
              <input type="checkbox" checked={toggles.showSignHistory} onChange={() => handleToggleChange('showSignHistory')} />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', cursor: 'pointer' }}>
              <span>Debug Information View</span>
              <input type="checkbox" checked={toggles.debugMode} onChange={() => handleToggleChange('debugMode')} />
            </label>
          </div>
        </div>

        {/* Section 2: Text-to-Speech Audio Controls */}
        <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={16} /> Audio Speech Controls
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Voice Gender Selection */}
            <div>
              <div style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={14} color="#60a5fa" />
                <span>Voice Persona Gender:</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setVoiceGender && setVoiceGender('female')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: voiceGender === 'female' ? '1px solid #ec4899' : '1px solid var(--border-color)',
                    backgroundColor: voiceGender === 'female' ? 'rgba(236, 72, 153, 0.25)' : 'var(--input-bg)',
                    color: voiceGender === 'female' ? '#f472b6' : 'var(--text-muted)',
                    fontWeight: voiceGender === 'female' ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  ♀ Female Voice (Zira)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceGender && setVoiceGender('male')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    borderRadius: '6px',
                    border: voiceGender === 'male' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    backgroundColor: voiceGender === 'male' ? 'rgba(59, 130, 246, 0.25)' : 'var(--input-bg)',
                    color: voiceGender === 'male' ? '#60a5fa' : 'var(--text-muted)',
                    fontWeight: voiceGender === 'male' ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  ♂ Male Voice (David)
                </button>
              </div>
            </div>

            {/* Voice Tone Selection (Acoustic Inflection Presets) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>Realistic Voice Tone:</span>
                <strong style={{ color: '#38bdf8' }}>{TONE_PRESETS[voiceTone]?.name}</strong>
              </div>
              <select
                value={voiceTone}
                onChange={(e) => setVoiceTone && setVoiceTone(e.target.value as VoiceTone)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {Object.values(TONE_PRESETS).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} — {preset.tagline}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>TTS Speech Volume:</span>
                <strong>{Math.round(volume * 100)}%</strong>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>Speech Rate:</span>
                <strong>{rate.toFixed(2)}x</strong>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>Voice Pitch:</span>
                <strong>{pitch.toFixed(2)}</strong>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Confidence & Threshold Controls */}
        <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#f59e0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={16} /> Recognition Confidence Threshold
          </h4>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span>Confidence Threshold:</span>
              <strong>{Math.round(confidenceThreshold * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.90"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Hand shapes with confidence below {Math.round(confidenceThreshold * 100)}% are held by the Master Agent for verification.
            </p>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span>AFME Tremor Filter Epsilon:</span>
              <strong style={{ color: '#38bdf8' }}>0.0035 (Standard)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '8px', marginBottom: '4px' }}>
              <span>Temporal Buffer Window:</span>
              <strong style={{ color: '#a855f7' }}>15 Frames (Adaptive)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

