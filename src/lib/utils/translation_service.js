/**
 * Translates text using a free/unofficial endpoint.
 * @param {string} text 
 * @param {string} targetLang 
 * @param {string} sourceLang 
 * @returns {Promise<string>}
 */
export async function translateText(text, targetLang, sourceLang = 'auto') {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        // data[0] contains an array of translated segments (sentences)
        // We need to join them all together
        return data[0].map((/** @type {any} */ item) => item[0]).join('');
    } catch (e) {
        console.error('Translation failed', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        return `[Error: ${errorMessage}]`;
    }
}
