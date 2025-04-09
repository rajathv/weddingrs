import { request, HTTP_GET } from '../connection/request.js';

export const cache = (cacheName) => {

    /**
     * @type {Map<string, function[][]>|null}
     */
    const items = new Map();

    /**
     * @type {function|null}
     */
    let fnEachComplete = null;

    /**
     * @type {Caches|null}
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
    const manualOpen = async () => {
        if (!cacheObject) {
            cacheObject = await window.caches.open(cacheName);
        }
    };

    /**
     * @param {string} url
     * @param {Promise<void>|null} [cancelReq=null]
     * @returns {Promise<Blob>}
     */
    const getSingle = async (url, cancelReq = null) => {

        await manualOpen();

        /**
         * @returns {Promise<Blob>}
         */
        const fetchPut = () => request(HTTP_GET, url)
            .withCancel(cancelReq)
            .withTimeout()
            .default()
            .then((r) => r.blob().then((b) => {
                const headers = new Headers();
                const expiresDate = new Date(Date.now() + ttl);

                headers.set('Content-Length', String(b.size));
                headers.set('Expires', expiresDate.toUTCString());
                headers.set('Content-Type', r.headers.get('Content-Type'));

                return cacheObject.put(url, new Response(b, { headers })).then(() => b);
            }));

        const result = await cacheObject.match(url).then((res) => {
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

        return result;
    };

    /**
     * @param {Promise<void>|null} cancelReq
     * @returns {Promise<void>}
     */
    const run = (cancelReq = null) => {
        let count = items.size;

        return new Promise((resolve) => {
            (async () => {
                await manualOpen();

                items.forEach(async (v, k) => {
                    try {
                        const b = await getSingle(k, cancelReq);

                        v.forEach(([cb, _]) => {
                            if (cb) {
                                cb(b);
                            }
                        });

                        if (fnEachComplete) {
                            fnEachComplete();
                        }
                    } catch (err) {
                        v.forEach(([_, cb]) => {
                            if (cb) {
                                cb(err);
                            }
                        });
                    } finally {
                        count--;
                        if (count === 0) {
                            resolve();
                            items.clear();
                            fnEachComplete = null;
                        }
                    }
                });
            })();
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
        fnEachComplete = fn;
    };

    return {
        setTtl,
        run,
        add,
        getSingle,
        manualOpen,
        onEachComplete,
    };
};