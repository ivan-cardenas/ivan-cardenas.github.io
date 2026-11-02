// Presenter keys and the demo video. Scrolling still works; main.js stays as it is on the landing page.
(function () {
    // Share of a section to stop at: each stage's layers are fully shown before its panel fades at 0.58.
    const READ_POINT = 0.55;
    const stages = [...document.querySelectorAll('.stage')];
    const demo = document.getElementById('demo');
    const video = document.getElementById('demo-video');
    const empty = document.getElementById('video-empty');
    const frame = document.getElementById('video-frame');
    const input = document.getElementById('video-file');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;

    function stops() {
        const tops = stages.map(pageTop);
        const points = tops.map((top, i) => {
            if (i === 0 || i === tops.length - 1) return top;
            return top + READ_POINT * (tops[i + 1] - top);
        });
        points.push(pageTop(demo));
        return points;
    }

    function step(direction) {
        const y = window.scrollY;
        const points = stops();
        const target = direction > 0
            ? points.find((p) => p > y + 4)
            : points.filter((p) => p < y - 4).pop();
        if (target !== undefined) window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    }

    addEventListener('keydown', (event) => {
        if (event.target.closest?.('video, input, a, label')) return;
        if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
            event.preventDefault();
            step(1);
        } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
            event.preventDefault();
            step(-1);
        }
    });

    function load(file) {
        if (!file || !file.type.startsWith('video/')) return;
        if (video.src) URL.revokeObjectURL(video.src);
        video.src = URL.createObjectURL(file);
        video.hidden = false;
        empty.hidden = true;
    }

    input.addEventListener('change', () => load(input.files[0]));
    frame.addEventListener('dragover', (event) => { event.preventDefault(); frame.classList.add('is-over'); });
    frame.addEventListener('dragleave', () => frame.classList.remove('is-over'));
    frame.addEventListener('drop', (event) => {
        event.preventDefault();
        frame.classList.remove('is-over');
        load(event.dataTransfer.files[0]);
    });

    new IntersectionObserver(([entry]) => {
        if (!video.src) return;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
    }, { threshold: 0.8 }).observe(demo);
})();
