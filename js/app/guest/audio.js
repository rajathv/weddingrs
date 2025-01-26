export const audio = (() => {

    /**
     * @type {HTMLElement|null}
     */
    let music = null;

    /**
     * @type {HTMLAudioElement|null}
     */
    let audio = null;

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
            await audio.play();
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
        audio.pause();
        music.innerHTML = statePause;
    };

    /**
     * @returns {void}
     */
    const init = () => {
        music = document.getElementById('button-music');
        music.style.display = 'block';

        audio = new Audio(music.getAttribute('data-url'));
        audio.volume = 1;
        audio.loop = true;
        audio.muted = false;
        audio.currentTime = 0;
        audio.autoplay = false;
        audio.controls = false;

        audio.addEventListener('canplay', play);
        music.addEventListener('offline', pause);
        music.addEventListener('click', () => isPlay ? pause() : play());
    };

    return {
        init,
    };
})();