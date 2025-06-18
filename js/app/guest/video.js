import { util } from '../../common/util.js';
import { cache } from '../../connection/cache.js';
import { HTTP_GET, request } from '../../connection/request.js';

export const video = (() => {

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    /**
     * @returns {void}
     */
    const load = () => {
        const wrap = document.getElementById('video-love-stroy');
        if (!wrap) {
            return;
        }

        const vid = document.createElement('video');
        vid.className = wrap.getAttribute('data-vid-class');
        vid.loop = true;
        vid.muted = true;
        vid.controls = true;
        vid.autoplay = false;
        vid.playsInline = true;
        vid.preload = 'metadata';
        vid.disableRemotePlayback = true;
        vid.disablePictureInPicture = true;
        vid.controlsList = 'noremoteplayback nodownload noplaybackrate';

        const observer = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting ? vid.play() : vid.pause()));

        /**
         * @param {Response} res 
         * @returns {Promise<Response>}
         */
        const resToVideo = (res) => res.clone().blob().then((b) => {
            vid.src = URL.createObjectURL(b);
            document.getElementById('video-love-stroy-loading')?.remove();

            return res;
        });

        /**
         * @returns {Promise<Response>}
         */
        const fetchBasic = () => {
            const bar = document.getElementById('progress-bar-video-love-stroy');
            const inf = document.getElementById('progress-info-video-love-stroy');

            vid.src = util.escapeHtml(wrap.getAttribute('data-src'));
            const loaded = new Promise((resolve) => vid.addEventListener('loadedmetadata', resolve, { once: true }));

            wrap.appendChild(vid);
            observer.observe(vid);

            return loaded.then(() => {
                vid.style.height = `${vid.getBoundingClientRect().width * (vid.videoHeight / vid.videoWidth)}px`;

                return request(HTTP_GET, vid.src)
                    .withProgressFunc((a, b) => {
                        const result = Math.min((a / b) * 100).toFixed(0) + '%';

                        bar.style.width = result;
                        inf.innerText = result;
                    })
                    .withRetry()
                    .default()
                    .then(resToVideo);
            });
        };

        /**
         * @param {string} src
         * @returns {Promise<Response>}
         */
        const fetchCache = (src) => c.has(src)
            .then((res) => res ? resToVideo(res).finally(() => wrap.appendChild(vid)).finally(() => observer.observe(vid)) : c.del(src).then(fetchBasic).then((r) => c.set(src, r)));

        // run in async
        c.open().then(() => window.isSecureContext ? fetchCache(wrap.getAttribute('data-src')) : fetchBasic());
    };

    /**
     * @returns {object}
     */
    const init = () => {
        c = cache('video').withForceCache();

        return {
            load,
        };
    };

    return {
        init,
    };
})();