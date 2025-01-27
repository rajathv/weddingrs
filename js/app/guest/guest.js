import { image } from './image.js';
import { audio } from './audio.js';
import { progress } from './progress.js';
import { util } from '../../common/util.js';
import { bs } from '../../libs/bootstrap.js';
import { theme } from '../../common/theme.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { offline } from '../../common/offline.js';
import { comment } from '../component/comment.js';
import { basicAnimation, openAnimation } from '../../libs/confetti.js';

export const guest = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let information = null;

    /**
     * @returns {void}
     */
    const countDownDate = () => {
        const until = document.getElementById('count-down')?.getAttribute('data-time')?.replace(' ', 'T');
        if (!until) {
            return;
        }

        const count = (new Date(until)).getTime();

        setInterval(() => {
            const distance = Math.abs(count - Date.now());

            document.getElementById('day').innerText = Math.floor(distance / (1000 * 60 * 60 * 24));
            document.getElementById('hour').innerText = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            document.getElementById('minute').innerText = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            document.getElementById('second').innerText = Math.floor((distance % (1000 * 60)) / 1000);
        }, 1000);
    };

    /**
     * @param {string} id
     * @param {number} speed
     * @returns {void}
     */
    const opacity = (id, speed = 0.01) => {
        const el = document.getElementById(id);
        let op = parseFloat(el.style.opacity);

        let clear = null;
        const callback = () => {
            if (op > 0) {
                el.style.opacity = op.toFixed(3);
                op -= speed;
                return;
            }

            clearInterval(clear);
            clear = null;
            el.remove();
        };

        clear = setInterval(callback, 10);
    };

    /**
     * @returns {void}
     */
    const showGuestName = () => {
        /**
         * Make sure "to=" is the last query string.
         * Ex. domain.my.id/?id=some-uuid-here&to=name
         */
        const raw = window.location.search.split('to=');
        let name = null;

        if (raw.length > 1 && raw[1].length > 0) {
            name = window.decodeURIComponent(raw[1]);
        }

        if (name) {
            const guest = document.getElementById('guest-name');
            const div = document.createElement('div');
            div.classList.add('m-2');
            div.innerHTML = `
                <p class="mt-0 mb-1 mx-0 p-0" style="font-size: 0.95rem;">${guest?.getAttribute('data-message')}</p>
                <h2 class="m-0 p-0">${util.escapeHtml(name)}</h2>
            `;

            guest?.appendChild(div);
        }

        const form = document.getElementById('form-name');
        if (form) {
            form.value = information.get('name') ?? name;
        }

        // remove loading screen
        opacity('loading', 0.025);
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const open = (button) => {
        button.disabled = true;
        document.body.style.overflowY = 'scroll';

        if (theme.isAutoMode()) {
            document.getElementById('button-theme').style.display = 'block';
        }

        basicAnimation();
        opacity('welcome', 0.025);

        audio.init();
        theme.spyTop();

        util.timeOut(openAnimation, 1500);
    };

    /**
     * @param {HTMLImageElement} img
     * @returns {void}
     */
    const modal = (img) => {
        document.getElementById('show-modal-image').src = img.src;
        bs.modal('modal-image').show();
    };

    /**
     * @returns {void}
     */
    const closeInformation = () => information.set('info', true);

    /**
     * @returns {void}
     */
    const normalizeArabicFont = () => {
        document.querySelectorAll('.font-arabic').forEach((el) => {
            el.innerHTML = String(el.innerHTML).normalize('NFC');
        });
    };

    /**
     * @returns {void}
     */
    const animateSvg = () => {
        document.querySelectorAll('svg').forEach((el) => {
            util.timeOut(() => el.classList.add(el.getAttribute('data-class')), parseInt(el.getAttribute('data-time')));
        });
    };

    /**
     * @returns {void}
     */
    const booting = () => {
        animateSvg();
        countDownDate();
        normalizeArabicFont();
        document.getElementById('root').style.opacity = '1';

        if (information.has('presence')) {
            document.getElementById('form-presence').value = information.get('presence') ? '1' : '2';
        }

        if (information.get('info')) {
            document.getElementById('information')?.remove();
        }
    };

    /**
     * @returns {void}
     */
    const domLoaded = () => {
        offline.init();
        progress.init();
        information = storage('information');

        if (session.isAdmin()) {
            storage('user').clear();
            storage('owns').clear();
            storage('likes').clear();
            storage('session').clear();
            storage('comment').clear();
            storage('tracker').clear();
        }

        document.addEventListener('progress.done', () => {
            document.body.scrollIntoView({ behavior: 'instant' });
            window.AOS.init();
            booting();

            // then show guest name.
            showGuestName();
        });

        document.addEventListener('hide.bs.modal', () => {
            if (document.activeElement) {
                document.activeElement.blur();
            }
        });

        const token = document.body.getAttribute('data-key');
        if (!token || token.length === 0) {
            image.init().load();
            document.getElementById('comment')?.remove();
            document.querySelector('a.nav-link[href="#comment"]')?.closest('li.nav-item')?.remove();
        }

        if (token.length > 0) {
            // add 2 progress for config and comment.
            // before load image.
            progress.add();
            progress.add();

            const img = image.init();
            if (!img.hasDataSrc()) {
                img.load();
            }

            // fetch after document is loaded.
            window.addEventListener('load', () => {
                const params = new URLSearchParams(window.location.search);

                session.setToken(params.get('k') ?? token);
                session.guest().then((res) => {
                    if (res.code !== 200) {
                        progress.invalid('config');
                        return;
                    }

                    progress.complete('config');
                    if (img.hasDataSrc()) {
                        img.load();
                    }

                    comment.init();
                    comment.comment()
                        .then(() => progress.complete('comment'))
                        .catch(() => progress.invalid('comment'));
                }).catch(() => progress.invalid('config'));
            });
        }
    };

    /**
     * @returns {object}
     */
    const init = () => {
        theme.init();
        session.init();
        window.addEventListener('DOMContentLoaded', domLoaded);

        return {
            util,
            theme,
            comment,
            guest: {
                open,
                modal,
                closeInformation,
            },
        };
    };

    return {
        init,
    };
})();