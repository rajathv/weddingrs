import { request, HTTP_GET } from './request.js';

const objectPool = (() => {
    /**
     * @type {Map<string, Promise<Cache>>|null}
     */
    let cachePool = null;

    return {
        /**
         * @param {string} name
         * @returns {Promise<Cache>}
         */
        getInstance: (name) => {
            if (!cachePool) {
                cachePool = new Map();
            }

            if (!cachePool.has(name)) {
                cachePool.set(name, window.caches.open(name));
            }

            return cachePool.get(name);
        },
    };
})();

export const cache = (cacheName) => {

    /**
     * @type {Map<string, string>}
     */
    const objectUrls = new Map();

    /**
     * @type {Map<string, Promise<string>>}
     */
    const inFlightRequests = new Map();

    /**
     * @type {caches|null}
     */
    let cacheObject = null;

    let ttl = 1000 * 60 * 60 * 6;

    let forceCache = false;

    /**
     * @returns {Promise<void>}
     */
    const open = async () => {
        if (!cacheObject && window.isSecureContext) {
            cacheObject = await objectPool.getInstance(cacheName);
        }
    };

    /**
     * @param {string|URL} input 
     * @param {Response} res 
     * @returns {Response}
     */
    const set = (input, res) => open().then(() => res.clone().arrayBuffer().then((ab) => {
        if (!res.ok) {
            throw new Error(res.statusText);
        }

        if (!window.isSecureContext) {
            return res;
        }

        const now = new Date();
        const headers = new Headers(res.headers);

        if (!headers.has('Date')) {
            headers.set('Date', now.toUTCString());
        }

        if (forceCache || !headers.has('Cache-Control')) {
            if (!forceCache && headers.has('Expires')) {
                const expTime = new Date(headers.get('Expires'));
                ttl = Math.max(0, expTime.getTime() - now.getTime());
            }

            headers.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
        }

        if (!headers.has('Content-Length')) {
            headers.set('Content-Length', String(ab.byteLength));
        }

        return cacheObject.put(input, new Response(ab, { headers })).then(() => res);
    }));

    /**
     * @param {string|URL} input 
     * @returns {Promise<Response|null>}
     */
    const has = (input) => open().then(() => cacheObject.match(input).then((res) => {
        if (!res) {
            return null;
        }

        const maxAge = res.headers.get('Cache-Control').match(/max-age=(\d+)/)[1];
        const expTime = Date.parse(res.headers.get('Date')) + (parseInt(maxAge) * 1000);

        return Date.now() > expTime ? null : res;
    }));

    /**
     * @param {string|URL} input 
     * @returns {Promise<boolean>}
     */
    const del = (input) => open().then(() => cacheObject.delete(input));

    /**
     * @param {string} input
     * @param {Promise<void>|null} [cancel=null]
     * @returns {Promise<string>}
     */
    const get = (input, cancel = null) => {
        if (objectUrls.has(input)) {
            return Promise.resolve(objectUrls.get(input));
        }

        if (inFlightRequests.has(input)) {
            return inFlightRequests.get(input);
        }

        const inflightPromise = open().then(() => {

            /**
             * @returns {Promise<Blob>}
             */
            const fetchPut = () => request(HTTP_GET, input)
                .withCancel(cancel)
                .withRetry()
                .default()
                .then((res) => set(input, res))
                .then((res) => res.blob());

            /**
             * @param {Blob} b 
             * @returns {string}
             */
            const blobToUrl = (b) => {
                objectUrls.set(input, URL.createObjectURL(b));
                return objectUrls.get(input);
            };

            if (!window.isSecureContext) {
                return fetchPut().then((b) => blobToUrl(b));
            }

            return cacheObject.match(input).then((res) => {
                if (!res) {
                    return fetchPut();
                }

                const maxAge = parseInt(res.headers.get('Cache-Control').match(/max-age=(\d+)/)[1]);
                const expTime = Date.parse(res.headers.get('Date')) + (maxAge * 1000);

                if (Date.now() > expTime) {
                    return cacheObject.delete(input).then((s) => s ? fetchPut() : res.blob());
                }

                return res.blob();
            }).then((b) => blobToUrl(b));
        }).finally(() => {
            inFlightRequests.delete(input);
        });

        inFlightRequests.set(input, inflightPromise);
        return inflightPromise;
    };

    /**
     * @param {object[]} items
     * @param {Promise<void>|null} cancel
     * @returns {Promise<void>}
     */
    const run = async (items, cancel = null) => {
        await open();
        const uniq = new Map();

        if (!window.isSecureContext) {
            console.warn('Cache is not supported in insecure context');
        }

        items.filter((val) => val !== null).forEach((val) => {
            const exist = uniq.get(val.url) ?? [];
            uniq.set(val.url, [...exist, [val.res, val?.rej]]);
        });

        return Promise.allSettled(Array.from(uniq).map(([k, v]) => get(k, cancel)
            .then((s) => {
                v.forEach((cb) => cb[0]?.(s));
                return s;
            })
            .catch((r) => {
                v.forEach((cb) => cb[1]?.(r));
                return r;
            })
        ));
    };

    /**
     * @param {string} input
     * @param {string} name
     * @returns {Promise<Response>}
     */
    const download = async (input, name) => {
        const reverse = new Map(Array.from(objectUrls.entries()).map(([k, v]) => [v, k]));

        if (!reverse.has(input)) {
            try {
                const checkUrl = new URL(input);
                if (!checkUrl.protocol.includes('blob')) {
                    throw new Error('Is not blob');
                }
            } catch {
                input = await get(input);
            }
        }

        return request(HTTP_GET, input).withDownload(name).default();
    };

    return {
        run,
        del,
        has,
        set,
        get,
        open,
        download,
        /**
         * @param {number} v
         * @returns {this} 
         */
        setTtl(v) {
            ttl = Number(v);
            return this;
        },
        /**
         * @returns {this} 
         */
        withForceCache() {
            forceCache = true;
            return this;
        },
    };
};