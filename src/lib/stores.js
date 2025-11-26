import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const defaultBoxes = [
    { id: '1', label: 'Hello (Spanish)', text: 'Hello', targetLang: 'es' },
    { id: '2', label: 'Good Morning (French)', text: 'Good Morning', targetLang: 'fr' }
];

function getInitialBoxes() {
    if (!browser) return defaultBoxes;

    // 1. Try URL params first
    const params = new URLSearchParams(window.location.search);
    const config = params.get('config');
    if (config) {
        try {
            // Handle unicode by decoding percent-encoding before/after base64
            return JSON.parse(decodeURIComponent(escape(atob(config))));
        } catch (e) {
            console.error('Failed to parse config from URL', e);
        }
    }

    // 2. Fallback to localStorage
    const stored = localStorage.getItem('boxes');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse config from localStorage', e);
        }
    }

    // 3. Default
    return defaultBoxes;
}

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
