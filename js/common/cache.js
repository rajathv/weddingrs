import { request, HTTP_GET } from '../connection/request.js';

export const cache = (cacheName) => {

    /**
     * @type {Map<string, function[][]>|null}
     */
    const items = new Map();

    /**
     * @type {function[]}
     */
    const fnEachComplete = [];

    /**
     * @type {caches|null}
     */
    let cacheObject = null;

    let ttl = 1000 * 60 * 60 * 6;

    /**
     * @param {string} url 
     * @param {function} res
     * @param {function} [rej=null]
     * @returns {void}
     */
    const add = (url, res, rej = null) => {
        items.set(url, [...(items.get(url) ?? []), [res, rej]]);
    };

    /**
     * @returns {Promise<void>}
     */
    const open = async () => {
        if (!cacheObject && window.isSecureContext) {
            cacheObject = await window.caches.open(cacheName);
        }
    };

    /**
     * @param {string} url
     * @param {Promise<void>|null} [cancelReq=null]
     * @returns {Promise<Blob>}
     */
    const get = async (url, cancelReq = null) => {

        await open();

        /**
         * @returns {Promise<Blob>}
         */
        const fetchPut = () => request(HTTP_GET, url)
            .withCancel(cancelReq)
            .withTimeout()
            .default()
            .then((r) => r.blob().then((b) => {
                if (!window.isSecureContext) {
                    return b;
                }

                const headers = new Headers();
                const expiresDate = new Date(Date.now() + ttl);

                headers.set('Content-Length', String(b.size));
                headers.set('Expires', expiresDate.toUTCString());
                headers.set('Content-Type', r.headers.get('Content-Type'));

                return cacheObject.put(url, new Response(b, { headers })).then(() => b);
            }));

        if (!window.isSecureContext) {
            return fetchPut();
        }

        return cacheObject.match(url).then((res) => {
            if (!res) {
                return fetchPut();
            }

            const expiresHeader = res.headers.get('Expires');
            const expiresTime = expiresHeader ? (new Date(expiresHeader)).getTime() : 0;

            if (Date.now() > expiresTime) {
                return cacheObject.delete(url).then((s) => s ? fetchPut() : res.blob());
            }

            return res.blob();
        });
    };

    /**
     * @param {Promise<void>|null} cancelReq
     * @returns {Promise<void>}
     */
    const run = async (cancelReq = null) => {
        let count = items.size;

        await open();
        if (!window.isSecureContext) {
            console.warn('Cache is not supported in insecure context');
        }

        return new Promise((resolve) => {
            items.forEach(async (v, k) => {
                try {
                    const b = await get(k, cancelReq);
                    for (const cb of v) {
                        await cb[0](b);
                    }

                    fnEachComplete.forEach((fn) => fn(k));
                } catch (err) {
                    for (const cb of v) {
                        const f = cb[1];
                        if (f) {
                            await f(err);
                        }
                    }
                } finally {
                    count--;
                    if (count === 0) {
                        fnEachComplete.length = 0;
                        items.clear();
                        resolve();
                    }
                }
            });
        });
    };

    /**
     * @param {number} v
     * @returns {void} 
     */
    const setTtl = (v) => {
        ttl = Number(v);
    };

    /**
     * @param {function} fn 
     * @returns {void}
     */
    const onEachComplete = (fn) => {
        fnEachComplete.push(fn);
    };

    return {
        setTtl,
        run,
        add,
        get,
        open,
        onEachComplete,
    };
};