import { cache } from '../../connection/cache.js';
import { HTTP_GET, request } from '../../connection/request.js';

export const video = (() => {

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    /**
     * @type {HTMLVideoElement|null}
     */
    let vid = null;

    /**
     * @returns {Promise<Response>}
     */
    const getVideo = () => {
        const bar = document.getElementById('progress-bar-video-love-stroy');
        const inf = document.getElementById('progress-info-video-love-stroy');

        return request(HTTP_GET, vid.src).withRetry().withProgressFunc((a, b) => {
            const result = Math.min((a / b) * 100).toFixed(0) + '%';

            bar.style.width = result;
            inf.innerText = result;
        }).default().then((r) => c.set(vid.src, r));
    };

    /**
     * @returns {Promise<void>}
     */
    const load = () => c.open().then(() => c.has(vid.src).then((res) => {
        if (res) {
            return res;
        }

        return c.del(vid.src).then(() => getVideo());
    }).then((r) => r.blob()).then((b) => {
        vid.src = URL.createObjectURL(b);
        vid.dispatchEvent(new Event('undangan.cache.video'));
    }));

    /**
     * @returns {object}
     */
    const init = () => {
        c = cache('video').withForceCache();

        vid = document.createElement('video');
        const container = document.getElementById('video-love-stroy');

        vid.src = container.getAttribute('data-src');
        vid.className = container.getAttribute('data-vid-class');
        vid.controls = true;
        vid.preload = 'metadata';
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.disablePictureInPicture = true;
        vid.disableRemotePlayback = true;
        vid.controlsList = 'noremoteplayback nodownload noplaybackrate';

        const observer = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting ? vid.play() : vid.pause()));

        vid.addEventListener('undangan.cache.video', () => {
            observer.observe(vid);
            document.getElementById('video-love-stroy-loading')?.remove();
        });

        vid.addEventListener('loadedmetadata', () => {
            const ratio = vid.videoHeight / vid.videoWidth;
            const width = vid.getBoundingClientRect().width;

            vid.style.height = `${width * ratio}px`;
        });

        container.appendChild(vid);

        return {
            load,
        };
    };

    return {
        init,
    };
})();