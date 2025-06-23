/**
 * @returns {Promise<void>}
 */
const loadCss = () => new Promise((res, rej) => {
    const link = document.createElement('link');
    link.onload = res;
    link.onerror = rej;

    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css';
    link.integrity = 'sha256-GqiEX9BuR1rv5zPU5Vs2qS/NSHl1BJyBcjQYJ6ycwD4=';
    link.crossOrigin = 'anonymous';

    document.head.appendChild(link);
});

/**
 * @returns {Promise<void>}
 */
const loadJs = () => new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.onload = res;
    sc.onerror = rej;

    sc.src = 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js';
    sc.integrity = 'sha256-pQBbLkFHcP1cy0C8IhoSdxlm0CtcH5yJ2ki9jjgR03c=';
    sc.crossOrigin = 'anonymous';

    document.head.appendChild(sc);
});

/**
 * @returns {Promise<void>}
 */
export const loadAOS = () => Promise.all([loadCss(), loadJs()]).then(() => {
    if (typeof window.AOS === 'undefined') {
        throw new Error('AOS library failed to load');
    }

    window.AOS.init();
});