import React from 'react';
import { MosqueBuilding, TimeOfDay } from '../config/khoasConfig';
import { MAP_THEMES } from '../utils/themePalette';

interface MosqueBuildingUnitProps {
  mosque: MosqueBuilding;
  phase: TimeOfDay;
  onSelect: (mosque: MosqueBuilding) => void;
}

export const MosqueBuildingUnit = React.memo(function MosqueBuildingUnit({
  mosque,
  phase,
  onSelect,
}: MosqueBuildingUnitProps) {
  const theme = MAP_THEMES[phase];
  const isNight = phase === 'night';
  const isDusk = phase === 'dusk';
  const isLit = isNight || isDusk;

  return (
    <button
      type="button"
      data-testid={`mosque-${mosque.block.toLowerCase()}`}
      aria-label={`${mosque.name} — Klik untuk melihat Jadwal Waktu Sholat Real-Time`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(mosque);
      }}
      style={{
        left: mosque.x,
        top: mosque.y,
        width: mosque.width,
        height: mosque.height,
        backgroundColor: isNight ? '#16282a' : isDusk ? '#657a65' : '#dbead5',
        borderColor: isLit ? 'rgba(52, 211, 153, 0.48)' : '#86b593',
        boxShadow: isNight
          ? '0 10px 26px rgba(0, 0, 0, 0.6), 0 0 24px rgba(16, 185, 129, 0.28)'
          : `${theme.shadowOffsetX * 2}px ${theme.shadowOffsetY * 2}px 0 ${theme.shadowColor}`,
      }}
      className="group absolute z-[6] flex cursor-pointer items-center justify-center overflow-visible rounded-2xl border-2 transition-transform duration-200 hover:z-20 hover:scale-[1.03] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
    >
      {/* Tiled Mosque Courtyard (Halaman Masjid) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-1.5 rounded-xl border"
        style={{
          backgroundColor: isNight ? '#1d3235' : isDusk ? '#9a8f7e' : '#edeae2',
          borderColor: isLit ? 'rgba(253, 230, 138, 0.25)' : '#cfc8b8',
          backgroundImage:
            'linear-gradient(to right, rgba(16,185,129,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.1) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />

      {/* Corner Courtyard Trees */}
      {[
        { x: 14, y: 14 },
        { x: mosque.width - 34, y: 14 },
        { x: 14, y: mosque.height - 34 },
        { x: mosque.width - 34, y: mosque.height - 34 },
      ].map((pt, idx) => (
        <span
          key={idx}
          aria-hidden="true"
          style={{
            left: pt.x,
            top: pt.y,
            backgroundColor: theme.treeCanopy,
            boxShadow: `${theme.shadowOffsetX}px ${theme.shadowOffsetY}px 0 ${theme.shadowColor}`,
          }}
          className="pointer-events-none absolute h-5 w-5 rounded-full"
        >
          <span
            style={{ backgroundColor: theme.treeHighlight }}
            className="absolute left-0.5 top-0.5 h-2.5 w-2.5 rounded-full opacity-80"
          />
        </span>
      ))}

      {/* Warm Evening / Night Mosque Courtyard Glow */}
      {isLit && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(253, 224, 71, 0.24) 0%, rgba(16, 185, 129, 0.14) 55%, transparent 80%)',
          }}
        />
      )}

      {/* Detailed Top-Down 2.5D Mosque Architecture SVG */}
      <svg
        width="210"
        height="122"
        viewBox="0 0 210 122"
        fill="none"
        aria-hidden="true"
        className="relative z-10 drop-shadow-md transition-transform duration-200 group-hover:scale-[1.03]"
      >
        <defs>
          <radialGradient id={`dome-${mosque.block}`} cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor={isNight ? '#34d399' : '#10b981'} />
            <stop offset="58%" stopColor={isNight ? '#047857' : '#059669'} />
            <stop offset="100%" stopColor="#064e3b" />
          </radialGradient>
          <linearGradient id={`wall-${mosque.block}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isNight ? '#334155' : '#f8fafc'} />
            <stop offset="100%" stopColor={isNight ? '#1e293b' : '#e2e8f0'} />
          </linearGradient>
        </defs>

        {/* Ground architectural shadow */}
        <rect
          x="36"
          y="20"
          width="142"
          height="86"
          rx="14"
          fill={theme.shadowColor}
          transform={`translate(${theme.shadowOffsetX + 1}, ${theme.shadowOffsetY + 1})`}
        />

        {/* Main Mosque Prayer Hall Roof & Parapet */}
        <rect
          x="36"
          y="20"
          width="138"
          height="82"
          rx="12"
          fill={`url(#wall-${mosque.block})`}
          stroke={isLit ? '#fbbf24' : '#047857'}
          strokeWidth="2.2"
        />

        {/* Inner Decorative Courtyard Border on Roof */}
        <rect
          x="45"
          y="28"
          width="120"
          height="66"
          rx="8"
          fill={isNight ? '#1e293b' : '#f1f5f9'}
          stroke={isLit ? 'rgba(251, 191, 36, 0.45)' : '#cbd5e1'}
          strokeWidth="1.2"
        />

        {/* Front Entrance Porch & Warm Glowing Arched Windows */}
        <rect
          x="74"
          y="96"
          width="62"
          height="10"
          rx="3"
          fill={isLit ? '#fef08a' : '#0f766e'}
          stroke={isLit ? '#f59e0b' : '#065f46'}
          strokeWidth="1"
        />
        {[52, 66, 134, 148].map((wx) => (
          <rect
            key={wx}
            x={wx}
            y="95"
            width="8"
            height="6"
            rx="2"
            fill={isLit ? '#fde68a' : '#38bdf8'}
            opacity={isLit ? 0.95 : 0.7}
          />
        ))}

        {/* Small Flanking Secondary Domes */}
        <circle
          cx="62"
          cy="61"
          r="13"
          fill={`url(#dome-${mosque.block})`}
          stroke="#fbbf24"
          strokeWidth="1.2"
        />
        <circle cx="62" cy="61" r="2.2" fill="#fde047" />
        <circle
          cx="148"
          cy="61"
          r="13"
          fill={`url(#dome-${mosque.block})`}
          stroke="#fbbf24"
          strokeWidth="1.2"
        />
        <circle cx="148" cy="61" r="2.2" fill="#fde047" />

        {/* Grand Central Emerald & Gold Dome (Kubah Utama) */}
        <circle
          cx="105"
          cy="61"
          r="28"
          fill={`url(#dome-${mosque.block})`}
          stroke="#fbbf24"
          strokeWidth="2"
        />
        {/* Dome architectural ribs */}
        <circle
          cx="105"
          cy="61"
          r="19"
          fill="none"
          stroke="rgba(254, 240, 138, 0.35)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <path
          d="M105 33V89M77 61H133M85 41L125 81M125 41L85 81"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.9"
        />
        {/* Golden Crescent Finial Center */}
        <circle cx="105" cy="61" r="5.5" fill="#fbbf24" />
        <circle cx="106.8" cy="59.8" r="3.6" fill="#065f46" />

        {/* Tall Cylindrical Minaret (Menara Masjid) at Right Corner */}
        <g>
          <circle
            cx="185"
            cy="34"
            r="13"
            fill={theme.shadowColor}
            transform="translate(2, 3)"
          />
          <circle
            cx="185"
            cy="34"
            r="13"
            fill={isNight ? '#334155' : '#f8fafc'}
            stroke={isLit ? '#fbbf24' : '#059669'}
            strokeWidth="2"
          />
          <circle cx="185" cy="34" r="8" fill={`url(#dome-${mosque.block})`} stroke="#fbbf24" strokeWidth="1.2" />
          <circle cx="185" cy="34" r="2.6" fill="#fde047" />
        </g>

        {/* Ablution Fountain Pool (Kolam Wudhu) at Left Side */}
        <g>
          <rect
            x="10"
            y="45"
            width="18"
            height="32"
            rx="6"
            fill={isNight ? '#0e7490' : '#38bdf8'}
            stroke={isNight ? '#22d3ee' : '#e0f2fe'}
            strokeWidth="1.6"
          />
          <circle cx="19" cy="61" r="3.5" fill="#bae6fd" opacity="0.85" />
        </g>
      </svg>

      {/* Clean Floating Mosque Label Badge */}
      <div className="pointer-events-none absolute -top-3.5 left-1/2 z-20 -translate-x-1/2">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/30 bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-emerald-950 shadow-md transition-all duration-200 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 group-hover:bg-amber-300" />
          <span>{mosque.name}</span>
        </span>
      </div>
    </button>
  );
});
