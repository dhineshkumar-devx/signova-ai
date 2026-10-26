import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Bot,
  ShieldAlert,
  Stethoscope,
  Landmark,
  GraduationCap,
  MessageSquare,
  Volume2,
  Sliders,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { SignAvatar3D } from '../components/SignAvatar3D';
import { WebcamFeed } from '../components/WebcamFeed';
import { SignerCalibrationWizard } from '../components/SignerCalibrationWizard';
import { ISLKnowledgeExplorer } from '../components/ISLKnowledgeExplorer';
import { useWebcam } from '../hooks/useWebcam';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMediaPipe } from '../hooks/useMediaPipe';
import {
  convertEnglishToISL,
  processDomainAgent,
  translateMultilingual,
} from '../services/api';
import { EnglishToISLResult, DomainProcessResult, SignerCalibrationProfile } from '../types/isl';
import {
  speakMultilingual,
  announceLanguageChange,
  SupportedLanguage,
  VoiceGender,
  VoiceTone,
} from '../services/speech';

export const BidirectionalStudio: React.FC = () => {
  // Speech-to-Sign States (Hearing Person)
  const [inputText, setInputText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [islConversion, setIslConversion] = useState<EnglishToISLResult | null>(null);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Sign-to-Speech States (Deaf Person)
  const { videoRef, isStreaming, startWebcam, stopWebcam } = useWebcam();
  const { prediction, sendLandmarkFrame } = useWebSocket();
  const { latestLandmarks } = useMediaPipe(videoRef, sendLandmarkFrame);

  // Multi-Agent Domain Suite
  const [activeDomain, setActiveDomain] = useState<'GENERAL' | 'MEDICAL' | 'BANKING' | 'EDUCATION' | 'EMERGENCY'>('GENERAL');
  const [domainResult, setDomainResult] = useState<DomainProcessResult | null>(null);
  const [isDomainProcessing, setIsDomainProcessing] = useState<boolean>(false);

  // Calibration Wizard
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [calibrationProfile, setCalibrationProfile] = useState<SignerCalibrationProfile | null>(null);

  // Audio Language, Gender & Tone for Deaf -> Hearing Person
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('en');
  const [regionalSentence, setRegionalSentence] = useState<string>('');
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female');
  const [voiceTone, setVoiceTone] = useState<VoiceTone>('natural');

  // Setup Web Speech API for hearing person speech recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN'; // Indian English

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        handleTranslateEnglish(transcript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }

    const savedCal = localStorage.getItem('isl_signer_calibration');
    if (savedCal) {
      try {
        setCalibrationProfile(JSON.parse(savedCal));
      } catch (e) {}
    }
  }, []);

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported on this browser. You can type in the input box instead.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleTranslateEnglish = async (textToTranslate?: string) => {
    const text = textToTranslate || inputText;
    if (!text || !text.trim()) return;

    setIsTranslating(true);
    try {
      const result = await convertEnglishToISL(text);
      setIslConversion(result);
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDispatchDomainAgent = async (domain: 'GENERAL' | 'MEDICAL' | 'BANKING' | 'EDUCATION' | 'EMERGENCY', targetSign?: string) => {
    setActiveDomain(domain);
    const sign = targetSign || prediction?.prediction || 'HELP';
    setIsDomainProcessing(true);
    try {
      const res = await processDomainAgent(domain, sign);
      setDomainResult(res);
    } catch (err) {
      console.error('Domain dispatch error:', err);
    } finally {
      setIsDomainProcessing(false);
    }
  };

  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    setTargetLanguage(newLang);
    const sign = prediction?.prediction;
    if (sign && sign !== 'No Hand Detected' && sign !== 'Unknown Sign') {
      try {
        const multi = await translateMultilingual([sign], newLang, prediction?.nmm_markers);
        if (multi && multi.translated_text) {
          setRegionalSentence(newLang === 'en' ? '' : multi.translated_text);
          speakMultilingual(multi.translated_text, { lang: newLang, gender: voiceGender, tone: voiceTone });
          return;
        }
      } catch {
        // Fallback to announcement
      }
    }
    announceLanguageChange(newLang, { gender: voiceGender, tone: voiceTone });
  };

  // Trigger TTS with multilingual & voice persona support
  const speakText = (text: string, lang?: SupportedLanguage) => {
    if (!text) return;
    speakMultilingual(text, {
      lang: lang || targetLanguage,
      gender: voiceGender,
      tone: voiceTone,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' }}>
      {/* Studio Header */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.4), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Bidirectional Sign ⇄ Speech &amp; 3D Avatar Studio
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#93c5fd', margin: '4px 0 0 0' }}>
            Two-Way Accessible Communication • Hearing Speech to 3D ISL Avatar • Live Sign Recognition to Spoken Voice
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn"
            onClick={() => setIsCalibrationOpen(true)}
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              fontSize: '0.8rem',
              padding: '6px 12px',
            }}
          >
            <Sliders size={14} />
            {calibrationProfile ? 'Recalibrate Signer' : 'Calibrate Hand Anatomy'}
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TWO-WAY BIDIRECTIONAL GRID                                   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="grid-two-col">
        {/* SIDE A: HEARING PERSON (Speech to 3D ISL Avatar) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Volume2 size={20} color="#3b82f6" />
              <span>Hearing Person (Speech to 3D Sign)</span>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                padding: '3px 8px',
                borderRadius: '12px',
              }}
            >
              Voice to Avatar
            </span>
          </div>

          {/* Voice & Text Input Form */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Speak or type what you want to say in English..."
              style={{ flex: 1, fontSize: '0.9rem' }}
              onKeyDown={(e) => e.key === 'Enter' && handleTranslateEnglish()}
            />
            <button
              className="btn"
              onClick={toggleSpeechRecognition}
              style={{
                backgroundColor: isListening ? '#ef4444' : '#2563eb',
                color: '#ffffff',
                padding: '0 12px',
              }}
              title={isListening ? 'Stop listening' : 'Start microphone'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleTranslateEnglish()}
              disabled={isTranslating}
              style={{ padding: '0 14px' }}
            >
              <Send size={16} />
            </button>
          </div>

          {/* Quick preset phrases */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center' }}>Presets:</span>
            {[
              'Good morning, welcome!',
              'Do you need help or a doctor?',
              'Please have some drinking water',
              'Stop, please wait here',
            ].map((preset, i) => (
              <button
                key={i}
                onClick={() => {
                  setInputText(preset);
                  handleTranslateEnglish(preset);
                }}
                style={{
                  background: 'rgba(51, 65, 85, 0.4)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Grammar Translation Output */}
          {islConversion && (
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px' }}>
                ISL SOV Grammatical Sequence:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                {islConversion.isl_glosses.map((gloss, idx) => (
                  <span
                    key={idx}
                    style={{
                      backgroundColor: 'rgba(37, 99, 235, 0.25)',
                      color: '#93c5fd',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                    }}
                  >
                    {gloss}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {islConversion.explanation}
              </div>
            </div>
          )}

          {/* 3D Sign Language Avatar Component */}
          <SignAvatar3D
            glossSequence={islConversion?.isl_glosses || ['HELLO', 'WELCOME']}
            autoPlay={true}
          />
        </div>

        {/* SIDE B: DEAF PERSON (Live ISL Recognition to Speech) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} color="#10b981" />
              <span>Deaf Signer (Sign to Voice)</span>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                padding: '3px 8px',
                borderRadius: '12px',
              }}
            >
              Camera to Speech
            </span>
          </div>

          {/* Webcam Live Capture */}
          <WebcamFeed
            videoRef={videoRef}
            isStreaming={isStreaming}
            onStart={startWebcam}
            onStop={stopWebcam}
            landmarks={latestLandmarks}
            show3DHand={true}
            showLandmarks={true}
            showConnections={true}
          />

          {/* Recognition & Full Sentence Output */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '10px',
              padding: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                Recognized Sign &amp; LLM Voice Output:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Voice Gender Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setVoiceGender('female')}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: voiceGender === 'female' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(15, 23, 42, 0.8)',
                      color: voiceGender === 'female' ? '#f472b6' : 'var(--text-muted)',
                      fontWeight: voiceGender === 'female' ? 700 : 500,
                    }}
                  >
                    ♀ Female
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceGender('male')}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: voiceGender === 'male' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(15, 23, 42, 0.8)',
                      color: voiceGender === 'male' ? '#60a5fa' : 'var(--text-muted)',
                      fontWeight: voiceGender === 'male' ? 700 : 500,
                    }}
                  >
                    ♂ Male
                  </button>
                </div>

                {/* Voice Tone Selector */}
                <select
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value as VoiceTone)}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    outline: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Human Voice Cadence &amp; Inflection"
                >
                  <option value="natural">🎙️ Natural</option>
                  <option value="warm">🌸 Warm</option>
                  <option value="professional">💼 Professional</option>
                  <option value="deep">🌊 Deep</option>
                  <option value="energetic">⚡ Lively</option>
                  <option value="storyteller">📖 Narrative</option>
                  <option value="urgent">🚨 Urgent</option>
                </select>

                {/* Audio Language Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={13} color="#10b981" />
                  <select
                    value={targetLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      outline: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="en">English (EN)</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="te">తెలుగు (Telugu)</option>
                    <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    <option value="bn">বাংলা (Bengali)</option>
                  </select>
                </div>

                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {prediction ? `${(prediction.confidence * 100).toFixed(0)}% Conf` : 'Standby'}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
              {prediction?.prediction && prediction.prediction !== 'No Hand Detected'
                ? prediction.prediction.replace(/_/g, ' ')
                : 'Awaiting Hand Gesture...'}
            </div>

            <div style={{ fontSize: '0.95rem', color: '#93c5fd', fontStyle: 'italic', minHeight: '40px' }}>
              {prediction?.sentence || 'Signs will be translated to full spoken sentences here.'}
            </div>

            {regionalSentence && (
              <div style={{ fontSize: '1.05rem', color: '#6ee7b7', fontWeight: 600, margin: '6px 0', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{regionalSentence}</span>
                <button
                  className="btn"
                  onClick={() => speakText(regionalSentence, targetLanguage)}
                  style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'rgba(16, 185, 129, 0.8)', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Volume2 size={12} /> Listen
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (targetLanguage !== 'en' && regionalSentence) {
                    speakText(regionalSentence, targetLanguage);
                  } else if (prediction?.sentence) {
                    speakText(prediction.sentence, 'en');
                  }
                }}
                disabled={!prediction?.sentence && !regionalSentence}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <Volume2 size={14} /> Speak to Hearing Person {targetLanguage !== 'en' ? `(${targetLanguage.toUpperCase()})` : ''}
              </button>
              <button
                className="btn"
                onClick={() => handleDispatchDomainAgent(activeDomain, prediction?.prediction)}
                disabled={isDomainProcessing}
                style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#334155', color: '#ffffff' }}
              >
                <Sparkles size={14} /> {isDomainProcessing ? 'Processing Agent...' : `Send to ${activeDomain} Agent`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MULTI-AGENT COLLABORATIVE REASONING SUITE                    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#a855f7" />
            <span>Multi-Agent Collaborative Reasoning Architecture</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Specialized context switching for real-world deployments
          </span>
        </div>

        {/* Domain Selection Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'GENERAL', name: 'General Social', icon: MessageSquare, color: '#3b82f6' },
            { id: 'MEDICAL', name: 'Medical Clinical', icon: Stethoscope, color: '#10b981' },
            { id: 'BANKING', name: 'Banking & FinTech', icon: Landmark, color: '#f59e0b' },
            { id: 'EDUCATION', name: 'Education STEM', icon: GraduationCap, color: '#06b6d4' },
            { id: 'EMERGENCY', name: 'Safety SOS Dispatch', icon: ShieldAlert, color: '#ef4444' },
          ].map((item) => {
            const Icon = item.icon;
            const isSel = activeDomain === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleDispatchDomainAgent(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: isSel ? `1px solid ${item.color}` : '1px solid rgba(148, 163, 184, 0.2)',
                  backgroundColor: isSel ? 'rgba(30, 41, 59, 0.8)' : 'rgba(15, 23, 42, 0.4)',
                  color: isSel ? item.color : '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} /> {item.name}
              </button>
            );
          })}
        </div>

        {/* Active Domain Agent Reasoning Card */}
        {domainResult && (
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: `1px solid ${
                domainResult.urgency_level === 'CRITICAL' ? '#ef4444' : 'rgba(168, 85, 247, 0.4)'
              }`,
              borderRadius: '10px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={18} color="#a855f7" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                  {domainResult.agent_name}
                </span>
              </div>
              {domainResult.urgency_level && (
                <span
                  style={{
                    backgroundColor:
                      domainResult.urgency_level === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: domainResult.urgency_level === 'CRITICAL' ? '#ef4444' : '#60a5fa',
                    border: '1px solid currentColor',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  Urgency: {domainResult.urgency_level}
                </span>
              )}
            </div>

            {/* Medical Assessment Note */}
            {domainResult.clinical_assessment && (
              <div style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.5, marginBottom: '8px' }}>
                {domainResult.clinical_assessment}
              </div>
            )}

            {/* Emergency SOS Payload */}
            {domainResult.emergency_code && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px dashed #ef4444',
                  borderRadius: '8px',
                  padding: '12px',
                  margin: '8px 0',
                }}
              >
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> {domainResult.message}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#fca5a5', marginTop: '6px' }}>
                  Incident Code: <strong>{domainResult.emergency_code}</strong> | Location Coordinates:{' '}
                  {domainResult.simulated_location?.lat}, {domainResult.simulated_location?.lng} (
                  {domainResult.simulated_location?.city})
                </div>
              </div>
            )}

            {/* Banking / Education Response */}
            {domainResult.response && (
              <div style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                {domainResult.response}
              </div>
            )}

            {/* Follow up or Next Step */}
            {(domainResult.follow_up_prompt || domainResult.next_step) && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(51, 65, 85, 0.4)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#93c5fd',
                }}
              >
                Next Recommended Step: {domainResult.follow_up_prompt || domainResult.next_step}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ISL Knowledge Base & Multilingual Extension Studio */}
      <ISLKnowledgeExplorer />

      {/* Anatomical Calibration Modal */}
      <SignerCalibrationWizard
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        latestLandmarks={latestLandmarks}
        onCalibrationComplete={(profile) => {
          setCalibrationProfile(profile);
          setIsCalibrationOpen(false);
        }}
      />
    </div>
  );
};
