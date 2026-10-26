export interface Keypoint3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface NonManualMarkers {
  eyebrow_raised?: boolean;
  mouth_open?: boolean;
  emotion?: 'neutral' | 'happy' | 'sad' | 'urgent';
  urgency?: boolean;
}

export interface MediaPipeLandmarkFrame {
  timestamp: number;
  frame_index: number;
  pose: Keypoint3D[];
  left_hand: Keypoint3D[];
  right_hand: Keypoint3D[];
  face?: Keypoint3D[];
  nmm_markers?: NonManualMarkers;
}

export interface PredictionScore {
  label: string;
  score: number;
}

export interface JointAttentionData {
  joint_weights: number[]; // 21 weights summing to 1.0
  active_finger_importance: Record<string, number>;
  temporal_frame_weights?: number[];
}

export interface MasterAgentReasoning {
  perception_status: string;
  afme_state: 'STATIONARY' | 'TRANSITIONING' | 'ACTIVE_SIGNING';
  motion_summary: string;
  raw_candidates: PredictionScore[];
  verification_verdict: 'CONFIRMED' | 'HELD_FOR_EVIDENCE' | 'AMBIGUOUS' | 'RESOLVED_BY_CONTEXT';
  verification_note: string;
  context_history: string[];
  grammar_translation_mode: 'ISL_DIRECT' | 'SYNTHESIZED_SOV' | 'NATURAL_ENGLISH';
}

export interface PredictionResponse {
  prediction: string;
  confidence: number;
  top_k: PredictionScore[];
  latency_ms: number;
  timestamp: number;
  sentence?: string;
  agent_response?: string;
  nmm_markers?: NonManualMarkers;
  domain?: string;
  afme?: any;
  agent_reasoning?: MasterAgentReasoning;
  joint_attention?: JointAttentionData;
  inference_backend?: string;
}

export interface SignVocabularyItem {
  id: number;
  sign_label: string;
  category: string;
  description: string;
  sample_count: number;
}

export interface ModelMetric {
  model_name: string;
  architecture: 'ST-GCN' | 'Transformer' | 'Bi-LSTM';
  accuracy: number;
  top_5_accuracy: number;
  f1_score: number;
  latency_ms: number;
  checkpoint_file: string;
}

export interface EnglishToISLResult {
  original_text: string;
  isl_glosses: string[];
  timing_ms: number[];
  explanation: string;
}

export interface DomainProcessResult {
  domain: string;
  agent_name: string;
  urgency_level?: string;
  alert_status?: string;
  emergency_code?: string;
  simulated_location?: { lat: number; lng: number; city: string };
  message?: string;
  clinical_assessment?: string;
  ehr_entry_code?: string;
  follow_up_prompt?: string;
  response?: string;
  security_level?: string;
  next_step?: string;
  learning_module?: string;
  recommended_actions?: string[];
}

export interface SignerCalibrationProfile {
  calibrated: boolean;
  palmWidth: number;
  fingerSpan: number;
  wristToMiddleRatio: number;
  timestamp: number;
}
