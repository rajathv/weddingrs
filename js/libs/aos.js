import { cache } from '../connection/cache.js';

const urlCss = 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css';
const urlJs = 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js';

/**
 * @returns {Promise<void>}
 */
const loadCss = () => cache('libs').get(urlCss).then((uri) => new Promise((res, rej) => {
    const link = document.createElement('link');
    link.onload = res;
    link.onerror = rej;

    link.rel = 'stylesheet';
    link.href = uri;
    link.crossOrigin = 'anonymous';

    document.head.appendChild(link);
}));

/**
 * @returns {Promise<void>}
 */
const loadJs = () => cache('libs').get(urlJs).then((uri) => new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.onload = res;
    sc.onerror = rej;

    sc.src = uri;
    sc.crossOrigin = 'anonymous';

    document.head.appendChild(sc);
}));

/**
 * @returns {Promise<void>}
 */
export const loadAOS = () => Promise.all([loadCss(), loadJs()]).then(() => {
    if (typeof window.AOS === 'undefined') {
        throw new Error('AOS library failed to load');
    }

    window.AOS.init();
});