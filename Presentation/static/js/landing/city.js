// Turns the plan (plan.js) into Three.js objects, one group per system, and applies the
// layer values of stages.js to them. update() only touches what changed since the last call.
import * as THREE from 'three';
import { CHAIN, EDGES, LEVELS, levelRadius, levelY, NODES, nodePositions } from './graph.js';
import { canalX, mulberry32, SEED } from './plan.js';
import { clamp01, smooth } from './stages.js';

const WIRE = '#7fb6cb';      // light tint of Blueprint Cyanotype, for lines on the dark ground
const CYANOTYPE = '#2E6478';
const BRICK = '#B5674A';
const OCHRE = '#C99A3E';
const HOUSE_COLORS = ['#a9674e', '#8f5240', '#b5674a', '#7a4a3a', '#9a7a66', '#84695a'];
const MIDRISE_COLORS = ['#8d8f8f', '#74787b', '#9a968c'];
const TREE_COLORS = ['#3f6b45', '#4f7a4a', '#35603f'];
const TYPE_COLORS = { residential: '#4f8ba3', commercial: OCHRE, mixed: BRICK, institutional: '#e7e2d6' };
const HEAT_STOPS = [[0, '#2E6478'], [0.42, '#C99A3E'], [0.72, '#B5674A'], [1, '#8f2f1f']];
const MAX_TREES = { 2: 1, 1: 0.6, 0: 0.35 };
const MAX_PULSES = { 2: 140, 1: 110, 0: 56 };
const TEXTURE_SIZE = { 2: 1024, 1: 1024, 0: 512 };

const srgb = (hex) => new THREE.Color(hex);

function geometryFrom(triangles, shades) {
    const positions = new Float32Array(triangles.flat(2));
    const colors = new Float32Array(positions.length);
    shades.forEach((shade, tri) => {
        for (let v = 0; v < 9; v++) colors[tri * 9 + v] = shade;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
}

// A unit gabled house: 1 x 1 x 1, standing on y = 0, gables facing +z and -z.
function houseGeometry() {
    const e = 0.66;
    const [a, b, c, d] = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];
    const tris = [];
    const shades = [];
    const quad = (p, q, r, s, shade) => {
        tris.push([p, q, r], [p, r, s]);
        shades.push(shade, shade);
    };
    const wall = (u, v) => quad([u[0], 0, u[1]], [v[0], 0, v[1]], [v[0], e, v[1]], [u[0], e, u[1]], 1);
    wall(a, b); wall(b, c); wall(c, d); wall(d, a);
    tris.push([[-0.5, e, 0.5], [0.5, e, 0.5], [0, 1, 0.5]], [[0.5, e, -0.5], [-0.5, e, -0.5], [0, 1, -0.5]]);
    shades.push(1, 1);
    quad([0.5, e, 0.5], [0.5, e, -0.5], [0, 1, -0.5], [0, 1, 0.5], 0.42);
    quad([-0.5, e, -0.5], [-0.5, e, 0.5], [0, 1, 0.5], [0, 1, -0.5], 0.42);
    return geometryFrom(tris, shades);
}

function merge(geometries) {
    const parts = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
    const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
    const position = new Float32Array(total * 3);
    const normal = new Float32Array(total * 3);
    const color = parts[0].attributes.color ? new Float32Array(total * 3) : null;
    let at = 0;
    for (const g of parts) {
        position.set(g.attributes.position.array, at * 3);
        normal.set(g.attributes.normal.array, at * 3);
        if (color) color.set(g.attributes.color.array, at * 3);
        at += g.attributes.position.count;
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    if (color) merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
    return merged;
}

function tinted(geometry, shade) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const colors = new Float32Array(g.attributes.position.count * 3).fill(shade);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
}

function treeGeometry() {
    const trunk = tinted(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 5).translate(0, 0.2, 0), 0.42);
    const crown = tinted(new THREE.IcosahedronGeometry(0.34, 0).translate(0, 0.62, 0), 1);
    return merge([trunk, crown]);
}

function polylineSegments(lines, y) {
    const out = [];
    for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
            out.push(line[i - 1][0], y, line[i - 1][1], line[i][0], y, line[i][1]);
        }
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
}

function paintLandCover(plan, size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const k = size / (plan.radius * 2);
    const px = (v) => (v + plan.radius) * k;
    ctx.fillStyle = '#39462f';
    ctx.fillRect(0, 0, size, size);
    const { x: bx, z: bz } = plan.block;
    const fills = { park: '#46683c', edit: '#4f7040', vacant: '#5a5645', rows: '#3a3834', midrise: '#403e3b' };
    for (const c of plan.cells) {
        ctx.fillStyle = fills[c.kind];
        ctx.fillRect(px(c.x - bx / 2), px(c.z - bz / 2), bx * k, bz * k);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

// Illustrative temperature field: warm over the built area and streets, cool around
// parks, trees and water. Painted once; `read` samples it for the roofs.
function paintHeatField(plan, size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const k = size / (plan.radius * 2);
    const px = (v) => (v + plan.radius) * k;
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    const half = plan.block.street * 1.2;
    for (const s of plan.streets) {
        if (s.z0 === s.z1) ctx.fillRect(px(s.x0), px(s.z0 - half), (s.x1 - s.x0) * k, half * 2 * k);
        else ctx.fillRect(px(s.x0 - half), px(s.z0), half * 2 * k, (s.z1 - s.z0) * k);
    }
    ctx.filter = `blur(${Math.round(size / 256)}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    const coolSpot = (x, z, r, strength) => {
        const g = ctx.createRadialGradient(px(x), px(z), 0, px(x), px(z), r * k);
        g.addColorStop(0, `rgba(0,0,0,${strength})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px(x - r), px(z - r), r * 2 * k, r * 2 * k);
    };
    for (const c of plan.cells) if (c.kind === 'park') coolSpot(c.x, c.z, 56, 0.85);
    for (const t of plan.trees) coolSpot(t.x, t.z, 15, 0.3);
    for (let z = -plan.radius; z < plan.radius; z += 10) coolSpot(canalX(z), z, 26, 0.34);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const read = (x, z) => {
        const ix = Math.min(size - 1, Math.max(0, Math.round(px(x))));
        const iz = Math.min(size - 1, Math.max(0, Math.round(px(z))));
        return pixels[(iz * size + ix) * 4] / 255;
    };
    return { texture: new THREE.CanvasTexture(canvas), read };
}

function heatColor(v, out) {
    let i = 0;
    while (i < HEAT_STOPS.length - 2 && v > HEAT_STOPS[i + 1][0]) i++;
    const [a, ca] = HEAT_STOPS[i];
    const [b, cb] = HEAT_STOPS[i + 1];
    return out.copy(srgb(ca)).lerp(srgb(cb), clamp01((v - a) / (b - a)));
}

function heatMaterial(field) {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            uField: { value: field },
            uOpacity: { value: 0 },
            uSpread: { value: 0 },
            uCool: { value: 0 },
            uStops: { value: HEAT_STOPS.map(([, c]) => srgb(c)) },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            varying vec2 vUv;
            uniform sampler2D uField;
            uniform float uOpacity, uSpread, uCool;
            uniform vec3 uStops[4];
            void main() {
                float field = texture2D(uField, vUv).r;
                float v = mix(0.74 + (field - 0.66) * 0.5, field, uCool);
                vec3 color = v < 0.42 ? mix(uStops[0], uStops[1], v / 0.42)
                    : v < 0.72 ? mix(uStops[1], uStops[2], (v - 0.42) / 0.3)
                    : mix(uStops[2], uStops[3], (v - 0.72) / 0.28);
                float d = length(vUv - 0.5) * 2.0;
                float reach = smoothstep(uSpread * 1.2, uSpread * 1.2 - 0.18, d);
                gl_FragColor = vec4(color, uOpacity * reach * 0.86);
                #include <colorspace_fragment>
            }`,
    });
}

function textSprite(text, color, height) {
    const fontSize = 40;
    const probe = document.createElement('canvas').getContext('2d');
    const font = `500 ${fontSize}px "IBM Plex Mono", monospace`;
    probe.font = font;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(probe.measureText(text).width) + 24;
    canvas.height = fontSize + 16;
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(8,8,8,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.fillText(text, 12, canvas.height / 2 + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, fog: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
    sprite.renderOrder = 20;
    return sprite;
}

function writeBox(array, i, x, y, z, sx, sy, sz) {
    const o = i * 16;
    array[o] = sx; array[o + 5] = sy; array[o + 10] = sz;
    array[o + 12] = x; array[o + 13] = y; array[o + 14] = z; array[o + 15] = 1;
}

class InstancedLayer {
    // items: {x, z, w?, d?, h?, s?}; color(item, rand) gives the base colour.
    constructor(geometry, material, items, colorOf, cast = true) {
        this.items = items;
        this.mesh = new THREE.InstancedMesh(geometry, material, items.length);
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = cast;
        this.mesh.receiveShadow = cast;
        this.mesh.visible = false;
        this.delays = items.map((it) => Math.hypot(it.x, it.z));
        const far = Math.max(1, ...this.delays);
        this.delays = this.delays.map((d) => d / far);
        this.base = items.map(colorOf);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3);
        this.tint(() => null);
        this.lastGrow = -1;
    }

    grow(value, spread = 0.45) {
        if (Math.abs(value - this.lastGrow) < 0.001) return false;
        this.lastGrow = value;
        this.mesh.visible = value > 0.001;
        const array = this.mesh.instanceMatrix.array;
        this.items.forEach((it, i) => {
            const g = smooth((value * (1 + spread) - this.delays[i] * spread) / 1);
            const sy = Math.max(0.001, g);
            if (it.s) writeBox(array, i, it.x, 0, it.z, it.s * sy, it.s * sy, it.s * sy);
            else writeBox(array, i, it.x, 0, it.z, it.w, it.h * sy, it.d);
        });
        this.mesh.instanceMatrix.needsUpdate = true;
        return true;
    }

    // fn(item, base, out) may write the final colour to `out`; null keeps the base.
    tint(fn) {
        const array = this.mesh.instanceColor.array;
        const out = new THREE.Color();
        this.items.forEach((it, i) => {
            const color = fn(it, this.base[i], out) || this.base[i];
            array[i * 3] = color.r; array[i * 3 + 1] = color.g; array[i * 3 + 2] = color.b;
        });
        this.mesh.instanceColor.needsUpdate = true;
    }
}

function pathLengths(path) {
    let total = 0;
    const cumulative = [0];
    for (let i = 1; i < path.length; i++) {
        total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
        cumulative.push(total);
    }
    return { total, cumulative };
}

function alongPath(path, lengths, f, out) {
    const at = f * lengths.total;
    let i = 1;
    while (i < path.length - 1 && lengths.cumulative[i] < at) i++;
    const span = lengths.cumulative[i] - lengths.cumulative[i - 1] || 1;
    const t = (at - lengths.cumulative[i - 1]) / span;
    out[0] = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t;
    out[1] = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t;
}

export function buildCity(plan, tier) {
    const root = new THREE.Group();
    const groups = {};
    for (const name of ['terrain', 'streets', 'water', 'greenery', 'buildings', 'housing', 'pipes',
        'heatOverlay', 'blueprint', 'boundaries', 'network', 'edit']) {
        groups[name] = new THREE.Group();
        groups[name].name = name;
        root.add(groups[name]);
    }
    const rand = mulberry32(SEED + 1);
    const pick = (list) => srgb(list[Math.floor(rand() * list.length)]);
    const R = plan.radius;

    // terrain
    const landCover = paintLandCover(plan, TEXTURE_SIZE[tier]);
    const terrainMaterial = new THREE.MeshLambertMaterial({ map: landCover, transparent: true, opacity: 0 });
    const terrain = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), terrainMaterial);
    terrain.receiveShadow = true;
    const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R * 0.97, 12, 128, 1, true).translate(0, -6, 0),
        new THREE.MeshLambertMaterial({ color: '#1a1a1a', transparent: true, opacity: 0 }),
    );
    groups.terrain.add(terrain, rim);

    // streets and bridges
    const half = plan.block.street / 2;
    const streetParts = plan.streets.map((s) => {
        const alongX = s.z0 === s.z1;
        const length = alongX ? s.x1 - s.x0 : s.z1 - s.z0;
        return new THREE.BoxGeometry(alongX ? length : half * 2, 0.3, alongX ? half * 2 : length)
            .translate((s.x0 + s.x1) / 2, 0.16, (s.z0 + s.z1) / 2);
    });
    const bridgeParts = plan.bridges.map((b) => new THREE.BoxGeometry(plan.canalHalf * 2 + 8, 0.8, half * 2 + 1).translate(b.x, 0.5, b.z));
    const streetMaterial = new THREE.MeshLambertMaterial({ color: '#242527', transparent: true, opacity: 0 });
    const streets = new THREE.Mesh(merge([...streetParts, ...bridgeParts]), streetMaterial);
    streets.receiveShadow = true;
    groups.streets.add(streets);

    // water: the canal as a ribbon, clipped to the disc
    const canalPos = [];
    for (let z = -R; z < R; z += 6) {
        const row = (zz) => [canalX(zz) - plan.canalHalf, canalX(zz) + plan.canalHalf].map((x) => [x, 0.12, zz]);
        const [a, b] = row(z);
        const [c, d] = row(z + 6);
        if ([a, b, c, d].every((p) => Math.hypot(p[0], p[2]) < R - 1)) canalPos.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const waterMaterial = new THREE.MeshLambertMaterial({ color: '#1d4a5e', transparent: true, opacity: 0 });
    const canalGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(canalPos, 3));
    canalGeometry.computeVertexNormals();
    groups.water.add(new THREE.Mesh(canalGeometry, waterMaterial));

    // buildings
    const house = houseGeometry();
    const buildingMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
    const houses = new InstancedLayer(house, buildingMaterial, plan.houses, () => pick(HOUSE_COLORS));
    const box = tinted(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 1);
    box.computeVertexNormals();
    const midrises = new InstancedLayer(box, buildingMaterial, plan.midrises, () => pick(MIDRISE_COLORS));
    groups.buildings.add(houses.mesh, midrises.mesh);

    // future homes (housing stage)
    const homes = new InstancedLayer(house, buildingMaterial, plan.futureHomes, () => pick(HOUSE_COLORS));
    groups.housing.add(homes.mesh);

    // greenery
    const treeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
    const trees = new InstancedLayer(treeGeometry(), treeMaterial, plan.trees, () => pick(TREE_COLORS));
    groups.greenery.add(trees.mesh);

    // blueprint
    const blueprintGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(plan.blueprint, 3));
    const wireMaterial = new THREE.LineBasicMaterial({ color: WIRE, transparent: true, opacity: 1 });
    const wire = new THREE.LineSegments(blueprintGeometry, wireMaterial);
    wire.frustumCulled = false;
    const gridLines = [];
    const extent = R * 2.6;
    for (let x = -extent; x <= extent; x += 44) gridLines.push([[x, -extent], [x, extent]]);
    for (let z = -extent; z <= extent; z += 44) gridLines.push([[-extent, z], [extent, z]]);
    const gridMaterial = new THREE.LineBasicMaterial({ color: CYANOTYPE, transparent: true, opacity: 0.32 });
    groups.blueprint.add(wire, new THREE.LineSegments(polylineSegments(gridLines, -0.6), gridMaterial));

    // boundaries, province to neighbourhood, drawn one level after the other
    const levels = [plan.boundaries.province, plan.boundaries.city, plan.boundaries.districts, plan.boundaries.hoods];
    const levelColors = ['#e7e2d6', OCHRE, OCHRE, WIRE];
    const boundaryMaterials = levelColors.map((color) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }));
    const boundaryLines = levels.map((lines, i) => {
        const line = new THREE.LineSegments(polylineSegments(lines, 1.1), boundaryMaterials[i]);
        line.frustumCulled = false;
        groups.boundaries.add(line);
        return line;
    });

    // pipes: under the ground, with wells, a treatment plant, pulses and leaks
    const pipeMaterial = new THREE.MeshBasicMaterial({ color: WIRE, transparent: true, opacity: 0, depthWrite: false });
    const pipeParts = plan.water.paths.flatMap((p) => p.points.slice(1).flatMap((q, i) => {
        const a = p.points[i];
        if (Math.hypot(q[0] - a[0], q[1] - a[1]) < 0.01) return [];
        const curve = new THREE.LineCurve3(new THREE.Vector3(a[0], -1.5, a[1]), new THREE.Vector3(q[0], -1.5, q[1]));
        return [new THREE.TubeGeometry(curve, 1, p.radius, 5, false)];
    }));
    groups.pipes.add(new THREE.Mesh(merge(pipeParts), pipeMaterial));
    const facilityMaterial = new THREE.MeshLambertMaterial({ color: '#c9d6db', transparent: true, opacity: 0 });
    const facilities = [
        new THREE.BoxGeometry(26, 7, 18).translate(plan.water.plant[0], 3.5, plan.water.plant[1]),
        ...plan.water.wells.map(([x, z]) => new THREE.CylinderGeometry(3, 3.6, 11, 10).translate(x, 5.5, z)),
    ];
    groups.pipes.add(new THREE.Mesh(merge(facilities), facilityMaterial));
    const pulseCount = plan.water.paths.length * 10;
    const pulseMaterial = new THREE.MeshBasicMaterial({ color: OCHRE, transparent: true, opacity: 0, depthTest: false, fog: false });
    const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 8, 6), pulseMaterial, pulseCount);
    pulses.frustumCulled = false;
    pulses.renderOrder = 12;
    groups.pipes.add(pulses);
    const pulsePaths = plan.water.paths.map((p) => ({ points: p.points, lengths: pathLengths(p.points) }));
    const leakGeometry = new THREE.RingGeometry(0.72, 1, 32).rotateX(-Math.PI / 2);
    const leaks = plan.water.leaks.map((leak) => {
        const mesh = new THREE.Mesh(leakGeometry, new THREE.MeshBasicMaterial({
            color: '#e0694a', transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide, fog: false,
        }));
        mesh.position.set(leak.x, 0.8, leak.z);
        mesh.renderOrder = 13;
        groups.pipes.add(mesh);
        return { mesh, at: leak.at };
    });

    // heat overlay
    const heat = paintHeatField(plan, 256);
    const heatMat = heatMaterial(heat.texture);
    const heatMesh = new THREE.Mesh(new THREE.CircleGeometry(R, 96).rotateX(-Math.PI / 2).translate(0, 0.7, 0), heatMat);
    heatMesh.visible = false;
    heatMesh.renderOrder = 5;
    groups.heatOverlay.add(heatMesh);

    // causal network above the city
    const positions = nodePositions(R);
    const labelScale = window.innerWidth < 768 ? 1.5 : 1; // portrait views sit further away
    const nodeGeometry = new THREE.SphereGeometry(3, 12, 8);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: '#f0f0f0', transparent: true, opacity: 0, fog: false });
    const fade = [nodeMaterial];
    const labels = [];
    Object.keys(NODES).forEach((name) => {
        const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
        mesh.position.set(...positions[name]);
        const label = textSprite(name.replace(/_/g, ' '), '#f0f0f0', 8.5 * labelScale);
        label.position.set(positions[name][0], positions[name][1] + 8.5, positions[name][2]);
        groups.network.add(mesh, label);
        labels.push(label.material);
    });
    LEVELS.forEach((level, i) => {
        const y = levelY(i);
        const r = levelRadius(i, R);
        const ring = [];
        for (let k = 0; k <= 72; k++) ring.push([Math.cos((k / 72) * Math.PI * 2) * r, Math.sin((k / 72) * Math.PI * 2) * r]);
        const material = new THREE.LineBasicMaterial({ color: CYANOTYPE, transparent: true, opacity: 0, fog: false });
        groups.network.add(new THREE.LineSegments(polylineSegments([ring], y), material));
        fade.push(material);
        const label = textSprite(level.toUpperCase(), OCHRE, 9.5 * labelScale);
        label.position.set(r + 26, y, 0);
        groups.network.add(label);
        labels.push(label.material);
    });
    const chainPairs = CHAIN.slice(1).map((b, i) => `${CHAIN[i]}>${b}`);
    const edges = EDGES.map(([a, b, computed]) => {
        const [p, q] = [new THREE.Vector3(...positions[a]), new THREE.Vector3(...positions[b])];
        const mid = p.clone().lerp(q, 0.5);
        mid.y += 14;
        const curve = new THREE.QuadraticBezierCurve3(p, mid, q);
        const material = new THREE.MeshBasicMaterial({
            color: computed ? WIRE : '#8a8a8a', transparent: true, opacity: 0, depthWrite: false, fog: false,
        });
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, computed ? 0.95 : 0.42, 5, false), material);
        mesh.frustumCulled = false;
        groups.network.add(mesh);
        return { mesh, material, curve, computed, chainIndex: chainPairs.indexOf(`${a}>${b}`), count: mesh.geometry.index.count };
    });
    const traveller = new THREE.Mesh(new THREE.SphereGeometry(4.6, 12, 8), new THREE.MeshBasicMaterial({
        color: OCHRE, transparent: true, opacity: 0, depthTest: false, fog: false,
    }));
    traveller.renderOrder = 15;
    groups.network.add(traveller);
    const chainEdges = chainPairs.map((_, i) => edges.find((e) => e.chainIndex === i));

    // edit: the drawn building, its 10 m land cover buffer and the ripple
    const { edit } = plan;
    const patchMaterial = new THREE.MeshLambertMaterial({ color: '#6a6660', transparent: true, opacity: 0 });
    const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(edit.w + edit.buffer * 2, edit.d + edit.buffer * 2).rotateX(-Math.PI / 2),
        patchMaterial,
    );
    patch.position.set(edit.x, 0.5, edit.z);
    patch.receiveShadow = true;
    const editMaterial = new THREE.MeshLambertMaterial({ color: BRICK, vertexColors: true });
    const editBuilding = new THREE.Mesh(house, editMaterial);
    editBuilding.scale.set(edit.w, edit.h, edit.d);
    editBuilding.castShadow = true;
    editBuilding.visible = false;
    const rippleColors = [BRICK, OCHRE, WIRE];
    const rippleGeometry = new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2);
    const ripples = rippleColors.map((color) => {
        const mesh = new THREE.Mesh(rippleGeometry, new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide, fog: false,
        }));
        mesh.position.set(edit.x, 1, edit.z);
        mesh.renderOrder = 14;
        return mesh;
    });
    groups.edit.add(patch, editBuilding, ...ripples);

    // Quality: lower tiers keep the first N of the shuffled tree list and fewer pulses.
    function setTier(next) {
        trees.mesh.count = Math.floor(plan.trees.length * MAX_TREES[next]);
        pulses.count = Math.min(pulseCount, MAX_PULSES[next]);
    }
    setTier(tier);

    const last = {};
    const changed = (key, value, eps = 0.002) => {
        if (last[key] !== undefined && Math.abs(last[key] - value) < eps) return false;
        last[key] = value;
        return true;
    };
    const typeColors = Object.fromEntries(Object.entries(TYPE_COLORS).map(([k, v]) => [k, srgb(v)]));
    const heatTmp = new THREE.Color();
    const pulseMatrix = new THREE.Matrix4();
    const xz = [0, 0];

    function update(L) {
        let geometryChanged = false;

        // ground
        terrain.visible = rim.visible = L.terrain > 0.002;
        terrainMaterial.opacity = rim.material.opacity = L.terrain;
        terrainMaterial.depthWrite = rim.material.depthWrite = L.terrain > 0.98;
        streetMaterial.opacity = L.terrain;
        streets.visible = terrain.visible;
        streetMaterial.depthWrite = terrainMaterial.depthWrite;
        waterMaterial.opacity = L.terrain;
        waterMaterial.color.set('#1d4a5e').lerp(srgb('#4aa3c4'), L.green);

        // blueprint and boundaries
        wireMaterial.opacity = L.wire;
        wire.visible = L.wire > 0.002;
        gridMaterial.opacity = 0.14 + 0.2 * L.wire;
        boundaryLines.forEach((line, i) => {
            const opacity = clamp01(L.boundaries * 2.2 - i * 0.28);
            boundaryMaterials[i].opacity = opacity;
            line.visible = opacity > 0.002;
        });

        // solids
        if (houses.grow(L.solid)) geometryChanged = true;
        if (midrises.grow(L.solid)) geometryChanged = true;
        if (trees.grow(L.trees, 0.3)) geometryChanged = true;
        if (homes.grow(L.homes)) geometryChanged = true;
        buildingMaterial.opacity = L.buildingAlpha;
        buildingMaterial.depthWrite = L.buildingAlpha > 0.98;
        treeMaterial.opacity = L.buildingAlpha;
        treeMaterial.depthWrite = buildingMaterial.depthWrite;
        treeMaterial.color.setScalar(1 + 0.75 * L.green);

        const look = changed('types', L.types) | changed('heat', L.heat) | changed('cool', L.cool) | changed('dim', L.dim);
        if (look) {
            const shade = (it, base, out) => {
                out.copy(base);
                if (L.heat > 0.002) {
                    const field = heat.read(it.x, it.z);
                    const v = 0.74 + (field - 0.66) * 0.5 + (field - (0.74 + (field - 0.66) * 0.5)) * L.cool;
                    heatColor(v, heatTmp);
                    out.lerp(heatTmp, Math.min(1, L.heat) * 0.72);
                }
                if (L.types > 0.002) out.lerp(typeColors[it.type], L.types);
                out.multiplyScalar(1 - L.dim);
                return out;
            };
            houses.tint(shade);
            midrises.tint(shade);
        }
        if (changed('homesTint', L.homesTint) || look) {
            const ochre = srgb(OCHRE);
            homes.tint((it, base, out) => {
                out.copy(base).lerp(ochre, L.homesTint);
                if (L.types > 0.002) out.lerp(typeColors[it.type], L.types);
                return out;
            });
        }

        // pipes
        const pipesOn = L.pipes > 0.002;
        groups.pipes.visible = pipesOn;
        if (pipesOn) {
            pipeMaterial.opacity = facilityMaterial.opacity = L.pipes;
            pulseMaterial.opacity = L.pipes;
            for (let i = 0; i < pulses.count; i++) {
                const path = pulsePaths[i % pulsePaths.length];
                // Evenly spaced along each path, each path with its own offset.
                const phase = (Math.floor(i / pulsePaths.length) / 10 + (i % pulsePaths.length) * 0.37) % 1;
                alongPath(path.points, path.lengths, (phase + L.flow * 1.6) % 1, xz);
                pulseMatrix.makeTranslation(xz[0], -1.5, xz[1]);
                pulses.setMatrixAt(i, pulseMatrix);
            }
            pulses.instanceMatrix.needsUpdate = true;
            for (const leak of leaks) {
                const f = (L.flow * 2.2 + leak.at) % 1;
                leak.mesh.scale.setScalar(4 + f * 15);
                leak.mesh.material.opacity = L.pipes * (1 - f) * (1 - f);
            }
        }

        // heat
        heatMesh.visible = L.heat > 0.002;
        heatMat.uniforms.uOpacity.value = Math.min(1, L.heat);
        heatMat.uniforms.uSpread.value = L.heatSpread;
        heatMat.uniforms.uCool.value = L.cool;

        // network
        groups.network.visible = L.network > 0.002;
        if (groups.network.visible) {
            groups.network.scale.y = Math.max(0.02, L.netGrow);
            fade.forEach((m) => { m.opacity = L.network * (m === nodeMaterial ? 1 : 0.5); });
            labels.forEach((m) => { m.opacity = L.netLabels; });
            edges.forEach((edge, i) => {
                const grow = clamp01(L.netGrow * 1.6 - (i / edges.length) * 0.6);
                edge.mesh.geometry.setDrawRange(0, Math.floor(edge.count * grow));
                edge.material.opacity = L.network * (edge.computed ? 0.9 : 0.38);
                if (edge.chainIndex >= 0) {
                    const lit = clamp01(L.chain * chainEdges.length - edge.chainIndex);
                    edge.material.color.set(WIRE).lerp(srgb(OCHRE), lit);
                }
            });
            const hop = Math.min(chainEdges.length - 1, Math.floor(L.chain * chainEdges.length));
            traveller.position.copy(chainEdges[hop].curve.getPoint(clamp01(L.chain * chainEdges.length - hop)));
            traveller.material.opacity = L.chain > 0 && L.chain < 1 ? L.network : 0;
        }

        // edit
        const drop = L.buildingDrop;
        editBuilding.visible = drop > 0.001;
        editBuilding.position.set(edit.x, (1 - drop) * 110, edit.z);
        if (changed('drop', drop)) geometryChanged = true;
        patch.visible = L.patch > 0.002;
        patchMaterial.opacity = L.patch;
        ripples.forEach((mesh, i) => {
            const t = clamp01(L.ripple * 1.8 - i * 0.4);
            mesh.scale.setScalar(16 + t * (46 + i * 34));
            mesh.material.opacity = L.rippleOn * (1 - t * 0.75) * (t > 0 ? 1 : 0);
        });

        return geometryChanged;
    }

    return { root, groups, update, setTier };
}
