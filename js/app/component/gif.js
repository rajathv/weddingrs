import { util } from '../../common/util.js';
import { cache } from '../../common/cache.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { request, defaultJSON, HTTP_GET } from '../../connection/request.js';

export const gif = (() => {

    const cacheName = 'gifs';

    const gifDefault = 'default';

    const breakPoint = {
        128: 2,
        256: 3,
        512: 4,
        768: 5,
    };

    /**
     * @type {Map<string, string>|null}
     */
    let urls = null;

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    /**
     * @type {Map<string, object>|null}
     */
    let objectPool = null;

    /**
     * @type {Map<string, function>|null}
     */
    let eventListeners = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let config = null;

    /**
     * @param {object} ctx
     * @param {object} data
     * @returns {void}
     */
    const show = (ctx, data) => {
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
                c.add(url, (b) => {
                    const uri = URL.createObjectURL(b);
                    urls.set(url, uri);

                    el.insertAdjacentHTML('beforeend', `
                    <figure class="gif-figure m-0 position-relative">
                        <button onclick="undangan.comment.gif.click('${ctx.uuid}', '${id}', '${util.base64Encode(url)}')" class="btn gif-checklist position-absolute justify-content-center align-items-center top-0 end-0 bg-overlay-auto p-1 m-1 rounded-circle border shadow-sm z-1">
                            <i class="fa-solid fa-circle-check"></i>
                        </button>
                        <img src="${uri}" class="img-fluid" alt="${util.escapeHtml(description)}" style="width: 100%;">
                    </figure>`);
                });
                return;
            }
            k++;
        }
    };

    /**
     * @returns {Promise<void>}
     */
    const prepareCache = async () => {
        await c.open();
    };

    /**
     * @param {string} url
     * @returns {Promise<string>}
     */
    const get = async (url) => {
        if (!urls.has(url)) {
            urls.set(url, URL.createObjectURL(await c.get(url)));
        }

        return urls.get(url);
    };

    /**
     * @param {object} ctx 
     * @returns {object}
     */
    const loading = (ctx) => {
        const list = ctx.lists;
        const load = document.getElementById(`gif-loading-${ctx.uuid}`);
        const prog = document.getElementById(`progress-bar-${ctx.uuid}`);
        const info = document.getElementById(`progress-info-${ctx.uuid}`);

        let total = 0;
        let loaded = 0;

        if (!list.classList.contains('d-none')) {
            load.classList.replace('d-none', 'd-flex');
        }

        info.innerText = `${loaded}/${total}`;
        list.setAttribute('data-continue', 'false');
        list.classList.replace('overflow-y-scroll', 'overflow-y-hidden');

        const release = () => {
            if (!list.classList.contains('d-none')) {
                load.classList.replace('d-flex', 'd-none');
            }

            prog.style.width = '0%';
            info.innerText = `${loaded}/${total}`;
            list.setAttribute('data-continue', 'true');
            list.classList.replace('overflow-y-hidden', 'overflow-y-scroll');
        };

        /**
         * @param {number} num 
         */
        const until = (num) => {
            total = num;
            info.innerText = `${loaded}/${total}`;
        };

        const step = () => {
            loaded += 1;
            info.innerText = `${loaded}/${total}`;
            prog.style.width = Math.min((loaded / total) * 100, 100).toString() + '%';
        };

        return {
            release,
            until,
            step,
        };
    };

    /**
     * @param {object} ctx
     * @param {string} path 
     * @param {object} params
     * @returns {void}
     */
    const render = (ctx, path, params) => {
        params = {
            media_filter: 'tinygif',
            client_key: 'undangan_app',
            key: config.get('tenor_key'),
            country: lang.getCountry(),
            locale: lang.getLocale(),
            ...(params ?? {}),
        };

        const param = Object.keys(params)
            .filter((k) => params[k] !== null && params[k] !== undefined)
            .map((k) => `${k}=${encodeURIComponent(params[k])}`)
            .join('&');

        const url = `https://tenor.googleapis.com/v2${path}?${param}`;

        ctx.last = new Promise((res) => {
            const load = loading(ctx);

            const reqCancel = new Promise((r) => {
                ctx.reqs.push(r);
            });

            (async () => {
                try {
                    const data = await request(HTTP_GET, url)
                        .withCancel(reqCancel)
                        .default(defaultJSON)
                        .then((r) => r.json())
                        .then((j) => {
                            if (!j.error) {
                                return j;
                            }

                            throw new Error(j.error.message);
                        });

                    if (data.results.length > 0) {

                        ctx.next = data?.next;
                        load.until(data.results.length);
                        c.onEachComplete(load.step);

                        for (const el of data.results) {
                            ctx.gifs.push(el);
                            show(ctx, el);
                        }

                        await c.run(reqCancel);
                    }
                } catch (err) {
                    if (err.name === 'AbortError') {
                        console.warn('Fetch abort:', err);
                    } else {
                        alert(err);
                    }
                } finally {
                    load.release();
                    res();
                }
            })();
        });
    };

    /**
     * @param {string} uuid 
     * @returns {string}
     */
    const template = (uuid) => {
        uuid = util.escapeHtml(uuid);

        return `
        <label for="gif-search-${uuid}" class="form-label my-1"><i class="fa-solid fa-photo-film me-2"></i>Gif</label>

        <div class="d-flex mb-3" id="gif-search-nav-${uuid}">
            <button class="btn btn-secondary btn-sm rounded-4 shadow-sm me-1 my-1" onclick="undangan.comment.gif.back(this, '${uuid}')" data-offline-disabled="false"><i class="fa-solid fa-arrow-left"></i></button>
            <input type="text" name="gif-search" id="gif-search-${uuid}" autocomplete="on" class="form-control shadow-sm rounded-4" placeholder="Search for a GIF on Tenor" data-offline-disabled="false">
        </div>

        <div class="position-relative">
            <div class="position-absolute d-flex flex-column justify-content-center align-items-center top-50 start-50 translate-middle w-100 h-100 bg-overlay-auto rounded-4 z-3" id="gif-loading-${uuid}">
                <div class="progress w-25" role="progressbar" style="height: 0.5rem;" aria-label="progress bar">
                    <div class="progress-bar" id="progress-bar-${uuid}" style="width: 0%"></div>
                </div>
                <small class="mt-1 text-theme-auto bg-theme-auto py-0 px-2 rounded-4" id="progress-info-${uuid}" style="font-size: 0.7rem;"></small>
            </div>
            <div id="gif-lists-${uuid}" class="d-flex rounded-4 p-0 overflow-y-scroll border" data-continue="true" style="height: 15rem;"></div>
        </div>

        <figure class="d-flex m-0 position-relative" id="gif-result-${uuid}">
            <button onclick="undangan.comment.gif.cancel('${uuid}')" id="gif-cancel-${uuid}" class="btn d-none position-absolute justify-content-center align-items-center top-0 end-0 bg-overlay-auto p-2 m-1 rounded-circle border shadow-sm z-1">
                <i class="fa-solid fa-circle-xmark"></i>
            </button>
        </figure>`;
    };

    /**
     * @param {object} ctx
     * @returns {Promise<void>}
     */
    const waitLastRequest = async (ctx) => {
        ctx.reqs.forEach((f) => f());
        ctx.reqs.length = 0;

        if (ctx.last) {
            await ctx.last;
            ctx.last = null;
        }
    };

    /**
     * @param {object} ctx
     * @returns {Promise<void>}
     */
    const bootUp = async (ctx) => {
        await waitLastRequest(ctx);

        const prevCol = ctx.col ?? 0;

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

        if (prevCol === ctx.col) {
            return;
        }

        ctx.pointer = -1;
        ctx.limit = ctx.col * 5;
        ctx.lists.innerHTML = '<div class="d-flex flex-column"></div>'.repeat(ctx.col);

        if (ctx.gifs.length === 0) {
            return;
        }

        const load = loading(ctx);
        load.until(ctx.gifs.length);
        c.onEachComplete(load.step);

        try {
            ctx.gifs.forEach((el) => show(ctx, el));
            await c.run();
        } catch {
            ctx.gifs.length = 0;
        }

        if (prevCol !== ctx.col) {
            ctx.lists.scroll({
                top: ctx.lists.scrollHeight,
                behavior: 'instant',
            });
        }

        load.release();

        // reset if error
        if (ctx.gifs.length === 0) {
            await bootUp(ctx);
        }
    };

    /**
     * @param {object} ctx
     * @returns {Promise<void>}
     */
    const infinite = async (ctx) => {
        if (ctx.lists.getAttribute('data-continue') !== 'true') {
            return;
        }

        // Don't try to load more if there's no next page token
        if (!ctx.next || ctx.next.length === 0) {
            return;
        }

        const isQuery = ctx.query && ctx.query.trim().length > 0;
        const params = { pos: ctx.next, limit: ctx.limit };

        if (isQuery) {
            params.q = ctx.query;
        }

        if (ctx.lists.scrollTop > (ctx.lists.scrollHeight - ctx.lists.clientHeight) * 0.8) {
            await bootUp(ctx);
            render(ctx, isQuery ? '/search' : '/featured', params);
        }
    };

    /**
     * @param {object} ctx
     * @param {string|null} [q=null]
     * @returns {Promise<void>}
     */
    const search = async (ctx, q = null) => {
        ctx.query = q !== null ? q : ctx.query;
        if (!ctx.query || ctx.query.trim().length === 0) {
            ctx.query = null;
        }

        ctx.col = null;
        ctx.next = null;
        ctx.pointer = -1;
        ctx.gifs.length = 0;

        await bootUp(ctx);
        render(ctx, ctx.query === null ? '/featured' : '/search', { q: ctx.query, limit: ctx.limit });
    };

    /**
     * @param {string} uuid
     * @returns {{
     *   uuid: string, 
     *   last: Promise<void>|null,
     *   limit: number|null,
     *   query: string|null, 
     *   next: string|null, 
     *   col: number|null, 
     *   pointer: number, 
     *   gifs: object[],
     *   reqs: function[],
     *   lists: HTMLElement, 
     * }}
     */
    const singleton = (uuid) => {
        if (!objectPool.has(uuid)) {

            util.safeInnerHTML(document.getElementById(`gif-form-${uuid}`), template(uuid));
            objectPool.set(uuid, {
                uuid: uuid,
                last: null,
                limit: null,
                query: null,
                next: null,
                col: null,
                pointer: -1,
                gifs: [],
                reqs: [],
                lists: document.getElementById(`gif-lists-${uuid}`),
            });

            const ctx = objectPool.get(uuid);
            const deSearch = util.debounce(search, 750);
            const deScroll = util.debounce(infinite, 250);

            ctx.lists.addEventListener('scroll', () => deScroll(ctx));
            document.getElementById(`gif-search-${uuid}`).addEventListener('input', (e) => deSearch(ctx, e.target.value));
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
        const res = document.getElementById(`gif-result-${uuid}`);
        res.setAttribute('data-id', id);
        res.querySelector(`#gif-cancel-${uuid}`).classList.replace('d-none', 'd-flex');
        res.insertAdjacentHTML('beforeend', `<img src="${urls.get(util.base64Decode(urlBase64))}" class="img-fluid mx-auto gif-image rounded-4" alt="selected-gif">`);

        objectPool.get(uuid).lists.classList.replace('d-flex', 'd-none');
        document.getElementById(`gif-search-nav-${uuid}`).classList.replace('d-flex', 'd-none');
    };

    /**
     * @param {string} uuid
     * @returns {void} 
     */
    const cancel = (uuid) => {
        const res = document.getElementById(`gif-result-${uuid}`);
        res.removeAttribute('data-id');
        res.querySelector(`#gif-cancel-${uuid}`).classList.replace('d-flex', 'd-none');
        res.querySelector('img').remove();

        objectPool.get(uuid).lists.classList.replace('d-none', 'd-flex');
        document.getElementById(`gif-search-nav-${uuid}`).classList.replace('d-none', 'd-flex');
    };

    /**
     * @param {string|null} uuid 
     * @returns {Promise<void>}
     */
    const remove = async (uuid = null) => {
        if (uuid) {
            if (objectPool.has(uuid)) {
                await waitLastRequest(objectPool.get(uuid));
                eventListeners.delete(uuid);
                objectPool.delete(uuid);
            }
        } else {
            await Promise.all(Array.from(objectPool.keys()).map((k) => waitLastRequest(objectPool.get(k))));
            eventListeners.clear();
            objectPool.clear();
        }
    };

    /**
     * @param {HTMLButtonElement} button
     * @param {string} uuid
     * @returns {Promise<void>} 
     */
    const back = async (button, uuid) => {
        const btn = util.disableButton(button, util.loader.replace('me-1', 'me-0'), true);
        await waitLastRequest(objectPool.get(uuid));
        btn.restore();

        document.getElementById(`gif-form-${uuid}`).classList.toggle('d-none', true);
        document.getElementById(`comment-form-${uuid}`)?.classList.toggle('d-none', false);
    };

    /**
     * @param {string} uuid
     * @returns {Promise<void>} 
     */
    const open = (uuid) => {
        const ctx = singleton(uuid);

        document.getElementById(`gif-form-${uuid}`).classList.toggle('d-none', false);
        document.getElementById(`comment-form-${uuid}`)?.classList.toggle('d-none', true);

        if (eventListeners.has(uuid)) {
            eventListeners.get(uuid)();
        }

        return search(ctx);
    };

    /**
     * @param {string} uuid 
     * @returns {boolean}
     */
    const isOpen = (uuid) => {
        const container = document.getElementById(`gif-form-${uuid}`);
        return container === null ? false : !container.classList.contains('d-none');
    };

    /**
     * @param {string} uuid 
     * @returns {string|null}
     */
    const getResultId = (uuid) => document.getElementById(`gif-result-${uuid}`)?.getAttribute('data-id');

    /**
     * @param {string} uuid 
     * @returns {void}
     */
    const removeGifSearch = (uuid) => document.querySelector(`[for="gif-search-${uuid}"]`)?.remove();

    /**
     * @param {string} uuid 
     * @returns {void}
     */
    const removeButtonBack = (uuid) => document.querySelector(`[onclick="undangan.comment.gif.back(this, '${uuid}')"]`)?.remove();

    /**
     * @param {string} uuid 
     * @param {function} callback
     * @returns {void}
     */
    const onOpen = (uuid, callback) => eventListeners.set(uuid, callback);

    /**
     * @param {string|null} [uuid=null] 
     * @returns {{ show: function(): void, hide: function(): void, click: function(): void }}
     */
    const buttonCancel = (uuid = null) => {
        const btnCancel = document.getElementById(`gif-cancel-${uuid ? uuid : gifDefault}`);

        return {
            show: () => btnCancel.classList.replace('d-none', 'd-flex'),
            hide: () => btnCancel.classList.replace('d-flex', 'd-none'),
            click: () => btnCancel.dispatchEvent(new Event('click')),
        };
    };

    /**
     * @returns {void}
     */
    const init = () => {
        urls = new Map();
        objectPool = new Map();
        eventListeners = new Map();

        c = cache(cacheName);
        config = storage('config');

        if (config.get('tenor_key') === null) {
            document.querySelector('[onclick="undangan.comment.gif.open(undangan.comment.gif.default)"]')?.remove();
        }
    };

    return {
        default: gifDefault,
        init,
        get,
        back,
        open,
        cancel,
        click,
        remove,
        isOpen,
        onOpen,
        getResultId,
        buttonCancel,
        removeGifSearch,
        removeButtonBack,
        prepareCache,
    };
})();