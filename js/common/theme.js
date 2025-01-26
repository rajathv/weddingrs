import { storage } from './storage.js';

export const theme = (() => {

    const themeColors = {
        '#000000': '#ffffff',
        '#ffffff': '#000000',
        '#212529': '#f8f9fa',
        '#f8f9fa': '#212529'
    };
    const themeLight = ['#ffffff', '#f8f9fa'];
    const themeDark = ['#000000', '#212529'];

    let isAuto = false;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let theme = null;

    /**
     * @type {HTMLElement|null}
     */
    let metaTheme = null;

    /**
     * @returns {void}
     */
    const setLight = () => theme.set('active', 'light');

    /**
     * @returns {void}
     */
    const setDark = () => theme.set('active', 'dark');

    /**
     * @returns {void}
     */
    const onLight = () => {
        setLight();
        document.documentElement.setAttribute('data-bs-theme', 'light');

        const now = metaTheme.getAttribute('content');
        metaTheme.setAttribute('content', themeDark.some((i) => i === now) ? themeColors[now] : now);
    };

    /**
     * @returns {void}
     */
    const onDark = () => {
        setDark();
        document.documentElement.setAttribute('data-bs-theme', 'dark');

        const now = metaTheme.getAttribute('content');
        metaTheme.setAttribute('content', themeLight.some((i) => i === now) ? themeColors[now] : now);
    };

    /**
     * @param {string|null} [onDark=null] 
     * @param {string|null} [onLight=null] 
     * @returns {boolean|string}
     */
    const isDarkMode = (onDark = null, onLight = null) => {
        const status = theme.get('active') === 'dark';

        if (onDark && onLight) {
            return status ? onDark : onLight;
        }

        return status;
    };

    /**
     * @returns {void}
     */
    const change = () => isDarkMode() ? onLight() : onDark();

    /**
     * @returns {boolean}
     */
    const isAutoMode = () => isAuto;

    /**
     * @returns {void}
     */
    const spyTop = () => {
        const callback = (es) => {
            es.filter((e) => e.isIntersecting).forEach((e) => {
                const themeColor = e.target.classList.contains('bg-white-black')
                    ? isDarkMode(themeDark[0], themeLight[0])
                    : isDarkMode(themeDark[1], themeLight[1]);

                metaTheme.setAttribute('content', themeColor);
            });
        };

        const observerTop = new IntersectionObserver(callback, { rootMargin: '0% 0% -95% 0%' });
        document.querySelectorAll('section').forEach((e) => observerTop.observe(e));
    };

    /**
     * @returns {void}
     */
    const init = () => {
        theme = storage('theme');
        metaTheme = document.querySelector('meta[name="theme-color"]');

        if (!theme.has('active')) {
            window.matchMedia('(prefers-color-scheme: dark)').matches ? setDark() : setLight();
        }

        switch (document.documentElement.getAttribute('data-bs-theme')) {
            case 'dark':
                setDark();
                break;
            case 'light':
                setLight();
                break;
            default:
                isAuto = true;
        }

        if (isDarkMode()) {
            onDark();
        } else {
            onLight();
        }
    };

    return {
        init,
        spyTop,
        change,
        isDarkMode,
        isAutoMode,
    };
})();