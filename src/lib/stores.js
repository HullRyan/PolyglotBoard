import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const defaultRows = [
    {
        id: 'row-1',
        items: [
            { id: '1', label: 'Hello (Spanish)', text: 'Hello', targetLang: 'es' },
            { id: '2', label: 'Good Morning (French)', text: 'Good Morning', targetLang: 'fr' }
        ]
    }
];

function getInitialBoxes() {
    if (!browser) return defaultRows;

    let data = null;

    // 1. Try URL params first
    const params = new URLSearchParams(window.location.search);
    const config = params.get('config');
    if (config) {
        try {
            // Handle unicode by decoding percent-encoding before/after base64
            data = JSON.parse(decodeURIComponent(escape(atob(config))));
        } catch (e) {
            console.error('Failed to parse config from URL', e);
        }
    }

    // 2. Fallback to localStorage
    if (!data) {
        const stored = localStorage.getItem('boxes');
        if (stored) {
            try {
                data = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse config from localStorage', e);
            }
        }
    }

    // 3. Default
    if (!data) return defaultRows;

    // MIGRATION: Check if data is flat array (old format)
    if (Array.isArray(data) && data.length > 0 && !data[0].items) {
        console.log('Migrating flat structure to rows...');
        return [{ id: 'row-default', items: data }];
    }

    // Check if it's already in row format (array of objects with items array)
    if (Array.isArray(data) && (data.length === 0 || data[0].items)) {
        return data;
    }

    return defaultRows;
}

/**
 * @typedef {Object} Box
 * @property {string} id
 * @property {string} label
 * @property {string} text
 * @property {string} targetLang
 * @property {string} [translatedText]
 */

/**
 * @typedef {Object} Row
 * @property {string} id
 * @property {Box[]} items
 */

/** @type {import('svelte/store').Writable<Row[]>} */
export const boxes = writable(getInitialBoxes());

if (browser) {
    boxes.subscribe((value) => {
        // Persist to localStorage
        localStorage.setItem('boxes', JSON.stringify(value));

        // Update URL
        const params = new URLSearchParams(window.location.search);
        // Handle unicode
        const config = btoa(unescape(encodeURIComponent(JSON.stringify(value))));
        params.set('config', config);

        // Update URL without reloading or creating history spam
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, '', newUrl);
    });
}

// Theme Store
const initialTheme = browser ? (localStorage.getItem('theme') || 'dark') : 'dark';
export const theme = writable(initialTheme);

if (browser) {
    theme.subscribe((value) => {
        localStorage.setItem('theme', value);
        document.documentElement.setAttribute('data-theme', value);
    });
}
