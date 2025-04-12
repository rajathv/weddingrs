import { request, HTTP_GET } from '../connection/request.js';

export const cache = (cacheName) => {

    /**
     * @type {Map<string, function[][]>}
     */
    const items = new Map();

    /**
     * @type {Map<string, string>}
     */
    const objectUrls = new Map();

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
     * @returns {Promise<string>}
     */
    const get = async (url, cancelReq = null) => {
        if (objectUrls.has(url)) {
            return objectUrls.get(url);
        }

        await open();

        /**
         * @returns {Promise<Blob>}
         */
        const fetchPut = () => request(HTTP_GET, url)
            .withCancel(cancelReq)
            .withRetry()
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

                return cacheObject.put(url, new Response(b, { headers })).then(() => b.slice());
            }));

        /**
         * @param {Blob} b 
         * @returns {string}
         */
        const blobToUrl = (b) => {
            objectUrls.set(url, URL.createObjectURL(b));
            return objectUrls.get(url);
        };

        if (!window.isSecureContext) {
            return fetchPut().then((b) => blobToUrl(b));
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
        }).then((b) => blobToUrl(b));
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
                    const s = await get(k, cancelReq);
                    v.forEach((cb) => cb[0](s));
                    fnEachComplete.forEach((fn) => fn(k));
                } catch (err) {
                    v.forEach((cb) => {
                        if (cb[1]) {
                            cb[1](err);
                        }
                    });
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

    return {
        run,
        get,
        open,
        /**
         * @param {string} url 
         * @param {function} res
         * @param {function} [rej=null]
         * @returns {this}
         */
        add(url, res, rej = null) {
            items.set(url, [...(items.get(url) ?? []), [res, rej]]);
        },
        /**
         * @param {number} v
         * @returns {this} 
         */
        setTtl(v) {
            ttl = Number(v);
            return this;
        },
        /**
         * @param {function} fn 
         * @returns {this}
         */
        onEachComplete(fn) {
            fnEachComplete.push(fn);
            return this;
        },
    };
};