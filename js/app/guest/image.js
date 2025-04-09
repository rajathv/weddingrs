import { cache } from '../../common/cache.js';
import { progress } from './progress.js';

export const image = (() => {

    /**
     * @type {NodeListOf<HTMLImageElement>|null}
     */
    let images = null;

    let hasSrc = false;

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

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

        const onSuccess = (b) => {
            if (b.size > 0) {
                img.src = URL.createObjectURL(b);
            } else {
                onError();
            }
        };

        c.add(el.getAttribute('data-src'), onSuccess, onError);
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
            c.run();
        }
    };

    /**
     * @returns {object}
     */
    const init = () => {
        c = cache('images');
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