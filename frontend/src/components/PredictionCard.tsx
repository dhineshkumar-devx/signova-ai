import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  Volume2,
  VolumeX,
  Trash2,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  History,
  Terminal,
  Download,
  Bot,
  Sparkles,
  MessageSquare,
  Globe,
  Smile,
  UserCheck as UserCheckIcon,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PredictionResponse } from '../types/isl';
import { FeatureToggles } from './SettingsPanel';
import {
  synthesizeSentence,
  converseWithAgent,
  translateMultilingual,
  LLMCognitiveThoughtProcess,
} from '../services/api';
import {
  speakMultilingual,
  announceLanguageChange,
  SupportedLanguage,
  VoiceGender,
  VoiceTone,
  TONE_PRESETS,
  getBestVoice,
} from '../services/speech';

interface PredictionCardProps {
  prediction: PredictionResponse | null;
  isConnected: boolean;
  toggles: FeatureToggles;
  volume: number;
  rate: number;
  pitch: number;
  confidenceThreshold: number;
  voiceGender?: VoiceGender;
  setVoiceGender?: (g: VoiceGender) => void;
  voiceTone?: VoiceTone;
  setVoiceTone?: (t: VoiceTone) => void;
}

const STABILITY_THRESHOLD = 5;

type AgentMode = 'sentence' | 'converse' | 'raw';
type AgentTone = 'polite' | 'casual' | 'formal' | 'emergency';

interface ConversationTurn {
  sender: 'user' | 'agent';
  text: string;
  sign?: string;
  timestamp: string;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  isConnected,
  toggles,
  volume,
  rate,
  pitch,
  confidenceThreshold,
  voiceGender: propVoiceGender,
  setVoiceGender: propSetVoiceGender,
  voiceTone: propVoiceTone,
  setVoiceTone: propSetVoiceTone,
}) => {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(toggles.automaticVoice);
  const [internalVoiceGender, setInternalVoiceGender] = useState<VoiceGender>('female');
  const voiceGender = propVoiceGender !== undefined ? propVoiceGender : internalVoiceGender;
  const setVoiceGender = propSetVoiceGender || setInternalVoiceGender;

  const [internalVoiceTone, setInternalVoiceTone] = useState<VoiceTone>('natural');
  const voiceTone = propVoiceTone !== undefined ? propVoiceTone : internalVoiceTone;
  const setVoiceTone = propSetVoiceTone || setInternalVoiceTone;
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [confirmedSign, setConfirmedSign] = useState<string>('');
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [signHistory, setSignHistory] = useState<string[]>([]);
  const [statusState, setStatusState] = useState<string>('Standby');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Agentic AI & LLM States
  const [agentMode, setAgentMode] = useState<AgentMode>('sentence');
  const [agentTone, setAgentTone] = useState<AgentTone>('polite');
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('en');
  const [llmSentence, setLlmSentence] = useState<string>('');
  const [regionalSentence, setRegionalSentence] = useState<string>('');
  const [llmConversationalReply, setLlmConversationalReply] = useState<string>('');
  const [isLlmLoading, setIsLlmLoading] = useState<boolean>(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [llmThoughtProcess, setLlmThoughtProcess] = useState<LLMCognitiveThoughtProcess | null>(null);
  const [accurateWords, setAccurateWords] = useState<Record<string, string> | null>(null);
  const [isThoughtExpanded, setIsThoughtExpanded] = useState<boolean>(true);

  // Debouncing refs
  const candidateRef = useRef<string>('');
  const consecutiveCountRef = useRef<number>(0);
  const lastConfirmedSignRef = useRef<string>('');
  const lastSpokenTextRef = useRef<string>('');

  useEffect(() => {
    setIsVoiceEnabled(toggles.automaticVoice);
  }, [toggles.automaticVoice]);

  useEffect(() => {
    const updateVoices = () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      }
    };
    updateVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speakText = (text: string, lang?: SupportedLanguage, englishFallback?: string) => {
    if (!text || text.trim() === '' || text === 'Unknown Sign' || text === 'No Hand Detected') return;
    const effectiveLang = lang || targetLanguage;
    const cleanText = text.replace(/_/g, ' ');
    lastSpokenTextRef.current = cleanText;

    speakMultilingual(cleanText, {
      lang: effectiveLang,
      gender: voiceGender,
      tone: voiceTone,
      volume,
      rate,
      pitch,
      availableVoices,
      englishFallback,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handlePreviewVoice = (previewGender?: VoiceGender, previewTone?: VoiceTone) => {
    const targetG = previewGender || voiceGender;
    const targetT = previewTone || voiceTone;
    const toneName = TONE_PRESETS[targetT]?.name || 'Natural';
    const sample = targetG === 'male'
      ? `Testing Microsoft David male voice with ${toneName.toLowerCase()} tone. Maximum volume audio ready for Indian Sign Language.`
      : `Testing Microsoft Zira female voice with ${toneName.toLowerCase()} tone. Maximum volume audio ready for Indian Sign Language.`;
    speakMultilingual(sample, {
      lang: targetLanguage,
      gender: targetG,
      tone: targetT,
      volume: 1.0,
      rate,
      pitch,
      availableVoices,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleSelectGender = (newGender: VoiceGender) => {
    setVoiceGender(newGender);
    handlePreviewVoice(newGender, voiceTone);
  };

  const handleSelectTone = (newTone: VoiceTone) => {
    setVoiceTone(newTone);
    handlePreviewVoice(voiceGender, newTone);
  };

  const activeMatchedVoice = getBestVoice(availableVoices, targetLanguage, voiceGender);

  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    setTargetLanguage(newLang);

    // 1. Immediate auditory confirmation: announce new language in that native language at full volume
    announceLanguageChange(newLang, {
      gender: voiceGender,
      tone: voiceTone,
      volume: 1.0,
      rate,
      pitch,
      availableVoices,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    // 2. If an active sign is already confirmed, update the regional translation and cognitive reasoning in the UI
    const activeSign = confirmedSign || (recognizedText ? recognizedText.trim().split(' ').slice(-1)[0] : '');
    if (activeSign && activeSign !== 'Unknown Sign' && activeSign !== 'No Hand Detected') {
      try {
        setIsLlmLoading(true);
        const multi = await translateMultilingual([activeSign], newLang, prediction?.nmm_markers);
        if (multi) {
          if (multi.translated_text) {
            setRegionalSentence(newLang === 'en' ? '' : multi.translated_text);
          }
          if (multi.thought_process) {
            setLlmThoughtProcess(multi.thought_process);
          }
          if (multi.accurate_words) {
            setAccurateWords(multi.accurate_words);
          }
        }
      } catch (err) {
        console.warn('Failed translating sign on language change:', err);
      } finally {
        setIsLlmLoading(false);
      }
    }
  };

  // Prediction detection loop
  useEffect(() => {
    if (!prediction) {
      setStatusState('Waiting for Stream');
      return;
    }

    const currentRaw = prediction.prediction;

    if (currentRaw === 'No Hand Detected') {
      setStatusState('No Hand Detected');
      candidateRef.current = '';
      consecutiveCountRef.current = 0;
      return;
    }

    if (currentRaw === 'Unknown Sign' || prediction.confidence < confidenceThreshold) {
      setStatusState('Unknown Sign');
      candidateRef.current = '';
      consecutiveCountRef.current = 0;
      return;
    }

    setStatusState('Recognizing...');

    if (toggles.predictionStabilization) {
      if (currentRaw === candidateRef.current) {
        consecutiveCountRef.current += 1;
      } else {
        candidateRef.current = currentRaw;
        consecutiveCountRef.current = 1;
      }

      if (consecutiveCountRef.current >= STABILITY_THRESHOLD) {
        if (currentRaw !== lastConfirmedSignRef.current) {
          lastConfirmedSignRef.current = currentRaw;
          confirmNewSign(currentRaw);
        }
      }
    } else {
      if (currentRaw !== lastConfirmedSignRef.current) {
        lastConfirmedSignRef.current = currentRaw;
        confirmNewSign(currentRaw);
      }
    }
  }, [prediction, isVoiceEnabled, voiceGender, confidenceThreshold, toggles.predictionStabilization, agentMode, agentTone]);

  // When a sign is confirmed, trigger Agentic LLM synthesis
  const confirmNewSign = async (signName: string) => {
    setConfirmedSign(signName);
    setStatusState('Hand Detected');

    const signText = signName.replace(/_/g, ' ');
    setRecognizedText((prev) => (prev ? `${prev} ${signText}` : signText));
    setSignHistory((prev) => [signName, ...prev]);

    // Trigger Agentic AI synthesis
    await processAgenticAI(signName, [signName, ...signHistory.slice(0, 3)]);
  };

  const processAgenticAI = async (currentSign: string, recentGlosses: string[]) => {
    setIsLlmLoading(true);
    try {
      if (agentMode === 'sentence') {
        // Mode 1: Natural Sentence Synthesis (Gloss -> Full Grammatical Sentence)
        let targetSentence = recentGlosses.length === 1 && prediction?.sentence ? prediction.sentence : '';
        if (!targetSentence) {
          const res = await synthesizeSentence(recentGlosses, agentTone, 'general', prediction?.nmm_markers);
          if (res) {
            if (res.sentence) targetSentence = res.sentence;
            if (res.thought_process) setLlmThoughtProcess(res.thought_process);
            if (res.accurate_words) setAccurateWords(res.accurate_words);
          }
        }
        if (targetSentence) {
          setLlmSentence(targetSentence);
        }

        // Multilingual Regional Translation
        if (targetLanguage !== 'en') {
          const multi = await translateMultilingual(recentGlosses, targetLanguage, prediction?.nmm_markers);
          if (multi) {
            if (multi.translated_text) {
              setRegionalSentence(multi.translated_text);
              if (isVoiceEnabled && multi.translated_text !== lastSpokenTextRef.current) {
                speakText(multi.translated_text, targetLanguage, targetSentence);
              }
            }
            if (multi.thought_process) setLlmThoughtProcess(multi.thought_process);
            if (multi.accurate_words) setAccurateWords(multi.accurate_words);
          }
        } else {
          setRegionalSentence('');
          if (isVoiceEnabled && targetSentence && targetSentence !== lastSpokenTextRef.current) {
            speakText(targetSentence, 'en');
          }
        }
      } else if (agentMode === 'converse') {
        // Mode 2: Conversational Dialogue Partner (Signs question/greeting -> AI Agent answers thoughtfully)
        let targetReply = prediction?.agent_response || '';
        if (!targetReply) {
          const res = await converseWithAgent(currentSign, [], agentTone);
          if (res) {
            if (res.agent_response) targetReply = res.agent_response;
            if (res.thought_process) setLlmThoughtProcess(res.thought_process);
            if (res.accurate_words) setAccurateWords(res.accurate_words);
          }
        }
        if (targetReply) {
          setLlmConversationalReply(targetReply);
          setConversationHistory((prev) => [
            {
              sender: 'user',
              text: `Signed: ${currentSign.replace(/_/g, ' ')}`,
              sign: currentSign,
              timestamp: new Date().toLocaleTimeString(),
            },
            {
              sender: 'agent',
              text: targetReply,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 10),
          ]);
          if (isVoiceEnabled && targetReply !== lastSpokenTextRef.current) {
            speakText(targetReply, targetLanguage);
          }
        }
      } else {
        // Mode 3: Raw 1-word fallback
        if (isVoiceEnabled) {
          speakText(currentSign.replace(/_/g, ' '), targetLanguage);
        }
      }
    } catch (err) {
      console.warn('Agentic AI endpoint call failed, falling back to local synthesis:', err);
      const fallbackSentence = `I am communicating ${currentSign.replace(/_/g, ' ')}. Please note this gesture.`;
      setLlmSentence(fallbackSentence);
      if (isVoiceEnabled) {
        speakText(fallbackSentence, 'en');
      }
    } finally {
      setIsLlmLoading(false);
    }
  };

  const handleManualSynthesize = async () => {
    if (!recognizedText && !confirmedSign) return;
    const glosses = recognizedText.split(' ').filter(Boolean);
    const targetGlosses = glosses.length > 0 ? glosses : [confirmedSign];
    setIsLlmLoading(true);
    try {
      const res = await synthesizeSentence(targetGlosses, agentTone, 'general', prediction?.nmm_markers);
      if (res) {
        if (res.sentence) setLlmSentence(res.sentence);
        if (res.thought_process) setLlmThoughtProcess(res.thought_process);
        if (res.accurate_words) setAccurateWords(res.accurate_words);
      }
      if (targetLanguage !== 'en') {
        const multi = await translateMultilingual(targetGlosses, targetLanguage, prediction?.nmm_markers);
        if (multi) {
          if (multi.translated_text) {
            setRegionalSentence(multi.translated_text);
            speakText(multi.translated_text, targetLanguage);
          }
          if (multi.thought_process) setLlmThoughtProcess(multi.thought_process);
          if (multi.accurate_words) setAccurateWords(multi.accurate_words);
          return;
        }
      }
      if (res && res.sentence) {
        speakText(res.sentence, 'en');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLlmLoading(false);
    }
  };

  const handleManualConverse = async () => {
    if (!confirmedSign && !recognizedText) return;
    const target = confirmedSign || recognizedText;
    setIsLlmLoading(true);
    try {
      const res = await converseWithAgent(target, [], agentTone);
      if (res) {
        if (res.agent_response) {
          setLlmConversationalReply(res.agent_response);
          setConversationHistory((prev) => [
            {
              sender: 'user',
              text: `Signed: ${target.replace(/_/g, ' ')}`,
              sign: target,
              timestamp: new Date().toLocaleTimeString(),
            },
            {
              sender: 'agent',
              text: res.agent_response,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 10),
          ]);
          speakText(res.agent_response, targetLanguage);
        }
        if (res.thought_process) setLlmThoughtProcess(res.thought_process);
        if (res.accurate_words) setAccurateWords(res.accurate_words);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLlmLoading(false);
    }
  };

  const handleClearText = () => {
    setRecognizedText('');
    setConfirmedSign('');
    setLlmSentence('');
    setRegionalSentence('');
    setLlmConversationalReply('');
    setLlmThoughtProcess(null);
    setAccurateWords(null);
    lastConfirmedSignRef.current = '';
    lastSpokenTextRef.current = '';
  };

  const handleClearHistory = () => {
    setSignHistory([]);
    setConversationHistory([]);
  };

  const handleExportHistory = () => {
    if (signHistory.length === 0 && conversationHistory.length === 0) return;
    const content = `ISL RECOGNITION & AGENTIC AI DIALOGUE LOG\nDate: ${new Date().toLocaleString()}\n--------------------\nMode: ${agentMode} | Tone: ${agentTone}\nSentence Text: ${recognizedText}\nLLM Sentence: ${llmSentence}\nConfirmed Signs: ${signHistory.join(', ')}\n\nDialogue History:\n${conversationHistory.map((c) => `[${c.timestamp}] ${c.sender.toUpperCase()}: ${c.text}`).join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `isl_agent_log_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = () => {
    switch (statusState) {
      case 'Hand Detected':
        return (
          <span
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle size={14} /> Hand Motion Confirmed
          </span>
        );
      case 'Recognizing...':
        return (
          <span
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Activity size={14} /> Tracking Motion ({consecutiveCountRef.current}/{STABILITY_THRESHOLD})
          </span>
        );
      case 'Unknown Sign':
        return (
          <span
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              color: '#f59e0b',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertCircle size={14} /> Unknown Gesture (&lt;{Math.round(confidenceThreshold * 100)}%)
          </span>
        );
      default:
        return (
          <span
            style={{
              backgroundColor: 'rgba(100, 116, 139, 0.2)',
              color: '#94a3b8',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Activity size={14} /> {statusState}
          </span>
        );
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Card Header & Controls */}
      <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={20} color="#10b981" />
          <span>Real-Time Motion ISL & Agentic AI</span>
        </div>

        {/* Audio Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isSpeaking && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderRadius: '4px',
              }}
            >
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
            </div>
          )}

          {/* Voice Gender Switcher Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '2px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => handleSelectGender('female')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: voiceGender === 'female' ? 'rgba(236, 72, 153, 0.3)' : 'transparent',
                color: voiceGender === 'female' ? '#f472b6' : 'var(--text-muted)',
                fontWeight: voiceGender === 'female' ? 700 : 500,
                transition: 'all 0.2s ease',
              }}
              title="Activate Female Voice Persona"
            >
              <span>♀</span> Female Voice (Zira)
            </button>
            <button
              type="button"
              onClick={() => handleSelectGender('male')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: voiceGender === 'male' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                color: voiceGender === 'male' ? '#60a5fa' : 'var(--text-muted)',
                fontWeight: voiceGender === 'male' ? 700 : 500,
                transition: 'all 0.2s ease',
              }}
              title="Activate Male Voice Persona (Microsoft David)"
            >
              <span>♂</span> Male Voice (David)
            </button>
          </div>

          <button
            className="btn"
            onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
            style={{
              padding: '4px 8px',
              fontSize: '0.8rem',
              background: isVoiceEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: isVoiceEnabled ? '#10b981' : '#ef4444',
              border: '1px solid currentColor',
            }}
          >
            {isVoiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {isVoiceEnabled ? 'Voice ON' : 'Muted'}
          </button>
        </div>
      </div>

      {/* Connection & Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--input-bg)',
          padding: '10px 14px',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#10b981' : '#ef4444',
              }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Multimodal Face CV Telemetry Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: prediction?.nmm_markers ? 'rgba(6, 182, 212, 0.15)' : 'rgba(51, 65, 85, 0.3)',
              color: prediction?.nmm_markers ? '#06b6d4' : '#64748b',
              fontSize: '0.75rem',
              border: '1px solid currentColor',
            }}
          >
            <Smile size={12} />
            <span>
              Face CV:{' '}
              {prediction?.nmm_markers
                ? `${prediction.nmm_markers.eyebrow_raised ? 'Brow Raised (?)' : 'Tracking'} | ${prediction.nmm_markers.emotion || 'neutral'}`
                : 'Active (468 pts)'}
            </span>
          </div>

          {/* AFME Kinematic State Badge */}
          {prediction?.afme && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor:
                  prediction.afme.motion_state === 'ACTIVE_SIGNING'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : prediction.afme.motion_state === 'TRANSITIONING'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(100, 116, 139, 0.2)',
                color:
                  prediction.afme.motion_state === 'ACTIVE_SIGNING'
                    ? '#10b981'
                    : prediction.afme.motion_state === 'TRANSITIONING'
                    ? '#f59e0b'
                    : '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: '1px solid currentColor',
              }}
            >
              <Activity size={12} />
              <span>AFME: {prediction.afme.motion_state}</span>
            </div>
          )}

          {/* Inference Backend Engine Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#c084fc',
              fontSize: '0.75rem',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            <Zap size={12} />
            <span>{prediction?.inference_backend || 'Adaptive ST-GCN'}</span>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 🤖 AGENTIC AI & LLM CONTROL BAR                               */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          borderRadius: '10px',
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bot size={18} color="#60a5fa" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0' }}>Agentic AI &amp; LLM Engine</span>
            <span
              style={{
                fontSize: '0.7rem',
                backgroundColor: 'rgba(59, 130, 246, 0.25)',
                color: '#93c5fd',
                padding: '2px 8px',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.4)',
              }}
            >
              Active
            </span>
          </div>

          {/* LLM Generation Tone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Text Tone:</span>
            <select
              value={agentTone}
              onChange={(e) => setAgentTone(e.target.value as AgentTone)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                color: '#e2e8f0',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                padding: '3px 6px',
                outline: 'none',
              }}
              title="LLM Natural Sentence Generation Tone"
            >
              <option value="polite">Polite &amp; Helpful</option>
              <option value="casual">Casual Conversation</option>
              <option value="formal">Formal &amp; Professional</option>
              <option value="emergency">Emergency / Urgent</option>
            </select>
          </div>

          {/* Realistic Voice Prosody & Cadence Tone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Voice Tone:</span>
            <select
              value={voiceTone}
              onChange={(e) => handleSelectTone(e.target.value as VoiceTone)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                padding: '3px 6px',
                outline: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Acoustic Voice Prosody & Human Inflection (Not Artificial / Robotic)"
            >
              <option value="natural">🎙️ Natural Human</option>
              <option value="warm">🌸 Warm &amp; Empathetic</option>
              <option value="professional">💼 Professional Clear</option>
              <option value="deep">🌊 Deep &amp; Grounded</option>
              <option value="energetic">⚡ Lively &amp; Upbeat</option>
              <option value="storyteller">📖 Narrative Expressive</option>
              <option value="urgent">🚨 Urgent Assist</option>
            </select>
          </div>

          {/* Regional Indian Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={14} color="#60a5fa" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lang:</span>
            <select
              value={targetLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                padding: '3px 6px',
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
        </div>

        {/* Active Voice Persona Visual Indicator & Test Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: voiceGender === 'female' ? '#f472b6' : '#60a5fa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <UserCheckIcon size={13} /> {voiceGender === 'female' ? '♀ Female Voice Persona' : '♂ Male Voice Persona'}:
            </span>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>
              {activeMatchedVoice ? activeMatchedVoice.name : (voiceGender === 'female' ? 'Microsoft Zira' : 'Microsoft David')}
            </span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: voiceGender === 'male' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                color: voiceGender === 'male' ? '#60a5fa' : '#f472b6',
                fontSize: '0.68rem',
                fontWeight: 600,
                border: '1px solid currentColor',
              }}
            >
              {voiceGender === 'male' ? 'Real Male Voice (David)' : 'Real Female Voice (Zira)'}
            </span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                fontSize: '0.68rem',
                fontWeight: 600,
                border: '1px solid currentColor',
              }}
            >
              🔊 Volume: 100% (High Gain)
            </span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {TONE_PRESETS[voiceTone]?.name}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
              ({TONE_PRESETS[voiceTone]?.tagline})
            </span>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => handlePreviewVoice()}
            style={{
              padding: '3px 10px',
              fontSize: '0.72rem',
              backgroundColor: 'rgba(59, 130, 246, 0.25)',
              color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600,
            }}
            title="Preview how this voice persona and tone sounds in the active language"
          >
            <Play size={11} /> Test Voice Persona
          </button>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setAgentMode('sentence')}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: agentMode === 'sentence' ? '#2563eb' : 'rgba(51, 65, 85, 0.5)',
              color: agentMode === 'sentence' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s ease',
            }}
          >
            <Sparkles size={14} /> Full Sentence Translation
          </button>
          <button
            onClick={() => setAgentMode('converse')}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: agentMode === 'converse' ? '#8b5cf6' : 'rgba(51, 65, 85, 0.5)',
              color: agentMode === 'converse' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s ease',
            }}
          >
            <MessageSquare size={14} /> Conversational Dialogue AI
          </button>
          <button
            onClick={() => setAgentMode('raw')}
            style={{
              padding: '6px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: agentMode === 'raw' ? '#475569' : 'rgba(51, 65, 85, 0.3)',
              color: agentMode === 'raw' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s ease',
            }}
          >
            Raw 1-Word
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 🌟 AGENTIC AI FULL SENTENCE / DIALOGUE OUTPUT               */}
      {/* ──────────────────────────────────────────────────────────── */}
      {agentMode !== 'raw' && (
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                color: agentMode === 'sentence' ? '#60a5fa' : '#c084fc',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {agentMode === 'sentence' ? (
                <>
                  <Sparkles size={14} /> LLM Natural Sentence Output:
                </>
              ) : (
                <>
                  <Bot size={14} /> AI Conversational Partner Response:
                </>
              )}
            </span>
            {isLlmLoading && (
              <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontStyle: 'italic' }}>
                AI Synthesizing...
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#f8fafc',
              lineHeight: 1.5,
              minHeight: '48px',
            }}
          >
            {agentMode === 'sentence'
              ? llmSentence ||
                (confirmedSign ? (
                  `Communicating: "${confirmedSign}" — Click 'Synthesize Full Sentence' below.`
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '1rem' }}>
                    Show an ISL sign to generate a complete natural sentence...
                  </span>
                ))
              : llmConversationalReply ||
                (confirmedSign ? (
                  `Signed "${confirmedSign}". Click 'Ask Conversational Agent' below.`
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '1rem' }}>
                    Sign a greeting or question to engage with the AI Agent...
                  </span>
                ))}
          </div>

          {/* Regional Multilingual Translation Display */}
          {regionalSentence && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px 14px',
                backgroundColor: 'rgba(37, 99, 235, 0.25)',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} color="#60a5fa" />
                <span style={{ fontSize: '1.15rem', color: '#93c5fd', fontWeight: 600 }}>{regionalSentence}</span>
              </div>
              <button
                className="btn"
                onClick={() => speakText(regionalSentence, targetLanguage)}
                style={{
                  fontSize: '0.75rem',
                  padding: '5px 10px',
                  background: 'rgba(37, 99, 235, 0.9)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: 600,
                }}
              >
                <Volume2 size={13} /> Listen ({targetLanguage.toUpperCase()})
              </button>
            </div>
          )}

          {/* Action buttons for LLM */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {agentMode === 'sentence' ? (
              <button
                className="btn btn-primary"
                onClick={handleManualSynthesize}
                disabled={!confirmedSign && !recognizedText}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <Sparkles size={14} /> Synthesize Full Sentence
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleManualConverse}
                disabled={!confirmedSign && !recognizedText}
                style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#8b5cf6' }}
              >
                <Bot size={14} /> Ask Conversational Agent
              </button>
            )}

            <button
              className="btn"
              onClick={() => {
                if (targetLanguage !== 'en' && regionalSentence) {
                  speakText(regionalSentence, targetLanguage);
                } else {
                  speakText(agentMode === 'sentence' ? llmSentence : llmConversationalReply, 'en');
                }
              }}
              disabled={!(agentMode === 'sentence' ? (regionalSentence || llmSentence) : llmConversationalReply)}
              style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#334155', color: 'white' }}
            >
              <Volume2 size={14} /> Speak Audio {targetLanguage !== 'en' && regionalSentence ? `(${targetLanguage.toUpperCase()})` : `(${Math.round(volume * 100)}%)`}
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 🧠 LLM COGNITIVE THOUGHT PROCESS & ACCURATE WORDS            */}
      {/* ──────────────────────────────────────────────────────────── */}
      {llmThoughtProcess && (
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Header Bar */}
          <div
            onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Brain size={18} color="#c084fc" />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f3e8ff' }}>
                LLM Cognitive Thought Process &amp; Linguistic Reasoning
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(168, 85, 247, 0.25)',
                  color: '#e9d5ff',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  fontWeight: 600,
                }}
              >
                4-Stage Cognitive Chain
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  fontWeight: 600,
                }}
              >
                Confidence: {Math.round(llmThoughtProcess.confidence_score * 100)}%
              </span>
            </div>

            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#c084fc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              {isThoughtExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {/* Collapsible Content */}
          {isThoughtExpanded && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Summary Thought */}
              <div
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  borderLeft: '3px solid #c084fc',
                  padding: '8px 12px',
                  borderRadius: '0 6px 6px 0',
                  fontSize: '0.8rem',
                  color: '#e2e8f0',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: '#c084fc' }}>Cognitive Rationale:</strong> {llmThoughtProcess.summary}
              </div>

              {/* 4 Stages Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '8px',
                }}
              >
                {/* Stage 1: Morphology */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '4px' }}>
                    1. Kinematics &amp; Morphology
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Tokens:</strong> {llmThoughtProcess.stage_1_morphology.tokens.join(', ')}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Handshape:</strong> {llmThoughtProcess.stage_1_morphology.handshape}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Motion / Loc:</strong> {llmThoughtProcess.stage_1_morphology.motion} ({llmThoughtProcess.stage_1_morphology.location})
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Articulation:</strong> {llmThoughtProcess.stage_1_morphology.articulation} {llmThoughtProcess.stage_1_morphology.two_handed ? '(Two-Handed)' : '(One-Handed)'}
                  </div>
                </div>

                {/* Stage 2: Syntax */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ color: '#34d399', fontWeight: 700, marginBottom: '4px' }}>
                    2. Syntactic SOV Transformation
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Source Syntax:</strong> {llmThoughtProcess.stage_2_syntax.source_syntax}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Target Syntax:</strong> {llmThoughtProcess.stage_2_syntax.target_syntax}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Grammar Role:</strong> {llmThoughtProcess.stage_2_syntax.grammatical_role}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Rule:</strong> {llmThoughtProcess.stage_2_syntax.transformation}
                  </div>
                </div>

                {/* Stage 3: Vision NMM Fusion */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: '4px' }}>
                    3. Face CV &amp; NMM Fusion
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Brow State:</strong> {llmThoughtProcess.stage_3_nmm_vision.eyebrow_raised ? 'Raised (Question / Interrogative)' : 'Neutral (Declarative)'}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Detected Emotion:</strong> {llmThoughtProcess.stage_3_nmm_vision.detected_emotion}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Polarity:</strong> {llmThoughtProcess.stage_3_nmm_vision.polarity}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Fusion:</strong> {llmThoughtProcess.stage_3_nmm_vision.fusion_impact}
                  </div>
                </div>

                {/* Stage 4: Lexical Selection */}
                <div
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ color: '#ec4899', fontWeight: 700, marginBottom: '4px' }}>
                    4. Pragmatic Lexical Selection
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Domain:</strong> {llmThoughtProcess.stage_4_lexical_selection.context_domain}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Tone Register:</strong> {llmThoughtProcess.stage_4_lexical_selection.tone_register}
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    <strong>Rationale:</strong> {llmThoughtProcess.stage_4_lexical_selection.rationale}
                  </div>
                </div>
              </div>

              {/* Accurate Words Across All 6 Languages (Interactive Click-to-Speak) */}
              {accurateWords && (
                <div
                  style={{
                    marginTop: '4px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e9d5ff' }}>
                      🌐 Context-Accurate Words (Click any language to hear native speech):
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      Active: {targetLanguage.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                    {[
                      { code: 'en' as SupportedLanguage, label: 'EN (English)', text: accurateWords.en || '' },
                      { code: 'hi' as SupportedLanguage, label: 'HI (हिन्दी)', text: accurateWords.hi || '' },
                      { code: 'ta' as SupportedLanguage, label: 'TA (தமிழ்)', text: accurateWords.ta || '' },
                      { code: 'te' as SupportedLanguage, label: 'TE (తెలుగు)', text: accurateWords.te || '' },
                      { code: 'kn' as SupportedLanguage, label: 'KN (ಕನ್ನಡ)', text: accurateWords.kn || '' },
                      { code: 'bn' as SupportedLanguage, label: 'BN (বাংলা)', text: accurateWords.bn || '' },
                    ].map(({ code, label, text }) => {
                      if (!text) return null;
                      const isActive = targetLanguage === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            setTargetLanguage(code);
                            speakText(text, code);
                          }}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: isActive ? '1px solid #c084fc' : '1px solid rgba(148, 163, 184, 0.2)',
                            backgroundColor: isActive ? 'rgba(168, 85, 247, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '2px',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                          title={`Click to listen to native ${label} pronunciation`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.68rem', color: isActive ? '#f3e8ff' : '#94a3b8', fontWeight: 600 }}>
                              {label}
                            </span>
                            <Volume2 size={11} color={isActive ? '#c084fc' : '#64748b'} />
                          </div>
                          <span style={{ fontSize: '0.85rem', color: isActive ? '#ffffff' : '#e2e8f0', fontWeight: 600 }}>
                            {text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* RAW RECOGNITION BOX (Detected Sign + Confidence)             */}
      {/* ──────────────────────────────────────────────────────────── */}
      {prediction ? (
        <div>
          <div
            className={prediction.confidence >= confidenceThreshold ? 'motion-active-card' : ''}
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '16px 20px',
              textAlign: 'center',
              transition: 'all 0.3s ease',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '4px',
              }}
            >
              Detected Motion ISL Sign (Raw Gesture)
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: prediction.confidence >= confidenceThreshold ? '#60a5fa' : '#f59e0b',
              }}
            >
              {prediction.prediction === 'Unknown Sign' || prediction.confidence < confidenceThreshold
                ? 'Unknown Sign'
                : prediction.prediction.replace(/_/g, ' ')}
            </div>

            {toggles.showConfidence && (
              <div style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Confidence: <strong>{(prediction.confidence * 100).toFixed(1)}%</strong> (Threshold:{' '}
                {Math.round(confidenceThreshold * 100)}%)
              </div>
            )}
          </div>

          {/* Top Candidates Probability Bars */}
          {toggles.showConfidence && (
            <div style={{ marginTop: '12px' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Top Predictions</h4>
              {prediction.top_k?.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '6px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      marginBottom: '2px',
                    }}
                  >
                    <span>{item.label.replace(/_/g, ' ')}</span>
                    <span>{(item.score * 100).toFixed(1)}%</span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '5px',
                      backgroundColor: 'var(--border-color)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${item.score * 100}%`,
                        height: '100%',
                        backgroundColor:
                          idx === 0 && prediction.confidence >= confidenceThreshold ? '#2563eb' : '#64748b',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AFME Kinematic Analysis Panel */}
          {prediction.afme && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={14} /> AFME Kinematic Engine Telemetry
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  v={prediction.afme.overall_velocity} | a={prediction.afme.overall_acceleration} | κ={prediction.afme.trajectory_curvature}
                </span>
              </div>
              
              {/* Active Fingers */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Fingers:</span>
                {['THUMB', 'INDEX', 'MIDDLE', 'RING', 'PINKY'].map((f) => {
                  const isActive = prediction.afme?.active_fingers?.includes(f);
                  const ext = prediction.afme?.finger_kinematics?.[f]?.angles?.extension_pct;
                  return (
                    <span
                      key={f}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.4)',
                        color: isActive ? '#34d399' : '#94a3b8',
                        border: `1px solid ${isActive ? '#10b981' : 'transparent'}`,
                      }}
                    >
                      {f} {ext !== undefined ? `(${Math.round(ext)}%)` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ST-GCN Joint & Finger Attention Weights */}
          {prediction.joint_attention?.active_finger_importance && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(88, 28, 135, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={14} /> ST-GCN Finger Attention Contribution
                </span>
                <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Explainable AI (21 Joints)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {Object.entries(prediction.joint_attention.active_finger_importance).map(([finger, pct]) => (
                  <div key={finger} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'capitalize' }}>{finger}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: Number(pct) > 20 ? '#a855f7' : '#94a3b8' }}>{pct}%</div>
                    <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#c084fc' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ISL Master Agent Reasoning & Verification Box */}
          {prediction.agent_reasoning && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Bot size={14} /> Master Agent Verification &amp; Reasoning
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor:
                      prediction.agent_reasoning.verification_verdict === 'CONFIRMED'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : prediction.agent_reasoning.verification_verdict === 'RESOLVED_BY_CONTEXT'
                        ? 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                    color:
                      prediction.agent_reasoning.verification_verdict === 'CONFIRMED'
                        ? '#10b981'
                        : prediction.agent_reasoning.verification_verdict === 'RESOLVED_BY_CONTEXT'
                        ? '#60a5fa'
                        : '#f59e0b',
                    fontWeight: 700,
                  }}
                >
                  {prediction.agent_reasoning.verification_verdict}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                <strong>Evidence:</strong> {prediction.agent_reasoning.verification_note}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                <strong>Motion:</strong> {prediction.agent_reasoning.motion_summary}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
          <Activity size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
          <p>Waiting for live camera frame stream...</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* Recognized Sentence Text                                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      {toggles.showRecognizedText && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Recognized Sign Gloss Stream:
          </h4>
          <div
            style={{
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '10px 14px',
              minHeight: '44px',
              fontSize: '1rem',
              color: recognizedText ? 'var(--text-main)' : 'var(--text-muted)',
              fontStyle: recognizedText ? 'normal' : 'italic',
            }}
          >
            {recognizedText || 'Recognized ISL signs will accumulate here...'}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => speakText(recognizedText)}
              disabled={!recognizedText}
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
            >
              <Play size={14} /> Speak Signs ({Math.round(volume * 100)}%)
            </button>
            <button
              className="btn"
              onClick={() => confirmedSign && speakText(confirmedSign)}
              disabled={!confirmedSign}
              style={{ background: '#334155', color: 'white', fontSize: '0.8rem', padding: '6px 10px' }}
            >
              <RefreshCw size={14} /> Replay Last Sign
            </button>
            <button
              className="btn"
              onClick={handleClearText}
              disabled={!recognizedText && !confirmedSign}
              style={{ background: '#ef4444', color: 'white', fontSize: '0.8rem', padding: '6px 10px' }}
            >
              <Trash2 size={14} /> Clear All
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* Interactive Dialogue History (in Conversational Mode)       */}
      {/* ──────────────────────────────────────────────────────────── */}
      {agentMode === 'converse' && conversationHistory.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            💬 Dialogue History with AI Agent:
          </h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '180px',
              overflowY: 'auto',
              padding: '8px',
              backgroundColor: 'var(--input-bg)',
              borderRadius: '8px',
            }}
          >
            {conversationHistory.map((turn, i) => (
              <div
                key={i}
                style={{
                  alignSelf: turn.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: turn.sender === 'user' ? 'rgba(37, 99, 235, 0.25)' : 'rgba(139, 92, 246, 0.25)',
                  border:
                    turn.sender === 'user'
                      ? '1px solid rgba(37, 99, 235, 0.4)'
                      : '1px solid rgba(139, 92, 246, 0.4)',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                }}
              >
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: turn.sender === 'user' ? '#93c5fd' : '#c4b5fd',
                    marginBottom: '2px',
                    fontWeight: 600,
                  }}
                >
                  {turn.sender === 'user' ? '👤 Signer' : '🤖 AI Agent'} • {turn.timestamp}
                </div>
                <div>{turn.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* Sign History Panel                                          */}
      {/* ──────────────────────────────────────────────────────────── */}
      {toggles.showSignHistory && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <h4
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <History size={16} /> Confirmed Sign History
            </h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(signHistory.length > 0 || conversationHistory.length > 0) && (
                <button
                  onClick={handleExportHistory}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Download size={14} /> Export Log
                </button>
              )}
              {signHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear History
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '90px', overflowY: 'auto' }}>
            {signHistory.length > 0 ? (
              signHistory.map((sign, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {sign.replace(/_/g, ' ')}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No signs confirmed in history yet.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* Debug Information Box                                       */}
      {/* ──────────────────────────────────────────────────────────── */}
      {toggles.debugMode && prediction && (
        <div
          style={{
            backgroundColor: 'var(--input-bg)',
            border: '1px dashed #3b82f6',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '0.75rem',
            color: '#93c5fd',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Terminal size={14} /> Debug Monitor
          </div>
          <div>Raw Prediction: {prediction.prediction}</div>
          <div>Confidence Score: {prediction.confidence}</div>
          <div>Inference Latency: {prediction.latency_ms} ms</div>
          <div>Agent Mode: {agentMode} | Tone: {agentTone}</div>
        </div>
      )}
    </div>
  );
};
