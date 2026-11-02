// Everything the page shows is a pure function of `u`, the scroll position in stage
// coordinates: u = 3.5 is halfway through section 3. That makes scrolling back an exact
// reverse and a reload at any position correct. No Three.js, no DOM, no clock.

export const LAST_STAGE = 8;
export const HOLD_END = 0.62;    // within a section: reading time until here, then the move
const MOVE_END = 0.96;
const REST_SHARE = 0.12;         // share of a section's rotation spent during the reading time
export const REST = HOLD_END - 0.04; // reduced motion: the static view of a stage

// Camera per stage: r = distance, el = elevation (deg), t = target,
// ox = horizontal shift of the view as a fraction of its width, away from the text panel.
const CAMERAS = [
    { r: 860, el: 28, t: [0, 8, 0], ox: 0.16 },       // hero: three-quarter view
    { r: 900, el: 66, t: [0, 0, 0], ox: -0.17 },      // foundation: overhead
    { r: 1120, el: 12, t: [0, 105, 0], ox: 0.17 },      // causal network: low and wide
    { r: 560, el: 44, t: [-40, 0, -10], ox: -0.17 },  // water: close
    { r: 340, el: 30, t: [20, 0, -20], ox: 0.17 },    // heat: close
    { r: 880, el: 36, t: [0, 0, 0], ox: -0.15 },      // housing
    { r: 820, el: 58, t: [0, 0, 0], ox: 0.17 },       // fabric: overhead
    { r: 240, el: 34, t: 'edit', ox: -0.15 },         // what-if: close-up on the plot
    { r: 1040, el: 22, t: [0, 40, 0], ox: 0.15 },       // closing: the whole city
];

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const ramp = (u, a, b) => smooth((u - a) / (b - a));
export const trap = (u, a, b, c, d) => ramp(u, a, b) * (1 - ramp(u, c, d));
const mix = (a, b, t) => a + (b - a) * t;

// Which stage and how far into the move towards the next one.
export function locate(u) {
    const i = Math.min(LAST_STAGE, Math.floor(u));
    const f = u - i;
    if (i === LAST_STAGE) return { i, next: i, blend: 0 };
    if (f < HOLD_END) return { i, next: i, blend: 0 };
    if (f >= MOVE_END) return { i: i + 1, next: i + 1, blend: 0 };
    return { i, next: i + 1, blend: smooth((f - HOLD_END) / (MOVE_END - HOLD_END)) };
}

// One full turn over the page: slow during reading, fast between stages.
export function rotation(u) {
    const share = (Math.PI * 2) / LAST_STAGE;
    const i = Math.min(LAST_STAGE - 1, Math.floor(u));
    const f = Math.min(1, u - i);
    const inSection = f < HOLD_END
        ? REST_SHARE * (f / HOLD_END)
        : REST_SHARE + (1 - REST_SHARE) * smooth((f - HOLD_END) / (1 - HOLD_END));
    return -0.6 + share * (i + inSection);
}

// How much the camera backs off so the disc still fits a narrow (portrait) view.
const fitFactor = (aspect) => Math.max(1, 1 / aspect);

export function cameraAt(u, aspect, editTarget) {
    const { i, next, blend } = locate(u);
    const a = CAMERAS[i];
    const b = CAMERAS[next];
    const target = (c) => (c.t === 'edit' ? editTarget : c.t);
    const [ta, tb] = [target(a), target(b)];
    const fit = fitFactor(aspect);
    const portrait = aspect < 0.9;
    return {
        r: mix(a.r, b.r, blend) * fit,
        el: (mix(a.el, b.el, blend) * Math.PI) / 180,
        t: [0, 1, 2].map((k) => mix(ta[k], tb[k], blend)),
        ox: portrait ? 0 : mix(a.ox, b.ox, blend),
        oy: portrait ? 0.2 : 0,
        az: rotation(u),
    };
}

export function cameraPosition(cam, extraAz = 0) {
    const az = cam.az + extraAz;
    const flat = cam.r * Math.cos(cam.el);
    return [cam.t[0] + flat * Math.sin(az), cam.t[1] + cam.r * Math.sin(cam.el), cam.t[2] + flat * Math.cos(az)];
}

export function layersAt(u) {
    const water = trap(u, 2.66, 3.05, 3.62, 3.96);
    const network = trap(u, 1.62, 2.2, 2.62, 2.92);
    const types = trap(u, 5.62, 6.0, 6.62, 6.94);
    const settle = ramp(u, 7.62, 7.96);
    return {
        wire: 1 - 0.94 * ramp(u, 0.9, 2.05),
        solid: ramp(u, 1.3, 2.05),
        trees: ramp(u, 1.55, 2.15),
        terrain: ramp(u, 0.62, 1.05) * (1 - 0.86 * water),
        buildingAlpha: 1 - 0.88 * water,
        boundaries: trap(u, 0.66, 1.35, 1.62, 1.95) + settle * 0.3,
        network: network + settle * 0.16,
        netLabels: network,
        netGrow: ramp(u, 1.62, 2.2),
        chain: ramp(u, 2.08, 2.6),
        dim: network * 0.5,
        pipes: water,
        flow: u - 2.66,
        heat: trap(u, 3.62, 4.12, 4.62, 4.94) + settle * 0.1,
        heatSpread: ramp(u, 3.62, 4.2),
        cool: Math.max(ramp(u, 4.12, 4.55), settle),
        homes: ramp(u, 4.72, 5.6),
        homesTint: 1 - ramp(u, 5.62, 5.95),
        slider: ramp(u, 4.85, 5.6),
        types,
        green: types,
        buildingDrop: ramp(u, 6.68, 7.12),
        patch: ramp(u, 7.1, 7.28),
        ripple: ramp(u, 7.1, 7.62),
        rippleOn: trap(u, 7.08, 7.14, 7.62, 7.72),
    };
}

// Opacity of a stage's text panel; its position comes from CSS (position: sticky).
export function panelOpacity(i, u) {
    const fadeIn = i === 0 ? 1 : ramp(u, i - 0.26, i - 0.06);
    const fadeOut = i === LAST_STAGE ? 0 : ramp(u, i + 0.58, i + 0.7);
    return fadeIn * (1 - fadeOut);
}

// The stage to mark as current: changes halfway through each move.
export const activeStage = (u) => Math.min(LAST_STAGE, Math.floor(u + 1 - (HOLD_END + MOVE_END) / 2));
