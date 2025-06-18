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
        const container = document.getElementById('video-love-stroy');
        if (!container) {
            return;
        }

        const bar = document.getElementById('progress-bar-video-love-stroy');
        const inf = document.getElementById('progress-info-video-love-stroy');

        const vid = document.createElement('video');
        vid.src = util.escapeHtml(container.getAttribute('data-src'));
        vid.className = container.getAttribute('data-vid-class');
        vid.loop = true;
        vid.muted = true;
        vid.controls = true;
        vid.autoplay = false;
        vid.playsInline = true;
        vid.preload = 'metadata';
        vid.disableRemotePlayback = true;
        vid.disablePictureInPicture = true;
        vid.controlsList = 'noremoteplayback nodownload noplaybackrate';

        vid.addEventListener('loadedmetadata', () => {
            const ratio = vid.videoHeight / vid.videoWidth;
            const width = vid.getBoundingClientRect().width;

            vid.style.height = `${width * ratio}px`;
        }, { once: true });

        const loaded = new Promise((resolve) => vid.addEventListener('loadedmetadata', resolve, { once: true }));
        const observer = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting ? vid.play() : vid.pause()));

        container.appendChild(vid);

        /**
         * @returns {Promise<Response>}
         */
        const fetchVideo = () => request(HTTP_GET, vid.src).withRetry().withProgressFunc((a, b) => {
            const result = Math.min((a / b) * 100).toFixed(0) + '%';

            bar.style.width = result;
            inf.innerText = result;
        }).default();

        // run in async
        loaded.then(() => c.open())
            .then(() => window.isSecureContext ? c.has(vid.src).then((res) => res ? Promise.resolve(res) : c.del(vid.src).then(fetchVideo).then((r) => c.set(vid.src, r))) : fetchVideo())
            .then((r) => r.blob())
            .then((b) => {
                vid.src = URL.createObjectURL(b);
                observer.observe(vid);
                document.getElementById('video-love-stroy-loading')?.remove();
            });
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