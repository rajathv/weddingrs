import { dto } from './dto.js';
import { util } from '../common/util.js';

export const HTTP_GET = 'GET';
export const HTTP_PUT = 'PUT';
export const HTTP_POST = 'POST';
export const HTTP_PATCH = 'PATCH';
export const HTTP_DELETE = 'DELETE';

export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_CREATED = 201;
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

export const ERROR_ABORT = 'AbortError';

export const defaultJSON = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

export const request = (method, path) => {

    const ac = new AbortController();
    const req = {
        signal: ac.signal,
        method: String(method).toUpperCase(),
        headers: new Headers(defaultJSON),
    };

    window.addEventListener('offline', () => ac.abort());
    window.addEventListener('popstate', () => ac.abort());

    let reqTtl = 0;
    let reqRetry = 0;
    let reqDelay = 1000;
    let reqAttempts = 0;
    let url = document.body.getAttribute('data-url');

    if (url && url.slice(-1) === '/') {
        url = url.slice(0, -1);
    }

    return {
        /**
         * @template T
         * @param {((data: any) => T)=} transform
         * @returns {Promise<ReturnType<typeof dto.baseResponse<T>>>}
         */
        send(transform = null) {
            return fetch(url + path, req)
                .then((res) => {
                    return res.json().then((json) => {
                        if (res.status >= HTTP_STATUS_INTERNAL_SERVER_ERROR && (json.message ?? json[0])) {
                            throw new Error(json.message ?? json[0]);
                        }

                        if (json.error) {
                            throw new Error(json.error[0]);
                        }

                        if (transform) {
                            json.data = transform(json.data);
                        }

                        return dto.baseResponse(json.code, json.data, json.error);
                    });
                })
                .catch((err) => {
                    if (err.name === ERROR_ABORT) {
                        console.warn('Fetch abort:', err);
                        return err;
                    }

                    alert(err);
                    throw new Error(err);
                });
        },
        /**
         * @param {number} [ttl=21600000]
         * @returns {ReturnType<typeof request>}
         */
        withCache(ttl = 1000 * 60 * 60 * 6) {
            reqTtl = ttl;

            return this;
        },
        /**
         * @param {number} [maxRetries=3]
         * @param {number} [delay=1000]
         * @returns {ReturnType<typeof request>}
         */
        withRetry(maxRetries = 3, delay = 1000) {
            reqRetry = maxRetries;
            reqDelay = delay;

            return this;
        },
        /**
         * @param {Promise<void>|null} cancel
         * @returns {ReturnType<typeof request>}
         */
        withCancel(cancel) {
            if (cancel === null || cancel === undefined) {
                return this;
            }

            (async () => {
                await cancel;
                ac.abort();
            })();

            return this;
        },
        /**
         * @param {object|null} header 
         * @returns {Promise<Response>}
         */
        default(header = null) {
            req.headers = new Headers(header ?? {});

            const baseFetch = () => {
                if (reqTtl === 0 || !window.isSecureContext) {
                    return fetch(path, req);
                }

                if (req.method !== HTTP_GET) {
                    throw new Error('Only method GET can be cached');
                }

                const fetchPut = (c) => fetch(path, req).then(async (res) => {
                    if (!res.ok) {
                        return res;
                    }

                    const cRes = res.clone();
                    const headers = new Headers(res.headers);

                    if (!headers.has('Expires')) {
                        const expiresDate = new Date(Date.now() + reqTtl);
                        headers.set('Expires', expiresDate.toUTCString());
                    }

                    if (!headers.has('Content-Length')) {
                        await res.clone().arrayBuffer().then((a) => {
                            headers.set('Content-Length', String(a.byteLength));
                        });
                    }

                    await c.put(path, new Response(res.body, { headers }));

                    return cRes;
                });

                return window.caches.open('request').then((c) => c.match(path).then((res) => {
                    if (!res) {
                        return fetchPut(c);
                    }

                    const expiresHeader = res.headers.get('Expires');
                    const expiresTime = expiresHeader ? (new Date(expiresHeader)).getTime() : 0;

                    if (Date.now() > expiresTime) {
                        return c.delete(path).then((s) => s ? fetchPut(c) : res);
                    }

                    return res;
                }));
            };

            if (reqRetry === 0 && reqDelay === 0) {
                return baseFetch();
            }

            /**
             * @returns {Promise<Response>}
             */
            const attempt = async () => {
                try {
                    const res = await baseFetch();
                    if (res.ok) {
                        return res;
                    }

                    throw new Error(`HTTP error! Status: ${res.status}`);
                } catch (error) {
                    if (error.name === ERROR_ABORT) {
                        throw error;
                    }

                    reqDelay *= 2;
                    reqAttempts++;

                    if (reqAttempts >= reqRetry) {
                        throw new Error(`Max retries reached: ${error}`);
                    }

                    console.warn(`Retrying fetch (${reqAttempts}/${reqRetry}): ${path}`);

                    await new Promise((resolve) => util.timeOut(resolve, reqDelay));
                    return attempt();
                }
            };

            return attempt();
        },
        /**
         * @returns {Promise<boolean>}
         */
        download() {
            Object.keys(defaultJSON).forEach((k) => req.headers.delete(k));
            return fetch(url + path, req)
                .then((res) => {
                    if (res.status !== HTTP_STATUS_OK) {
                        return false;
                    }

                    const existingLink = document.querySelector('a[download]');
                    if (existingLink) {
                        document.body.removeChild(existingLink);
                    }

                    const filename = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'download.csv';

                    return res.blob().then((blob) => {
                        const link = document.createElement('a');
                        const href = window.URL.createObjectURL(blob);

                        link.href = href;
                        link.download = filename;
                        document.body.appendChild(link);

                        link.click();

                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(href);

                        return true;
                    });
                })
                .catch((err) => {
                    if (err.name === ERROR_ABORT) {
                        console.warn('Fetch abort:', err);
                        return err;
                    }

                    alert(err);
                    throw new Error(err);
                });
        },
        /**
         * @param {string} token
         * @returns {ReturnType<typeof request>}
         */
        token(token) {
            if (token.split('.').length === 3) {
                req.headers.append('Authorization', 'Bearer ' + token);
                return this;
            }

            req.headers.append('x-access-key', token);
            return this;
        },
        /**
         * @param {object} body
         * @returns {ReturnType<typeof request>}
         */
        body(body) {
            req.body = JSON.stringify(body);
            return this;
        },
    };
};
