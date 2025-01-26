import { progress } from './progress.js';

export const image = (() => {

    /**
     * @type {Map<string, string>}
     */
    let uniqUrl = null;

    /**
     * @type {NodeListOf<HTMLImageElement>}
     */
    let images = null;

    let hasSrc = true;

    // default 6 hour TTL
    let ttl = 1000 * 60 * 60 * 6;

    const cacheName = 'images';

    /**
 * @param {HTMLImageElement} el 
 * @returns {Promise<void>}
 */
    const getByFetch = async (el) => {
        const url = el.getAttribute('data-src');
        const exp = 'x-expiration-time';

        if (uniqUrl.has(url)) {
            el.src = uniqUrl.get(url);
            progress.complete('image');
            return;
        }

        /**
         * @param {Cache} c 
         * @param {number} retries
         * @param {number} delay
         * @returns {Promise<Blob>}
         */
        const fetchPut = (c, retries = 3, delay = 1000) => {
            return fetch(url).then((res) => res.blob().then((b) => {
                const headers = new Headers(res.headers);
                headers.append(exp, String(Date.now() + ttl));

                return c.put(url, new Response(b, { headers })).then(() => b);
            })).catch((err) => {
                if (retries > 0) {
                    return new Promise((res) => setTimeout(() => res(fetchPut(c, retries - 1, delay)), delay));
                }

                throw err;
            });
        };

        await caches.open(cacheName).then((c) => {
            return c.match(url).then((res) => {
                if (!res) {
                    return fetchPut(c);
                }

                if (Date.now() <= parseInt(res.headers.get(exp))) {
                    return res.blob();
                }

                return c.delete(url).then((s) => s ? fetchPut(c) : res.blob());
            }).then((b) => {
                el.src = URL.createObjectURL(b);
                uniqUrl.set(url, el.src);
                progress.complete('image');
            })
        }).catch(() => progress.invalid('image'));
    };

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByDefault = (el) => {
        el.onerror = () => progress.invalid('image');
        el.onload = () => progress.complete('image');

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
     * @param {number} v
     * @returns {void} 
     */
    const setTtl = (v) => {
        ttl = Number(v)
    };

    /**
     * @returns {void}
     */
    const load = () => {
        (async () => {
            for (const el of images) {
                if (el.hasAttribute('data-src')) {
                    await getByFetch(el);
                } else {
                    getByDefault(el);
                }
            }
        })();
    };

    /**
     * @returns {object}
     */
    const init = () => {
        uniqUrl = new Map();
        images = document.querySelectorAll('img');

        images.forEach(progress.add);
        hasSrc = Array.from(images).some((i) => i.hasAttribute('data-src'));

        return {
            load,
            setTtl,
            hasDataSrc,
        };
    };

    return {
        init,
    };
})();