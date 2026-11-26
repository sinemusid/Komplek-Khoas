import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Gift,
  Info,
  LogIn,
  MessageCircle,
  Music,
  Sparkles,
  User,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  MAX_KAVLING_QUOTA,
  Resident,
  UserProfile,
  WHATSAPP_GROUP_URL,
} from '../config/khoasConfig';
import { getEventCountdown } from '../utils/countdown';
import {
  computeRotationStep,
  getPinnedResidentKeys,
  getResidentKey,
  randomIntInclusive,
  selectInitialWalkers,
} from '../utils/walkerRotation';
import { CitizenAvatarSvg } from './CitizenAvatarSvg';

interface AuditoriumInteriorProps {
  residents: Resident[];
  userProfile: UserProfile | null;
  shuffleNonce: number;
  isQuotaFull: boolean;
  isLofiPlaying: boolean;
  onToggleLofi: () => void;
  onExit: () => void;
  onSelectResident: (resident: Resident) => void;
  onOpenAccountOrProfile: () => void;
}

interface SeatSlot {
  id: string;
  xPct: number;
  yPct: number;
  scale: number;
}

interface HallWaypoint {
  id: string;
  xPct: number;
  yPct: number;
  neighbors: string[];
}

interface HallWalkerState {
  key: string;
  xPct: number;
  yPct: number;
  fromId: string;
  toId: string;
  speedPctPerSec: number;
}

/**
 * Menghasilkan tata kursi kosong yang rapi dan simetris di 4 blok lantai utama + balkon belakang.
 */
function buildTidyEmptySeats(): SeatSlot[] {
  const slots: SeatSlot[] = [];
  const rows = 5;

  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const yPct = 62.5 + t * 17.0;
    const scale = 0.78 + t * 0.28;
    const spread = 1 + t * 0.15;

    // Left angled wing (3 seats)
    for (let c = 0; c < 3; c++) {
      slots.push({
        id: `lw-${r}-${c}`,
        xPct: 24.5 - (2 - c) * 3.1 * spread - t * 3.6,
        yPct: yPct + (2 - c) * 0.5,
        scale,
      });
    }
    // Center-Left block (4 seats)
    for (let c = 0; c < 4; c++) {
      slots.push({
        id: `cl-${r}-${c}`,
        xPct: 36.2 + c * 3.15 * spread - t * 2.0,
        yPct,
        scale,
      });
    }
    // Center-Right block (4 seats)
    for (let c = 0; c < 4; c++) {
      slots.push({
        id: `cr-${r}-${c}`,
        xPct: 54.4 + c * 3.15 * spread - t * 0.35,
        yPct,
        scale,
      });
    }
    // Right angled wing (3 seats)
    for (let c = 0; c < 3; c++) {
      slots.push({
        id: `rw-${r}-${c}`,
        xPct: 75.5 + c * 3.1 * spread + t * 3.6,
        yPct: yPct + c * 0.5,
        scale,
      });
    }
  }

  // Rear lower balcony flanking FOH booth
  for (let c = 0; c < 4; c++) {
    slots.push({ id: `bal-l-${c}`, xPct: 11.5 + c * 5.2, yPct: 91.5, scale: 1.02 });
    slots.push({ id: `bal-r-${c}`, xPct: 73 + c * 5.2, yPct: 91.5, scale: 1.02 });
  }

  return slots;
}

/**
 * Jaringan lorong pejalan kaki di depan panggung & lorong tengah/samping auditorium
 * agar 3–5 avatar warga dapat berlalu-lalang santai tepat di karpet depan panggung & lorong.
 */
const HALL_WAYPOINTS: Record<string, HallWaypoint> = {
  front_far_l: { id: 'front_far_l', xPct: 25.5, yPct: 59.5, neighbors: ['front_l'] },
  front_l: { id: 'front_l', xPct: 33.4, yPct: 60.0, neighbors: ['front_far_l', 'front_c', 'aisle_l_mid'] },
  front_c: { id: 'front_c', xPct: 50.0, yPct: 60.8, neighbors: ['front_l', 'front_r', 'aisle_c_mid'] },
  front_r: { id: 'front_r', xPct: 66.6, yPct: 60.0, neighbors: ['front_c', 'front_far_r', 'aisle_r_mid'] },
  front_far_r: { id: 'front_far_r', xPct: 74.5, yPct: 59.5, neighbors: ['front_r'] },
  aisle_l_mid: { id: 'aisle_l_mid', xPct: 29.8, yPct: 70.0, neighbors: ['front_l', 'aisle_l_back'] },
  aisle_l_back: { id: 'aisle_l_back', xPct: 26.2, yPct: 80.5, neighbors: ['aisle_l_mid', 'aisle_c_back'] },
  aisle_c_mid: { id: 'aisle_c_mid', xPct: 50.0, yPct: 70.5, neighbors: ['front_c', 'aisle_c_back'] },
  aisle_c_back: { id: 'aisle_c_back', xPct: 50.0, yPct: 81.0, neighbors: ['aisle_c_mid', 'aisle_l_back', 'aisle_r_back'] },
  aisle_r_mid: { id: 'aisle_r_mid', xPct: 70.2, yPct: 70.0, neighbors: ['front_r', 'aisle_r_back'] },
  aisle_r_back: { id: 'aisle_r_back', xPct: 73.8, yPct: 80.5, neighbors: ['aisle_r_mid', 'aisle_c_back'] },
};

const HALL_START_NODES = ['front_l', 'front_c', 'front_r', 'aisle_c_mid', 'aisle_l_mid'];
const HALL_ENTRANCE_NODES = ['aisle_l_back', 'aisle_r_back', 'aisle_c_back', 'front_far_l', 'front_far_r'];
const HALL_EXIT_NODES = ['aisle_l_back', 'aisle_r_back', 'aisle_c_back'];

const AUDITORIUM_MAX_WALKERS = 5;
const AUDITORIUM_ROTATION_MIN_MS = 15000;
const AUDITORIUM_ROTATION_MAX_MS = 20000;
const AUDITORIUM_SWAP_MIN = 1;
const AUDITORIUM_SWAP_MAX = 2;
const AUDITORIUM_FADE_OUT_MS = 750;

interface HallWalkerSlot {
  key: string;
  phase: 'entering' | 'active' | 'exiting';
  spawnAtEntrance: boolean;
}

function findNearestExitNode(xPct: number, yPct: number): string {
  let bestId = HALL_EXIT_NODES[0];
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const id of HALL_EXIT_NODES) {
    const wp = HALL_WAYPOINTS[id];
    const distSq = (wp.xPct - xPct) ** 2 + (wp.yPct - yPct) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestId = id;
    }
  }
  return bestId;
}

export function AuditoriumInterior({
  residents,
  userProfile,
  shuffleNonce,
  isQuotaFull,
  isLofiPlaying,
  onToggleLofi,
  onExit,
  onSelectResident,
  onOpenAccountOrProfile,
}: AuditoriumInteriorProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [countdown, setCountdown] = useState(() => getEventCountdown());
  const [hallSlots, setHallSlots] = useState<HallWalkerSlot[]>([]);
  const [rotationCount, setRotationCount] = useState(0);

  const seatSlots = useMemo(() => buildTidyEmptySeats(), []);

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

  const residentsRef = useRef(residents);
  residentsRef.current = residents;
  const pinnedKeysRef = useRef(pinnedKeys);
  pinnedKeysRef.current = pinnedKeys;
  const hallSlotsRef = useRef<HallWalkerSlot[]>(hallSlots);
  hallSlotsRef.current = hallSlots;

  const walkerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const walkersStateRef = useRef<HallWalkerState[]>([]);
  const lastShuffleNonceRef = useRef<number>(-1);
  const cleanupTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const id of cleanupTimersRef.current) {
        window.clearTimeout(id);
      }
      cleanupTimersRef.current = [];
    };
  }, []);

  // Live 1-second countdown tick to 11 Desember 2026 19:30 WIB
  useEffect(() => {
    setCountdown(getEventCountdown());
    const id = window.setInterval(() => {
      setCountdown(getEventCountdown());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Initial Fisher-Yates shuffle of 3–5 walkers when entering auditorium or refreshing data
  useEffect(() => {
    if (residents.length === 0) {
      setHallSlots([]);
      walkersStateRef.current = [];
      return;
    }

    const shouldReshuffle = lastShuffleNonceRef.current !== shuffleNonce;
    if (shouldReshuffle) {
      lastShuffleNonceRef.current = shuffleNonce;
      const targetCount = Math.min(AUDITORIUM_MAX_WALKERS, residents.length);
      const initial = selectInitialWalkers(residents, targetCount, pinnedKeys);
      setHallSlots(
        initial.map((res) => ({
          key: getResidentKey(res),
          phase: 'active',
          spawnAtEntrance: false,
        }))
      );
      return;
    }

    setHallSlots((prev) => {
      const validPrev = prev.filter((slot) => residentByKey.has(slot.key));
      if (validPrev.length === 0) {
        const targetCount = Math.min(AUDITORIUM_MAX_WALKERS, residents.length);
        const initial = selectInitialWalkers(residents, targetCount, pinnedKeys);
        return initial.map((res) => ({
          key: getResidentKey(res),
          phase: 'active',
          spawnAtEntrance: false,
        }));
      }
      return validPrev;
    });
  }, [residents, residentByKey, pinnedKeys, shuffleNonce]);

  // Promote newly entered walkers from 'entering' -> 'active' on next frame for smooth fade-in
  useEffect(() => {
    if (!hallSlots.some((s) => s.phase === 'entering')) return;
    const timerId = window.setTimeout(() => {
      setHallSlots((prev) =>
        prev.map((slot) => (slot.phase === 'entering' ? { ...slot, phase: 'active' } : slot))
      );
    }, 45);
    return () => window.clearTimeout(timerId);
  }, [hallSlots]);

  // Automatic smooth rotation every 15–20 seconds (1–2 walkers exit via aisle, 1–2 random residents enter)
  useEffect(() => {
    if (residents.length <= AUDITORIUM_MAX_WALKERS) return;

    let cancelled = false;
    let rotationTimer = 0;

    const scheduleNextRotation = () => {
      const delayMs = randomIntInclusive(AUDITORIUM_ROTATION_MIN_MS, AUDITORIUM_ROTATION_MAX_MS);
      rotationTimer = window.setTimeout(() => {
        if (cancelled) return;

        const currentActiveKeys = hallSlotsRef.current
          .filter((s) => s.phase !== 'exiting')
          .map((s) => s.key);

        const step = computeRotationStep(residentsRef.current, currentActiveKeys, {
          maxActive: Math.min(AUDITORIUM_MAX_WALKERS, residentsRef.current.length),
          minSwap: AUDITORIUM_SWAP_MIN,
          maxSwap: AUDITORIUM_SWAP_MAX,
          pinnedKeys: pinnedKeysRef.current,
        });

        if (step.leavingKeys.length > 0 || step.enteringResidents.length > 0) {
          const leavingSet = new Set(step.leavingKeys);
          const enteringKeys = step.enteringResidents.map((r) => getResidentKey(r));

          // Arahkan warga yang keluar menuju lorong belakang/keluar sembari fade-out halus
          for (const w of walkersStateRef.current) {
            if (leavingSet.has(w.key)) {
              w.toId = findNearestExitNode(w.xPct, w.yPct);
            }
          }

          setHallSlots((prev) => {
            const updatedExisting: HallWalkerSlot[] = prev.map((slot) =>
              leavingSet.has(slot.key) ? { ...slot, phase: 'exiting' } : slot
            );
            const existingSet = new Set(updatedExisting.map((s) => s.key));
            const newlyEntering: HallWalkerSlot[] = enteringKeys
              .filter((k) => !existingSet.has(k))
              .map((key) => ({
                key,
                phase: 'entering' as const,
                spawnAtEntrance: true,
              }));
            return [...updatedExisting, ...newlyEntering];
          });

          setRotationCount((c) => c + 1);

          if (leavingSet.size > 0) {
            const cleanupId = window.setTimeout(() => {
              if (cancelled) return;
              setHallSlots((prev) =>
                prev.filter((slot) => !(slot.phase === 'exiting' && leavingSet.has(slot.key)))
              );
            }, AUDITORIUM_FADE_OUT_MS);
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
  }, [residents.length]);

  // Initialize / sync walking physics state for auditorium aisle walkers
  useEffect(() => {
    const existing = new Map(walkersStateRef.current.map((w) => [w.key, w]));
    const next: HallWalkerState[] = [];

    hallSlots.forEach((slot, idx) => {
      const res = residentByKey.get(slot.key);
      if (!res) return;

      const prev = existing.get(slot.key);
      if (prev) {
        next.push(prev);
        return;
      }

      if (slot.spawnAtEntrance) {
        const entranceId =
          HALL_ENTRANCE_NODES[Math.floor(Math.random() * HALL_ENTRANCE_NODES.length)];
        const entranceNode = HALL_WAYPOINTS[entranceId];
        const targetId =
          entranceNode.neighbors[Math.floor(Math.random() * entranceNode.neighbors.length)] ??
          'front_c';
        next.push({
          key: slot.key,
          xPct: entranceNode.xPct,
          yPct: entranceNode.yPct,
          fromId: entranceId,
          toId: targetId,
          speedPctPerSec: 3.6 + (res.colorSeed % 3) * 0.75,
        });
      } else {
        const startId = HALL_START_NODES[idx % HALL_START_NODES.length];
        const startNode = HALL_WAYPOINTS[startId];
        const targetId = startNode.neighbors[idx % startNode.neighbors.length] ?? startId;
        const targetNode = HALL_WAYPOINTS[targetId];
        const t = 0.15 + Math.random() * 0.65;

        next.push({
          key: slot.key,
          xPct: startNode.xPct + (targetNode.xPct - startNode.xPct) * t,
          yPct: startNode.yPct + (targetNode.yPct - startNode.yPct) * t,
          fromId: startId,
          toId: targetId,
          speedPctPerSec: 3.6 + (res.colorSeed % 3) * 0.75,
        });
      }
    });

    walkersStateRef.current = next;

    for (const w of next) {
      const el = walkerRefs.current[w.key];
      if (el) {
        const depthScale = 0.86 + ((w.yPct - 54) / 26) * 0.34;
        el.style.left = `${w.xPct.toFixed(2)}%`;
        el.style.top = `${w.yPct.toFixed(2)}%`;
        el.style.transform = `translate(-50%, -88%) scale(${depthScale.toFixed(3)})`;
      }
    }
  }, [hallSlots, residentByKey]);

  // Smooth 60fps requestAnimationFrame walking loop inside auditorium
  useEffect(() => {
    if (hallSlots.length === 0) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - lastTs) / 1000);
      lastTs = now;

      const list = walkersStateRef.current;
      for (let i = 0; i < list.length; i++) {
        const w = list[i];
        const target = HALL_WAYPOINTS[w.toId];
        if (!target) continue;

        const dx = target.xPct - w.xPct;
        const dy = target.yPct - w.yPct;
        const dist = Math.hypot(dx, dy);
        const step = w.speedPctPerSec * dt;

        if (dist <= step + 0.15) {
          w.xPct = target.xPct;
          w.yPct = target.yPct;
          const forward = target.neighbors.filter((nid) => nid !== w.fromId);
          const pool = forward.length > 0 ? forward : target.neighbors;
          const nextId = pool[Math.floor(Math.random() * pool.length)] ?? w.fromId;
          w.fromId = w.toId;
          w.toId = nextId;
        } else {
          w.xPct += (dx / dist) * step;
          w.yPct += (dy / dist) * step;
        }

        const el = walkerRefs.current[w.key];
        if (el) {
          const depthScale = 0.86 + ((w.yPct - 54) / 26) * 0.34;
          el.style.left = `${w.xPct.toFixed(2)}%`;
          el.style.top = `${w.yPct.toFixed(2)}%`;
          el.style.transform = `translate(-50%, -88%) scale(${depthScale.toFixed(3)})`;
          el.style.zIndex = String(20 + Math.round(w.yPct));
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [hallSlots.length]);

  const activeHallWalkerCount = hallSlots.filter((s) => s.phase !== 'exiting').length;

  return (
    <div
      data-testid="auditorium-interior"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#07060d] text-white"
    >
      {/* Top Auditorium Header Bar (Clean: Back button, Lofi Toggle, Event Info, Account/Profile — NO Arah Penonton toggle) */}
      <header className="relative z-30 flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 bg-[#0d0c18]/92 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Keluar ke Peta Komplek Khoas</span>
          </button>

          <div className="hidden items-center gap-2 text-xs text-slate-300 md:flex">
            <span className="font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Auditorium Komik Khoas
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="font-mono tabular-nums text-amber-300">
              {residents.length} / {MAX_KAVLING_QUOTA} Warga
            </span>
          </div>
        </div>

        {/* Right Controls: Lofi Music Toggle + Event Info + Account/Profile */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="auditorium-lofi-toggle"
            onClick={onToggleLofi}
            aria-pressed={isLofiPlaying}
            aria-label={isLofiPlaying ? 'Matikan musik lofi' : 'Putar musik lofi'}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              isLofiPlaying
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'
                : 'border-white/15 bg-white/8 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            {isLofiPlaying ? (
              <Volume2 className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-400" />
            )}
            <Music className="hidden h-3 w-3 sm:inline" />
            <span>{isLofiPlaying ? 'Lofi On' : 'Lofi Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInfoModal(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15"
          >
            <Info className="h-3.5 w-3.5 text-amber-300" />
            <span>Info Acara</span>
          </button>

          {userProfile && (
            <a
              data-testid="auditorium-wa-group-button"
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Grup WA</span>
            </a>
          )}

          <button
            type="button"
            onClick={onOpenAccountOrProfile}
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500 sm:inline-flex"
          >
            {userProfile ? (
              <>
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{userProfile.nama}</span>
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5" />
                <span>Masuk / Daftar Warga</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Grand Stage-Facing Auditorium Viewport (strict 16:10 coordinate space) */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#06050b] p-2 sm:p-4">
        <div
          style={{
            width: 'min(100%, calc((100vh - 88px) * 1.6))',
            aspectRatio: '16 / 10',
          }}
          className="relative max-w-[1380px] overflow-hidden rounded-2xl border border-white/12 bg-[#0a0912] shadow-2xl shadow-black/90"
        >
          <GrandStageArchitecture seatSlots={seatSlots} />

          {/* Crisp HTML Overlay strictly fitted inside the inner LED Screen Bezel (x:472..808, y:184..378) */}
          <div
            data-testid="auditorium-stage-screen"
            style={{
              left: '36.875%',
              top: '23%',
              width: '26.25%',
              height: '24.25%',
              containerType: 'inline-size',
            }}
            className="pointer-events-none absolute z-10 flex flex-col items-center justify-center overflow-hidden px-[4.5%] py-[3.5%] text-center"
          >
            <span
              style={{
                fontSize: '3.05cqi',
                padding: '1.1cqi 3.2cqi',
                letterSpacing: '0.14em',
              }}
              className="whitespace-nowrap rounded-full border border-amber-300/40 bg-amber-400/15 font-mono font-bold leading-none text-amber-200"
            >
              11 DESEMBER 2026 · 19:30 WIB
            </span>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '5.9cqi',
                marginTop: '3.6cqi',
              }}
              className="w-full whitespace-nowrap font-extrabold leading-tight tracking-wide text-white drop-shadow-[0_0_14px_rgba(192,132,252,0.85)]"
            >
              PRE-LAUNCH KOMIK KHOAS
            </h2>

            {countdown.isLive ? (
              <div
                data-testid="stage-countdown-live"
                style={{
                  fontSize: '3.6cqi',
                  marginTop: '4.2cqi',
                  padding: '2.2cqi 4.2cqi',
                }}
                className="rounded-lg border border-emerald-400/60 bg-emerald-500/25 font-mono font-extrabold tracking-widest text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
              >
                ACARA SEDANG BERLANGSUNG!
              </div>
            ) : (
              <div
                data-testid="stage-countdown-timer"
                style={{
                  marginTop: '4cqi',
                  gap: '2.2cqi',
                }}
                className="grid w-full max-w-[94%] grid-cols-4"
              >
                {[
                  { value: countdown.formattedDays, label: 'HARI' },
                  { value: countdown.formattedHours, label: 'JAM' },
                  { value: countdown.formattedMinutes, label: 'MENIT' },
                  { value: countdown.formattedSeconds, label: 'DETIK' },
                ].map((unit) => (
                  <div
                    key={unit.label}
                    style={{
                      padding: '2.6cqi 1cqi',
                      borderRadius: '2.2cqi',
                    }}
                    className="flex flex-col items-center justify-center border border-sky-300/30 bg-slate-950/80 backdrop-blur-sm"
                  >
                    <span
                      style={{ fontSize: '7.1cqi' }}
                      className="font-mono font-extrabold leading-none tabular-nums text-white"
                    >
                      {unit.value}
                    </span>
                    <span
                      style={{ fontSize: '2.6cqi', marginTop: '1.3cqi' }}
                      className="font-mono font-semibold leading-none tracking-wider text-sky-200/85"
                    >
                      {unit.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3–5 Walking Citizens Strolling Smoothly in the Front-Stage & Hall Aisles (Auto-Rotating) */}
          <div
            data-testid="auditorium-walkers-layer"
            data-walker-count={activeHallWalkerCount}
            data-rotation-count={rotationCount}
            className="pointer-events-none absolute inset-0 z-20"
          >
            {hallSlots.map((slot) => {
              const resident = residentByKey.get(slot.key);
              if (!resident) return null;

              const isFading = slot.phase === 'entering' || slot.phase === 'exiting';
              const isPinnedOwner = pinnedKeys.has(slot.key);
              const shortName =
                resident.nama.length > 16 ? `${resident.nama.slice(0, 15).trim()}…` : resident.nama;

              return (
                <button
                  key={slot.key}
                  ref={(el) => {
                    walkerRefs.current[slot.key] = el;
                  }}
                  type="button"
                  data-testid="auditorium-walker"
                  data-resident-key={slot.key}
                  data-phase={slot.phase}
                  aria-label={`Warga ${resident.nama} (${resident.houseNumberFormatted}) sedang berjalan di auditorium`}
                  disabled={slot.phase === 'exiting'}
                  onClick={() => {
                    if (slot.phase !== 'exiting') {
                      onSelectResident(resident);
                    }
                  }}
                  className={`group absolute flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    slot.phase === 'exiting'
                      ? 'pointer-events-none'
                      : 'pointer-events-auto cursor-pointer'
                  }`}
                >
                  {/* Smooth fade-in / fade-out wrapper */}
                  <div
                    className={`flex flex-col items-center transition-[opacity,transform] duration-700 ${
                      isFading
                        ? 'scale-75 opacity-0 ease-in'
                        : 'scale-100 opacity-100 ease-out'
                    }`}
                  >
                    {/* Name Tag */}
                    <span
                      className={`mb-0.5 max-w-[125px] truncate whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold shadow-lg transition-transform duration-150 group-hover:scale-110 ${
                        isPinnedOwner
                          ? 'border-amber-200 bg-amber-400 text-slate-950'
                          : 'border-amber-300/45 bg-slate-950/92 text-amber-100 group-hover:bg-amber-400 group-hover:text-slate-950'
                      }`}
                    >
                      {shortName}
                    </span>

                    {/* Walking Gender-Aware Avatar */}
                    <div className="animate-citizen-bob flex flex-col items-center">
                      <CitizenAvatarSvg
                        gender={resident.jenisKelamin}
                        seed={resident.colorSeed}
                        width={26}
                        height={31}
                        showShadow={true}
                        className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.85)]"
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quiet Bottom Info Strip */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between bg-gradient-to-t from-black/88 via-black/45 to-transparent px-5 pb-3 pt-8 text-xs text-slate-300">
            <span>
              {activeHallWalkerCount > 0
                ? `${activeHallWalkerCount} warga sedang berkeliling meninjau panggung · Klik avatar untuk Kartu Warga`
                : 'Auditorium megah siap menyambut 500 warga Pre-Launch Komik Khoas'}
            </span>
            <span className="hidden font-mono text-[11px] text-amber-300/90 sm:inline">
              Panggung Utama · 11 Des 2026 19:30 WIB
            </span>
          </div>
        </div>
      </main>

      {/* Event Info Modal (Ringkas: Hari/Tanggal, Jam, Google Meet, Kapasitas, Benefit) */}
      {showInfoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-info-title"
          data-testid="event-info-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#12111d] p-6 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold tracking-wider text-amber-300">
                  INFORMASI ACARA
                </p>
                <h2
                  id="event-info-title"
                  className="mt-1 text-2xl font-bold text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Pre-Launch Komik Khoas
                </h2>
              </div>
              <button
                type="button"
                aria-label="Tutup Info Acara"
                onClick={() => setShowInfoModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 border-y border-white/10 py-5 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-xs text-slate-400">Hari &amp; Tanggal</p>
                    <p className="mt-0.5 font-semibold text-white">Jumat, 11 Desember 2026</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-xs text-slate-400">Jam</p>
                    <p className="mt-0.5 font-mono font-bold tabular-nums text-white">
                      19:30 WIB – Selesai
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                  <Video className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-xs text-slate-400">Pelaksanaan</p>
                    <p className="mt-0.5 font-semibold text-white">Online via Google Meet</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <div>
                    <p className="text-xs text-slate-400">Kapasitas Peserta</p>
                    <p className="mt-0.5 font-mono font-bold tabular-nums text-white">
                      {residents.length} / {MAX_KAVLING_QUOTA} Peserta
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4">
                <Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                    Benefit Peserta
                  </p>
                  <p className="mt-0.5 font-semibold leading-snug text-white">
                    Akses gratis duluan Komik Digital Khoas Volume 1 Chapter 1
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
              >
                Tutup
              </button>
              {userProfile ? (
                <a
                  data-testid="info-modal-wa-group-button"
                  href={WHATSAPP_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Gabung Grup WA</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-85" />
                </a>
              ) : (
                !isQuotaFull && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowInfoModal(false);
                      onOpenAccountOrProfile();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Masuk / Daftar Warga</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Arsitektur Interior Auditorium Arah Panggung — Versi Sinematik & Megah (v7)
 * Kursi tertata rapi dalam kondisi kosong sambil menyisakan lorong lega untuk avatar berlalu-lalang.
 */
function GrandStageArchitecture({ seatSlots }: { seatSlots: SeatSlot[] }) {
  return (
    <svg
      viewBox="0 0 1280 800"
      preserveAspectRatio="none"
      className="h-full w-full select-none"
      aria-label="Interior Auditorium Komik Khoas tampak megah menuju panggung utama"
    >
      <defs>
        <linearGradient id="stageScreenBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#090f24" />
          <stop offset="50%" stopColor="#162142" />
          <stop offset="100%" stopColor="#120c28" />
        </linearGradient>
        <radialGradient id="purpleWashLeft" cx="14%" cy="22%" r="52%">
          <stop offset="0%" stopColor="#d946ef" stopOpacity="0.62" />
          <stop offset="48%" stopColor="#6b21a8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#08070f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="purpleWashRight" cx="86%" cy="22%" r="52%">
          <stop offset="0%" stopColor="#d946ef" stopOpacity="0.62" />
          <stop offset="48%" stopColor="#6b21a8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#08070f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cyanStageGlow" cx="50%" cy="42%" r="38%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.48" />
          <stop offset="55%" stopColor="#6366f1" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#08070f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ceilingSpot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#fde68a" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stageFloorGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f285e" />
          <stop offset="50%" stopColor="#26193a" />
          <stop offset="100%" stopColor="#151022" />
        </linearGradient>
        <linearGradient id="carpetGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#524662" />
          <stop offset="45%" stopColor="#3b3448" />
          <stop offset="100%" stopColor="#241f2d" />
        </linearGradient>
        <linearGradient id="beamCyan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.58" />
          <stop offset="52%" stopColor="#38bdf8" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="beamGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="warmLedStrip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="50%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Deep Cinematic Shell Backdrop */}
      <rect width="1280" height="800" fill="#08070f" />

      {/* Architectural Coffered Acoustic Ceiling & Warm Pin-Spot Array */}
      {[34, 62, 88].map((cy, idx) => (
        <line
          key={`ceil-${idx}`}
          x1={80 + idx * 55}
          y1={cy}
          x2={1200 - idx * 55}
          y2={cy}
          stroke="#1e1b2d"
          strokeWidth="2"
        />
      ))}
      {[260, 420, 560, 720, 860, 1020].map((cx, idx) => (
        <g key={`cspot-${idx}`}>
          <circle cx={cx} cy="52" r="18" fill="url(#ceilingSpot)" opacity="0.55" />
          <circle cx={cx} cy="52" r="2.5" fill="#fffbeb" />
        </g>
      ))}

      {/* Faceted Left & Right Acoustic Side Walls with Warm Golden Vertical LED Ribs */}
      {[0, 1, 2, 3, 4].map((i) => {
        const lx = 26 + i * 54;
        const rx = 1254 - i * 54;
        const topY = 92 + i * 20;
        const botY = 636 - i * 26;
        return (
          <g key={`rib-${i}`}>
            <polygon
              points={`${lx - 26},${topY - 22} ${lx + 24},${topY} ${lx + 24},${botY} ${lx - 26},${botY + 24}`}
              fill={i % 2 === 0 ? '#1b1728' : '#251e36'}
              stroke="#100d18"
              strokeWidth="1.5"
            />
            <polyline
              points={`${lx - 22},${topY - 34} ${lx + 22},${topY} ${lx + 22},${botY}`}
              fill="none"
              stroke="url(#warmLedStrip)"
              strokeWidth="3"
              opacity="0.92"
            />
            <polygon
              points={`${rx + 26},${topY - 22} ${rx - 24},${topY} ${rx - 24},${botY} ${rx + 26},${botY + 24}`}
              fill={i % 2 === 0 ? '#1b1728' : '#251e36'}
              stroke="#100d18"
              strokeWidth="1.5"
            />
            <polyline
              points={`${rx + 22},${topY - 34} ${rx - 22},${topY} ${rx - 22},${botY}`}
              fill="none"
              stroke="url(#warmLedStrip)"
              strokeWidth="3"
              opacity="0.92"
            />
          </g>
        );
      })}

      {/* Rich Atmospheric Concert Wall Washes */}
      <rect width="1280" height="540" fill="url(#purpleWashLeft)" />
      <rect width="1280" height="540" fill="url(#purpleWashRight)" />
      <rect width="1280" height="560" fill="url(#cyanStageGlow)" />

      {/* Central Stage Proscenium Wall & Main LED Screen Frame */}
      <rect x="292" y="166" width="696" height="236" fill="#0b0915" />
      <rect
        x="466"
        y="178"
        width="348"
        height="206"
        rx="6"
        fill="url(#stageScreenBg)"
        stroke="#475569"
        strokeWidth="2.4"
      />
      {/* Subtle Inner LED Bezel Glow */}
      <rect
        x="472"
        y="184"
        width="336"
        height="194"
        rx="4"
        fill="none"
        stroke="rgba(56, 189, 248, 0.35)"
        strokeWidth="1.2"
      />

      {/* Crimson Vertical Truss Light Columns flanking LED Screen */}
      {[452, 828].map((tx, idx) => (
        <g key={`truss-col-${idx}`}>
          <rect x={tx - 6} y="176" width="12" height="210" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((dot) => (
            <circle
              key={dot}
              cx={tx}
              cy={190 + dot * 25}
              r="5.5"
              fill="#fb7185"
              filter="url(#softGlow)"
            />
          ))}
        </g>
      ))}

      {/* Sweeping Volumetric Stage Spotlight Beams */}
      <g className="animate-stage-beam">
        <polygon points="498,180 420,400 535,400" fill="url(#beamCyan)" />
        <polygon points="782,180 745,400 860,400" fill="url(#beamCyan)" />
      </g>
      <g className="animate-stage-beam-alt">
        <polygon points="640,176 555,405 725,405" fill="url(#beamGold)" />
      </g>

      {/* Overhead Silver Lighting Rigging Truss */}
      <g>
        <rect x="235" y="100" width="810" height="22" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
        {Array.from({ length: 27 }).map((_, idx) => {
          const x = 235 + idx * 30;
          return (
            <line
              key={`truss-diag-${idx}`}
              x1={x}
              y1="100"
              x2={x + 30}
              y2="122"
              stroke="#cbd5e1"
              strokeWidth="1.2"
              opacity="0.72"
            />
          );
        })}
        {/* Hanging Line-Array Speakers & Moving Head Spotlights */}
        <rect x="396" y="122" width="24" height="60" rx="3" fill="#0f172a" stroke="#475569" />
        <rect x="860" y="122" width="24" height="60" rx="3" fill="#0f172a" stroke="#475569" />
        {[485, 535, 588, 640, 692, 745, 795].map((lx, idx) => (
          <circle key={`rig-light-${idx}`} cx={lx} cy="176" r="4" fill="#e0f2fe" filter="url(#softGlow)" />
        ))}
      </g>

      {/* Back-Stage Floor Uplights */}
      {[330, 380, 430, 550, 640, 730, 850, 900, 950].map((ux, idx) => (
        <rect
          key={`uplight-${idx}`}
          x={ux - 18}
          y="382"
          width="36"
          height="6"
          rx="3"
          fill="#c084fc"
          filter="url(#softGlow)"
        />
      ))}

      {/* Grand Curved Elevated Main Stage Platform */}
      <path
        d="M324,390 L956,390 L984,424 Q640,470 296,424 Z"
        fill="url(#stageFloorGrad)"
        stroke="#5b21b6"
        strokeWidth="1.5"
      />
      {/* Center Warm Spotlight Pool on Stage */}
      <ellipse cx="640" cy="416" rx="126" ry="20" fill="#fef3c7" opacity="0.48" filter="url(#softGlow)" />
      {/* Stage Front Rim with Warm Golden LED Strip */}
      <path
        d="M296,424 Q640,470 984,424 L984,438 Q640,484 296,438 Z"
        fill="#140f1f"
      />
      <path
        d="M298,425 Q640,471 982,425"
        fill="none"
        stroke="#fde68a"
        strokeWidth="3.4"
        filter="url(#softGlow)"
      />

      {/* Left & Right Illuminated Stage Staircases */}
      {[0, 1, 2, 3, 4].map((step) => (
        <g key={`stairs-${step}`}>
          <rect x={250 - step * 3} y={390 + step * 9} width="44" height="4" rx="1" fill="#fef08a" opacity="0.92" />
          <rect x={986 + step * 3} y={390 + step * 9} width="44" height="4" rx="1" fill="#fef08a" opacity="0.92" />
        </g>
      ))}

      {/* Stage Equipment Silhouettes */}
      <g opacity="0.92">
        <ellipse cx="478" cy="397" rx="28" ry="8" fill="#0f172a" />
        <circle cx="472" cy="384" r="12" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
        <circle cx="494" cy="382" r="8" fill="#334155" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="454" y1="366" x2="454" y2="396" stroke="#cbd5e1" strokeWidth="1.5" />
        <ellipse cx="454" cy="366" rx="11" ry="2.5" fill="#fde047" opacity="0.72" />
        {[540, 610, 670, 740].map((mx) => (
          <polygon
            key={mx}
            points={`${mx - 10},428 ${mx + 10},428 ${mx + 7},420 ${mx - 7},420`}
            fill="#09090b"
            stroke="#475569"
            strokeWidth="1"
          />
        ))}
        <rect x="758" y="378" width="54" height="7" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
        <line x1="768" y1="385" x2="764" y2="400" stroke="#64748b" strokeWidth="2" />
        <line x1="802" y1="385" x2="806" y2="400" stroke="#64748b" strokeWidth="2" />
      </g>

      {/* Main Carpeted Auditorium Floor & Generous Illuminated Promenade / Aisles */}
      <polygon points="100,434 1180,434 1280,695 0,695" fill="url(#carpetGrad)" />
      {/* Front-of-stage promenade carpet highlight */}
      <polygon points="270,436 1010,436 1045,468 235,468" fill="#7c6e8f" opacity="0.28" />
      {/* Center aisle & diagonal side aisles with subtle guide strips */}
      <polygon points="620,462 660,462 674,695 606,695" fill="#827794" opacity="0.36" />
      <line x1="620" y1="464" x2="606" y2="690" stroke="#fde68a" strokeWidth="1" opacity="0.45" />
      <line x1="660" y1="464" x2="674" y2="690" stroke="#fde68a" strokeWidth="1" opacity="0.45" />
      <polygon points="402,456 432,456 342,688 294,688" fill="#7c738a" opacity="0.3" />
      <polygon points="848,456 878,456 986,688 938,688" fill="#7c738a" opacity="0.3" />

      {/* Neatly Arranged Empty Velvet Auditorium Chairs (zero seated avatars) */}
      {seatSlots.map((slot) => {
        const cx = (slot.xPct / 100) * 1280;
        const cy = (slot.yPct / 100) * 800;
        const w = 22 * slot.scale;
        const h = 18 * slot.scale;
        return (
          <g key={`chair-${slot.id}`}>
            <rect
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={3 * slot.scale}
              fill="#3d1f30"
              stroke="#6b344d"
              strokeWidth="1"
            />
            <rect
              x={cx - w / 2 + 2}
              y={cy - h / 2 + 2}
              width={w - 4}
              height={h * 0.42}
              rx={2}
              fill="#582c46"
            />
            {/* Armrest highlights */}
            <rect
              x={cx - w / 2 - 1}
              y={cy - h / 4}
              width="2"
              height={h * 0.55}
              rx="1"
              fill="#27121f"
            />
            <rect
              x={cx + w / 2 - 1}
              y={cy - h / 4}
              width="2"
              height={h * 0.55}
              rx="1"
              fill="#27121f"
            />
          </g>
        );
      })}

      {/* Raised Lower Balcony Parapet Railings with Warm Under-LED */}
      <path d="M0,624 L250,654 L250,692 L0,692 Z" fill="#17141f" stroke="#3f374d" strokeWidth="1.5" />
      <path d="M1280,624 L1030,654 L1030,692 L1280,692 Z" fill="#17141f" stroke="#3f374d" strokeWidth="1.5" />
      <line x1="0" y1="658" x2="248" y2="684" stroke="#fde68a" strokeWidth="2.4" opacity="0.82" />
      <line x1="1280" y1="658" x2="1032" y2="684" stroke="#fde68a" strokeWidth="2.4" opacity="0.82" />

      {/* Lower Balcony Seating Deck */}
      <rect x="0" y="688" width="1280" height="112" fill="#1b1824" />
      <line x1="0" y1="688" x2="1280" y2="688" stroke="#94a3b8" strokeWidth="1.5" opacity="0.45" />

      {/* Central FOH Sound & Lighting Mixing Console Booth */}
      <g>
        <polygon points="484,678 796,678 814,800 466,800" fill="#29232c" stroke="#524857" strokeWidth="2" />
        <polygon points="566,690 688,690 698,744 556,744" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
        <rect x="574" y="696" width="52" height="22" rx="2" fill="#38bdf8" opacity="0.85" />
        <rect x="632" y="696" width="50" height="22" rx="2" fill="#a855f7" opacity="0.82" />
        {Array.from({ length: 14 }).map((_, idx) => (
          <rect
            key={`fader-${idx}`}
            x={572 + idx * 8.2}
            y="724"
            width="4.5"
            height="13"
            rx="1"
            fill={idx % 3 === 0 ? '#4ade80' : idx % 3 === 1 ? '#fbbf24' : '#38bdf8'}
            opacity="0.85"
          />
        ))}
        <rect x="526" y="754" width="98" height="36" rx="3" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.2" />
        <rect x="534" y="760" width="42" height="14" rx="1.5" fill="#e2e8f0" opacity="0.8" />
        <rect x="582" y="760" width="34" height="14" rx="1.5" fill="#fcd34d" opacity="0.75" />
        <rect x="640" y="750" width="64" height="38" rx="3" fill="#020617" stroke="#475569" strokeWidth="1.5" />
        <text x="672" y="772" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="700">
          FOH KHOAS
        </text>
      </g>
    </svg>
  );
}
