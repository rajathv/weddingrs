import { request, HTTP_GET } from '../../connection/request.js';

export const audio = (() => {

    /**
     * @type {HTMLButtonElement|null}
     */
    let music = null;

    /**
     * @type {HTMLAudioElement|null}
     */
    let audioEl = null;

    let isPlay = false;

    const statePlay = '<i class="fa-solid fa-circle-pause spin-button"></i>';
    const statePause = '<i class="fa-solid fa-circle-play"></i>';

    /**
     * @returns {Promise<void>}
     */
    const play = async () => {
        if (!navigator.onLine) {
            return;
        }

        music.disabled = true;
        try {
            await audioEl.play();
            isPlay = true;
            music.disabled = false;
            music.innerHTML = statePlay;
        } catch (err) {
            isPlay = false;
            alert(err);
        }
    };

    /**
     * @returns {void}
     */
    const pause = () => {
        isPlay = false;
        audioEl.pause();
        music.innerHTML = statePause;
    };

    /**
     * @returns {void}
     */
    const init = () => {
        music = document.getElementById('button-music');
        document.addEventListener('undangan.open', () => {
            music.style.display = 'block';
        });

        const url = music.getAttribute('data-url');
        const mediaSource = new MediaSource();
        audioEl = new Audio(URL.createObjectURL(mediaSource));
        audioEl.loop = true;
        audioEl.autoplay = false;
        audioEl.controls = false;

        const context = new AudioContext();
        const source = context.createMediaElementSource(audioEl);
        source.connect(context.destination);

        mediaSource.addEventListener('sourceopen', async () => {
            const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
            const res = await request(HTTP_GET, url).default();
            const reader = res.body.getReader();

            const push = () => reader.read().then(({ value, done }) => {
                if (done) {
                    mediaSource.endOfStream();
                    return;
                }

                sourceBuffer.addEventListener('updateend', push, { once: true });
                sourceBuffer.appendBuffer(value.buffer);
            });

            push();
        });

        music.addEventListener('offline', pause);
        music.addEventListener('click', () => isPlay ? pause() : play());
    };

    return {
        init,
        play,
    };
})();