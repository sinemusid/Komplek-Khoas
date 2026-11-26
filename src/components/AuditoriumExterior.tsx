import React from 'react';
import { TimeOfDay } from '../config/khoasConfig';
import { AuditoriumBounds } from '../utils/mapLayout';
import { MAP_THEMES } from '../utils/themePalette';

interface AuditoriumExteriorProps {
  bounds: AuditoriumBounds;
  phase: TimeOfDay;
  onEnter: () => void;
}

export const AuditoriumExterior = React.memo(function AuditoriumExterior({
  bounds,
  phase,
  onEnter,
}: AuditoriumExteriorProps) {
  const theme = MAP_THEMES[phase];
  const isNight = phase === 'night';
  const isDusk = phase === 'dusk';
  const isLit = isNight || isDusk;

  return (
    <div
      style={{
        left: bounds.plazaX,
        top: bounds.plazaY,
        width: bounds.plazaWidth,
        height: bounds.plazaHeight,
        backgroundColor: theme.plazaTile,
        borderColor: theme.plazaBorder,
      }}
      className="absolute rounded-[20px] border-2 shadow-inner"
    >
      {/* Subtle plaza paving grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[18px] opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(100,116,139,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.22) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Plaza Corner Trees & Planters */}
      {[
        { x: 24, y: 26 },
        { x: 64, y: 26 },
        { x: bounds.plazaWidth - 52, y: 26 },
        { x: bounds.plazaWidth - 92, y: 26 },
        { x: 24, y: bounds.plazaHeight - 54 },
        { x: 64, y: bounds.plazaHeight - 54 },
        { x: bounds.plazaWidth - 52, y: bounds.plazaHeight - 54 },
        { x: bounds.plazaWidth - 92, y: bounds.plazaHeight - 54 },
      ].map((tree, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          style={{ left: tree.x, top: tree.y }}
          className="pointer-events-none absolute h-7 w-7 rounded-full"
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              backgroundColor: theme.treeCanopy,
              boxShadow: `${theme.shadowOffsetX}px ${theme.shadowOffsetY}px 0 ${theme.shadowColor}`,
            }}
          />
          <div
            className="absolute left-1 top-1 h-3.5 w-3.5 rounded-full opacity-75"
            style={{ backgroundColor: theme.treeHighlight }}
          />
        </div>
      ))}

      {/* Front Promenade Approach & Red Welcome Carpet leading to Entrance */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 flex h-[96px] w-[148px] -translate-x-1/2 flex-col items-center justify-end"
      >
        <div
          className="h-full w-[58px]"
          style={{
            background: isNight
              ? 'linear-gradient(180deg, #9f1239 0%, #881337 100%)'
              : 'linear-gradient(180deg, #be123c 0%, #e11d48 100%)',
            boxShadow: isLit ? '0 0 18px rgba(244, 63, 94, 0.35)' : 'none',
          }}
        />
        <div className="absolute inset-y-2 left-[34px] flex flex-col justify-between">
          {[0, 1, 2].map((b) => (
            <span
              key={b}
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: isLit ? '#fde047' : '#64748b',
                boxShadow: isLit ? '0 0 8px 2px rgba(253,224,71,0.75)' : 'none',
              }}
            />
          ))}
        </div>
        <div className="absolute inset-y-2 right-[34px] flex flex-col justify-between">
          {[0, 1, 2].map((b) => (
            <span
              key={b}
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: isLit ? '#fde047' : '#64748b',
                boxShadow: isLit ? '0 0 8px 2px rgba(253,224,71,0.75)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Exterior Building (Clean Architecture + Floating White Badge "Klik untuk masuk") */}
      <button
        type="button"
        data-testid="auditorium-exterior"
        aria-label="Gedung Auditorium — Klik untuk masuk"
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        style={{
          left: bounds.buildingX - bounds.plazaX,
          top: bounds.buildingY - bounds.plazaY,
          width: bounds.buildingWidth,
          height: bounds.buildingHeight,
          boxShadow: isNight
            ? '0 18px 40px rgba(0,0,0,0.72), 0 0 36px rgba(139, 92, 246, 0.35)'
            : `${theme.shadowOffsetX * 3}px ${theme.shadowOffsetY * 3}px 0px ${theme.shadowColor}`,
        }}
        className="group absolute flex cursor-pointer flex-col overflow-visible rounded-[16px] text-left transition-transform duration-200 hover:scale-[1.025] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
      >
        {/* Clean Floating White Badge Hovering Above the Auditorium */}
        <div className="pointer-events-none absolute -top-14 left-1/2 z-30 -translate-x-1/2">
          <div
            data-testid="auditorium-floating-badge"
            className="animate-float-badge relative flex items-center gap-2.5 whitespace-nowrap rounded-2xl border-2 border-slate-200/95 bg-white px-5 py-2.5 text-sm font-extrabold tracking-tight text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.34)] transition-all duration-200 group-hover:scale-105 group-hover:border-amber-400 group-hover:bg-amber-50"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.85)]" />
            <span>Klik untuk masuk</span>
            {/* Subtle downward pointer triangle */}
            <span
              aria-hidden="true"
              className="absolute -bottom-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-slate-200/95 bg-white transition-colors duration-200 group-hover:border-amber-400 group-hover:bg-amber-50"
            />
          </div>
        </div>

        {/* Ambient architectural glow on hover or night */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-3 rounded-[22px] transition-opacity duration-200 ${
            isNight ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.32) 0%, rgba(251, 191, 36, 0.14) 52%, rgba(168,85,247,0) 76%)',
          }}
        />

        {/* Monumental Faceted Exterior Roof (Clean Architectural Detail, Zero Text) */}
        <div
          className="relative flex h-[178px] w-full flex-col items-center justify-center overflow-hidden rounded-t-[16px] border-2"
          style={{
            background: isNight
              ? 'linear-gradient(135deg, #1b172c 0%, #2b2144 48%, #151426 100%)'
              : isDusk
                ? 'linear-gradient(135deg, #2d253d 0%, #433357 50%, #241f36 100%)'
                : 'linear-gradient(135deg, #252a38 0%, #374056 50%, #1f2432 100%)',
            borderColor: isLit ? 'rgba(251, 191, 36, 0.45)' : '#475569',
          }}
        >
          {/* Architectural stepped side roof ribs */}
          <div className="pointer-events-none absolute inset-y-2.5 left-3.5 flex gap-2">
            {[0, 1, 2, 3].map((rib) => (
              <span
                key={`l-${rib}`}
                className="h-full w-[4px] rounded-full"
                style={{
                  background: isLit
                    ? 'linear-gradient(180deg, rgba(192,132,252,0.85), rgba(253,224,71,0.9), rgba(192,132,252,0.85))'
                    : 'rgba(148,163,184,0.35)',
                  boxShadow: isLit ? '0 0 8px rgba(253,224,71,0.5)' : 'none',
                }}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-2.5 right-3.5 flex gap-2">
            {[0, 1, 2, 3].map((rib) => (
              <span
                key={`r-${rib}`}
                className="h-full w-[4px] rounded-full"
                style={{
                  background: isLit
                    ? 'linear-gradient(180deg, rgba(192,132,252,0.85), rgba(253,224,71,0.9), rgba(192,132,252,0.85))'
                    : 'rgba(148,163,184,0.35)',
                  boxShadow: isLit ? '0 0 8px rgba(253,224,71,0.5)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Clean Architectural Skylight Glass Atrium & Geometric Roof Truss */}
          <div
            className="relative flex h-[116px] w-[308px] items-center justify-center overflow-hidden rounded-[12px] border transition-colors duration-200 group-hover:border-amber-300/80"
            style={{
              background: isNight
                ? 'linear-gradient(180deg, rgba(64, 42, 112, 0.92) 0%, rgba(24, 18, 46, 0.96) 100%)'
                : isDusk
                  ? 'linear-gradient(180deg, rgba(88, 60, 118, 0.9) 0%, rgba(36, 28, 56, 0.95) 100%)'
                  : 'linear-gradient(180deg, rgba(56, 74, 104, 0.92) 0%, rgba(30, 41, 59, 0.96) 100%)',
              borderColor: isLit ? 'rgba(253, 224, 71, 0.45)' : 'rgba(148, 163, 184, 0.45)',
            }}
          >
            {/* Geometric Glass Skylight Mullions */}
            <svg width="308" height="116" viewBox="0 0 308 116" fill="none" aria-hidden="true">
              <rect
                x="14"
                y="14"
                width="280"
                height="88"
                rx="8"
                fill={isLit ? 'rgba(192, 132, 252, 0.14)' : 'rgba(148, 163, 184, 0.14)'}
                stroke={isLit ? 'rgba(253, 224, 71, 0.4)' : 'rgba(203, 213, 225, 0.35)'}
                strokeWidth="1.4"
              />
              {[60, 108, 154, 200, 248].map((lx) => (
                <line
                  key={lx}
                  x1={lx}
                  y1="14"
                  x2={lx}
                  y2="102"
                  stroke={isLit ? 'rgba(253, 224, 71, 0.25)' : 'rgba(226, 232, 240, 0.24)'}
                  strokeWidth="1.2"
                />
              ))}
              <line
                x1="14"
                y1="58"
                x2="294"
                y2="58"
                stroke={isLit ? 'rgba(253, 224, 71, 0.3)' : 'rgba(226, 232, 240, 0.28)'}
                strokeWidth="1.4"
              />
              {/* Central Skylight Medallion */}
              <circle
                cx="154"
                cy="58"
                r="22"
                fill={isLit ? 'rgba(251, 191, 36, 0.22)' : 'rgba(56, 189, 248, 0.18)'}
                stroke={isLit ? '#fde047' : '#94a3b8'}
                strokeWidth="1.6"
              />
              <circle
                cx="154"
                cy="58"
                r="10"
                fill={isLit ? '#fef08a' : '#e2e8f0'}
                opacity={isLit ? 0.85 : 0.65}
              />
            </svg>
          </div>
        </div>

        {/* Grand Exterior Facade & Entrance Portico (Bottom 54px, Clean Architectural Glass Doors) */}
        <div
          className="relative flex h-[54px] w-full items-center justify-between rounded-b-[16px] border-x-2 border-b-2 px-6"
          style={{
            background: isNight
              ? 'linear-gradient(180deg, #1e1b2e 0%, #12101d 100%)'
              : 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
            borderColor: isLit ? 'rgba(251, 191, 36, 0.35)' : '#64748b',
          }}
        >
          {/* Left Facade Glass Bay */}
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((w) => (
              <span
                key={`gl-${w}`}
                className="h-6 w-5 rounded-[3px] border"
                style={{
                  backgroundColor: isLit ? '#fde68a' : '#38bdf8',
                  borderColor: isLit ? '#f59e0b' : '#0284c7',
                  opacity: isLit ? 0.9 : 0.75,
                  boxShadow: isLit ? '0 0 10px rgba(251,191,36,0.55)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Grand Central Entrance Canopy + Glass Double Doors (No Text) */}
          <div className="relative flex h-full flex-col items-center justify-end">
            <div
              className="flex h-9 w-[124px] items-center justify-center gap-1.5 rounded-t-[6px] border-x border-t px-2.5"
              style={{
                background: isLit
                  ? 'linear-gradient(180deg, #fef08a 0%, #f59e0b 100%)'
                  : 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
                borderColor: isLit ? '#fde047' : '#475569',
                boxShadow: isLit ? '0 4px 16px rgba(251, 191, 36, 0.5)' : 'none',
              }}
            >
              <span className="h-6 w-11 rounded-t-[3px] border border-white/30 bg-sky-300/35" />
              <span className="h-6 w-11 rounded-t-[3px] border border-white/30 bg-sky-300/35" />
            </div>
          </div>

          {/* Right Facade Glass Bay */}
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((w) => (
              <span
                key={`gr-${w}`}
                className="h-6 w-5 rounded-[3px] border"
                style={{
                  backgroundColor: isLit ? '#fde68a' : '#38bdf8',
                  borderColor: isLit ? '#f59e0b' : '#0284c7',
                  opacity: isLit ? 0.9 : 0.75,
                  boxShadow: isLit ? '0 0 10px rgba(251,191,36,0.55)' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      </button>
    </div>
  );
});
