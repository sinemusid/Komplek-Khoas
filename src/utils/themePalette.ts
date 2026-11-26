import { TimeOfDay } from '../config/khoasConfig';

export interface MapTheme {
  viewportBg: string;
  terrainBg: string;
  terrainPattern: string;
  blockSurface: string;
  blockBorder: string;
  parkBg: string;
  parkBorder: string;
  treeCanopy: string;
  treeHighlight: string;
  roadAsphalt: string;
  roadShoulder: string;
  roadDash: string;
  sidewalk: string;
  plazaTile: string;
  plazaBorder: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  vacantLotBg: string;
  vacantRoofTop: string;
  vacantRoofSide: string;
  vacantWall: string;
  occupiedYardBg: string;
  labelColor: string;
  lampGlowOpacity: number;
  ambientOverlay: string;
  hudGlass: string;
  hudText: string;
  hudMuted: string;
  hudBorder: string;
}

export const MAP_THEMES: Record<TimeOfDay, MapTheme> = {
  day: {
    viewportBg: '#9dc488',
    terrainBg: '#b8d99c',
    terrainPattern: 'rgba(255,255,255,0.16)',
    blockSurface: '#cbe3b2',
    blockBorder: '#9dbb82',
    parkBg: '#8ec474',
    parkBorder: '#76ae5c',
    treeCanopy: '#3e8a4a',
    treeHighlight: '#5cab5f',
    roadAsphalt: '#475569',
    roadShoulder: '#cbd5e1',
    roadDash: 'rgba(248, 250, 252, 0.72)',
    sidewalk: '#e7e5e0',
    plazaTile: '#e8e4dc',
    plazaBorder: '#c9c3b8',
    shadowOffsetX: 3,
    shadowOffsetY: 4,
    shadowColor: 'rgba(15, 23, 42, 0.24)',
    vacantLotBg: '#d8ddd4',
    vacantRoofTop: '#94a3b8',
    vacantRoofSide: '#64748b',
    vacantWall: '#e2e8f0',
    occupiedYardBg: '#a6d487',
    labelColor: '#1e3a24',
    lampGlowOpacity: 0,
    ambientOverlay: 'transparent',
    hudGlass: 'bg-white/92 backdrop-blur-md text-slate-900 border-slate-200/90 shadow-lg shadow-slate-900/8',
    hudText: 'text-slate-900',
    hudMuted: 'text-slate-500',
    hudBorder: 'border-slate-200/80',
  },
  dusk: {
    viewportBg: '#3c3142',
    terrainBg: '#6c7554',
    terrainPattern: 'rgba(254, 215, 170, 0.1)',
    blockSurface: '#7d835d',
    blockBorder: '#5b6044',
    parkBg: '#586d46',
    parkBorder: '#435535',
    treeCanopy: '#2f5637',
    treeHighlight: '#69864c',
    roadAsphalt: '#333647',
    roadShoulder: '#8d8078',
    roadDash: 'rgba(254, 215, 170, 0.6)',
    sidewalk: '#b59f8c',
    plazaTile: '#b49e8a',
    plazaBorder: '#847061',
    shadowOffsetX: 6,
    shadowOffsetY: 5,
    shadowColor: 'rgba(28, 16, 30, 0.44)',
    vacantLotBg: '#7d7772',
    vacantRoofTop: '#676b78',
    vacantRoofSide: '#494c59',
    vacantWall: '#a3a8b3',
    occupiedYardBg: '#779658',
    labelColor: '#fef3c7',
    lampGlowOpacity: 0.62,
    ambientOverlay:
      'linear-gradient(135deg, rgba(251, 146, 60, 0.18) 0%, rgba(190, 24, 93, 0.1) 55%, rgba(30, 27, 75, 0.2) 100%)',
    hudGlass: 'bg-stone-900/88 backdrop-blur-md text-amber-50 border-amber-200/20 shadow-xl shadow-black/30',
    hudText: 'text-amber-50',
    hudMuted: 'text-amber-200/75',
    hudBorder: 'border-amber-200/20',
  },
  night: {
    viewportBg: '#0b1020',
    terrainBg: '#121b2e',
    terrainPattern: 'rgba(148,163,184,0.05)',
    blockSurface: '#18243b',
    blockBorder: '#0e1729',
    parkBg: '#132a2e',
    parkBorder: '#0d1f24',
    treeCanopy: '#143836',
    treeHighlight: '#1e4d46',
    roadAsphalt: '#1e2538',
    roadShoulder: '#334155',
    roadDash: 'rgba(148, 163, 184, 0.35)',
    sidewalk: '#2b354d',
    plazaTile: '#263147',
    plazaBorder: '#3b4a69',
    shadowOffsetX: 4,
    shadowOffsetY: 5,
    shadowColor: 'rgba(2, 6, 23, 0.65)',
    vacantLotBg: '#192234',
    vacantRoofTop: '#263145',
    vacantRoofSide: '#1a2333',
    vacantWall: '#313d54',
    occupiedYardBg: '#1d363e',
    labelColor: '#cbd5e1',
    lampGlowOpacity: 1,
    ambientOverlay:
      'radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.08) 0%, rgba(2, 6, 23, 0.42) 100%)',
    hudGlass: 'bg-slate-950/88 backdrop-blur-md text-slate-100 border-slate-700/70 shadow-xl shadow-black/50',
    hudText: 'text-slate-100',
    hudMuted: 'text-slate-400',
    hudBorder: 'border-slate-700/70',
  },
};

export interface RoofPalette {
  top: string;
  side: string;
  ridge: string;
  wall: string;
}

export const OCCUPIED_ROOF_PALETTES: RoofPalette[] = [
  // Terracotta warm
  { top: '#d95d39', side: '#b24222', ridge: '#f08a6b', wall: '#fff7ed' },
  // Coastal teal
  { top: '#0d9488', side: '#0f766e', ridge: '#5eead4', wall: '#f0fdfa' },
  // Sunlit ochre
  { top: '#d97706', side: '#b45309', ridge: '#fcd34d', wall: '#fffbeb' },
  // Architectural cobalt
  { top: '#2563eb', side: '#1d4ed8', ridge: '#93c5fd', wall: '#eff6ff' },
  // Berry crimson
  { top: '#e11d48', side: '#be123c', ridge: '#fda4af', wall: '#fff1f2' },
];

export const AVATAR_SHIRT_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#6366f1',
];

export const AVATAR_HAIR_COLORS = [
  '#1e293b',
  '#3b2314',
  '#0f172a',
  '#5c3a21',
  '#292524',
];

export const AVATAR_SKIN_TONES = [
  '#f6d2b5',
  '#e8b994',
  '#d79e72',
  '#f1c5a4',
];

export function getAvatarAppearance(seed: number) {
  return {
    shirt: AVATAR_SHIRT_COLORS[seed % AVATAR_SHIRT_COLORS.length],
    hair: AVATAR_HAIR_COLORS[(seed >> 3) % AVATAR_HAIR_COLORS.length],
    skin: AVATAR_SKIN_TONES[(seed >> 5) % AVATAR_SKIN_TONES.length],
  };
}
