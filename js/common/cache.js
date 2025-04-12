import { request, HTTP_GET } from '../connection/request.js';

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
    const get = (url, cancelReq = null) => {
        if (objectUrls.has(url)) {
            return Promise.resolve(objectUrls.get(url));
        }

        if (inFlightRequests.has(url)) {
            return inFlightRequests.get(url);
        }

        const inflightPromise = open().then(() => {

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
        }).finally(() => {
            inFlightRequests.delete(url);
        });

        inFlightRequests.set(url, inflightPromise);
        return inflightPromise;
    };

    /**
     * @param {object[]} items
     * @param {Promise<void>|null} cancelReq
     * @returns {Promise<void>}
     */
    const run = async (items, cancelReq = null) => {
        await open();
        const uniq = new Map();

        if (!window.isSecureContext) {
            console.warn('Cache is not supported in insecure context');
        }

        items.filter((val) => val !== null).forEach((val) => {
            uniq.set(val.url, [...(uniq.get(val.url) ?? []), [val.res, val?.rej]]);
        });

        return Promise.allSettled(Array.from(uniq).map(([k, v]) => get(k, cancelReq)
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

    return {
        run,
        get,
        open,
        /**
         * @param {number} v
         * @returns {this} 
         */
        setTtl(v) {
            ttl = Number(v);
            return this;
        },
    };
};