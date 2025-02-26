import { util } from '../../common/util.js';
import { storage } from '../../common/storage.js';
import { request, HTTP_GET } from '../../connection/request.js';

export const gif = (() => {

    const cacheName = 'gifs';

    const breakPoint = {
        128: 2,
        256: 3,
        512: 4,
        768: 5,
    };

    const countryMapping = {
        'id': 'ID',
        'en': 'US',
        'fr': 'FR',
        'de': 'DE',
        'es': 'ES',
        'zh': 'CN',
        'ja': 'JP',
        'ko': 'KR',
        'ar': 'SA',
        'ru': 'RU',
        'it': 'IT',
        'nl': 'NL',
        'pt': 'PT',
        'tr': 'TR',
        'th': 'TH',
        'vi': 'VN',
        'ms': 'MY',
        'hi': 'IN',
    };

    /**
     * @type {Map<string, string>|null}
     */
    let urls = null;

    /**
     * @type {Map<string, object>|null}
     */
    let objectPool = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let conf = null;

    /**
     * @param {string} url
     * @returns {Promise<string>}
     */
    const cache = async (url) => {
        if (urls.has(url)) {
            return urls.get(url);
        }

        /**
        * @param {Cache} c 
        * @param {number} retries
        * @param {number} delay
        * @returns {Promise<Blob>}
        */
        const fetchPut = (c, retries = 3, delay = 1000) => request(HTTP_GET, url)
            .default()
            .then((r) => r.blob().then((b) => c.put(url, new Response(b, { headers: r.headers })).then(() => b)))
            .catch((err) => {
                if (retries <= 0) {
                    throw err;
                }

                console.warn('Retrying fetch:' + url);
                return new Promise((res) => util.timeOut(() => res(fetchPut(c, retries - 1, delay + 1000)), delay));
            });

        /**
        * @param {Cache} c 
        * @returns {Promise<Blob>}
        */
        const imageCache = (c) => c.match(url).then((res) => {
            if (!res) {
                return fetchPut(c);
            }

            const expiresHeader = res.headers.get('expires');
            const expiresTime = expiresHeader ? (new Date(expiresHeader)).getTime() : 0;

            if (Date.now() > expiresTime) {
                return c.delete(url).then((s) => s ? fetchPut(c) : res.blob());
            }

            return res.blob();
        });

        return caches.open(cacheName)
            .then((c) => imageCache(c))
            .then((b) => URL.createObjectURL(b))
            .then((uri) => {
                urls.set(url, uri);
                return uri;
            });
    };

    /**
     * @param {object} ctx
     * @param {object} data
     * @returns {Promise<void>}
     */
    const show = async (ctx, data) => {
        const { id, media_formats: { tinygif: { url } }, content_description: description } = data;

        if (ctx.pointer === -1) {
            ctx.pointer = 0;
        } else if (ctx.pointer === (ctx.col - 1)) {
            ctx.pointer = 0;
        } else {
            ctx.pointer++;
        }

        let k = 0;
        for (const el of ctx.lists.childNodes) {
            if (k === ctx.pointer) {
                await cache(url).then((uri) => {
                    el.insertAdjacentHTML('beforeend', `
                    <figure class="gif-figure m-0 position-relative">
                        <div onclick="undangan.comment.gif.click('${ctx.uuid}', '${id}', '${util.base64Encode(url)}')" class="gif-checklist position-absolute justify-content-center align-items-center top-0 end-0 bg-overlay-auto p-1 m-1 rounded-circle border shadow-sm z-1">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <img src="${uri}" class="img-fluid" alt="${description}" style="width: 100%;">
                    </figure>
                    `);
                });
            }
            k++;
        }
    };

    /**
     * @param {object} ctx 
     * @returns {object}
     */
    const loading = (ctx) => {
        const list = ctx.lists;

        if (!list.classList.contains('d-none')) {
            ctx.loading.classList.replace('d-none', 'd-flex');
        }

        list.setAttribute('data-continue', 'false');
        list.classList.replace('overflow-y-scroll', 'overflow-y-hidden');

        const release = () => {
            if (!list.classList.contains('d-none')) {
                ctx.loading.classList.replace('d-flex', 'd-none');
            }

            list.setAttribute('data-continue', 'true');
            list.classList.replace('overflow-y-hidden', 'overflow-y-scroll');
        };

        return {
            release,
        };
    };

    /**
     * @param {object} ctx
     * @param {Promise<object>} response
     * @returns {Promise<void>}
     */
    const render = async (ctx, response) => {
        const load = loading(ctx);

        try {
            const data = await response;
            ctx.next = data?.next;

            for (const el of data.results) {
                ctx.gifs.push(el);
                await show(ctx, el);
            }
        } catch (err) {
            alert(err);
        }

        load.release();
    };

    /**
     * @param {string} path 
     * @param {object} params 
     * @returns {Promise<object>}
     */
    const get = (path, params) => {
        params = {
            key: conf.get('key'),
            media_filter: conf.get('media_filter'),
            client_key: conf.get('client_key'),
            country: conf.get('country'),
            locale: conf.get('locale'),
            ...(params ?? {}),
        };

        const param = Object.keys(params)
            .filter((k) => params[k] !== null && params[k] !== undefined)
            .map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');

        const url = 'https://tenor.googleapis.com/v2';
        return request(HTTP_GET, `${url + path}?${param}`).default().then((r) => r.json());
    };

    /**
     * @param {object} ctx
     * @returns {Promise<void>}
     */
    const infinite = async (ctx) => {
        const isQuery = ctx.query && ctx.query.trim().length;
        const params = { pos: ctx.next, limit: ctx.limit };

        if (isQuery) {
            params.q = ctx.query;
        }

        const scrollableHeight = (ctx.lists.scrollHeight - ctx.lists.clientHeight) * 0.9;

        if (ctx.lists.scrollTop > scrollableHeight && ctx.lists.getAttribute('data-continue') === 'true') {
            await render(ctx, get(isQuery ? '/search' : '/featured', params));
        }
    };

    /**
     * @param {string} uuid 
     * @returns {string}
     */
    const template = (uuid) => {
        return `
        <label for="gif-search-${uuid}" class="form-label my-1"><i class="fa-solid fa-photo-film me-2"></i>Gif</label>

        <div class="d-flex mb-3" id="gif-search-nav-${uuid}">
            <button class="btn btn-secondary btn-sm rounded-4 shadow-sm me-1 my-1" onclick="undangan.comment.gif.back('${uuid}')" data-offline-disabled="false"><i class="fa-solid fa-arrow-left"></i></button>
            <input type="text" name="gif-search" id="gif-search-${uuid}" autocomplete="off" class="form-control shadow-sm rounded-4" placeholder="Cari GIF oleh Tenor" data-offline-disabled="false">
        </div>

        <div class="position-relative">
            <div class="position-absolute d-flex justify-content-center align-items-center top-50 start-50 translate-middle w-100 h-100 bg-overlay-auto rounded-4 z-3" id="gif-loading-${uuid}">
                <div class="spinner-border" role="status"></div>
            </div>
            <div id="gif-lists-${uuid}" class="d-flex rounded-4 p-0 overflow-y-scroll" data-continue="true" style="height: 15rem;"></div>
        </div>

        <figure class="d-flex m-0 position-relative" id="gif-result-${uuid}">
            <div onclick="undangan.comment.gif.cancel('${uuid}')" id="gif-cancel-${uuid}" class="d-none position-absolute justify-content-center align-items-center top-0 end-0 bg-overlay-auto p-2 m-1 rounded-circle border shadow-sm z-1" style="cursor: pointer;">
                <i class="fa-solid fa-circle-xmark"></i>
            </div>
        </figure>`;
    };

    /**
     * @param {object} ctx
     * @returns {Promise<void>}
     */
    const bootUp = async (ctx) => {
        let last = 0;
        for (const [k, v] of Object.entries(breakPoint)) {
            last = v;
            if (ctx.lists.clientWidth >= parseInt(k)) {
                ctx.col = last;
            }
        }

        if (ctx.col === null) {
            ctx.col = last;
        }

        ctx.pointer = -1;
        ctx.limit = ctx.col * 5;
        ctx.lists.innerHTML = `<div class="d-flex flex-column"></div>`.repeat(ctx.col);

        if (ctx.gifs.length === 0) {
            return;
        }

        const load = loading(ctx);
        for (const el of ctx.gifs) {
            await show(ctx, el);
        }
        load.release();
    };

    /**
     * @param {object} ctx
     * @param {HTMLInputElement} input
     * @returns {Promise<void>}
     */
    const search = async (ctx, input) => {
        ctx.query = input.value;
        if (!ctx.query || ctx.query.trim().length === 0) {
            ctx.query = null;
        }

        ctx.next = null;
        ctx.gifs = [];
        ctx.pointer = -1;
        await bootUp(ctx);
        await render(ctx, get(ctx.query === null ? '/featured' : '/search', { q: ctx.query, limit: ctx.limit }));
    };

    /**
     * @param {string} uuid
     * @returns {{
     *   uuid: string, 
     *   container: HTMLElement, 
     *   query: string|null, 
     *   next: string|null, 
     *   col: number|null, 
     *   pointer: number, 
     *   gifs: object[], 
     *   limit: number|null, 
     *   lists: HTMLElement, 
     *   loading: HTMLElement, 
     *   form: HTMLElement, 
     *   comment: HTMLElement, 
     *   nav: HTMLElement, 
     *   result: HTMLElement
     * }}
     */
    const singleton = (uuid) => {
        if (!objectPool.has(uuid)) {

            const container = document.getElementById(`gif-form-${uuid}`);
            container.innerHTML = template(uuid);

            const debounceRender = util.debounce(bootUp, 500);
            const debounceSearch = util.debounce(search, 500);

            objectPool.set(uuid, {
                uuid: uuid,
                container: container,
                query: null,
                next: null,
                col: null,
                pointer: -1,
                gifs: [],
                limit: null,
                lists: document.getElementById(`gif-lists-${uuid}`),
                loading: document.getElementById(`gif-loading-${uuid}`),
                form: document.getElementById(`gif-search-${uuid}`),
                comment: document.getElementById(`comment-form-${uuid}`),
                nav: document.getElementById(`gif-search-nav-${uuid}`),
                result: document.getElementById(`gif-result-${uuid}`),
            });

            const ses = objectPool.get(uuid);
            ses.lists.addEventListener('scroll', () => infinite(ses));
            ses.form.addEventListener('input', (e) => debounceSearch(ses, e.target));
            window.addEventListener('resize', () => debounceRender(ses));
        }

        return objectPool.get(uuid);
    };

    /**
     * @param {string} uuid
     * @param {string} id
     * @param {string} urlBase64
     * @returns {void}
     */
    const click = (uuid, id, urlBase64) => {
        const ses = singleton(uuid);

        ses.result.setAttribute('data-id', id);
        ses.result.querySelector(`#gif-cancel-${uuid}`).classList.replace('d-none', 'd-flex');
        ses.result.insertAdjacentHTML('beforeend', `<img src="${urls.get(util.base64Decode(urlBase64))}" class="img-fluid mx-auto gif-image rounded-4" alt="selected-gif">`);

        ses.lists.classList.replace('d-flex', 'd-none');
        ses.nav.classList.replace('d-flex', 'd-none');

        get('/registershare', { id: id, q: ses.query });
    };

    /**
     * @param {string} uuid
     * @returns {void} 
     */
    const cancel = (uuid) => {
        const ses = singleton(uuid);

        ses.result.removeAttribute('data-id');
        ses.result.querySelector(`#gif-cancel-${uuid}`).classList.replace('d-flex', 'd-none');
        ses.result.querySelector('img').remove();

        ses.lists.classList.replace('d-none', 'd-flex');
        ses.nav.classList.replace('d-none', 'd-flex');
    };

    /**
     * @param {string} uuid
     * @returns {void} 
     */
    const back = (uuid) => {
        const ses = singleton(uuid);
        ses.comment?.classList.toggle('d-none', false);
        ses.container.classList.toggle('d-none', true);
        ses.container.dispatchEvent(new Event('gif.close'));
    };

    /**
     * @param {string} uuid
     * @returns {Promise<void>} 
     */
    const open = async (uuid) => {
        const ses = singleton(uuid);
        ses.comment?.classList.toggle('d-none', true);
        ses.container.classList.toggle('d-none', false);
        ses.container.dispatchEvent(new Event('gif.open'));

        await bootUp(ses);
        await render(ses, get('/featured', { limit: ses.limit }));
    };

    /**
     * @param {string|null} uuid 
     * @returns {boolean}
     */
    const remove = (uuid = null) => uuid ? objectPool.delete(uuid) : objectPool.clear();

    /**
     * @returns {void}
     */
    const init = () => {
        urls = new Map();
        objectPool = new Map();
        conf = storage('config');

        let lang = document.documentElement.lang ?? 'en';
        lang = lang.split('-')[0].toLowerCase();

        conf.set('country', countryMapping[lang] ?? 'US');
        conf.set('locale', `${lang}_${conf.get('country')}`);

        conf.set('key', 'AIzaSyB-Z10TLX7MbkcMT5S_YA1iEqCmGzutV7s');
        conf.set('media_filter', 'tinygif');
        conf.set('client_key', 'undangan_app');
    };

    return {
        init,
        cache,
        back,
        open,
        cancel,
        click,
        remove,
    };
})();