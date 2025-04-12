import { cache } from '../../common/cache.js';
import { progress } from './progress.js';

export const image = (() => {

    /**
     * @type {NodeListOf<HTMLImageElement>|null}
     */
    let images = null;

    let hasSrc = false;

    /**
     * @type {object[]}
     */
    const urlCache = [];

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByFetch = (el) => {
        const img = new Image();

        img.onload = () => {
            el.src = img.src;
            el.width = img.width;
            el.height = img.height;
            img.remove();
            progress.complete('image');
        };

        const onError = () => {
            progress.invalid('image');
        };

        const onSuccess = (url) => {
            img.src = url;
        };

        urlCache.push({
            url: el.getAttribute('data-src'),
            res: onSuccess,
            rej: onError,
        });
    };

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByDefault = (el) => {
        el.onerror = () => progress.invalid('image');
        el.onload = () => {
            el.width = el.naturalWidth;
            el.height = el.naturalHeight;
            progress.complete('image');
        };

        if (el.complete && el.naturalWidth !== 0 && el.naturalHeight !== 0) {
            progress.complete('image');
        } else if (el.complete) {
            progress.invalid('image');
        }
    };

    /**
     * @returns {boolean}
     */
    const hasDataSrc = () => hasSrc;

    /**
     * @returns {void}
     */
    const load = () => {
        for (const el of images) {
            el.hasAttribute('data-src') ? getByFetch(el) : getByDefault(el);
        }

        if (hasSrc) {
            cache('images').run(urlCache);
        }
    };

    /**
     * @returns {object}
     */
    const init = () => {
        images = document.querySelectorAll('img');

        images.forEach(progress.add);
        hasSrc = Array.from(images).some((i) => i.hasAttribute('data-src'));

        return {
            load,
            hasDataSrc,
        };
    };

    return {
        init,
    };
})();