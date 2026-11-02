// Renderer, camera, lights and the render loop. Draws only when something changed or
// while the hero's idle rotation runs; pauses when the tab is hidden or the canvas is off-screen.
import * as THREE from 'three';
import { buildCity } from './city.js';
import { buildPlan } from './plan.js';
import { cameraAt, cameraPosition, layersAt } from './stages.js';

const BACKGROUND = '#080808';
const IDLE_SPEED = 0.035;     // rad/s, before the scroll takes over
const IDLE_MAX_U = 0.002;
const DPR_CAP = { 2: 2, 1: 1.5, 0: 1 };
const SHADOW_SIZE = { 2: 2048, 1: 1024 };
const SLOW_FRAME_MS = 1000 / 30;
const SAMPLE_FRAMES = 45;

export function startingTier(gl) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software/i.test(renderer)) return 0;
    const fewCores = (navigator.hardwareConcurrency || 8) <= 4;
    const lowMemory = (navigator.deviceMemory || 8) <= 4;
    if (fewCores && lowMemory) return 0;
    const phone = matchMedia('(pointer: coarse)').matches;
    return phone || fewCores || lowMemory ? 1 : 2;
}

const wrapAngle = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

export function createLanding(canvas, { tier, reduced, onFrame, onContextLost }) {
    let quality = tier;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality > 0, powerPreference: 'high-performance' });
    renderer.setClearColor(BACKGROUND);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // the light is fixed to the city: only redraw when geometry moves

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);
    scene.fog = new THREE.Fog(BACKGROUND, 500, 1500);
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 9000);

    const plan = buildPlan();
    const city = buildCity(plan, quality);
    scene.add(city.root);
    const editTarget = [plan.edit.x, 6, plan.edit.z];

    scene.add(new THREE.HemisphereLight('#cfe0ea', '#2a2622', 1.5));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.8);
    sun.position.set(-plan.radius * 1.1, plan.radius * 2, plan.radius * 0.8);
    const reach = plan.radius * 1.12;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 50, far: plan.radius * 6 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.7;
    scene.add(sun);

    let width = 1;
    let height = 1;
    let u = 0;
    let idle = 0;
    let dirty = true;
    let paused = false;
    let raf = 0;
    let lastTime = 0;
    let samples = [];
    let shadowDirty = true;

    function applyTier() {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP[quality]));
        renderer.setSize(width, height, false);
        sun.castShadow = quality > 0;
        if (quality > 0) {
            sun.shadow.mapSize.setScalar(SHADOW_SIZE[quality]);
            if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        }
        city.setTier(quality);
        shadowDirty = true;
        document.documentElement.dataset.tier = String(quality);
    }

    function draw() {
        const aspect = width / height;
        const cam = cameraAt(u, aspect, editTarget);
        const idleOffset = idle * (1 - Math.min(1, u / 0.62));
        const [x, y, z] = cameraPosition(cam, idleOffset);
        camera.aspect = aspect;
        camera.position.set(x, y, z);
        camera.lookAt(cam.t[0], cam.t[1], cam.t[2]);
        camera.setViewOffset(width, height, -cam.ox * width, cam.oy * height, width, height);
        scene.fog.near = cam.r * 0.92;
        scene.fog.far = cam.r * 2.3;

        if (city.update(layersAt(u))) shadowDirty = true;
        if (shadowDirty && quality > 0) {
            renderer.shadowMap.needsUpdate = true;
            shadowDirty = false;
        }
        renderer.render(scene, camera);
        onFrame?.(cam.az + idleOffset);
    }

    const idling = () => !reduced && u < IDLE_MAX_U;

    function watchFrameRate(dt) {
        if (quality === 0 || dt > 250) { samples = []; return; }
        samples.push(dt);
        if (samples.length < SAMPLE_FRAMES) return;
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        samples = [];
        if (mean > SLOW_FRAME_MS) {
            quality -= 1;
            applyTier();
        }
    }

    function frame(now) {
        raf = 0;
        if (paused) return;
        const dt = lastTime ? now - lastTime : 0;
        lastTime = now;
        const isIdle = idling();
        if (isIdle) idle = wrapAngle(idle + (Math.min(dt, 100) / 1000) * IDLE_SPEED);
        if (dirty || isIdle) {
            dirty = false;
            draw();
            if (dt) watchFrameRate(dt);
            schedule();
        } else {
            lastTime = 0;
        }
    }

    function schedule() {
        if (!raf && !paused) raf = requestAnimationFrame(frame);
    }

    function invalidate() {
        dirty = true;
        schedule();
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        width = rect.width;
        height = rect.height;
        camera.aspect = width / height;
        renderer.setSize(width, height, false);
        invalidate();
    }

    function setPaused(value) {
        paused = value;
        if (paused) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
        lastTime = 0;
        samples = [];
        if (!paused) invalidate();
    }

    let offScreen = false;
    const syncPaused = () => setPaused(document.hidden || offScreen);
    document.addEventListener('visibilitychange', syncPaused);
    const onScreen = new IntersectionObserver((entries) => {
        offScreen = !entries[0].isIntersecting;
        syncPaused();
    });
    onScreen.observe(canvas);
    const sized = new ResizeObserver(resize);
    sized.observe(canvas);
    const onLost = (event) => {
        event.preventDefault();
        onContextLost?.();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    // Reduced motion: draw the current view onto a 2D copy, switch, fade the copy out.
    function crossfadeTo(next, overlay) {
        draw();
        const ctx = overlay.getContext('2d');
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        ctx.drawImage(canvas, 0, 0);
        overlay.style.transition = 'none';
        overlay.style.opacity = '1';
        u = next;
        draw();
        overlay.getBoundingClientRect();
        overlay.style.transition = '';
        overlay.style.opacity = '0';
    }

    function dispose() {
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', syncPaused);
        canvas.removeEventListener('webglcontextlost', onLost);
        onScreen.disconnect();
        sized.disconnect();
        scene.traverse((obj) => {
            obj.geometry?.dispose();
            for (const material of [obj.material].flat()) {
                if (!material) continue;
                material.map?.dispose();
                Object.values(material.uniforms || {}).forEach((uniform) => uniform.value?.isTexture && uniform.value.dispose());
                material.dispose();
            }
            if (obj.isInstancedMesh) obj.dispose();
        });
        renderer.dispose();
    }

    applyTier();
    resize();
    return {
        setU(next) { if (next !== u) { u = next; invalidate(); } },
        invalidate,
        crossfadeTo,
        dispose,
    };
}
