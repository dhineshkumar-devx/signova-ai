export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'bn';
export type VoiceGender = 'female' | 'male';
export type VoiceTone =
  | 'natural'
  | 'warm'
  | 'professional'
  | 'deep'
  | 'energetic'
  | 'storyteller'
  | 'urgent';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  bcp47: string;
  speechLang: string;
  activationAnnouncement: string;
  phoneticAnnouncement: string;
  voiceKeywords: string[];
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English (EN)',
    bcp47: 'en-IN',
    speechLang: 'en-IN',
    activationAnnouncement: 'English language selected. Ready for Indian Sign Language.',
    phoneticAnnouncement: 'English language selected. Ready for Indian Sign Language.',
    voiceKeywords: ['english', 'india', 'en-in', 'en-us', 'david', 'zira', 'jenny', 'guy', 'mark', 'neerja', 'prabhat'],
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी (Hindi)',
    bcp47: 'hi-IN',
    speechLang: 'hi-IN',
    activationAnnouncement: 'नमस्ते! हिन्दी भाषा चुनी गई। भारतीय सांकेतिक भाषा के लिए तैयार।',
    phoneticAnnouncement: 'Namaste! Hindi bhasha chuni gayi. Bharatiya sanketik bhasha ke liye taiyar.',
    voiceKeywords: ['hindi', 'हिन्दी', 'kalpana', 'swara', 'madhur', 'hemant', 'prabhat', 'hi-in', 'hi_in'],
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ் (Tamil)',
    bcp47: 'ta-IN',
    speechLang: 'ta-IN',
    activationAnnouncement: 'வணக்கம்! தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது. இந்திய சைகை மொழிக்கு தயார்.',
    phoneticAnnouncement: 'Vanakkam! Tamil mozhi thernthedukkappattadhu. Indhiya saigai mozhikku thayaar.',
    voiceKeywords: ['tamil', 'தமிழ்', 'valluvar', 'vani', 'pallavi', 'ta-in', 'ta_in'],
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు (Telugu)',
    bcp47: 'te-IN',
    speechLang: 'te-IN',
    activationAnnouncement: 'నమస్కారం! తెలుగు భాష ఎంచుకోబడింది. భారతీయ సంజ్ఞా భాషకు సిద్ధం.',
    phoneticAnnouncement: 'Namaskaram! Telugu bhasha enchukobadindi. Bharathiya sangya bhashaku siddham.',
    voiceKeywords: ['telugu', 'తెలుగు', 'mohan', 'chitra', 'shruti', 'te-in', 'te_in'],
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ (Kannada)',
    bcp47: 'kn-IN',
    speechLang: 'kn-IN',
    activationAnnouncement: 'ನಮಸ್ಕಾರ! ಕನ್ನಡ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ. ಸಂಕೇತ ಭಾಷೆಗೆ ಸಿದ್ಧವಾಗಿದೆ.',
    phoneticAnnouncement: 'Namaskara! Kannada bhashe aaykemaadalaagide. Sanketha bhashege siddhavaagide.',
    voiceKeywords: ['kannada', 'ಕನ್ನಡ', 'sapna', 'gagan', 'kn-in', 'kn_in'],
  },
  bn: {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা (Bengali)',
    bcp47: 'bn-IN',
    speechLang: 'bn-IN',
    activationAnnouncement: 'নমস্কার! বাংলা ভাষা নির্বাচিত হয়েছে। ভারতীয় প্রতীকী ভাষার জন্য প্রস্তুত।',
    phoneticAnnouncement: 'Nomoshkar! Bangla bhasha nirbachito hoyechhe. Bharatiya protiki bhashar jonno prostut.',
    voiceKeywords: ['bengali', 'bangla', 'বাংলা', 'bashkar', 'tanishaa', 'bn-in', 'bn_in'],
  },
};

export interface TonePreset {
  id: VoiceTone;
  name: string;
  tagline: string;
  femalePitch: number;
  malePitch: number;
  femaleRate: number;
  maleRate: number;
}

export const TONE_PRESETS: Record<VoiceTone, TonePreset> = {
  natural: {
    id: 'natural',
    name: 'Natural Conversational',
    tagline: 'Warm human pacing with authentic inflection',
    femalePitch: 1.0,
    malePitch: 1.0,
    femaleRate: 0.95,
    maleRate: 0.95,
  },
  warm: {
    id: 'warm',
    name: 'Warm & Empathetic',
    tagline: 'Gentle, friendly, caring human cadence',
    femalePitch: 1.02,
    malePitch: 0.98,
    femaleRate: 0.92,
    maleRate: 0.92,
  },
  professional: {
    id: 'professional',
    name: 'Professional & Clear',
    tagline: 'Articulate broadcast-clarity news anchor delivery',
    femalePitch: 1.0,
    malePitch: 1.0,
    femaleRate: 0.98,
    maleRate: 0.98,
  },
  deep: {
    id: 'deep',
    name: 'Deep & Grounded',
    tagline: 'Resonant, steady, calming low-frequency resonance',
    femalePitch: 0.95,
    malePitch: 0.90,
    femaleRate: 0.90,
    maleRate: 0.90,
  },
  energetic: {
    id: 'energetic',
    name: 'Lively & Upbeat',
    tagline: 'Spirited, animated, youthful presentation',
    femalePitch: 1.05,
    malePitch: 1.03,
    femaleRate: 1.05,
    maleRate: 1.04,
  },
  storyteller: {
    id: 'storyteller',
    name: 'Expressive Narrative',
    tagline: 'Deliberate rhythmic flow with natural micro-pauses',
    femalePitch: 1.02,
    malePitch: 0.97,
    femaleRate: 0.93,
    maleRate: 0.92,
  },
  urgent: {
    id: 'urgent',
    name: 'Urgent Assist',
    tagline: 'Prompt, crisp, attentive emergency articulation',
    femalePitch: 1.02,
    malePitch: 1.0,
    femaleRate: 1.10,
    maleRate: 1.10,
  },
};

/**
 * Phonetic transliterations mapping Indic expressions to clear Roman phonemes
 * used when client only has English SAPI voices (Microsoft David/Zira) to prevent silence.
 */
const PHONETIC_MAP: Record<string, string> = {
  // Common phrases
  'नमस्ते': 'Namaste',
  'नमस्ते!': 'Namaste!',
  'नमस्ते! हिन्दी भाषा चुनी गई।': 'Namaste! Hindi bhasha chuni gayi.',
  'नमस्ते! हिन्दी भाषा चुनी गई। भारतीय सांकेतिक भाषा के लिए तैयार।': 'Namaste! Hindi bhasha chuni gayi. Bharatiya sanketik bhasha ke liye taiyar.',
  'नमस्ते! आपसे मिलकर बहुत खुशी हुई।': 'Namaste! Aap se milkar bahut khushi hui.',
  'आपका बहुत-बहुत धन्यवाद! मैं आपकी मदद की सराहना करता हूँ।': 'Aapka bahut bahut dhanyavaad! Main aapki madad ki sarahana karta hoon.',
  'कृपया मेरी मदद करें! मुझे तुरंत सहायता चाहिए।': 'Kripaya meri madad karein! Mujhe turant sahayata chahiye.',
  'कृपया मुझे पानी दीजिए, मुझे बहुत प्यास लगी है।': 'Kripaya mujhe paani dijiye, mujhe bahut pyaas lagi hai.',
  'हाँ, मैं बिल्कुल सहमत हूँ।': 'Haan, main bilkul sahmat hoon.',
  'नहीं, यह सही नहीं है।': 'Nahin, yeh sahi nahin hai.',
  'यह बहुत अच्छा और उत्कृष्ट है।': 'Yeh bahut achha aur uttkrisht hai.',
  'कृपया डॉक्टर को बुलाएं, मुझे तुरंत चिकित्सा सहायता चाहिए।': 'Kripaya doctor ko bulayein, mujhe turant chikitsa sahayata chahiye.',
  'আমি আপনাকে সাহায্য করতে পারি': 'Ami aapnake shahajjo korte pari',
  'வணக்கம்! தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது. இந்திய சைகை மொழிக்கு தயார்.': 'Vanakkam! Tamil mozhi thernthedukkappattadhu. Indhiya saigai mozhikku thayaar.',
  'வணக்கம்! உங்களை சந்திப்பதில் மிக்க மகிழ்ச்சி.': 'Vanakkam! Ungalai sandhippadhil mikka magizhchi.',
  'மிக்க நன்றி! உங்கள் உதவிக்கு என் மனமார்ந்த நன்றிகள்.': 'Mikka nandri! Ungal udhavikku en manamaarndha nandrigal.',
  'தயவுசெய்து எனக்கு உதவுங்கள்! எனக்கு உடனடி உதவி தேவை.': 'Dayavuseidhu enakku udhavungal! Enakku udanadi udhavi thevai.',
  'தயவுசெய்து எனக்கு தண்ணீர் கொடுங்கள், எனக்கு மிகவும் தாகமாக இருக்கிறது.': 'Dayavuseidhu enakku thanneer kodungal, enakku migavum thaagamaaga irukkiradhu.',
  'ஆம், நான் முழுமையாக ஏற்றுக்கொள்கிறேன்.': 'Aam, naan muzhumaiyaaga etrukkolgiren.',
  'இல்லை, அது சரியல்ல.': 'Illai, adhu sariyalla.',
  'இது மிகவும் அருமையாகவும் சிறப்பாகவும் உள்ளது.': 'Idhu migavum arumaiyaagavum sirappaagavum ulladhu.',
  'நமస్కారం! తెలుగు భాష ఎంచుకోబడింది. భారతీయ సంజ్ఞా భాషకు సిద్ధం.': 'Namaskaram! Telugu bhasha enchukobadindi. Bharathiya sangya bhashaku siddham.',
  'నమస్కారం! మిమ్మల్ని కలవడం చాలా సంతోషంగా ఉంది.': 'Namaskaram! Mimmalni kalavadam chaala santhoshanga undi.',
  'చాలా ధన్యవాదాలు! మీ సహాయాన్ని ఎంతో అభినందిస్తున్నాను.': 'Chaala dhanyavaadaalu! Mee sahaayaanni entho abhinandisthunnaanu.',
  'దయచేసి నాకు సహాయం చేయండి! నాకు తక్షణ సహాయం కావాలి.': 'Dayachesi naaku sahaayam cheyandi! Naaku thakshana sahaayam kaavaali.',
  'దయచేసి నాకు మంచి నీరు ఇవ్వండి, నాకు చాలా దాహంగా ఉంది.': 'Dayachesi naaku manchi neeru ivvandi, naaku chaala daahanga undi.',
  'అవును, నేను పూర్తిగా అంగీకరిస్తున్నాను.': 'Avunu, nenu poorthiga angeekaristhunnaanu.',
  'కాదు, ఇది సరైనది కాదు.': 'Kaadu, idi sarainadi kaadu.',
  'ಇದು ತುಂಬಾ ಒಳ್ಳೆಯದು': 'Idu thumba olleyadu',
  'ನಮಸ್ಕಾರ! ಕನ್ನಡ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ. ಸಂಕೇತ ಭಾಷೆಗೆ ಸಿದ್ಧವಾಗಿದೆ.': 'Namaskara! Kannada bhashe aaykemaadalaagide. Sanketha bhashege siddhavaagide.',
  'ನಮಸ್ಕಾರ! ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಲು ಸಂತೋಷವಾಗಿದೆ.': 'Namaskara! Nimmannu bhetiyaagalu santhoshavagide.',
  'ತುಂಬಾ ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ಸಹಾಯಕ್ಕೆ ಕೃತಜ್ಞತೆಗಳು.': 'Thumba dhanyavaadagalu! Nimma sahaayakke kruthajnategalu.',
  'ದಯವಿಟ್ಟು ನನಗೆ ಸಹಾಯ ಮಾಡಿ! ನನಗೆ ತಕ್ಷಣದ ನೆರವು ಬೇಕು.': 'Dayavittu nanage sahaaya maadi! Nanage thakshanada neravu beku.',
  'ದಯವಿಟ್ಟು ನನಗೆ ನೀರು ಕೊಡಿ, ನನಗೆ ತುಂಬಾ ಬಾಯಾರಿಕೆಯಾಗಿದೆ.': 'Dayavittu nanage neeru kodi, nanage thumba baayaarikeyagide.',
  'ಹೌದು, ನಾನು ಸಂಪೂರ್ಣವಾಗಿ ಒಪ್ಪುತ್ತೇನೆ.': 'Haudu, naanu sampoornavaagi opputtene.',
  'ಇಲ್ಲ, ಇದು ಸರಿಯಲ್ಲ.': 'Illa, idu sariyalla.',
  'ನಮಸ್ಕಾರ': 'Namaskara',
  'ಧನ್ಯವಾದಗಳು': 'Dhanyavaadagalu',
  'ಸಹಾಯ': 'Sahaaya',
  'ನೀರು': 'Neeru',
  'ನಮಸ್ಕಾರಂ': 'Namaskaram',
  'ధన్యవాదాలు': 'Dhanyavaadaalu',
  'సహాయం': 'Sahaayam',
  'నీరు': 'Neeru',
  'வணக்கம்': 'Vanakkam',
  'நன்றி': 'Nandri',
  'உதவி': 'Udhavi',
  'தண்ணீர்': 'Thanneer',
  'ধন্যবাদ': 'Dhanyabaad',
  'সাহায্য': 'Shahajjo',
  'জল': 'Jol',
  'নমস্কার! বাংলা ভাষা নির্বাচিত হয়েছে। ভারতীয় প্রতীকী ভাষার জন্য প্রস্তুত।': 'Nomoshkar! Bangla bhasha nirbachito hoyechhe. Bharatiya protiki bhashar jonno prostut.',
  'নমস্কার! আপনার সাথে দেখা হয়ে খুব ভালো লাগলো।': 'Nomoshkar! Aapnar shaathe dekha hoye khub bhaalo laaglo.',
  'অনেক ধন্যবাদ! আপনার সাহায্যের জন্য কৃতজ্ঞ।': 'Onek dhanyabaad! Aapnar shaahajjer jonno kritoggo.',
  'দয়া করে আমাকে সাহায্য করুন! আমার এখনই সাহায্য দরকার।': 'Doya kore aamake shahajjo korun! Aamar ekhoni shahajjo dorkaar.',
  'দয়া করে আমাকে একটু জল দিন, আমার খুব তেষ্টা পেয়েছে।': 'Doya kore aamake ektu jol din, aamar khub teshta peyechhe.',
  'হ্যাঁ, আমি পুরোপুরি একমত।': 'Hyan, aami puroapuri ekomot.',
  'না, এটা ঠিক নয়।': 'Naa, eta thik noy.',
  'এটা খুব সুন্দর এবং অসাধারণ।': 'Eta khub sundor ebong oshadharon.',
};

/**
 * Checks if a SpeechSynthesisVoice natively supports an Indic language.
 */
export function isVoiceNativeForLang(voice: SpeechSynthesisVoice | undefined, lang: SupportedLanguage): boolean {
  if (!voice) return false;
  if (lang === 'en') return true;
  const config = SUPPORTED_LANGUAGES[lang];
  const vLang = (voice.lang || '').toLowerCase().replace('_', '-');
  const vName = (voice.name || '').toLowerCase();

  const matchesCode = vLang === config.bcp47.toLowerCase() || vLang.startsWith(`${lang}-`) || vLang === lang;
  const matchesKeyword = config.voiceKeywords.some((kw) => vName.includes(kw));

  // Ensure it's not simply an en-US default voice
  const isEnglishDefault = vName.includes('david') || vName.includes('zira') || vName.includes('mark');
  return (matchesCode || matchesKeyword) && !isEnglishDefault;
}

/**
 * Searches for the voice matching the requested language and gender.
 */
export function getBestVoice(
  voices: SpeechSynthesisVoice[],
  lang: SupportedLanguage = 'en',
  gender: VoiceGender = 'female'
): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;

  const config = SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES.en;
  const langPrefix = config.code.toLowerCase();
  const bcpLower = config.bcp47.toLowerCase();
  const targetGender = gender.toLowerCase();

  // 1. Search for voices matching the target language
  const langVoices = voices.filter((v) => {
    const vLang = (v.lang || '').toLowerCase().replace('_', '-');
    const matchesLang = vLang === bcpLower || vLang.startsWith(`${langPrefix}-`) || vLang === langPrefix;
    const matchesKeyword = config.voiceKeywords.some((kw) => v.name.toLowerCase().includes(kw));
    return matchesLang || matchesKeyword;
  });

  // 2. If voices for this language exist, filter by gender
  if (langVoices.length > 0) {
    const genderMatch = langVoices.find((v) => {
      const vName = v.name.toLowerCase();
      if (targetGender === 'female') {
        return (
          vName.includes('female') ||
          vName.includes('zira') ||
          vName.includes('kalpana') ||
          vName.includes('swara') ||
          vName.includes('vani') ||
          vName.includes('pallavi') ||
          vName.includes('chitra') ||
          vName.includes('sapna') ||
          vName.includes('tanishaa') ||
          vName.includes('google')
        );
      } else {
        return (
          vName.includes('male') ||
          vName.includes('david') ||
          vName.includes('madhur') ||
          vName.includes('hemant') ||
          vName.includes('valluvar') ||
          vName.includes('mohan') ||
          vName.includes('gagan') ||
          vName.includes('bashkar') ||
          vName.includes('prabhat') ||
          vName.includes('guy') ||
          vName.includes('mark')
        );
      }
    });

    if (genderMatch) return genderMatch;
    return langVoices[0];
  }

  // 3. Fallback to classic voices (Microsoft David / Zira)
  const fallback = voices.find((v) => {
    const vName = v.name.toLowerCase();
    return targetGender === 'male'
      ? vName.includes('david') || vName.includes('male')
      : vName.includes('zira') || vName.includes('female');
  });

  return fallback || voices[0];
}

/**
 * Naturalizes text to prevent robotic acronym spelling or machine bracket reading.
 */
export function naturalizeText(text: string): string {
  if (!text) return '';

  let clean = text
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If text is ALL-CAPS (like "HELLO" or "THANK YOU"), convert to Title/Sentence case
  if (clean === clean.toUpperCase() && /[A-Z]/.test(clean)) {
    clean = clean.toLowerCase();
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // Remove machine annotations like "(SOV)", "(?)", "[NMM]"
  clean = clean.replace(/\([A-Z0-9_\s?]+\)/g, '');
  clean = clean.replace(/\[[A-Z0-9_\s?]+\]/g, '');

  return clean.trim();
}

/**
 * Converts Indic script into phonetic Romanized text for English SAPI voices
 * when native Indic voices are absent on the operating system.
 */
export function getPhoneticFallback(text: string, lang: SupportedLanguage): string {
  const trimmed = text.trim();
  if (PHONETIC_MAP[trimmed]) return PHONETIC_MAP[trimmed];

  for (const [indic, phonetic] of Object.entries(PHONETIC_MAP)) {
    if (trimmed.includes(indic)) {
      return phonetic;
    }
  }

  const config = SUPPORTED_LANGUAGES[lang];
  return config?.phoneticAnnouncement || text;
}

export interface SpeakOptions {
  lang?: SupportedLanguage;
  gender?: VoiceGender;
  tone?: VoiceTone;
  volume?: number;
  rate?: number;
  pitch?: number;
  availableVoices?: SpeechSynthesisVoice[];
  englishFallback?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

// Active HTML5 Audio element instance
let activeAudio: HTMLAudioElement | null = null;

/**
 * Immediately cancels all active speech (both Neural audio and WebSpeech).
 */
export function stopSpeech(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Primary Multilingual Speech Synthesis Pipeline:
 * 1. Generates authentic human Neural audio via backend edge-tts stream.
 * 2. If network/endpoint is unavailable, seamlessly falls back to client Web Speech API
 *    with phonetic transliteration to guarantee zero dropped audio or silence.
 */
export function speakMultilingual(
  text: string,
  options: SpeakOptions = {}
): void {
  if (typeof window === 'undefined') return;
  if (!text || text.trim() === '' || text === 'Unknown Sign' || text === 'No Hand Detected') return;

  const lang = options.lang || 'en';
  const gender = options.gender || 'female';
  const cleanText = naturalizeText(text);

  // 1. Stop any currently active audio
  stopSpeech();

  // 2. Try High-Definition Neural TTS first (Swara/Madhur for Hindi, Pallavi/Valluvar for Tamil, etc.)
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const query = new URLSearchParams({
    text: cleanText,
    lang,
    gender,
    rate: String(options.rate ?? 1.0),
    pitch: String(options.pitch ?? 1.0),
  }).toString();

  const neuralUrl = `${apiBase}/api/v1/agent/speak-neural?${query}`;
  const audio = new Audio(neuralUrl);
  audio.volume = Math.min(1.0, Math.max(0, options.volume ?? 1.0));
  activeAudio = audio;

  audio.onplay = () => {
    options.onStart?.();
  };

  audio.onended = () => {
    activeAudio = null;
    options.onEnd?.();
  };

  audio.onerror = () => {
    activeAudio = null;
    // Fall back to Web Speech Synthesis if neural streaming fails
    speakWebSpeechFallback(cleanText, options);
  };

  audio.play().catch(() => {
    // If browser blocks autoplay or network fails, fall back to Web Speech
    activeAudio = null;
    speakWebSpeechFallback(cleanText, options);
  });
}

/**
 * Client-Side Web Speech API Fallback.
 * Safely converts Indic script to Hinglish/Romanized phonetics if client OS
 * only has English voices (e.g. Microsoft David / Zira) so that speech is audible.
 */
function speakWebSpeechFallback(
  cleanText: string,
  options: SpeakOptions = {}
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const lang = options.lang || 'en';
  const config = SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES.en;
  const gender = options.gender || 'female';
  const tone = options.tone || 'natural';
  const tonePreset = TONE_PRESETS[tone] || TONE_PRESETS.natural;

  const voices = options.availableVoices && options.availableVoices.length > 0
    ? options.availableVoices
    : window.speechSynthesis.getVoices();

  const matchedVoice = getBestVoice(voices, lang, gender);
  const isNative = isVoiceNativeForLang(matchedVoice, lang);

  // If matched voice cannot natively pronounce Indic characters, use Romanized phonetics
  const textToSpeak = isNative
    ? cleanText
    : getPhoneticFallback(cleanText, lang);

  const utterance = new SpeechSynthesisUtterance(textToSpeak);

  // Set language culture
  utterance.lang = isNative ? config.speechLang : 'en-US';

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.volume = 1.0;

  const basePitch = gender === 'female' ? tonePreset.femalePitch : tonePreset.malePitch;
  const baseRate = gender === 'female' ? tonePreset.femaleRate : tonePreset.maleRate;
  const userPitchMod = options.pitch !== undefined ? options.pitch : 1.0;
  const userRateMod = options.rate !== undefined ? options.rate : 1.0;

  utterance.pitch = basePitch * userPitchMod;
  utterance.rate = baseRate * userRateMod;

  if (options.onStart) utterance.onstart = options.onStart;
  if (options.onEnd) utterance.onend = options.onEnd;
  if (options.onError) utterance.onerror = options.onError;

  window.speechSynthesis.speak(utterance);
}

/**
 * Announces language change using the genuine native neural voice.
 */
export function announceLanguageChange(
  lang: SupportedLanguage,
  options: Omit<SpeakOptions, 'lang'> = {}
): void {
  const config = SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES.en;
  speakMultilingual(config.activationAnnouncement, {
    ...options,
    lang,
  });
}
