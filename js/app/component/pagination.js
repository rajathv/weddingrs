import { util } from '../../common/util.js';

export const pagination = (() => {

    let perPage = 10;
    let pageNow = 0;
    let totalData = 0;

    /**
     * @type {HTMLElement|null}
     */
    let page = null;

    /**
     * @type {HTMLElement|null}
     */
    let liPrev = null;

    /**
     * @type {HTMLElement|null}
     */
    let liNext = null;

    /**
     * @type {HTMLElement|null}
     */
    let paginate = null;

    /**
     * @type {HTMLElement|null}
     */
    let comment = null;

    /**
     * @param {number} num 
     * @returns {void}
     */
    const setPer = (num) => {
        perPage = Number(num);
    };

    /**
     * @returns {number}
     */
    const getPer = () => perPage;

    /**
     * @returns {number}
     */
    const getNext = () => pageNow;

    /**
     * @returns {void}
     */
    const disabledPrevious = () => !liPrev.classList.contains('disabled') ? liPrev.classList.add('disabled') : null;

    /**
     * @returns {void}
     */
    const enablePrevious = () => liPrev.classList.contains('disabled') ? liPrev.classList.remove('disabled') : null;

    /**
     * @returns {void}
     */
    const disabledNext = () => !liNext.classList.contains('disabled') ? liNext.classList.add('disabled') : null;

    /**
     * @returns {void}
     */
    const enableNext = () => liNext.classList.contains('disabled') ? liNext.classList.remove('disabled') : null;

    /**
     * @returns {void}
     */
    const enablePagination = () => {
        if (paginate.classList.contains('d-none')) {
            paginate.classList.remove('d-none');
        }
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {object}
     */
    const buttonAction = (button) => {
        disabledNext();
        disabledPrevious();

        const btn = util.disableButton(button, util.loader.replace('ms-0 me-1', 'mx-1'), true);

        const process = async () => {
            const result = new Promise((res) => comment.addEventListener('comment.result', res, { once: true }));
            comment.dispatchEvent(new Event('comment.show'));

            await result;

            btn.restore();
            comment.scrollIntoView({ behavior: 'smooth' });
        };

        const next = () => {
            pageNow += perPage;

            button.innerHTML = 'Next' + button.innerHTML;
            process();
        };

        const prev = () => {
            pageNow -= perPage;

            button.innerHTML = button.innerHTML + 'Prev';
            process();
        };

        return {
            next,
            prev,
        };
    };

    /**
     * @returns {boolean}
     */
    const reset = () => {
        if (pageNow === 0) {
            return false;
        }

        pageNow = 0;

        disabledNext();
        disabledPrevious();

        return true;
    };

    /**
     * @param {number} len 
     * @returns {void}
     */
    const setTotal = (len) => {
        totalData = Number(len);
        const current = (pageNow + perPage) / perPage;
        const total = Math.ceil(totalData / perPage);

        page.innerText = `${current} / ${total}`;

        if (pageNow > 0) {
            enablePrevious();
        }

        if (current === total) {
            disabledNext();
            return;
        }

        enableNext();
        enablePagination();
    };

    /**
     * @returns {void}
     */
    const setTotalIncrement = () => {
        totalData += 1;
        setTotal(totalData);
    };

    /**
     * @returns {void}
     */
    const setTotalDecrement = () => {
        totalData -= 1;
        setTotal(totalData);
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {void}
     */
    const previous = (button) => buttonAction(button).prev();

    /**
     * @param {HTMLButtonElement} button 
     * @returns {void}
     */
    const next = (button) => buttonAction(button).next();

    /**
     * @returns {void}
     */
    const init = () => {
        paginate = document.getElementById('pagination');
        paginate.innerHTML = `
        <ul class="pagination mb-2 shadow-sm rounded-4">
            <li class="page-item disabled" id="previous">
                <button class="page-link rounded-start-4" onclick="undangan.comment.pagination.previous(this)" data-offline-disabled="false">
                    <i class="fa-solid fa-circle-left me-1"></i>Prev
                </button>
            </li>
            <li class="page-item disabled">
                <span class="page-link text-theme-auto" id="page"></span>
            </li>
            <li class="page-item" id="next">
                <button class="page-link rounded-end-4" onclick="undangan.comment.pagination.next(this)" data-offline-disabled="false">
                    Next<i class="fa-solid fa-circle-right ms-1"></i>
                </button>
            </li>
        </ul>`;

        comment = document.getElementById('comments');
        page = document.getElementById('page');
        liPrev = document.getElementById('previous');
        liNext = document.getElementById('next');
    };

    return {
        init,
        setPer,
        getPer,
        getNext,
        reset,
        setTotal,
        setTotalDecrement,
        setTotalIncrement,
        previous,
        next,
    };
})();
