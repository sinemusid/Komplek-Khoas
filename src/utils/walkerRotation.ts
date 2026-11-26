import { Resident, UserProfile } from '../config/khoasConfig';
import { WalkNode } from './mapLayout';
import { isOwnResident } from './sheetParser';

export interface RotationStepOptions {
  maxActive: number;
  minSwap: number;
  maxSwap: number;
  pinnedKeys?: ReadonlySet<string>;
  rng?: () => number;
}

export interface RotationStepResult {
  leavingKeys: string[];
  enteringResidents: Resident[];
  nextActiveKeys: string[];
}

/**
 * Kunci unik stabil untuk satu unit warga pada peta & auditorium.
 */
export function getResidentKey(resident: Pick<Resident, 'houseNumber' | 'kavlingId'>): string {
  return `${resident.houseNumber}-${resident.kavlingId}`;
}

/**
 * Fisher-Yates Shuffle (tidak memutasi array sumber) untuk pengocokan acak yang adil.
 */
export function fisherYatesShuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Menghasilkan bilangan bulat acak inklusif antara [min, max].
 */
export function randomIntInclusive(
  min: number,
  max: number,
  rng: () => number = Math.random
): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Mengembalikan himpunan kunci warga yang wajib diprioritaskan (user yang sedang login).
 */
export function getPinnedResidentKeys(
  residents: readonly Resident[],
  userProfile: Pick<UserProfile, 'nama' | 'nomorRumah' | 'idKavling'> | null
): Set<string> {
  const pinned = new Set<string>();
  if (!userProfile) return pinned;
  for (const resident of residents) {
    if (isOwnResident(resident, userProfile)) {
      pinned.add(getResidentKey(resident));
    }
  }
  return pinned;
}

/**
 * Memilih warga awal menggunakan Fisher-Yates Shuffle dari seluruh daftar peserta terdaftar,
 * dengan selalu menyertakan warga yang dipin (user login).
 */
export function selectInitialWalkers(
  residents: readonly Resident[],
  maxCount: number,
  pinnedKeys: ReadonlySet<string> = new Set(),
  rng: () => number = Math.random
): Resident[] {
  if (maxCount <= 0 || residents.length === 0) return [];

  const shuffled = fisherYatesShuffle(residents, rng);
  const pinned: Resident[] = [];
  const unpinned: Resident[] = [];

  for (const res of shuffled) {
    if (pinnedKeys.has(getResidentKey(res))) {
      pinned.push(res);
    } else {
      unpinned.push(res);
    }
  }

  return [...pinned, ...unpinned].slice(0, maxCount);
}

/**
 * Menghitung satu siklus rotasi warga keluar-masuk secara acak.
 * - Tidak pernah merotasi keluar warga yang ada di `pinnedKeys` (user login).
 * - Mengambil pengganti secara acak dari warga yang sedang tidak tampil (bench).
 * - Menjamin tidak ada duplikat dan total aktif tidak melebihi `maxActive`.
 */
export function computeRotationStep(
  residents: readonly Resident[],
  currentActiveKeys: readonly string[],
  options: RotationStepOptions
): RotationStepResult {
  const { maxActive, minSwap, maxSwap, pinnedKeys = new Set<string>(), rng = Math.random } = options;

  if (maxActive <= 0 || residents.length === 0) {
    return { leavingKeys: [], enteringResidents: [], nextActiveKeys: [] };
  }

  const residentByKey = new Map<string, Resident>();
  for (const r of residents) {
    residentByKey.set(getResidentKey(r), r);
  }

  // Deduplikasi & pastikan hanya kunci warga yang masih valid
  const activeSet = new Set<string>();
  const validActiveKeys: string[] = [];
  for (const key of currentActiveKeys) {
    if (residentByKey.has(key) && !activeSet.has(key)) {
      activeSet.add(key);
      validActiveKeys.push(key);
    }
  }

  // Warga yang sedang tidak tampil di peta / auditorium
  const bench: Resident[] = [];
  for (const r of residents) {
    const key = getResidentKey(r);
    if (!activeSet.has(key)) {
      bench.push(r);
    }
  }

  if (bench.length === 0) {
    return { leavingKeys: [], enteringResidents: [], nextActiveKeys: validActiveKeys };
  }

  // Prioritaskan warga yang dipin bila kebetulan belum aktif
  const pinnedBench: Resident[] = [];
  const unpinnedBench: Resident[] = [];
  for (const r of bench) {
    if (pinnedKeys.has(getResidentKey(r))) {
      pinnedBench.push(r);
    } else {
      unpinnedBench.push(r);
    }
  }
  const orderedBench = [...pinnedBench, ...fisherYatesShuffle(unpinnedBench, rng)];

  const rotatableActive = validActiveKeys.filter((key) => !pinnedKeys.has(key));
  const desiredSwap = randomIntInclusive(minSwap, maxSwap, rng);
  const actualSwap = Math.min(desiredSwap, orderedBench.length, rotatableActive.length);

  const leavingKeys =
    actualSwap > 0 ? fisherYatesShuffle(rotatableActive, rng).slice(0, actualSwap) : [];
  const leavingSet = new Set(leavingKeys);

  const remainingActive = validActiveKeys.filter((key) => !leavingSet.has(key));
  const capacityToFill = Math.max(0, maxActive - remainingActive.length);
  const enterCount = Math.min(orderedBench.length, capacityToFill);
  const enteringResidents = orderedBench.slice(0, enterCount);

  const nextActiveKeys = [
    ...remainingActive,
    ...enteringResidents.map((r) => getResidentKey(r)),
  ];

  return {
    leavingKeys,
    enteringResidents,
    nextActiveKeys,
  };
}

/**
 * Mencari ID simpul jalan terdekat dari koordinat (x, y) rumah/kavling
 * agar warga yang baru muncul keluar langsung dari depan rumah menuju jalan terdekat.
 */
export function findNearestWalkNodeId(
  x: number,
  y: number,
  walkGraph: Record<string, WalkNode>,
  walkNodeIds: readonly string[]
): string {
  let bestId = walkNodeIds[0] ?? '';
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < walkNodeIds.length; i++) {
    const id = walkNodeIds[i];
    const node = walkGraph[id];
    if (!node) continue;
    const dx = node.x - x;
    const dy = node.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestId = id;
    }
  }

  return bestId;
}
