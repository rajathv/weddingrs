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

export const defaultJSON = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

export const request = (method, path) => {

    const ac = new AbortController();

    let url = document.body.getAttribute('data-url');
    const req = {
        signal: ac.signal,
        method: String(method).toUpperCase(),
        headers: new Headers(defaultJSON),
    };

    let reqRetry = 0;
    let reqDelay = 1000;
    let reqAttempts = 0;

    window.addEventListener('offline', () => ac.abort());
    window.addEventListener('popstate', () => ac.abort());

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
                    if (err.name === 'AbortError') {
                        console.warn('Fetch abort:', err);
                        return err;
                    }

                    alert(err);
                    throw new Error(err);
                });
        },
        /**
         * @param {number} [maxRetries=3]
         * @param {number} [delay=1000]
         * @returns {ReturnType<typeof request>}
         */
        withTimeout(maxRetries = 3, delay = 1000) {
            reqRetry = maxRetries;
            reqDelay = delay;

            return this;
        },
        /**
         * @param {Promise<void>|null} cancel
         * @returns {ReturnType<typeof request>}
         */
        withCancel(cancel) {
            if (cancel === null) {
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

            if (reqRetry === 0 && reqDelay === 0) {
                return fetch(path, req);
            }

            /**
             * @returns {Promise<Response>}
             * @throws {Error}
             * @throws {AbortError}
             */
            const attempt = () => {
                return fetch(path, req).then((res) => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! Status: ${res.status}`);
                    }

                    return res;
                }).catch((error) => {
                    if (error.name === 'AbortError') {
                        throw error;
                    }

                    reqAttempts++;
                    reqDelay *= 2;

                    if (reqAttempts >= reqRetry) {
                        throw new Error(`Max retries reached: ${error}`);
                    }

                    console.warn('Retrying fetch: ' + path);
                    return new Promise((res, rej) => util.timeOut(() => attempt().then(res, rej), reqDelay));
                });
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
                    if (err.name === 'AbortError') {
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
