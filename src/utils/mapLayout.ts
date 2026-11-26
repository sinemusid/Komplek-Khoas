import { BlockLetter, KavlingLot, MosqueBuilding } from '../config/khoasConfig';

export const WORLD_WIDTH = 2360;
export const WORLD_HEIGHT = 1652;
export const LOT_W = 54;
export const LOT_H = 48;

export interface RoadRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  isMain?: boolean;
}

export interface StreetLamp {
  id: string;
  x: number;
  y: number;
}

export interface ParkArea {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  trees: Array<{ x: number; y: number; r: number }>;
}

export interface WalkNode {
  id: string;
  x: number;
  y: number;
  neighbors: string[];
}

export interface BlockLabel {
  block: BlockLetter;
  title: string;
  range: string;
  x: number;
  y: number;
}

export interface AuditoriumBounds {
  plazaX: number;
  plazaY: number;
  plazaWidth: number;
  plazaHeight: number;
  buildingX: number;
  buildingY: number;
  buildingWidth: number;
  buildingHeight: number;
  centerX: number;
  centerY: number;
}

export interface NeighborhoodLayout {
  lots: KavlingLot[];
  lotsById: Record<string, KavlingLot>;
  mosques: MosqueBuilding[];
  roads: RoadRect[];
  lamps: StreetLamp[];
  parks: ParkArea[];
  blockLabels: BlockLabel[];
  auditorium: AuditoriumBounds;
  walkGraph: Record<string, WalkNode>;
  walkNodeIds: string[];
}

// Column offsets inside a 15-column quadrant (width = 958px):
// Group 0 (cols 0..4): 0..294 | Alley 1: 294..332 | Group 1 (cols 5..9): 332..626 | Alley 2: 626..664 | Group 2 (cols 10..14): 664..958
const COL_OFFSETS = [
  0, 60, 120, 180, 240,
  332, 392, 452, 512, 572,
  664, 724, 784, 844, 904,
];

// Row offsets for North quadrants (A, B): groups 3 + 3 + 2 + 2 = 10 rows (height = 630px)
// Band 1 (rows 3..5) middle cols 5..9 form the Central Mosque Courtyard (15 cells)
// Band 3 (rows 8..9) inner corner cols form the Auditorium Cutout (10 cells)
// Total lots per block = 150 - 15 - 10 = 125 lots (exact 500 across 4 blocks!)
const NORTH_ROW_OFFSETS = [
  0, 54, 108,
  194, 248, 302,
  388, 442,
  528, 582,
];

// Row offsets for South quadrants (C, D): groups 2 + 2 + 3 + 3 = 10 rows (height = 630px)
// Band 0 (rows 0..1) inner corner cols form the Auditorium Cutout (10 cells)
// Band 2 (rows 4..6) middle cols 5..9 form the Central Mosque Courtyard (15 cells)
const SOUTH_ROW_OFFSETS = [
  0, 54,
  140, 194,
  280, 334, 388,
  474, 528, 582,
];

const LEFT_QUAD_X = 166;
const RIGHT_QUAD_X = 1236;
const TOP_QUAD_Y = 112;
const BOTTOM_QUAD_Y = 910;

const QUAD_W = 958;
const QUAD_H = 630;

function isAuditoriumCutout(block: BlockLetter, col: number, row: number): boolean {
  if (block === 'A') return col >= 10 && row >= 8;
  if (block === 'B') return col <= 4 && row >= 8;
  if (block === 'C') return col >= 10 && row <= 1;
  return col <= 4 && row <= 1;
}

function isMosqueCutout(block: BlockLetter, col: number, row: number): boolean {
  if (col < 5 || col > 9) return false;
  if (block === 'A' || block === 'B') {
    return row >= 3 && row <= 5;
  }
  return row >= 4 && row <= 6;
}

function getFacing(block: BlockLetter, row: number): 'north' | 'south' {
  if (block === 'A' || block === 'B') {
    return row === 0 || row === 3 || row === 6 || row === 8 ? 'north' : 'south';
  }
  return row === 0 || row === 2 || row === 4 || row === 7 ? 'north' : 'south';
}

export function buildNeighborhoodLayout(): NeighborhoodLayout {
  const lots: KavlingLot[] = [];
  const lotsById: Record<string, KavlingLot> = {};

  const blocks: Array<{
    letter: BlockLetter;
    originX: number;
    originY: number;
    rowOffsets: number[];
    mosqueYOffset: number;
  }> = [
    {
      letter: 'A',
      originX: LEFT_QUAD_X,
      originY: TOP_QUAD_Y,
      rowOffsets: NORTH_ROW_OFFSETS,
      mosqueYOffset: NORTH_ROW_OFFSETS[3],
    },
    {
      letter: 'B',
      originX: RIGHT_QUAD_X,
      originY: TOP_QUAD_Y,
      rowOffsets: NORTH_ROW_OFFSETS,
      mosqueYOffset: NORTH_ROW_OFFSETS[3],
    },
    {
      letter: 'C',
      originX: LEFT_QUAD_X,
      originY: BOTTOM_QUAD_Y,
      rowOffsets: SOUTH_ROW_OFFSETS,
      mosqueYOffset: SOUTH_ROW_OFFSETS[4],
    },
    {
      letter: 'D',
      originX: RIGHT_QUAD_X,
      originY: BOTTOM_QUAD_Y,
      rowOffsets: SOUTH_ROW_OFFSETS,
      mosqueYOffset: SOUTH_ROW_OFFSETS[4],
    },
  ];

  const mosques: MosqueBuilding[] = [];

  for (const b of blocks) {
    mosques.push({
      id: `masjid-${b.letter.toLowerCase()}`,
      block: b.letter,
      name: `Masjid Blok ${b.letter}`,
      x: b.originX + COL_OFFSETS[5], // 332 offset
      y: b.originY + b.mosqueYOffset,
      width: 294, // Spans cols 5..9 cleanly (572 + 54 - 332 = 294)
      height: 156, // Spans 3 rows cleanly (108 + 48 = 156)
    });

    let indexInBlock = 0;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 15; col++) {
        if (isAuditoriumCutout(b.letter, col, row)) continue;
        if (isMosqueCutout(b.letter, col, row)) continue;

        indexInBlock += 1;
        const numStr = String(indexInBlock).padStart(2, '0');
        const id = `${b.letter}-${numStr}`;
        const lot: KavlingLot = {
          id,
          block: b.letter,
          indexInBlock,
          x: b.originX + COL_OFFSETS[col],
          y: b.originY + b.rowOffsets[row],
          width: LOT_W,
          height: LOT_H,
          facing: getFacing(b.letter, row),
          roofVariant: (indexInBlock * 7 + b.letter.charCodeAt(0)) % 5,
        };
        lots.push(lot);
        lotsById[id] = lot;
      }
    }
  }

  // Central Auditorium Plaza occupies the carved-out inner clearing + boulevard intersection
  const plazaX = LEFT_QUAD_X + 664; // 830
  const plazaRight = RIGHT_QUAD_X + 294; // 1530
  const plazaY = TOP_QUAD_Y + 528; // 640
  const plazaBottom = BOTTOM_QUAD_Y + 102; // 1012
  const plazaWidth = plazaRight - plazaX; // 700
  const plazaHeight = plazaBottom - plazaY; // 372

  const buildingWidth = 460;
  const buildingHeight = 232;
  const buildingX = plazaX + (plazaWidth - buildingWidth) / 2;
  const buildingY = plazaY + 42;

  const auditorium: AuditoriumBounds = {
    plazaX,
    plazaY,
    plazaWidth,
    plazaHeight,
    buildingX,
    buildingY,
    buildingWidth,
    buildingHeight,
    centerX: plazaX + plazaWidth / 2,
    centerY: plazaY + plazaHeight / 2,
  };

  // Road network (perimeter, main boulevards, residential streets & alleys)
  const roads: RoadRect[] = [
    // Outer ring road
    { id: 'outer-n', x: 118, y: 66, width: 2124, height: 38, orientation: 'horizontal' },
    { id: 'outer-s', x: 118, y: 1548, width: 2124, height: 38, orientation: 'horizontal' },
    { id: 'outer-w', x: 118, y: 66, width: 38, height: 1520, orientation: 'vertical' },
    { id: 'outer-e', x: 2204, y: 66, width: 38, height: 1520, orientation: 'vertical' },

    // Main Central Boulevards (segmented around auditorium plaza)
    { id: 'main-w', x: 118, y: 778, width: 712, height: 96, orientation: 'horizontal', isMain: true },
    { id: 'main-e', x: 1530, y: 778, width: 712, height: 96, orientation: 'horizontal', isMain: true },
    { id: 'main-n', x: 1134, y: 66, width: 92, height: 574, orientation: 'vertical', isMain: true },
    { id: 'main-s', x: 1134, y: 1012, width: 92, height: 574, orientation: 'vertical', isMain: true },

    // Auditorium Ring Road
    { id: 'ring-n', x: 792, y: 602, width: 776, height: 38, orientation: 'horizontal', isMain: true },
    { id: 'ring-s', x: 792, y: 1012, width: 776, height: 38, orientation: 'horizontal', isMain: true },
    { id: 'ring-w', x: 792, y: 602, width: 38, height: 448, orientation: 'vertical', isMain: true },
    { id: 'ring-e', x: 1530, y: 602, width: 38, height: 448, orientation: 'vertical', isMain: true },

    // North residential horizontal streets (Blok A & B)
    { id: 'north-h1-w', x: 156, y: 268, width: 978, height: 38, orientation: 'horizontal' },
    { id: 'north-h1-e', x: 1226, y: 268, width: 978, height: 38, orientation: 'horizontal' },
    { id: 'north-h2-w', x: 156, y: 462, width: 978, height: 38, orientation: 'horizontal' },
    { id: 'north-h2-e', x: 1226, y: 462, width: 978, height: 38, orientation: 'horizontal' },
    { id: 'north-h3-w', x: 156, y: 602, width: 636, height: 38, orientation: 'horizontal' },
    { id: 'north-h3-e', x: 1568, y: 602, width: 636, height: 38, orientation: 'horizontal' },

    // South residential horizontal streets (Blok C & D)
    { id: 'south-h1-w', x: 156, y: 1012, width: 636, height: 38, orientation: 'horizontal' },
    { id: 'south-h1-e', x: 1568, y: 1012, width: 636, height: 38, orientation: 'horizontal' },
    { id: 'south-h2-w', x: 156, y: 1152, width: 978, height: 38, orientation: 'horizontal' },
    { id: 'south-h2-e', x: 1226, y: 1152, width: 978, height: 38, orientation: 'horizontal' },
    { id: 'south-h3-w', x: 156, y: 1346, width: 978, height: 38, orientation: 'horizontal' },
    { id: 'south-h3-e', x: 1226, y: 1346, width: 978, height: 38, orientation: 'horizontal' },

    // Vertical alleys inside quadrants (flanking each Mosque plaza cleanly)
    { id: 'alley-w1-n', x: 460, y: 104, width: 38, height: 674, orientation: 'vertical' },
    { id: 'alley-w2-n', x: 792, y: 104, width: 38, height: 498, orientation: 'vertical' },
    { id: 'alley-w1-s', x: 460, y: 874, width: 38, height: 674, orientation: 'vertical' },
    { id: 'alley-w2-s', x: 792, y: 1050, width: 38, height: 498, orientation: 'vertical' },
    { id: 'alley-e1-n', x: 1530, y: 104, width: 38, height: 498, orientation: 'vertical' },
    { id: 'alley-e2-n', x: 1862, y: 104, width: 38, height: 674, orientation: 'vertical' },
    { id: 'alley-e1-s', x: 1530, y: 1050, width: 38, height: 498, orientation: 'vertical' },
    { id: 'alley-e2-s', x: 1862, y: 874, width: 38, height: 674, orientation: 'vertical' },
  ];

  // Streetlamps placed along boulevards, ring road, and Mosque-adjacent intersections
  const lampCoords: Array<[number, number]> = [
    // Ring road around auditorium
    [826, 621], [975, 621], [1124, 621], [1236, 621], [1385, 621], [1534, 621],
    [826, 1031], [975, 1031], [1124, 1031], [1236, 1031], [1385, 1031], [1534, 1031],
    [811, 734], [811, 918], [1549, 734], [1549, 918],
    // Main West & East boulevards
    [250, 774], [440, 774], [630, 774], [250, 878], [440, 878], [630, 878],
    [1730, 774], [1920, 774], [2110, 774], [1730, 878], [1920, 878], [2110, 878],
    // Main North & South boulevards
    [1130, 180], [1230, 180], [1130, 384], [1230, 384], [1130, 548], [1230, 548],
    [1130, 1104], [1230, 1104], [1130, 1268], [1230, 1268], [1130, 1455], [1230, 1455],
    // Quadrant intersections (around the 4 Mosques)
    [479, 287], [811, 287], [1549, 287], [1881, 287],
    [479, 481], [811, 481], [1549, 481], [1881, 481],
    [479, 1171], [811, 1171], [1549, 1171], [1881, 1171],
    [479, 1365], [811, 1365], [1549, 1365], [1881, 1365],
  ];

  const lamps: StreetLamp[] = lampCoords.map(([x, y], idx) => ({
    id: `lamp-${idx}`,
    x,
    y,
  }));

  // Landscaped pocket parks along the outer perimeter
  const parks: ParkArea[] = [
    {
      id: 'park-nw',
      label: 'Taman Utara Barat',
      x: 24,
      y: 120,
      width: 82,
      height: 310,
      trees: [
        { x: 42, y: 44, r: 17 },
        { x: 38, y: 118, r: 14 },
        { x: 46, y: 194, r: 18 },
        { x: 38, y: 266, r: 15 },
      ],
    },
    {
      id: 'park-sw',
      label: 'Taman Selatan Barat',
      x: 24,
      y: 1210,
      width: 82,
      height: 310,
      trees: [
        { x: 40, y: 42, r: 16 },
        { x: 46, y: 118, r: 18 },
        { x: 36, y: 196, r: 14 },
        { x: 44, y: 268, r: 16 },
      ],
    },
    {
      id: 'park-ne',
      label: 'Taman Utara Timur',
      x: 2254,
      y: 120,
      width: 82,
      height: 310,
      trees: [
        { x: 40, y: 46, r: 16 },
        { x: 44, y: 122, r: 18 },
        { x: 36, y: 198, r: 15 },
        { x: 44, y: 266, r: 16 },
      ],
    },
    {
      id: 'park-se',
      label: 'Taman Selatan Timur',
      x: 2254,
      y: 1210,
      width: 82,
      height: 310,
      trees: [
        { x: 42, y: 46, r: 17 },
        { x: 36, y: 122, r: 14 },
        { x: 44, y: 196, r: 18 },
        { x: 40, y: 266, r: 15 },
      ],
    },
  ];

  const blockLabels: BlockLabel[] = [
    { block: 'A', title: 'BLOK A', range: 'A-01 – A-125', x: LEFT_QUAD_X + 12, y: 44 },
    { block: 'B', title: 'BLOK B', range: 'B-01 – B-125', x: RIGHT_QUAD_X + QUAD_W - 140, y: 44 },
    { block: 'C', title: 'BLOK C', range: 'C-01 – C-125', x: LEFT_QUAD_X + 12, y: BOTTOM_QUAD_Y + QUAD_H + 56 },
    { block: 'D', title: 'BLOK D', range: 'D-01 – D-125', x: RIGHT_QUAD_X + QUAD_W - 140, y: BOTTOM_QUAD_Y + QUAD_H + 56 },
  ];

  // Connected sidewalk/road waypoint graph for animated walking citizens
  const walkGraph: Record<string, WalkNode> = {};
  const addNode = (id: string, x: number, y: number) => {
    walkGraph[id] = { id, x, y, neighbors: [] };
  };
  const connect = (a: string, b: string) => {
    if (!walkGraph[a] || !walkGraph[b]) return;
    if (!walkGraph[a].neighbors.includes(b)) walkGraph[a].neighbors.push(b);
    if (!walkGraph[b].neighbors.includes(a)) walkGraph[b].neighbors.push(a);
  };

  // Key road centerlines
  const xs = [137, 479, 811, 1180, 1549, 1881, 2223];
  const ys = [85, 287, 481, 621, 826, 1031, 1171, 1365, 1567];

  for (let yi = 0; yi < ys.length; yi++) {
    for (let xi = 0; xi < xs.length; xi++) {
      if (xi === 3 && yi === 4) continue; // auditorium center
      addNode(`n_${xi}_${yi}`, xs[xi], ys[yi]);
    }
  }

  // Front plaza walkway nodes around the Auditorium courtyard
  addNode('plaza_s_w', 980, 992);
  addNode('plaza_s_c', 1180, 992);
  addNode('plaza_s_e', 1380, 992);

  for (let yi = 0; yi < ys.length; yi++) {
    for (let xi = 0; xi < xs.length - 1; xi++) {
      if (yi === 4 && (xi === 2 || xi === 3)) continue;
      connect(`n_${xi}_${yi}`, `n_${xi + 1}_${yi}`);
    }
  }

  for (let xi = 0; xi < xs.length; xi++) {
    for (let yi = 0; yi < ys.length - 1; yi++) {
      if (xi === 3 && (yi === 3 || yi === 4)) continue;
      connect(`n_${xi}_${yi}`, `n_${xi}_${yi + 1}`);
    }
  }

  connect('plaza_s_w', 'plaza_s_c');
  connect('plaza_s_c', 'plaza_s_e');
  connect('plaza_s_c', 'n_3_5');
  connect('plaza_s_w', 'n_2_5');
  connect('plaza_s_e', 'n_4_5');

  return {
    lots,
    lotsById,
    mosques,
    roads,
    lamps,
    parks,
    blockLabels,
    auditorium,
    walkGraph,
    walkNodeIds: Object.keys(walkGraph),
  };
}

let cachedLayout: NeighborhoodLayout | null = null;

export function getNeighborhoodLayout(): NeighborhoodLayout {
  if (!cachedLayout) {
    cachedLayout = buildNeighborhoodLayout();
  }
  return cachedLayout;
}
