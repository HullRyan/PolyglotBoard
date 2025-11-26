import { pipeline, env } from '@xenova/transformers';
import { getAudioFromDB, saveAudioToDB } from './audio_cache';

// Skip local model checks
env.allowLocalModels = false;
env.useBrowserCache = true;

/** @type {any} */
let synthesizer = null;
/** @type {any} */
let speakerEmbeddings = null;

// Helper to load the model lazily
/** @type {Object<string, any>} */
const synthesizers = {};

// Map common language codes to Xenova MMS models
/** @type {Object<string, string>} */
const LANG_MODEL_MAP = {
    'en': 'Xenova/mms-tts-eng',
    'es': 'Xenova/mms-tts-spa',
    'fr': 'Xenova/mms-tts-fra',
    'de': 'Xenova/mms-tts-deu', // Check if deu exists, otherwise fallback
    'it': 'Xenova/mms-tts-ita',
    'pt': 'Xenova/mms-tts-por',
    'nl': 'Xenova/mms-tts-nld',
    'ru': 'Xenova/mms-tts-rus',
    'zh': 'Xenova/mms-tts-cmn', // Mandarin
    'ja': 'Xenova/mms-tts-jpn',
    'ko': 'Xenova/mms-tts-kor',
    'hi': 'Xenova/mms-tts-hin',
    'ar': 'Xenova/mms-tts-ara'
};

// Cache for active loading promises to prevent duplicate loads
/** @type {Object<string, Promise<any>>} */
const loadingPromises = {};

/**
 * Helper to load the model lazily for a specific language
 * @param {string} lang
 */
export async function loadModel(lang) {
    // Normalize lang code (e.g. 'en-US' -> 'en')
    const shortLang = lang.split('-')[0];
    const modelName = LANG_MODEL_MAP[shortLang];

    if (!modelName) {
        console.warn(`No specific MMS model found for ${lang}, falling back to Web Speech API`);
        return null;
    }

    // Return existing synthesizer if available
    if (synthesizers[shortLang]) {
        return synthesizers[shortLang];
    }

    // Return existing loading promise if available
    if (loadingPromises[shortLang]) {
        return loadingPromises[shortLang];
    }

    // Create new loading promise
    console.log(`Loading TTS model for ${shortLang}: ${modelName}...`);
    loadingPromises[shortLang] = (async () => {
        try {
            const synth = await pipeline('text-to-speech', modelName, { quantized: false });
            synthesizers[shortLang] = synth;
            delete loadingPromises[shortLang]; // Cleanup promise
            return synth;
        } catch (e) {
            console.error(`Failed to load model for ${shortLang}`, e);
            delete loadingPromises[shortLang];
            return null;
        }
    })();

    return loadingPromises[shortLang];
}

/** @type {Map<string, { audio: Float32Array, sampling_rate: number }>} */
const audioCache = new Map();

/**
 * Generates audio for the text and language, using cache if available.
 * @param {string} text 
 * @param {string} lang 
 * @returns {Promise<{ audio: Float32Array, sampling_rate: number } | null>}
 */
async function generateAudio(text, lang) {
    const key = `${lang}:${text}`;

    // 1. Check Memory Cache
    if (audioCache.has(key)) {
        console.log(`Memory cache hit for [${lang}] "${text}"`);
        return audioCache.get(key) || null;
    }

    // 2. Check IndexedDB Cache
    const dbCache = await getAudioFromDB(key);
    if (dbCache) {
        console.log(`IndexedDB cache hit for [${lang}] "${text}"`);
        audioCache.set(key, dbCache); // Populate memory cache
        return dbCache;
    }

    // 3. Generate Audio
    console.log(`Generating audio for [${lang}] "${text}"...`);
    const synth = await loadModel(lang);
    if (!synth) return null;

    const out = await synth(text);
    const result = { audio: out.audio, sampling_rate: out.sampling_rate };

    // 4. Save to Caches
    audioCache.set(key, result);
    saveAudioToDB(key, result); // Async save

    return result;
}

/**
 * Preloads audio into the cache.
 * @param {string} text 
 * @param {string} lang 
 */
export async function preloadAudio(text, lang) {
    if (!text) return;
    try {
        await generateAudio(text, lang);
    } catch (e) {
        console.error(`Failed to preload audio for ${lang}`, e);
    }
}

/**
 * Speaks the text using Transformers.js (MMS) or falls back to Web Speech API.
 * @param {string} text 
 * @param {string} lang 
 * @param {function} [onStart] - Callback when generation starts
 * @param {function} [onEnd] - Callback when playback ends
 */
export async function speakText(text, lang, onStart, onEnd) {
    if (!text) return;

    try {
        if (onStart) onStart();

        const result = await generateAudio(text, lang);

        if (!result) {
            throw new Error(`Failed to generate audio for ${lang}`);
        }

        // @ts-ignore
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        const buffer = audioContext.createBuffer(1, result.audio.length, result.sampling_rate);
        buffer.copyToChannel(result.audio, 0);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = () => {
            if (onEnd) onEnd();
        };
        source.start();

    } catch (e) {
        console.warn(`Transformers.js TTS failed for ${lang}, falling back to Web Speech API`, e);
        fallbackSpeak(text, lang);
        if (onEnd) onEnd();
    }
}

/**
 * Fallback to Web Speech API.
 * @param {string} text 
 * @param {string} lang 
 */
function fallbackSpeak(text, lang) {
    if (!window.speechSynthesis) {
        console.error('Web Speech API not supported');
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(lang));
    if (voice) {
        utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
}
