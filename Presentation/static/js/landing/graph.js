// The part of core/DAG.dot drawn above the city. Names are the DAG's own node names:
// mainMap/tests.py checks that every edge below exists in DAG.dot.
// `computed` follows the coverage list in .claude/CLAUDE.md; false = a documented gap.

export const LEVELS = ['Driver', 'Pressure', 'State', 'Impact', 'Response'];

export const NODES = {
    Population_Growth: 0, ConsumptionCapita: 0, Buildings: 0,
    Total_Population: 1, Household_Size: 1, Total_Extraction: 1, Housing_Demand: 1,
    Total_Water_Demand: 2, Total_Water_Prod: 2, DSM: 2, Meteorology: 2, Tmrt: 2,
    Supply_Security: 3, SVF: 3, LandCover: 3, UTCI: 3, PET: 3,
    Service_Time: 4, New_Units: 4, Zoning_Status: 4, NBS: 4,
};

export const EDGES = [
    ['Population_Growth', 'Total_Population', true],
    ['Total_Population', 'Total_Water_Demand', true],
    ['ConsumptionCapita', 'Total_Water_Demand', true],
    ['Total_Water_Demand', 'Supply_Security', true],
    ['Total_Extraction', 'Total_Water_Prod', true],
    ['Total_Water_Prod', 'Supply_Security', true],
    ['Supply_Security', 'Service_Time', true],
    ['Total_Population', 'Housing_Demand', true],
    ['Household_Size', 'Housing_Demand', true],
    ['New_Units', 'LandCover', true],
    ['Buildings', 'DSM', true],
    ['DSM', 'SVF', true],
    ['SVF', 'Tmrt', true],
    ['Meteorology', 'Tmrt', true],
    ['Tmrt', 'UTCI', true],
    ['Tmrt', 'PET', true],
    ['Housing_Demand', 'Zoning_Status', false],
    ['Zoning_Status', 'New_Units', false],
    ['PET', 'NBS', false],
    ['UTCI', 'NBS', false],
];

// A computed chain, lit link by link: population to service time.
export const CHAIN = ['Population_Growth', 'Total_Population', 'Total_Water_Demand', 'Supply_Security', 'Service_Time'];

export const levelY = (level) => 72 + level * 46;
export const levelRadius = (level, radius) => radius * (0.92 - level * 0.09);

// Node positions above the city: one tier per DPSIR level, spread around the axis.
export function nodePositions(radius) {
    const byLevel = LEVELS.map(() => []);
    Object.entries(NODES).forEach(([name, level]) => byLevel[level].push(name));
    const pos = {};
    byLevel.forEach((names, level) => {
        names.forEach((name, i) => {
            const a = (i / names.length) * Math.PI * 2 + level * 0.9;
            const r = levelRadius(level, radius);
            pos[name] = [Math.cos(a) * r, levelY(level), Math.sin(a) * r];
        });
    });
    return pos;
}
