import axios from 'axios';
import {
  SignVocabularyItem,
  ModelMetric,
  PredictionResponse,
  EnglishToISLResult,
  DomainProcessResult,
} from '../types/isl';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchVocabulary = async (): Promise<SignVocabularyItem[]> => {
  const response = await apiClient.get<SignVocabularyItem[]>('/dataset/signs');
  return response.data;
};

export const fetchModelMetrics = async (): Promise<ModelMetric[]> => {
  const response = await apiClient.get<ModelMetric[]>('/models');
  return response.data;
};

export const sendBatchPrediction = async (landmarks: any): Promise<PredictionResponse> => {
  const response = await apiClient.post<PredictionResponse>('/models/predict', { landmarks });
  return response.data;
};

export interface LLMCognitiveThoughtProcess {
  summary: string;
  stage_1_morphology: {
    tokens: string[];
    handshape: string;
    location: string;
    motion: string;
    two_handed: boolean;
    articulation: string;
  };
  stage_2_syntax: {
    source_syntax: string;
    target_syntax: string;
    grammatical_role: string;
    transformation: string;
  };
  stage_3_nmm_vision: {
    eyebrow_raised: boolean;
    detected_emotion: string;
    polarity: string;
    fusion_impact: string;
  };
  stage_4_lexical_selection: {
    context_domain: string;
    tone_register: string;
    rationale: string;
  };
  accurate_words: Record<string, string>;
  selected_sentence: string;
  confidence_score: number;
}

export interface AgentSynthesisResult {
  sentence: string;
  glosses: string[];
  tone: string;
  intent: string;
  nmm_question?: boolean;
  thought_process?: LLMCognitiveThoughtProcess;
  accurate_words?: Record<string, string>;
}

export interface AgentConverseResult {
  user_signed: string;
  agent_response: string;
  mode: string;
  status: string;
  thought_process?: LLMCognitiveThoughtProcess;
  accurate_words?: Record<string, string>;
}

export interface MultilingualTranslationResult {
  primary_sign: string;
  target_language: string;
  translated_text: string;
  nmm_interrogative: boolean;
  thought_process?: LLMCognitiveThoughtProcess;
  accurate_words?: Record<string, string>;
  sign_metadata: {
    handshape: string;
    location: string;
    grammar: string;
    two_handed: boolean;
  };
}

export interface ISLExpertQAResult {
  topic: string;
  answer: string;
  cultural_context?: string;
  linguistic_rule?: string;
  rule?: string;
  roadmap?: string;
}

export const synthesizeSentence = async (
  glosses: string[],
  tone: string = 'polite',
  context: string = 'general',
  nmmMarkers?: Record<string, any>
): Promise<AgentSynthesisResult> => {
  const response = await apiClient.post<AgentSynthesisResult>('/agent/synthesize', {
    glosses,
    tone,
    context,
    nmm_markers: nmmMarkers,
  });
  return response.data;
};

export const converseWithAgent = async (
  signedMessage: string,
  history: any[] = [],
  tone: string = 'polite'
): Promise<AgentConverseResult> => {
  const response = await apiClient.post<AgentConverseResult>('/agent/converse', {
    signed_message: signedMessage,
    history,
    tone,
  });
  return response.data;
};

export const convertEnglishToISL = async (englishText: string): Promise<EnglishToISLResult> => {
  const response = await apiClient.post<EnglishToISLResult>('/agent/english-to-isl', {
    english_text: englishText,
  });
  return response.data;
};

export const processDomainAgent = async (
  domain: string,
  signOrText: string,
  history: any[] = []
): Promise<DomainProcessResult> => {
  const response = await apiClient.post<DomainProcessResult>('/agent/domain-process', {
    domain,
    sign_or_text: signOrText,
    history,
  });
  return response.data;
};

export const translateMultilingual = async (
  glosses: string[],
  targetLang: string = 'en',
  nmmMarkers?: Record<string, any>
): Promise<MultilingualTranslationResult> => {
  const response = await apiClient.post<MultilingualTranslationResult>('/agent/multilingual-translate', {
    glosses,
    target_lang: targetLang,
    nmm_markers: nmmMarkers,
  });
  return response.data;
};

export const askISLExpert = async (question: string): Promise<ISLExpertQAResult> => {
  const response = await apiClient.post<ISLExpertQAResult>('/agent/ask-expert', {
    question,
  });
  return response.data;
};

export const fetchSignKnowledgeBase = async (): Promise<{ signs: Record<string, any> }> => {
  const response = await apiClient.get<{ signs: Record<string, any> }>('/agent/knowledge/signs');
  return response.data;
};

export const fetchAlphabetKnowledge = async (): Promise<{ alphabet: Record<string, any> }> => {
  const response = await apiClient.get<{ alphabet: Record<string, any> }>('/agent/knowledge/alphabet');
  return response.data;
};

export const fetchAgentDomains = async (): Promise<{ domains: any[] }> => {
  const response = await apiClient.get('/agent/domains');
  return response.data;
};

export const fetchAgentStatus = async () => {
  const response = await apiClient.get('/agent/status');
  return response.data;
};

export interface AvatarSignKeyframe {
  sign_name: string;
  type: string;
  version: string;
  category: string;
  hand_type: string;
  description: string;
  sample_count: number;
  normalized_landmarks: Array<{
    index: number;
    name: string;
    x: number;
    y: number;
    z: number;
    std: number;
  }>;
  finger_extensions?: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
}

export interface AvatarSignsCatalog {
  total_signs: number;
  format: string;
  normalization: string;
  signs: Record<string, {
    category: string;
    description: string;
    hand_type: string;
    sample_count: number;
    file: string;
    finger_extensions: {
      thumb: boolean;
      index: boolean;
      middle: boolean;
      ring: boolean;
      pinky: boolean;
    };
  }>;
}

export const fetchAvatarSignsCatalog = async (): Promise<AvatarSignsCatalog> => {
  const response = await apiClient.get<AvatarSignsCatalog>('/avatar/signs');
  return response.data;
};

export const fetchAvatarSignKeyframe = async (signName: string): Promise<AvatarSignKeyframe> => {
  const response = await apiClient.get<AvatarSignKeyframe>(`/avatar/sign/${signName}`);
  return response.data;
};

export interface GlossTokenItem {
  token: string;
  type: 'library_sign' | 'fingerspelling';
  source_word: string;
  char?: string;
  duration_ms: number;
  keyframe_file?: string | null;
}

export interface GlossTranslationResponse {
  input_text: string;
  detected_language: string;
  isl_glosses: string[];
  tokens: GlossTokenItem[];
  explanation: string;
  engine_used: string;
}

export interface SpeechTranscribeResponse {
  transcript: string;
  is_speech: boolean;
  language: string;
  latency_ms: number;
  privacy: string;
  engine: string;
}

export interface SignSequenceResponse {
  input_text: string;
  total_signs: number;
  total_duration_ms: number;
  sequence: Array<{
    token: string;
    type: 'library_sign' | 'fingerspelling';
    source_word: string;
    start_time_ms: number;
    duration_ms: number;
    end_time_ms: number;
    keyframe: any;
  }>;
}

export const translateTextToISLGloss = async (
  text: string,
  preferLLM: boolean = true
): Promise<GlossTranslationResponse> => {
  const response = await apiClient.post<GlossTranslationResponse>('/speech/translate-to-gloss', {
    text,
    prefer_llm: preferLLM,
  });
  return response.data;
};

export const transcribeSpeechText = async (
  text: string,
  language: string = 'en'
): Promise<SpeechTranscribeResponse> => {
  const response = await apiClient.post<SpeechTranscribeResponse>('/speech/transcribe', {
    text,
    language,
  });
  return response.data;
};

export const fetchSignSequence = async (
  payload: { text?: string; glosses?: string[] }
): Promise<SignSequenceResponse> => {
  const response = await apiClient.post<SignSequenceResponse>('/speech/get-sign-sequence', payload);
  return response.data;
};


