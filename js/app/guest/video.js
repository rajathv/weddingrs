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

        const vid = document.createElement('video');
        vid.src = util.escapeHtml(container.getAttribute('data-src'));
        vid.className = container.getAttribute('data-vid-class');
        vid.loop = true;
        vid.muted = true;
        vid.controls = true;
        vid.playsInline = true;
        vid.preload = 'metadata';
        vid.disablePictureInPicture = true;
        vid.disableRemotePlayback = true;
        vid.controlsList = 'noremoteplayback nodownload noplaybackrate';

        const loaded = new Promise((resolve) => {
            vid.addEventListener('loadedmetadata', () => {
                const ratio = vid.videoHeight / vid.videoWidth;
                const width = vid.getBoundingClientRect().width;

                vid.style.height = `${width * ratio}px`;

                container.removeAttribute('data-src');
                container.removeAttribute('data-vid-class');
                resolve();
            }, { once: true });
        });

        container.appendChild(vid);
        const observer = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting ? vid.play() : vid.pause()));

        /**
         * @returns {Promise<Response>}
         */
        const fetchVideo = () => {
            const bar = document.getElementById('progress-bar-video-love-stroy');
            const inf = document.getElementById('progress-info-video-love-stroy');

            return request(HTTP_GET, vid.src).withRetry().withProgressFunc((a, b) => {
                const result = Math.min((a / b) * 100).toFixed(0) + '%';

                bar.style.width = result;
                inf.innerText = result;
            }).default().then((r) => c.set(vid.src, r));
        };

        // run in async
        loaded.then(() => c.open())
            .then(() => c.has(vid.src))
            .then((r) => r ? r : c.del(vid.src).then(fetchVideo))
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