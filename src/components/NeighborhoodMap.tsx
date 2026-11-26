import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { KavlingLot, MosqueBuilding, Resident, TimeOfDay, UserProfile } from '../config/khoasConfig';
import { NeighborhoodLayout, WORLD_HEIGHT, WORLD_WIDTH } from '../utils/mapLayout';
import { MAP_THEMES } from '../utils/themePalette';
import { AuditoriumExterior } from './AuditoriumExterior';
import { HouseUnit } from './HouseUnit';
import { MosqueBuildingUnit } from './MosqueBuildingUnit';
import { WalkingCitizensLayer } from './WalkingCitizensLayer';

export interface MapCameraHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  focusPoint: (worldX: number, worldY: number, scale?: number) => void;
}

interface NeighborhoodMapProps {
  layout: NeighborhoodLayout;
  residents: Resident[];
  byKavling: Record<string, Resident>;
  userProfile: UserProfile | null;
  shuffleNonce: number;
  phase: TimeOfDay;
  isSelectMode: boolean;
  isQuotaFull: boolean;
  highlightedLotId: string | null;
  isEnteringAuditorium: boolean;
  onSelectEmptyLot: (lotId: string) => void;
  onSelectResident: (resident: Resident) => void;
  onSelectMosque: (mosque: MosqueBuilding) => void;
  onEnterAuditorium: () => void;
  onZoomChange: (zoomPct: number) => void;
}

interface CameraState {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.34;
const MAX_SCALE = 2.1;

function computeFitCamera(viewportW: number, viewportH: number): CameraState {
  const padX = viewportW < 640 ? 16 : 36;
  const padTop = viewportW < 640 ? 86 : 104;
  const padBottom = viewportW < 640 ? 64 : 62;
  const usableW = Math.max(280, viewportW - padX * 2);
  const usableH = Math.max(240, viewportH - padTop - padBottom);
  const fitScale = Math.min(usableW / WORLD_WIDTH, usableH / WORLD_HEIGHT);
  const initialScale = Math.max(
    MIN_SCALE,
    Math.min(1.0, viewportW < 640 ? Math.max(fitScale * 1.4, 0.42) : fitScale)
  );
  return {
    scale: initialScale,
    x: padX + (usableW - WORLD_WIDTH * initialScale) / 2,
    y: padTop + (usableH - WORLD_HEIGHT * initialScale) / 2,
  };
}

export const NeighborhoodMap = React.forwardRef<MapCameraHandle, NeighborhoodMapProps>(
  function NeighborhoodMap(
    {
      layout,
      residents,
      byKavling,
      userProfile,
      shuffleNonce,
      phase,
      isSelectMode,
      isQuotaFull,
      highlightedLotId,
      isEnteringAuditorium,
      onSelectEmptyLot,
      onSelectResident,
      onSelectMosque,
      onEnterAuditorium,
      onZoomChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [camera, setCamera] = useState<CameraState>(() =>
      computeFitCamera(
        typeof window !== 'undefined' ? window.innerWidth : 1440,
        typeof window !== 'undefined' ? window.innerHeight : 900
      )
    );
    const [isAnimatingCamera, setIsAnimatingCamera] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverInfo, setHoverInfo] = useState<{
      lot: KavlingLot;
      resident?: Resident;
      x: number;
      y: number;
    } | null>(null);

    const cameraRef = useRef(camera);
    cameraRef.current = camera;

    // Multi-touch pointer tracking for pan + pinch-to-zoom
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const dragStartRef = useRef<{
      pointerX: number;
      pointerY: number;
      camX: number;
      camY: number;
      moved: boolean;
    } | null>(null);
    const pinchRef = useRef<{
      initialDist: number;
      initialScale: number;
      midWorldX: number;
      midWorldY: number;
    } | null>(null);
    const suppressNextClickRef = useRef(false);
    const hasUserInteractedRef = useRef(false);

    const theme = MAP_THEMES[phase];

    // Re-center map cleanly whenever container size changes before manual panning
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const syncFit = () => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && !hasUserInteractedRef.current) {
          setCamera(computeFitCamera(rect.width, rect.height));
        }
      };
      syncFit();
      const ro = new ResizeObserver(syncFit);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const clampCamera = useCallback((next: CameraState): CameraState => {
      const rect = containerRef.current?.getBoundingClientRect();
      const vw = rect?.width ?? window.innerWidth;
      const vh = rect?.height ?? window.innerHeight;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
      const worldW = WORLD_WIDTH * scale;
      const worldH = WORLD_HEIGHT * scale;
      const marginX = Math.min(vw * 0.45, 320);
      const marginY = Math.min(vh * 0.45, 260);
      const minX = Math.min(vw - worldW - marginX, (vw - worldW) / 2 - marginX);
      const maxX = Math.max(marginX, (vw - worldW) / 2 + marginX);
      const minY = Math.min(vh - worldH - marginY, (vh - worldH) / 2 - marginY);
      const maxY = Math.max(marginY, (vh - worldH) / 2 + marginY);

      return {
        scale,
        x: Math.min(maxX, Math.max(minX, next.x)),
        y: Math.min(maxY, Math.max(minY, next.y)),
      };
    }, []);

    useEffect(() => {
      onZoomChange(Math.round(camera.scale * 100));
    }, [camera.scale, onZoomChange]);

    const zoomAroundScreenPoint = useCallback(
      (screenX: number, screenY: number, targetScale: number, smooth = false) => {
        setIsAnimatingCamera(smooth);
        setCamera((prev) => {
          const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
          const worldX = (screenX - prev.x) / prev.scale;
          const worldY = (screenY - prev.y) / prev.scale;
          return clampCamera({
            scale: clampedScale,
            x: screenX - worldX * clampedScale,
            y: screenY - worldY * clampedScale,
          });
        });
      },
      [clampCamera]
    );

    const focusPoint = useCallback(
      (worldX: number, worldY: number, targetScale = 1.25) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const vw = rect?.width ?? window.innerWidth;
        const vh = rect?.height ?? window.innerHeight;
        const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
        setIsAnimatingCamera(true);
        setCamera(
          clampCamera({
            scale: clampedScale,
            x: vw / 2 - worldX * clampedScale,
            y: vh / 2 - worldY * clampedScale,
          })
        );
      },
      [clampCamera]
    );

    const resetView = useCallback(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      const vw = rect?.width ?? window.innerWidth;
      const vh = rect?.height ?? window.innerHeight;
      hasUserInteractedRef.current = false;
      setIsAnimatingCamera(true);
      setCamera(computeFitCamera(vw, vh));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          const rect = containerRef.current?.getBoundingClientRect();
          const cx = (rect?.width ?? window.innerWidth) / 2;
          const cy = (rect?.height ?? window.innerHeight) / 2;
          zoomAroundScreenPoint(cx, cy, cameraRef.current.scale * 1.26, true);
        },
        zoomOut: () => {
          const rect = containerRef.current?.getBoundingClientRect();
          const cx = (rect?.width ?? window.innerWidth) / 2;
          const cy = (rect?.height ?? window.innerHeight) / 2;
          zoomAroundScreenPoint(cx, cy, cameraRef.current.scale / 1.26, true);
        },
        resetView,
        focusPoint,
      }),
      [focusPoint, resetView, zoomAroundScreenPoint]
    );

    // Wheel zoom attached natively with passive: false so browser zoom doesn't hijack it
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        hasUserInteractedRef.current = true;
        const rect = el.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        zoomAroundScreenPoint(sx, sy, cameraRef.current.scale * factor, false);
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, [zoomAroundScreenPoint]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setIsAnimatingCamera(false);

      if (pointersRef.current.size === 1) {
        dragStartRef.current = {
          pointerX: e.clientX,
          pointerY: e.clientY,
          camX: cameraRef.current.x,
          camY: cameraRef.current.y,
          moved: false,
        };
        pinchRef.current = null;
      } else if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const rect = containerRef.current?.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
        const midY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);
        pinchRef.current = {
          initialDist: Math.max(10, dist),
          initialScale: cameraRef.current.scale,
          midWorldX: (midX - cameraRef.current.x) / cameraRef.current.scale,
          midWorldY: (midY - cameraRef.current.y) / cameraRef.current.scale,
        };
        dragStartRef.current = null;
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const pts = Array.from(pointersRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const rect = containerRef.current?.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
        const midY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchRef.current.initialScale * (dist / pinchRef.current.initialDist))
        );
        suppressNextClickRef.current = true;
        setCamera(
          clampCamera({
            scale: nextScale,
            x: midX - pinchRef.current.midWorldX * nextScale,
            y: midY - pinchRef.current.midWorldY * nextScale,
          })
        );
        return;
      }

      if (dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.pointerX;
        const dy = e.clientY - dragStartRef.current.pointerY;
        if (!dragStartRef.current.moved && Math.hypot(dx, dy) > 6) {
          dragStartRef.current.moved = true;
          hasUserInteractedRef.current = true;
          suppressNextClickRef.current = true;
          setIsDragging(true);
          setHoverInfo(null);
        }
        if (dragStartRef.current.moved) {
          setCamera(
            clampCamera({
              scale: cameraRef.current.scale,
              x: dragStartRef.current.camX + dx,
              y: dragStartRef.current.camY + dy,
            })
          );
        }
      }
    };

    const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
      }
      if (pointersRef.current.size === 0) {
        dragStartRef.current = null;
        setIsDragging(false);
        if (suppressNextClickRef.current) {
          window.setTimeout(() => {
            suppressNextClickRef.current = false;
          }, 40);
        }
      }
    };

    const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
      if (suppressNextClickRef.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    return (
      <div
        ref={containerRef}
        data-testid="neighborhood-map-viewport"
        data-phase={phase}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onPointerLeave={handlePointerUpOrCancel}
        onClickCapture={handleClickCapture}
        style={{ backgroundColor: theme.viewportBg }}
        className={`relative h-full w-full overflow-hidden select-none transition-colors duration-500 ${
          isDragging ? 'cursor-grabbing' : isSelectMode ? 'cursor-crosshair' : 'cursor-grab'
        }`}
      >
        {/* GPU-Transformed World Canvas */}
        <div
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transformOrigin: '0 0',
            transform: isEnteringAuditorium
              ? `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${(camera.scale * 1.65).toFixed(4)})`
              : `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale.toFixed(4)})`,
            opacity: isEnteringAuditorium ? 0 : 1,
            backgroundColor: theme.terrainBg,
            backgroundImage: `radial-gradient(${theme.terrainPattern} 1.5px, transparent 1.5px)`,
            backgroundSize: '26px 26px',
          }}
          className={`relative will-change-transform ${
            isEnteringAuditorium
              ? 'transition-all duration-500 ease-in'
              : isAnimatingCamera
                ? 'transition-transform duration-300 ease-out'
                : ''
          }`}
        >
          {/* Decorative Pocket Parks along outer perimeter */}
          {layout.parks.map((park) => (
            <div
              key={park.id}
              aria-hidden="true"
              style={{
                left: park.x,
                top: park.y,
                width: park.width,
                height: park.height,
                backgroundColor: theme.parkBg,
                borderColor: theme.parkBorder,
              }}
              className="pointer-events-none absolute rounded-2xl border-2"
            >
              {park.trees.map((tree, idx) => (
                <div
                  key={idx}
                  style={{
                    left: tree.x - tree.r,
                    top: tree.y - tree.r,
                    width: tree.r * 2,
                    height: tree.r * 2,
                    backgroundColor: theme.treeCanopy,
                    boxShadow: `${theme.shadowOffsetX}px ${theme.shadowOffsetY}px 0 ${theme.shadowColor}`,
                  }}
                  className="absolute rounded-full"
                >
                  <span
                    style={{ backgroundColor: theme.treeHighlight }}
                    className="absolute left-[18%] top-[16%] h-[46%] w-[46%] rounded-full opacity-75"
                  />
                </div>
              ))}
            </div>
          ))}

          {/* Road Network & Sidewalks */}
          <svg
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            {/* Sidewalk underlay */}
            {layout.roads.map((road) => (
              <rect
                key={`sw-${road.id}`}
                x={road.x - 5}
                y={road.y - 5}
                width={road.width + 10}
                height={road.height + 10}
                rx="6"
                fill={theme.sidewalk}
              />
            ))}

            {/* Asphalt layer */}
            {layout.roads.map((road) => (
              <rect
                key={`rd-${road.id}`}
                x={road.x}
                y={road.y}
                width={road.width}
                height={road.height}
                rx="4"
                fill={theme.roadAsphalt}
              />
            ))}

            {/* Dashed Road Centerlines */}
            {layout.roads.map((road) =>
              road.orientation === 'horizontal' ? (
                <line
                  key={`dash-${road.id}`}
                  x1={road.x + 12}
                  y1={road.y + road.height / 2}
                  x2={road.x + road.width - 12}
                  y2={road.y + road.height / 2}
                  stroke={theme.roadDash}
                  strokeWidth={road.isMain ? 2.5 : 1.5}
                  strokeDasharray={road.isMain ? '14 12' : '8 10'}
                />
              ) : (
                <line
                  key={`dash-${road.id}`}
                  x1={road.x + road.width / 2}
                  y1={road.y + 12}
                  x2={road.x + road.width / 2}
                  y2={road.y + road.height - 12}
                  stroke={theme.roadDash}
                  strokeWidth={road.isMain ? 2.5 : 1.5}
                  strokeDasharray={road.isMain ? '14 12' : '8 10'}
                />
              )
            )}

            {/* Boulevard Street Name Plates (aligned with main-w & main-e at y=778..874) */}
            <g>
              <rect x="352" y="812" width="246" height="28" rx="6" fill={theme.roadAsphalt} />
              <text
                x="475"
                y="830"
                textAnchor="middle"
                fill={theme.roadDash}
                fontSize="12"
                fontWeight="700"
                letterSpacing="3"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                JL. KOMIK KHOAS BARAT
              </text>
              <rect x="1762" y="812" width="246" height="28" rx="6" fill={theme.roadAsphalt} />
              <text
                x="1885"
                y="830"
                textAnchor="middle"
                fill={theme.roadDash}
                fontSize="12"
                fontWeight="700"
                letterSpacing="3"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                JL. KOMIK KHOAS TIMUR
              </text>
            </g>
          </svg>

          {/* Block Identification Signs (BLOK A, B, C, D) */}
          {layout.blockLabels.map((bl) => (
            <div
              key={bl.block}
              aria-hidden="true"
              style={{ left: bl.x, top: bl.y, color: theme.labelColor }}
              className="pointer-events-none absolute flex items-baseline gap-2"
            >
              <span
                className="text-sm font-extrabold tracking-wide"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {bl.title}
              </span>
              <span className="font-mono text-[11px] font-semibold opacity-75">{bl.range}</span>
            </div>
          ))}

          {/* 500 Residential Kavling Units */}
          <div data-testid="houses-layer" data-lot-count={layout.lots.length}>
            {layout.lots.map((lot) => (
              <HouseUnit
                key={lot.id}
                lot={lot}
                resident={byKavling[lot.id]}
                phase={phase}
                isSelectMode={isSelectMode}
                isHighlighted={highlightedLotId === lot.id}
                isQuotaFull={isQuotaFull}
                onSelectEmpty={onSelectEmptyLot}
                onSelectOccupied={onSelectResident}
                onHoverChange={setHoverInfo}
              />
            ))}
          </div>

          {/* 4 Center-Block Mosques (Blok A, B, C, D) */}
          <div data-testid="mosques-layer">
            {layout.mosques.map((mosque) => (
              <MosqueBuildingUnit
                key={mosque.id}
                mosque={mosque}
                phase={phase}
                onSelect={onSelectMosque}
              />
            ))}
          </div>

          {/* Central Exterior Auditorium Building */}
          <AuditoriumExterior
            bounds={layout.auditorium}
            phase={phase}
            onEnter={onEnterAuditorium}
          />

          {/* Streetlamps with Warm Halos during Dusk & Night */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[12]">
            {layout.lamps.map((lamp) => (
              <div
                key={lamp.id}
                style={{ left: lamp.x, top: lamp.y }}
                className="absolute -ml-1 -mt-1"
              >
                {/* Warm lamp light pool when dusk or night */}
                {theme.lampGlowOpacity > 0 && (
                  <span
                    className="absolute -left-7 -top-7 h-16 w-16 rounded-full transition-opacity duration-500"
                    style={{
                      opacity: theme.lampGlowOpacity,
                      background:
                        'radial-gradient(circle, rgba(254, 240, 138, 0.52) 0%, rgba(251, 191, 36, 0.16) 44%, rgba(251, 191, 36, 0) 72%)',
                    }}
                  />
                )}
                {/* Lamp post bulb */}
                <span
                  className="block h-2.5 w-2.5 rounded-full border transition-colors duration-500"
                  style={{
                    backgroundColor: theme.lampGlowOpacity > 0 ? '#fef08a' : '#94a3b8',
                    borderColor: theme.lampGlowOpacity > 0 ? '#f59e0b' : '#475569',
                    boxShadow:
                      theme.lampGlowOpacity > 0
                        ? '0 0 8px 2px rgba(253, 224, 71, 0.85)'
                        : 'none',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Animated Walking Citizens Layer (max 40 active at 60fps with auto-rotation) */}
          <WalkingCitizensLayer
            residents={residents}
            lotsById={layout.lotsById}
            walkGraph={layout.walkGraph}
            walkNodeIds={layout.walkNodeIds}
            phase={phase}
            isPaused={isEnteringAuditorium}
            userProfile={userProfile}
            shuffleNonce={shuffleNonce}
            onSelectCitizen={onSelectResident}
          />

          {/* Dynamic House Hover Tooltip (positioned cleanly above hovered house) */}
          {hoverInfo && !isDragging && (
            <div
              role="tooltip"
              style={{
                left: hoverInfo.x,
                top: hoverInfo.y - 10,
                transform: 'translate(-50%, -100%)',
              }}
              className="pointer-events-none absolute z-40 whitespace-nowrap rounded-lg border border-slate-700/80 bg-slate-950/95 px-3 py-1.5 text-center text-white shadow-xl"
            >
              {hoverInfo.resident ? (
                <>
                  <p className="text-xs font-bold text-white">
                    Rumah {hoverInfo.resident.houseNumberFormatted} - {hoverInfo.resident.nama}
                  </p>
                  <p className="font-mono text-[10px] text-amber-300">
                    Kavling {hoverInfo.lot.id} · {hoverInfo.resident.kota}
                  </p>
                </>
              ) : (
                <p className="text-xs font-semibold text-emerald-300">
                  Kavling {hoverInfo.lot.id} - Kosong (Klik untuk pilih)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Dusk / Night Atmospheric Screen Overlay */}
        {theme.ambientOverlay !== 'transparent' && (
          <div
            aria-hidden="true"
            style={{ background: theme.ambientOverlay }}
            className="pointer-events-none fixed inset-0 z-10 transition-opacity duration-500"
          />
        )}
      </div>
    );
  }
);
