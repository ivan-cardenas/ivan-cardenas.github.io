// Layout of the illustrative district: plain numbers, no Three.js, no DOM.
// A fixed seed makes it identical on every load. city.js turns it into meshes and
// tools/landing_fallback_svg.mjs into the no-WebGL sketch, so both show the same city.
// A real extract (e.g. Enschede) can replace it by returning the same fields.

export const RADIUS = 220;
export const SEED = 28992;

const BLOCK_X = 66;
const BLOCK_Z = 48;
const STREET = 8;
const CANAL_HALF = 9;

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const canalX = (z) => 30 + 38 * Math.sin(z / 95 + 0.6);

const inDisc = (x, z, r) => x * x + z * z < r * r;
const onCanal = (x, z, margin) => Math.abs(x - canalX(z)) < CANAL_HALF + margin;

function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function layoutCells(rand) {
    const cells = [];
    for (let ix = -4; ix <= 4; ix++) {
        for (let iz = -5; iz <= 5; iz++) {
            const x = ix * BLOCK_X;
            const z = iz * BLOCK_Z;
            if (inDisc(x, z, RADIUS - 12)) cells.push({ x, z, ix, iz, kind: 'rows' });
        }
    }
    const free = shuffle(cells.filter((c) => !onCanal(c.x, c.z, 34)), rand);
    const byDist = (a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z);

    // The plot for the what-if building: an inner, canal-free cell.
    const edit = [...free].sort(byDist).find((c) => c.x < 0 && c.z > 0);
    edit.kind = 'edit';
    const open = free.filter((c) => c !== edit);
    open.filter((c) => Math.hypot(c.x, c.z) < 110).slice(0, 5).forEach((c) => { c.kind = 'midrise'; });
    let rest = open.filter((c) => c.kind === 'rows');
    rest.slice(0, 7).forEach((c) => { c.kind = 'park'; });
    rest = rest.filter((c) => c.kind === 'rows').sort((a, b) => byDist(b, a));
    rest.filter((c) => Math.hypot(c.x, c.z) > 130).slice(0, 6).forEach((c) => { c.kind = 'vacant'; });
    return { cells, edit };
}

function rowsInCell(cell, rand, out, type) {
    const halfX = (BLOCK_X - STREET) / 2;
    const halfZ = (BLOCK_Z - STREET) / 2;
    for (const side of [-1, 1]) {
        const depth = 10 + rand() * 2;
        let x = cell.x - halfX;
        while (x < cell.x + halfX - 4) {
            const w = 5 + rand() * 2.5;
            const px = x + w / 2;
            const pz = cell.z + side * (halfZ - depth / 2);
            x += w;
            if (!inDisc(px, pz, RADIUS - 7) || onCanal(px, pz, 5)) continue;
            out.push({ x: px, z: pz, w, d: depth, h: 8 + rand() * 5.5, type: type(rand) });
        }
    }
}

function residentialMostly(rand) {
    const r = rand();
    if (r < 0.84) return 'residential';
    if (r < 0.94) return 'mixed';
    return r < 0.98 ? 'commercial' : 'institutional';
}

function streetSegments() {
    const list = [];
    const chord = (a) => Math.sqrt(Math.max(0, (RADIUS - 2) ** 2 - a * a));
    for (let i = -4; i <= 4; i++) {
        const x = (i + 0.5) * BLOCK_X;
        if (Math.abs(x) < RADIUS - 8) list.push({ x0: x, z0: -chord(x), x1: x, z1: chord(x) });
    }
    for (let i = -5; i <= 4; i++) {
        const z = (i + 0.5) * BLOCK_Z;
        if (Math.abs(z) < RADIUS - 8) list.push({ x0: -chord(z), z0: z, x1: chord(z), z1: z });
    }
    return list;
}

// Manhattan route along the streets, between two street crossings.
function route(a, b) {
    const pts = [a];
    if (a[0] !== b[0]) pts.push([b[0], a[1]]);
    if (a[1] !== b[1]) pts.push(b);
    return pts;
}

const crossing = (x, z) => [
    (Math.round(x / BLOCK_X - 0.5) + 0.5) * BLOCK_X,
    (Math.round(z / BLOCK_Z - 0.5) + 0.5) * BLOCK_Z,
];

function waterNetwork(rand) {
    const plant = crossing(-70, -60);
    const wells = [-2.6, -1.05, 0.5, 2.3].map((a) => [Math.cos(a) * (RADIUS - 16), Math.sin(a) * (RADIUS - 16)]);
    const mains = wells.map((w) => {
        const start = crossing(w[0] * 0.86, w[1] * 0.86);
        return { points: [w, ...route(start, plant)], radius: 1.0 };
    });
    const branches = [];
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + rand() * 0.3;
        const r = 70 + rand() * 105;
        const points = route(plant, crossing(Math.cos(a) * r, Math.sin(a) * r));
        if (points.length > 1) branches.push({ points, radius: 0.55 });
    }
    const leaks = [mains[1], branches[2], branches[6], branches[11]].map((path, i) => {
        const [p, q] = [path.points.at(-2), path.points.at(-1)];
        const f = 0.3 + 0.13 * i;
        return { x: p[0] + (q[0] - p[0]) * f, z: p[1] + (q[1] - p[1]) * f, at: i / 4 };
    });
    return { plant, wells, paths: [...mains, ...branches], leaks };
}

function circleLine(r, steps = 96) {
    const line = [];
    for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        line.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return line;
}

function boundaries(rand) {
    const radial = (a, r0, r1) => {
        const line = [];
        for (let i = 0; i <= 10; i++) {
            const r = r0 + ((r1 - r0) * i) / 10;
            const wobble = (rand() - 0.5) * 0.09;
            line.push([Math.cos(a + wobble) * r, Math.sin(a + wobble) * r]);
        }
        return line;
    };
    const districts = [0.4, 1.95, 3.5, 5.0].map((a) => radial(a, 0, RADIUS));
    const inner = circleLine(RADIUS * 0.52, 48);
    const hoods = [inner, ...[0.9, 1.5, 2.7, 3.1, 4.3, 5.7, 6.0].map((a) => radial(a, RADIUS * 0.52, RADIUS))];
    return {
        province: [circleLine(RADIUS * 1.3)],
        city: [circleLine(RADIUS)],
        districts,
        hoods,
    };
}

// Flat [x0,y0,z0, x1,y1,z1, ...] of every drawn edge: the cyanotype of the city.
function blueprintSegments(plan) {
    const out = [];
    const seg = (a, b) => out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    for (const h of [...plan.houses, ...plan.futureHomes]) {
        const x0 = h.x - h.w / 2; const x1 = h.x + h.w / 2;
        const z0 = h.z - h.d / 2; const z1 = h.z + h.d / 2;
        const eave = h.h * 0.66;
        const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
        corners.forEach(([x, z], i) => {
            const [nx, nz] = corners[(i + 1) % 4];
            seg([x, 0, z], [nx, 0, nz]);
            seg([x, eave, z], [nx, eave, nz]);
            seg([x, 0, z], [x, eave, z]);
        });
        for (const z of [z0, z1]) {
            seg([x0, eave, z], [h.x, h.h, z]);
            seg([x1, eave, z], [h.x, h.h, z]);
        }
        seg([h.x, h.h, z0], [h.x, h.h, z1]);
    }
    for (const m of plan.midrises) {
        const x0 = m.x - m.w / 2; const x1 = m.x + m.w / 2;
        const z0 = m.z - m.d / 2; const z1 = m.z + m.d / 2;
        const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
        corners.forEach(([x, z], i) => {
            const [nx, nz] = corners[(i + 1) % 4];
            seg([x, 0, z], [nx, 0, nz]);
            seg([x, m.h, z], [nx, m.h, nz]);
            seg([x, 0, z], [x, m.h, z]);
        });
    }
    for (const t of plan.trees) {
        const r = t.s * 0.32;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2; const b = ((i + 1) / 6) * Math.PI * 2;
            seg([t.x + Math.cos(a) * r, 0.4, t.z + Math.sin(a) * r], [t.x + Math.cos(b) * r, 0.4, t.z + Math.sin(b) * r]);
        }
    }
    const half = STREET / 2;
    for (const s of plan.streets) {
        const alongX = s.z0 === s.z1;
        for (const side of [-half, half]) {
            const dx = alongX ? 0 : side; const dz = alongX ? side : 0;
            seg([s.x0 + dx, 0.3, s.z0 + dz], [s.x1 + dx, 0.3, s.z1 + dz]);
        }
    }
    for (const side of [-CANAL_HALF, CANAL_HALF]) {
        let prev = null;
        for (let z = -RADIUS; z <= RADIUS; z += 8) {
            const x = canalX(z) + side;
            const next = inDisc(x, z, RADIUS - 1) ? [x, 0.3, z] : null;
            if (prev && next) seg(prev, next);
            prev = next;
        }
    }
    const ring = circleLine(RADIUS);
    ring.forEach((p, i) => { if (i) seg([ring[i - 1][0], 0.3, ring[i - 1][1]], [p[0], 0.3, p[1]]); });
    return new Float32Array(out);
}

export function buildPlan() {
    const rand = mulberry32(SEED);
    const { cells, edit } = layoutCells(rand);
    const houses = [];
    const futureHomes = [];
    const midrises = [];
    const trees = [];
    const addTree = (x, z, scale = 1) => {
        if (inDisc(x, z, RADIUS - 3) && !onCanal(x, z, 2)) trees.push({ x, z, s: (7 + rand() * 5) * scale });
    };

    for (const cell of cells) {
        const scatter = (n) => {
            for (let i = 0; i < n; i++) {
                const x = cell.x + (rand() - 0.5) * (BLOCK_X - STREET - 6);
                const z = cell.z + (rand() - 0.5) * (BLOCK_Z - STREET - 6);
                if (cell.kind === 'edit' && Math.hypot(x - cell.x, z - cell.z) < 28) continue;
                addTree(x, z, 1.15);
            }
        };
        if (cell.kind === 'rows') {
            rowsInCell(cell, rand, houses, residentialMostly);
            for (let i = 0; i < 2; i++) addTree(cell.x + (rand() - 0.5) * 44, cell.z + (rand() - 0.5) * 8);
        } else if (cell.kind === 'vacant') {
            rowsInCell(cell, rand, futureHomes, () => 'residential');
        } else if (cell.kind === 'midrise') {
            const types = ['commercial', 'mixed', 'institutional'];
            for (const side of [-1, 1]) {
                midrises.push({
                    x: cell.x + side * 14 + (rand() - 0.5) * 3,
                    z: cell.z + (rand() - 0.5) * 3,
                    w: 19 + rand() * 4,
                    d: 26 + rand() * 6,
                    h: 24 + rand() * 24,
                    type: types[Math.floor(rand() * types.length)],
                });
            }
        } else {
            scatter(cell.kind === 'park' ? 20 : 12);
        }
    }
    // Quay trees along the canal, and a thin rural rim at the edge of the disc.
    for (let z = -RADIUS; z < RADIUS; z += 15) {
        addTree(canalX(z) - CANAL_HALF - 3, z + rand() * 4, 0.8);
        addTree(canalX(z) + CANAL_HALF + 3, z + rand() * 4, 0.8);
    }
    for (let i = 0; i < 110; i++) {
        const a = rand() * Math.PI * 2;
        addTree(Math.cos(a) * (RADIUS - 5 - rand() * 3), Math.sin(a) * (RADIUS - 5 - rand() * 3));
    }
    shuffle(trees, rand); // so a lower quality can keep the first N evenly over the city

    const streets = streetSegments();
    const bridges = streets.filter((s) => s.z0 === s.z1)
        .map((s) => ({ x: canalX(s.z0), z: s.z0 }))
        .filter((b) => inDisc(b.x, b.z, RADIUS - 10));

    const plan = {
        radius: RADIUS,
        block: { x: BLOCK_X, z: BLOCK_Z, street: STREET },
        canalHalf: CANAL_HALF,
        cells,
        houses,
        futureHomes,
        midrises,
        trees,
        streets,
        bridges,
        water: waterNetwork(rand),
        boundaries: boundaries(rand),
        edit: { x: edit.x, z: edit.z, w: 18, d: 13, h: 20, buffer: 10 },
    };
    plan.blueprint = blueprintSegments(plan);
    return plan;
}
