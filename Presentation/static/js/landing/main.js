// Landing page wiring: scroll position -> u -> text panels, rail and (if WebGL is there) the scene.
// The text is all in the HTML. This file is small on purpose: Three.js and GSAP load only once
// the page is on screen, and not at all without WebGL.
import { activeStage, LAST_STAGE, layersAt, panelOpacity, REST } from './stages.js';

const GSAP_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js';
const SCROLLTRIGGER_URL = 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stages = [...document.querySelectorAll('.stage')];
const panels = stages.map((stage) => stage.querySelector('.panel'));
const railLinks = [...document.querySelectorAll('.rail a')];
const hudFigure = document.querySelector('[data-hud-figure]');
const hudHeading = document.querySelector('[data-hud-heading]');
const slider = document.querySelector('[data-slider]');
const effects = [...document.querySelectorAll('[data-effect]')];

let tops = [];
let current = -1;
let liveScene = null;

function measure() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    tops = stages.map((stage) => Math.min(max, stage.getBoundingClientRect().top + window.scrollY));
}

function uFromScroll(y) {
    for (let i = LAST_STAGE - 1; i >= 0; i--) {
        if (y >= tops[i]) return Math.min(LAST_STAGE, i + (y - tops[i]) / (tops[i + 1] - tops[i] || 1));
    }
    return 0;
}

function renderDom(u) {
    const active = activeStage(u);
    if (active !== current) {
        current = active;
        railLinks.forEach((link, i) => {
            if (i === active) link.setAttribute('aria-current', 'step');
            else link.removeAttribute('aria-current');
        });
        if (hudFigure) hudFigure.textContent = stages[active].dataset.figure;
    }
    if (root.dataset.scene === 'live' && !reduced) {
        panels.forEach((panel, i) => {
            const opacity = panelOpacity(i, u);
            panel.style.opacity = opacity.toFixed(3);
            panel.classList.toggle('is-faded', opacity < 0.05);
        });
    }
    const L = layersAt(reduced ? active + REST : u);
    slider?.style.setProperty('--value', L.slider.toFixed(3));
    const lit = { patch: L.patch > 0.5, dsm: L.ripple > 0.4, stale: L.ripple > 0.8 };
    effects.forEach((el) => el.classList.toggle('is-on', lit[el.dataset.effect]));
}

function onHeading(az) {
    if (!hudHeading) return;
    const degrees = ((az * 180) / Math.PI) % 360;
    hudHeading.textContent = `${String(Math.round((degrees + 360) % 360)).padStart(3, '0')}°`;
}

function wireRail() {
    railLinks.forEach((link, i) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            measure();
            window.scrollTo({ top: tops[i], behavior: reduced ? 'auto' : 'smooth' });
            history.replaceState(null, '', link.getAttribute('href'));
            stages[i].querySelector('h1, h2')?.focus({ preventScroll: true });
        });
    });
    document.querySelector('[data-see-how]')?.addEventListener('click', (event) => {
        event.preventDefault();
        railLinks[1].click();
    });
}

// Without the scene (no WebGL, or until it has loaded) a plain scroll listener keeps the rail right.
function followScrollPlainly(onU) {
    let queued = false;
    const update = () => {
        queued = false;
        const u = uFromScroll(window.scrollY);
        renderDom(u);
        onU?.(u);
    };
    const request = () => {
        if (!queued) {
            queued = true;
            requestAnimationFrame(update);
        }
    };
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', () => { measure(); request(); });
    update();
}

function followScrollWithGsap(gsap, ScrollTrigger, onU) {
    gsap.registerPlugin(ScrollTrigger);
    // One master timeline, scrubbed by the scroll. It only moves `p`; all state derives from it.
    const driver = { p: 0 };
    const push = () => {
        const u = uFromScroll(driver.p * (document.documentElement.scrollHeight - window.innerHeight));
        renderDom(u);
        onU(u);
    };
    const master = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
            trigger: document.documentElement,
            start: 0,
            end: 'max',
            scrub: 0.5,
        },
    });
    master.to(driver, { p: 1, duration: 1, onUpdate: push });
    ScrollTrigger.addEventListener('refreshInit', measure);
    ScrollTrigger.addEventListener('refresh', push);
    ScrollTrigger.refresh();
    // After a reload start where the page is, not with a scrub from the top.
    master.progress(master.scrollTrigger.progress).pause();
    driver.p = master.scrollTrigger.progress;
    push();
}

// GSAP's dist files are UMD and set window.gsap; as ES modules they throw in strict mode.
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.append(script);
    });
}

async function waitForFont() {
    const timeout = new Promise((resolve) => { setTimeout(resolve, 1500); });
    try {
        await Promise.race([document.fonts.load('500 40px "IBM Plex Mono"'), timeout]);
    } catch { /* the labels fall back to any monospace */ }
}

function fallBack() {
    root.dataset.scene = 'none';
    panels.forEach((panel) => { panel.style.opacity = ''; panel.classList.remove('is-faded'); });
    measure();
}

function webglContext() {
    try {
        return document.createElement('canvas').getContext('webgl2');
    } catch {
        return null;
    }
}

async function startScene(gl) {
    const canvas = document.getElementById('city-canvas');
    const loader = document.getElementById('landing-loader');
    loader.hidden = false;
    try {
        const pending = [import('./scene.js'), waitForFont()];
        const [{ createLanding, startingTier }] = await Promise.all(pending);
        if (!reduced) {
            await loadScript(GSAP_URL);
            await loadScript(SCROLLTRIGGER_URL);
        }
        canvas.hidden = false;
        const landing = createLanding(canvas, {
            tier: startingTier(gl),
            reduced,
            onFrame: onHeading,
            onContextLost: () => { landing?.dispose(); fallBack(); },
        });
        liveScene = landing;
        root.dataset.scene = 'live';
        measure();
        if (reduced) {
            const overlay = document.getElementById('city-fade');
            let shown = activeStage(uFromScroll(window.scrollY));
            landing.setU(Math.min(LAST_STAGE, shown + REST));
            followScrollPlainly((u) => {
                const stage = activeStage(u);
                if (stage !== shown) {
                    shown = stage;
                    landing.crossfadeTo(Math.min(LAST_STAGE, stage + REST), overlay);
                }
            });
        } else {
            followScrollWithGsap(window.gsap, window.ScrollTrigger, landing.setU);
        }
    } catch (error) {
        console.warn('CrossTwin landing: scene not started', error);
        canvas.hidden = true;
        fallBack();
        followScrollPlainly();
    } finally {
        loader.hidden = true;
    }
}

addEventListener('pagehide', (event) => {
    if (!event.persisted && liveScene) {
        liveScene.dispose();
        liveScene = null;
    }
});
addEventListener('pageshow', (event) => {
    if (event.persisted && !liveScene && root.dataset.scene === 'live') location.reload();
});

measure();
wireRail();
const gl = webglContext();
if (gl) {
    renderDom(uFromScroll(window.scrollY));
    if (document.readyState === 'complete') startScene(gl);
    else addEventListener('load', () => startScene(gl), { once: true });
} else {
    fallBack();
    followScrollPlainly();
}
