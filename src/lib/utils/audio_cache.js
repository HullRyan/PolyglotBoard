import { openDB } from 'idb';

const DB_NAME = 'tts-audio-cache';
const STORE_NAME = 'audio';

/**
 * Opens the IndexedDB database.
 */
async function getDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

/**
 * Saves an audio buffer to IndexedDB.
 * @param {string} key - Unique key (e.g., "lang:text")
 * @param {{ audio: Float32Array, sampling_rate: number }} data 
 */
export async function saveAudioToDB(key, data) {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, data, key);
    } catch (e) {
        console.error('Failed to save audio to IndexedDB', e);
    }
}

/**
 * Retrieves an audio buffer from IndexedDB.
 * @param {string} key 
 * @returns {Promise<{ audio: Float32Array, sampling_rate: number } | undefined>}
 */
export async function getAudioFromDB(key) {
    try {
        const db = await getDB();
        return await db.get(STORE_NAME, key);
    } catch (e) {
        console.error('Failed to get audio from IndexedDB', e);
        return undefined;
    }
}
