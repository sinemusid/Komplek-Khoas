import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KavlingLot,
  MAX_ACTIVE_WALKERS,
  Resident,
  TimeOfDay,
  UserProfile,
} from '../config/khoasConfig';
import { WalkNode } from '../utils/mapLayout';
import {
  computeRotationStep,
  findNearestWalkNodeId,
  getPinnedResidentKeys,
  getResidentKey,
  randomIntInclusive,
  selectInitialWalkers,
} from '../utils/walkerRotation';
import { CitizenAvatarSvg } from './CitizenAvatarSvg';

interface WalkingCitizensLayerProps {
  residents: Resident[];
  lotsById: Record<string, KavlingLot>;
  walkGraph: Record<string, WalkNode>;
  walkNodeIds: string[];
  phase: TimeOfDay;
  isPaused: boolean;
  userProfile: UserProfile | null;
  shuffleNonce: number;
  onSelectCitizen: (resident: Resident) => void;
}

interface WalkerState {
  residentId: string;
  x: number;
  y: number;
  fromId: string;
  toId: string;
  speed: number;
  laneOffsetX: number;
  laneOffsetY: number;
  facingLeft: boolean;
}

interface WalkerSlot {
  key: string;
  phase: 'entering' | 'active' | 'exiting';
  spawnFromHouse: boolean;
}

const MAP_ROTATION_MIN_MS = 12000;
const MAP_ROTATION_MAX_MS = 18000;
const MAP_SWAP_MIN = 4;
const MAP_SWAP_MAX = 6;
const FADE_OUT_MS = 750;

function createWalkerPhysicsState(
  res: Resident,
  lotsById: Record<string, KavlingLot>,
  walkGraph: Record<string, WalkNode>,
  walkNodeIds: string[],
  spawnFromHouse: boolean
): WalkerState {
  const key = getResidentKey(res);
  const laneOffsetX = (Math.random() - 0.5) * 14;
  const laneOffsetY = (Math.random() - 0.5) * 10;
  const speed = 24 + Math.floor(Math.random() * 16);

  const lot = lotsById[res.kavlingId];
  if (spawnFromHouse && lot && walkNodeIds.length > 0) {
    // Muncul dari depan rumah / trotoar kavling masing-masing lalu berjalan ke simpul jalan terdekat
    const spawnX = lot.x + lot.width / 2;
    const spawnY = lot.facing === 'north' ? lot.y - 8 : lot.y + lot.height + 8;
    const nearestNodeId = findNearestWalkNodeId(spawnX, spawnY, walkGraph, walkNodeIds);
    const nearestNode = walkGraph[nearestNodeId];

    return {
      residentId: key,
      x: spawnX,
      y: spawnY,
      fromId: nearestNodeId,
      toId: nearestNodeId,
      speed,
      laneOffsetX: laneOffsetX * 0.45,
      laneOffsetY: laneOffsetY * 0.45,
      facingLeft: nearestNode ? nearestNode.x < spawnX : false,
    };
  }

  // Untuk warga awal di peta: sebar merata di seluruh jaringan jalan perumahan
  const startNodeId = walkNodeIds[Math.floor(Math.random() * walkNodeIds.length)];
  const startNode = walkGraph[startNodeId];
  const neighbors = startNode.neighbors;
  const targetId = neighbors[Math.floor(Math.random() * neighbors.length)] ?? startNodeId;
  const targetNode = walkGraph[targetId];
  const progress = Math.random() * 0.85;

  return {
    residentId: key,
    x: startNode.x + (targetNode.x - startNode.x) * progress,
    y: startNode.y + (targetNode.y - startNode.y) * progress,
    fromId: startNodeId,
    toId: targetId,
    speed,
    laneOffsetX,
    laneOffsetY,
    facingLeft: targetNode.x < startNode.x,
  };
}

export const WalkingCitizensLayer = React.memo(function WalkingCitizensLayer({
  residents,
  lotsById,
  walkGraph,
  walkNodeIds,
  phase,
  isPaused,
  userProfile,
  shuffleNonce,
  onSelectCitizen,
}: WalkingCitizensLayerProps) {
  const [walkerSlots, setWalkerSlots] = useState<WalkerSlot[]>([]);
  const [rotationCount, setRotationCount] = useState(0);

  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const walkersRef = useRef<WalkerState[]>([]);
  const lastShuffleNonceRef = useRef<number>(-1);
  const cleanupTimersRef = useRef<number[]>([]);

  const residentByKey = useMemo(() => {
    const map = new Map<string, Resident>();
    for (const r of residents) {
      map.set(getResidentKey(r), r);
    }
    return map;
  }, [residents]);

  const pinnedKeys = useMemo(
    () => getPinnedResidentKeys(residents, userProfile),
    [residents, userProfile]
  );

  // Refs untuk akses aman di timer rotasi tanpa me-reset timer saat profil/data berubah tipis
  const residentsRef = useRef(residents);
  residentsRef.current = residents;
  const pinnedKeysRef = useRef(pinnedKeys);
  pinnedKeysRef.current = pinnedKeys;
  const walkerSlotsRef = useRef<WalkerSlot[]>(walkerSlots);
  walkerSlotsRef.current = walkerSlots;

  // Bersihkan timeout tertunda saat unmount
  useEffect(() => {
    return () => {
      for (const id of cleanupTimersRef.current) {
        window.clearTimeout(id);
      }
      cleanupTimersRef.current = [];
    };
  }, []);

  // 1. Pengocokan Acak Awal (Fisher-Yates) saat halaman dimuat atau data di-refresh (shuffleNonce berubah)
  //    + sinkronisasi mulus saat warga login/pindah rumah tanpa mereset posisi warga lain
  useEffect(() => {
    if (residents.length === 0) {
      setWalkerSlots([]);
      walkersRef.current = [];
      return;
    }

    const shouldReshuffle = lastShuffleNonceRef.current !== shuffleNonce;
    if (shouldReshuffle) {
      lastShuffleNonceRef.current = shuffleNonce;
      const initial = selectInitialWalkers(residents, MAX_ACTIVE_WALKERS, pinnedKeys);
      setWalkerSlots(
        initial.map((r) => {
          const key = getResidentKey(r);
          return {
            key,
            phase: 'active',
            // User yang sedang login langsung muncul di dekat rumahnya sendiri
            spawnFromHouse: pinnedKeys.has(key),
          };
        })
      );
      return;
    }

    // Jika tidak ada refresh penuh, pertahankan walker saat ini dan pastikan user login selalu aktif
    setWalkerSlots((prev) => {
      const validPrev = prev.filter((slot) => residentByKey.has(slot.key));
      if (validPrev.length === 0) {
        const initial = selectInitialWalkers(residents, MAX_ACTIVE_WALKERS, pinnedKeys);
        return initial.map((r) => {
          const key = getResidentKey(r);
          return { key, phase: 'active', spawnFromHouse: pinnedKeys.has(key) };
        });
      }

      const activeKeys = new Set(validPrev.filter((s) => s.phase !== 'exiting').map((s) => s.key));
      const missingPinned: WalkerSlot[] = [];

      for (const pinnedKey of pinnedKeys) {
        if (residentByKey.has(pinnedKey) && !activeKeys.has(pinnedKey)) {
          missingPinned.push({ key: pinnedKey, phase: 'entering', spawnFromHouse: true });
          activeKeys.add(pinnedKey);
        }
      }

      if (missingPinned.length === 0 && validPrev.length === prev.length) {
        return prev;
      }

      const next = [...validPrev, ...missingPinned];
      // Jaga agar jumlah slot aktif (non-exiting) tetap <= MAX_ACTIVE_WALKERS
      let activeCount = next.filter((s) => s.phase !== 'exiting').length;
      if (activeCount > MAX_ACTIVE_WALKERS) {
        const trimmed: WalkerSlot[] = [];
        for (const slot of next) {
          if (
            activeCount > MAX_ACTIVE_WALKERS &&
            slot.phase !== 'exiting' &&
            !pinnedKeys.has(slot.key)
          ) {
            activeCount--;
            continue;
          }
          trimmed.push(slot);
        }
        return trimmed;
      }
      return next;
    });
  }, [residents, residentByKey, pinnedKeys, shuffleNonce]);

  // Promosikan warga baru ('entering') ke 'active' pada frame berikutnya untuk animasi fade-in halus
  useEffect(() => {
    const hasEntering = walkerSlots.some((s) => s.phase === 'entering');
    if (!hasEntering) return;

    const timerId = window.setTimeout(() => {
      setWalkerSlots((prev) =>
        prev.map((slot) => (slot.phase === 'entering' ? { ...slot, phase: 'active' } : slot))
      );
    }, 45);
    return () => window.clearTimeout(timerId);
  }, [walkerSlots]);

  // 2. Siklus Rotasi Otomatis Keluar-Masuk Rumah setiap 12–18 detik
  useEffect(() => {
    if (isPaused || residents.length <= MAX_ACTIVE_WALKERS) return;

    let cancelled = false;
    let rotationTimer = 0;

    const scheduleNextRotation = () => {
      const delayMs = randomIntInclusive(MAP_ROTATION_MIN_MS, MAP_ROTATION_MAX_MS);
      rotationTimer = window.setTimeout(() => {
        if (cancelled) return;

        const currentActiveKeys = walkerSlotsRef.current
          .filter((s) => s.phase !== 'exiting')
          .map((s) => s.key);

        const step = computeRotationStep(residentsRef.current, currentActiveKeys, {
          maxActive: MAX_ACTIVE_WALKERS,
          minSwap: MAP_SWAP_MIN,
          maxSwap: MAP_SWAP_MAX,
          pinnedKeys: pinnedKeysRef.current,
        });

        if (step.leavingKeys.length > 0 || step.enteringResidents.length > 0) {
          const leavingSet = new Set(step.leavingKeys);
          const enteringKeys = step.enteringResidents.map((r) => getResidentKey(r));

          setWalkerSlots((prev) => {
            const updatedExisting: WalkerSlot[] = prev.map((slot) =>
              leavingSet.has(slot.key) ? { ...slot, phase: 'exiting' } : slot
            );
            const existingKeySet = new Set(updatedExisting.map((s) => s.key));
            const newlyEntering: WalkerSlot[] = enteringKeys
              .filter((k) => !existingKeySet.has(k))
              .map((key) => ({
                key,
                phase: 'entering' as const,
                spawnFromHouse: true,
              }));
            return [...updatedExisting, ...newlyEntering];
          });

          setRotationCount((c) => c + 1);

          if (leavingSet.size > 0) {
            const cleanupId = window.setTimeout(() => {
              if (cancelled) return;
              setWalkerSlots((prev) =>
                prev.filter((slot) => !(slot.phase === 'exiting' && leavingSet.has(slot.key)))
              );
            }, FADE_OUT_MS);
            cleanupTimersRef.current.push(cleanupId);
          }
        }

        scheduleNextRotation();
      }, delayMs);
    };

    scheduleNextRotation();

    return () => {
      cancelled = true;
      window.clearTimeout(rotationTimer);
    };
  }, [isPaused, residents.length]);

  // 3. Sinkronisasi state fisika walker tanpa mereset posisi walker yang sedang berjalan
  useEffect(() => {
    if (walkNodeIds.length === 0) return;

    const existingMap = new Map(walkersRef.current.map((w) => [w.residentId, w]));
    const nextWalkers: WalkerState[] = [];

    for (const slot of walkerSlots) {
      const res = residentByKey.get(slot.key);
      if (!res) continue;

      const prev = existingMap.get(slot.key);
      if (prev) {
        nextWalkers.push(prev);
        continue;
      }

      nextWalkers.push(
        createWalkerPhysicsState(res, lotsById, walkGraph, walkNodeIds, slot.spawnFromHouse)
      );
    }

    walkersRef.current = nextWalkers;

    // Terapkan transform awal segera agar tidak berkedip di (0,0)
    for (const w of nextWalkers) {
      const el = nodeRefs.current[w.residentId];
      if (el) {
        el.style.transform = `translate3d(${(w.x + w.laneOffsetX).toFixed(1)}px, ${(w.y + w.laneOffsetY).toFixed(1)}px, 0)`;
      }
    }
  }, [walkerSlots, residentByKey, lotsById, walkGraph, walkNodeIds]);

  // 4. Loop requestAnimationFrame murni 60fps — mutasi transform DOM langsung (0 React re-render per frame)
  useEffect(() => {
    if (isPaused || walkerSlots.length === 0) return;
    let frameId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - lastTs) / 1000);
      lastTs = now;

      const walkers = walkersRef.current;
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i];
        const target = walkGraph[w.toId];
        if (!target) continue;

        const dx = target.x - w.x;
        const dy = target.y - w.y;
        const dist = Math.hypot(dx, dy);
        const step = w.speed * dt;

        if (dist <= step + 0.5) {
          w.x = target.x;
          w.y = target.y;
          const neighbors = target.neighbors;
          const forwardChoices = neighbors.filter((id) => id !== w.fromId);
          const pool = forwardChoices.length > 0 ? forwardChoices : neighbors;
          const nextId = pool[Math.floor(Math.random() * pool.length)] ?? w.fromId;
          w.fromId = w.toId;
          w.toId = nextId;
          const nextNode = walkGraph[nextId];
          if (nextNode && Math.abs(nextNode.x - w.x) > 1) {
            w.facingLeft = nextNode.x < w.x;
          }
        } else {
          w.x += (dx / dist) * step;
          w.y += (dy / dist) * step;
        }

        const el = nodeRefs.current[w.residentId];
        if (el) {
          el.style.transform = `translate3d(${(w.x + w.laneOffsetX).toFixed(1)}px, ${(w.y + w.laneOffsetY).toFixed(1)}px, 0)`;
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [walkerSlots.length, isPaused, walkGraph]);

  const isDark = phase === 'night' || phase === 'dusk';
  const activeCount = walkerSlots.filter((s) => s.phase !== 'exiting').length;

  return (
    <div
      data-testid="walking-citizens-layer"
      data-walker-count={activeCount}
      data-rotation-count={rotationCount}
      className="pointer-events-none absolute inset-0 z-10"
    >
      {walkerSlots.map((slot) => {
        const resident = residentByKey.get(slot.key);
        if (!resident) return null;

        const isPinnedOwner = pinnedKeys.has(slot.key);
        const isFading = slot.phase === 'entering' || slot.phase === 'exiting';
        const shortName =
          resident.nama.length > 15 ? `${resident.nama.slice(0, 14).trim()}…` : resident.nama;

        return (
          <button
            key={slot.key}
            ref={(el) => {
              nodeRefs.current[slot.key] = el;
            }}
            type="button"
            data-testid="walking-citizen"
            data-resident-key={slot.key}
            data-house-number={resident.houseNumber}
            data-phase={slot.phase}
            data-pinned={isPinnedOwner ? 'true' : 'false'}
            aria-label={`Warga ${resident.nama} (${resident.houseNumberFormatted}, Kavling ${resident.kavlingId})`}
            disabled={slot.phase === 'exiting'}
            onClick={(e) => {
              e.stopPropagation();
              if (slot.phase !== 'exiting') {
                onSelectCitizen(resident);
              }
            }}
            style={{
              willChange: 'transform',
            }}
            className={`group absolute left-0 top-0 -ml-3 -mt-6 flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              slot.phase === 'exiting'
                ? 'pointer-events-none'
                : 'pointer-events-auto cursor-pointer'
            }`}
          >
            {/* Inner fade/scale wrapper terpisah dari transform 60fps luar */}
            <div
              className={`flex flex-col items-center transition-[opacity,transform] duration-700 ${
                isFading
                  ? 'scale-75 opacity-0 ease-in'
                  : 'scale-100 opacity-100 ease-out'
              }`}
            >
              {/* Floating Name Tag above head */}
              <span
                className={`mb-[2px] max-w-[116px] truncate whitespace-nowrap rounded-[4px] px-1.5 py-[1px] text-[9px] font-semibold leading-tight shadow-sm transition-transform duration-150 group-hover:scale-110 ${
                  isPinnedOwner
                    ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-200'
                    : isDark
                      ? 'bg-slate-900/90 text-amber-100 ring-1 ring-amber-300/35'
                      : 'bg-white/95 text-slate-900 ring-1 ring-slate-900/15'
                }`}
              >
                {shortName}
              </span>

              {/* Gender-Aware Mini-Avatar (Perempuan berhijab / Laki-laki / Netral) */}
              <div className="animate-citizen-bob relative flex flex-col items-center">
                <CitizenAvatarSvg
                  gender={resident.jenisKelamin}
                  seed={resident.colorSeed}
                  width={18}
                  height={22}
                  showShadow={true}
                  className="drop-shadow-sm"
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
