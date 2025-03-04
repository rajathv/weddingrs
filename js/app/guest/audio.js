import { request, HTTP_GET } from '../../connection/request.js';

export const audio = (() => {

    let isPlaying = false;
    let pausedTime = 0;
    let playbackStartTime = 0;
    let ttl = 1000 * 60 * 60 * 6;

    /**
     * @type {HTMLElement|null}
     */
    let music = null;

    /**
     * @type {Uint8Array<ArrayBufferLike>[]}
     */
    let chunks = [];

    /**
     * @type {AudioContext|null}
     */
    let audioContext = null;

    /**
     * @type {AudioBufferSourceNode|null}
     */
    let currentSource = null;

    /**
     * @type {AudioBuffer|null}
     */
    let cachedAudioBuffer = null;

    /**
     * @type {string|null}
     */
    let type = null;

    /**
     * @type {string|null}
     */
    let url = null;

    const volume = 1.0;
    const isLooping = true;
    const cacheName = 'audios';
    const exp = 'x-expiration-time';

    const statePlay = '<i class="fa-solid fa-circle-pause spin-button"></i>';
    const statePause = '<i class="fa-solid fa-circle-play"></i>';

    /**
     * @param {AudioBuffer} audioBuffer 
     * @returns {void}
     */
    const playAudio = (audioBuffer) => {
        if (!audioBuffer) {
            isPlaying = false;
            return;
        }

        if (currentSource) {
            currentSource.stop();
            currentSource.disconnect();
            currentSource = null;
        }

        try {
            currentSource = audioContext.createBufferSource();
            currentSource.buffer = audioBuffer;
            currentSource.loop = isLooping;

            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume;

            currentSource.connect(gainNode);
            gainNode.connect(audioContext.destination);

            const now = audioContext.currentTime;

            // Memastikan pausedTime tidak melebihi durasi untuk non-looping audio
            if (!isLooping && pausedTime >= audioBuffer.duration) {
                pausedTime = 0;
            }

            playbackStartTime = now - pausedTime;

            // Handle case where pausedTime is past the duration when loop is enabled
            if (isLooping && pausedTime >= audioBuffer.duration) {
                // Calculate the correct position within the loop
                pausedTime = pausedTime % audioBuffer.duration;
                playbackStartTime = now - pausedTime;
            }

            currentSource.start(0, pausedTime);
            currentSource.onended = () => {
                // Skip handling if we're looping (the browser handles looping automatically)
                // But we still need to track when the source ends due to other reasons (like pause)
                if (isLooping && isPlaying) {
                    return;
                }

                // Only reset if this is the current source (avoid race conditions)
                if (currentSource) {
                    const wasPlaying = isPlaying;
                    isPlaying = false;
                    currentSource = null;

                    // Don't reset pausedTime if stopping manually (pause)
                    if (wasPlaying && pausedTime >= audioBuffer.duration - 0.1) {
                        // Track that we completed naturally
                        pausedTime = 0;
                        playbackStartTime = 0;
                    }
                }
            };
        } catch {
            isPlaying = false;
            currentSource = null;
        }
    };

    /**
     * @returns {Promise<void>}
     */
    const fetchAudio = async () => {
        const cacheHit = await (async () => {
            if (!('caches' in window)) {
                return false;
            }

            const cache = await caches.open(cacheName);
            const response = await cache.match(url);

            if (!response) {
                return false;
            }

            if (Date.now() > parseInt(response.headers.get(exp))) {
                const status = await cache.delete(url);
                if (status) {
                    return false;
                }
            }

            const blob = await response.blob();
            if (blob.size === 0) {
                await cache.delete(url);
                return false;
            }

            chunks = [new Uint8Array(await blob.arrayBuffer())];
            const arrayBuffer = await blob.arrayBuffer();
            cachedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            return true;
        })();

        if (cacheHit) {
            return;
        }

        chunks = [];
        let totalLength = 0;
        const response = await request(HTTP_GET, url).default();
        const reader = response.body.getReader();

        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                if (totalLength === 0) {
                    isPlaying = false;
                    return;
                }

                const cachedBlob = new Blob(chunks, { type });
                const arrayBuffer = await cachedBlob.arrayBuffer();
                cachedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                if ('caches' in window) {
                    const headers = new Headers();
                    headers.append('Content-Type', type);
                    headers.append('Content-Length', String(totalLength));
                    headers.set(exp, String(Date.now() + ttl));

                    const cache = await caches.open(cacheName);
                    await cache.put(url, new Response(cachedBlob, { headers }));
                }

                return;
            }

            chunks.push(value);
            totalLength += value.length;

            // Only decode if we're playing and don't have a source yet
            if (isPlaying && !currentSource && !cachedAudioBuffer && totalLength > 50000) {
                const audioBlob = new Blob(chunks, { type });
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                if (isPlaying) {
                    playAudio(audioBuffer);
                }
            }
        }
    };

    /**
     * @returns {Promise<void>}
     */
    const play = async () => {
        if (!navigator.onLine) {
            return;
        }

        music.disabled = true;
        await (async () => {
            if (isPlaying) {
                return;
            }

            if (audioContext?.state === 'suspended') {
                await audioContext.resume();
            }

            isPlaying = true;

            if (cachedAudioBuffer) {
                playAudio(cachedAudioBuffer);
                return;
            }

            if (chunks.length > 0) {
                const audioBlob = new Blob(chunks, { type });
                const arrayBuffer = await audioBlob.arrayBuffer();
                cachedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                playAudio(cachedAudioBuffer);
                return;
            }

            await fetchAudio();
            if (cachedAudioBuffer) {
                playAudio(cachedAudioBuffer);
                return;
            }

            isPlaying = false;
        })();

        music.disabled = false;
        music.innerHTML = statePlay;
    };

    /**
     * @returns {boolean}
     */
    const pause = () => {
        if (!isPlaying || !currentSource || !navigator.onLine) {
            return false;
        }

        const now = audioContext.currentTime;
        pausedTime = now - playbackStartTime;

        // Handle case where pausedTime exceeds duration (can happen with looping)
        if (cachedAudioBuffer) {
            // For looping audio, we want to preserve the exact position even past duration
            if (isLooping) {
                pausedTime = pausedTime % cachedAudioBuffer.duration;
            }
            // For non-looping, don't exceed duration
            else if (pausedTime > cachedAudioBuffer.duration) {
                pausedTime = cachedAudioBuffer.duration;
            }
        }

        currentSource.stop();
        currentSource.disconnect();
        currentSource = null;
        isPlaying = false;

        music.innerHTML = statePause;
        return true;
    };

    /**
     * @returns {void}
     */
    const init = () => {
        audioContext = new AudioContext();
        music = document.getElementById('button-music');
        music.addEventListener('offline', pause);
        music.addEventListener('click', () => isPlaying ? pause() : play());

        type = 'audio/mpeg';
        url = music.getAttribute('data-url');

        document.addEventListener('undangan.open', () => {
            music.style.display = 'block';
        });
    };

    return {
        init,
        play,
    };
})();