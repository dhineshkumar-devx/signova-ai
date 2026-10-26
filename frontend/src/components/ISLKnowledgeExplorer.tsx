import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Globe,
  Bot,
  Send,
  Layers,
  Info,
  Volume2,
} from 'lucide-react';
import {
  fetchSignKnowledgeBase,
  fetchAlphabetKnowledge,
  translateMultilingual,
  askISLExpert,
} from '../services/api';
import { speakMultilingual, announceLanguageChange, SupportedLanguage } from '../services/speech';

export const ISLKnowledgeExplorer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'lexicon' | 'alphabet' | 'multilingual' | 'expert'>('lexicon');

  // Knowledge base states
  const [signsData, setSignsData] = useState<Record<string, any>>({});
  const [alphabetData, setAlphabetData] = useState<Record<string, any>>({});
  const [selectedSign, setSelectedSign] = useState<string>('HELLO');

  // Multilingual translation sandbox
  const [testSign, setTestSign] = useState<string>('HELP');
  const [targetLang, setTargetLang] = useState<string>('hi');
  const [isQuestionMode, setIsQuestionMode] = useState<boolean>(true);
  const [translationResult, setTranslationResult] = useState<any>(null);

  // Expert QA states
  const [expertQuestion, setExpertQuestion] = useState<string>(
    'Explain the role of facial non-manual markers (NMM) in Indian Sign Language grammar.'
  );
  const [expertAnswer, setExpertAnswer] = useState<any>(null);
  const [isAsking, setIsAsking] = useState<boolean>(false);

  useEffect(() => {
    fetchSignKnowledgeBase().then((res) => setSignsData(res.signs || {})).catch(console.error);
    fetchAlphabetKnowledge().then((res) => setAlphabetData(res.alphabet || {})).catch(console.error);
  }, []);

  const handleLanguageChange = async (newLang: string) => {
    setTargetLang(newLang);
    try {
      const res = await translateMultilingual([testSign], newLang, { eyebrow_raised: isQuestionMode });
      setTranslationResult(res);
      if (res && res.translated_text) {
        speakMultilingual(res.translated_text, { lang: newLang as SupportedLanguage });
        return;
      }
    } catch {
      // Fallback to spoken announcement if API fails
    }
    announceLanguageChange(newLang as SupportedLanguage);
  };

  const handleTestTranslation = async () => {
    try {
      const res = await translateMultilingual([testSign], targetLang, { eyebrow_raised: isQuestionMode });
      setTranslationResult(res);
      if (res && res.translated_text) {
        speakMultilingual(res.translated_text, { lang: targetLang as SupportedLanguage });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAskExpert = async (q?: string) => {
    const questionText = q || expertQuestion;
    if (!questionText.trim()) return;
    setIsAsking(true);
    try {
      const res = await askISLExpert(questionText);
      setExpertAnswer(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAsking(false);
    }
  };

  const activeSignInfo = signsData[selectedSign];

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
        border: '1px solid rgba(96, 165, 250, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} color="#60a5fa" />
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            ISL Knowledge Base &amp; Multilingual Extension Suite
          </span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#93c5fd',
            padding: '3px 10px',
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.4)',
          }}
        >
          Fed into LLM Context &amp; Computer Vision Engine
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'lexicon', label: 'Sign Lexicon & Anatomy', icon: Layers },
          { id: 'alphabet', label: 'A-Z Fingerspelling Guide', icon: Info },
          { id: 'multilingual', label: 'Regional Languages (6 Indian)', icon: Globe },
          { id: 'expert', label: 'ISL AI Linguistics Expert', icon: Bot },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: isSel ? '1px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.2)',
                backgroundColor: isSel ? 'rgba(37, 99, 235, 0.3)' : 'rgba(15, 23, 42, 0.4)',
                color: isSel ? '#ffffff' : '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 1: SIGN LEXICON & ANATOMY                                */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'lexicon' && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* Sign List Picker */}
          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
            {Object.keys(signsData).map((signName) => (
              <button
                key={signName}
                onClick={() => setSelectedSign(signName)}
                style={{
                  textAlign: 'left',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: selectedSign === signName ? '1px solid #3b82f6' : '1px solid transparent',
                  backgroundColor: selectedSign === signName ? 'rgba(37, 99, 235, 0.3)' : 'rgba(51, 65, 85, 0.2)',
                  color: selectedSign === signName ? '#60a5fa' : '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {signName.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Sign Details Card */}
          {activeSignInfo && (
            <div
              style={{
                flex: 1,
                minWidth: '280px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#60a5fa', fontWeight: 800 }}>
                  {activeSignInfo.sign}
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    backgroundColor: activeSignInfo.two_handed ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: activeSignInfo.two_handed ? '#c084fc' : '#34d399',
                    padding: '2px 8px',
                    borderRadius: '8px',
                  }}
                >
                  {activeSignInfo.two_handed ? 'Two-Handed' : 'One-Handed'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Handshape</div>
                  <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>{activeSignInfo.handshape}</div>
                </div>

                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Articulation Space</div>
                  <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>{activeSignInfo.location}</div>
                </div>

                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Motion Dynamics</div>
                  <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>{activeSignInfo.motion}</div>
                </div>

                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '8px 12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Grammar Role</div>
                  <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>{activeSignInfo.grammar}</div>
                </div>
              </div>

              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Regional Notes: </span>
                <span style={{ color: '#cbd5e1' }}>{activeSignInfo.regional_notes}</span>
              </div>

              <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#a855f7', fontWeight: 600 }}>ASL vs ISL Comparison: </span>
                <span style={{ color: '#cbd5e1' }}>{activeSignInfo.asl_comparison}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 2: A-Z FINGERSPELLING GUIDE                              */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'alphabet' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
            Indian Sign Language features a specialized two-handed manual alphabet. Vowels are represented by touching
            the fingertips of the non-dominant hand (Thumb=A, Index=E, Middle=I, Ring=O, Pinky=U).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
            {Object.entries(alphabetData).map(([letter, item]: [string, any]) => (
              <div
                key={letter}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}
                >
                  {letter}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: '#93c5fd', fontWeight: 600 }}>{item.type}</div>
                  <div style={{ fontSize: '0.8rem', color: '#e2e8f0', marginTop: '2px' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 3: REGIONAL MULTILINGUAL TRANSLATION                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'multilingual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
            Extend your ISL project beyond English into regional Indian languages. Non-manual markers (eyebrow raises)
            automatically adapt grammatical sentence structure into interrogative clauses.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '6px' }}>Sign:</span>
              <select
                value={testSign}
                onChange={(e) => setTestSign(e.target.value)}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                {Object.keys(signsData).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '6px' }}>Target Language:</span>
              <select
                value={targetLang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="en">English (English)</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isQuestionMode}
                onChange={(e) => setIsQuestionMode(e.target.checked)}
              />
              NMM Face: Eyebrows Raised (Question Mode)
            </label>

            <button
              className="btn btn-primary"
              onClick={handleTestTranslation}
              style={{ fontSize: '0.85rem', padding: '6px 14px' }}
            >
              Translate Multilingual
            </button>
          </div>

          {/* Translation Output Card */}
          {translationResult && (
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Synthesized Regional Output ({translationResult.target_language.toUpperCase()}):
                </div>
                <button
                  className="btn"
                  onClick={() =>
                    speakMultilingual(translationResult.translated_text, {
                      lang: translationResult.target_language as SupportedLanguage,
                    })
                  }
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    background: 'rgba(37, 99, 235, 0.8)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Volume2 size={13} /> Listen ({translationResult.target_language.toUpperCase()})
                </button>
              </div>
              <div style={{ fontSize: '1.4rem', color: '#60a5fa', fontWeight: 800, margin: '6px 0' }}>
                {translationResult.translated_text}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Grammar: {translationResult.sign_metadata.grammar} | Handshape: {translationResult.sign_metadata.handshape} |{' '}
                {translationResult.nmm_interrogative ? 'Interrogative Question Clause (?)' : 'Declarative Statement'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 4: ISL AI LINGUISTICS EXPERT QA                          */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'expert' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
            Ask the built-in ISL Linguistics &amp; AI Research Expert assistant anything about ISL grammar, computer vision,
            facial Non-Manual Markers (NMM), or final-year project extensions.
          </p>

          {/* Quick preset questions */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center' }}>Samples:</span>
            {[
              'Explain the role of facial non-manual markers (NMM) in Indian Sign Language grammar.',
              'How is DOCTOR signed in ISL compared to ASL?',
              'How does the two-handed fingerspelling alphabet work in ISL?',
              'How can we extend this project from isolated signs to continuous sentences?',
            ].map((q, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setExpertQuestion(q);
                  handleAskExpert(q);
                }}
                style={{
                  backgroundColor: 'rgba(51, 65, 85, 0.4)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {q.slice(0, 40)}...
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="input"
              value={expertQuestion}
              onChange={(e) => setExpertQuestion(e.target.value)}
              placeholder="Ask the ISL AI Expert a question..."
              style={{ flex: 1, fontSize: '0.85rem' }}
              onKeyDown={(e) => e.key === 'Enter' && handleAskExpert()}
            />
            <button
              className="btn btn-primary"
              onClick={() => handleAskExpert()}
              disabled={isAsking}
              style={{ padding: '0 16px' }}
            >
              {isAsking ? 'Thinking...' : <Send size={16} />}
            </button>
          </div>

          {expertAnswer && (
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Bot size={18} color="#c084fc" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                  {expertAnswer.topic}
                </span>
              </div>
              <div style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                {expertAnswer.answer}
              </div>
              {expertAnswer.linguistic_rule && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#93c5fd' }}>
                  <strong>Linguistic Rule: </strong>
                  {expertAnswer.linguistic_rule}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
