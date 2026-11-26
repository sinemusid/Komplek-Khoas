import React from 'react';
import { KavlingLot, Resident, TimeOfDay } from '../config/khoasConfig';
import { MAP_THEMES, OCCUPIED_ROOF_PALETTES } from '../utils/themePalette';

interface HouseUnitProps {
  lot: KavlingLot;
  resident?: Resident;
  phase: TimeOfDay;
  isSelectMode: boolean;
  isHighlighted: boolean;
  isQuotaFull: boolean;
  onSelectEmpty: (lotId: string) => void;
  onSelectOccupied: (resident: Resident) => void;
  onHoverChange: (info: { lot: KavlingLot; resident?: Resident; x: number; y: number } | null) => void;
}

export const HouseUnit = React.memo(function HouseUnit({
  lot,
  resident,
  phase,
  isSelectMode,
  isHighlighted,
  isQuotaFull,
  onSelectEmpty,
  onSelectOccupied,
  onHoverChange,
}: HouseUnitProps) {
  const theme = MAP_THEMES[phase];
  const isOccupied = Boolean(resident);
  const palette = isOccupied
    ? OCCUPIED_ROOF_PALETTES[(resident!.colorSeed + lot.roofVariant) % OCCUPIED_ROOF_PALETTES.length]
    : null;

  const isNight = phase === 'night';
  const isDusk = phase === 'dusk';
  const windowsLit = isOccupied && (isNight || isDusk);

  const roofTop = isOccupied ? palette!.top : theme.vacantRoofTop;
  const roofSide = isOccupied ? palette!.side : theme.vacantRoofSide;
  const wallColor = isOccupied ? palette!.wall : theme.vacantWall;

  const canClickEmpty = !isOccupied && !isQuotaFull;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOccupied && resident) {
      onSelectOccupied(resident);
    } else if (canClickEmpty) {
      onSelectEmpty(lot.id);
    }
  };

  const handleMouseEnter = () => {
    onHoverChange({
      lot,
      resident,
      x: lot.x + lot.width / 2,
      y: lot.y,
    });
  };

  const handleMouseLeave = () => {
    onHoverChange(null);
  };

  const ariaLabel = isOccupied
    ? `Rumah ${resident!.houseNumberFormatted} - ${resident!.nama} (Kavling ${lot.id})`
    : isQuotaFull
      ? `Kavling ${lot.id} - Kuota penuh`
      : `Kavling ${lot.id} - Kosong (Klik untuk pilih)`;

  return (
    <button
      type="button"
      data-lot-id={lot.id}
      data-occupied={isOccupied ? 'true' : 'false'}
      aria-label={ariaLabel}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      style={{
        left: lot.x,
        top: lot.y,
        width: lot.width,
        height: lot.height,
        backgroundColor: isOccupied ? theme.occupiedYardBg : theme.vacantLotBg,
      }}
      className={`group absolute rounded-[6px] p-[4px] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:z-30 ${
        isOccupied || canClickEmpty ? 'cursor-pointer hover:scale-[1.12] hover:z-20' : 'cursor-not-allowed opacity-75'
      } ${
        isSelectMode && canClickEmpty
          ? 'ring-2 ring-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.45)]'
          : ''
      } ${isHighlighted ? 'z-30 ring-2 ring-amber-400' : ''}`}
    >
      {/* Highlight pulse ring when focused from search or new registration */}
      {isHighlighted && (
        <span
          aria-hidden="true"
          className="animate-house-pulse pointer-events-none absolute -inset-1.5 rounded-[10px] border-2 border-amber-400"
        />
      )}

      {/* Warm porch/ambient glow pool around occupied homes at night/dusk */}
      {windowsLit && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-xl"
          style={{
            background: isNight
              ? 'radial-gradient(circle, rgba(251, 191, 36, 0.34) 0%, rgba(251, 191, 36, 0) 72%)'
              : 'radial-gradient(circle, rgba(251, 191, 36, 0.18) 0%, rgba(251, 191, 36, 0) 70%)',
          }}
        />
      )}

      {/* 2.5D House Body */}
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[4px]"
        style={{
          boxShadow: `${theme.shadowOffsetX}px ${theme.shadowOffsetY}px 0px ${theme.shadowColor}`,
          opacity: isOccupied ? 1 : isNight ? 0.58 : 0.72,
        }}
      >
        {/* Pitched Roof (Top 62%) */}
        <div
          className="relative flex-1"
          style={{
            background: `linear-gradient(180deg, ${roofTop} 0%, ${roofSide} 100%)`,
          }}
        >
          {/* Roof ridge line */}
          <div
            className="absolute inset-x-[4px] top-[45%] h-[2px] rounded-full opacity-55"
            style={{ backgroundColor: isOccupied ? palette!.ridge : '#cbd5e1' }}
          />
          {/* Subtle chimney or dormer accent for architectural variety */}
          {isOccupied && lot.roofVariant % 2 === 0 && (
            <div
              className="absolute right-[5px] top-[3px] h-[5px] w-[5px] rounded-[1px]"
              style={{ backgroundColor: roofSide, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}
            />
          )}
          {/* Kavling / House badge micro-tag on roof */}
          <span
            className="pointer-events-none absolute inset-x-0 bottom-[1px] text-center font-mono text-[7px] font-bold leading-none tracking-tight"
            style={{
              color: isOccupied ? 'rgba(255,255,255,0.94)' : isNight ? '#94a3b8' : '#334155',
              textShadow: isOccupied ? '0 1px 2px rgba(0,0,0,0.55)' : 'none',
            }}
          >
            {isOccupied ? resident!.houseNumberFormatted : lot.id}
          </span>
        </div>

        {/* Front Facade & Windows (Bottom 38%) */}
        <div
          className="flex h-[13px] items-center justify-between px-[5px]"
          style={{
            backgroundColor: isNight && !isOccupied ? '#1e293b' : wallColor,
            filter: isNight && isOccupied ? 'brightness(0.76)' : 'none',
          }}
        >
          {/* Left Window */}
          <span
            className="h-[6px] w-[8px] rounded-[1px]"
            style={{
              backgroundColor: windowsLit
                ? isNight
                  ? '#fde047'
                  : '#fcd34d'
                : isOccupied
                  ? '#38bdf8'
                  : '#64748b',
              boxShadow: windowsLit
                ? isNight
                  ? '0 0 6px 2px rgba(253, 224, 71, 0.85)'
                  : '0 0 4px 1px rgba(252, 211, 77, 0.6)'
                : 'none',
            }}
          />
          {/* Front Door */}
          <span
            className="mt-[2px] h-[9px] w-[7px] rounded-t-[2px]"
            style={{
              backgroundColor: isOccupied ? '#78350f' : '#475569',
            }}
          />
          {/* Right Window */}
          <span
            className="h-[6px] w-[8px] rounded-[1px]"
            style={{
              backgroundColor: windowsLit
                ? isNight
                  ? '#fef08a'
                  : '#fcd34d'
                : isOccupied
                  ? '#38bdf8'
                  : '#64748b',
              boxShadow: windowsLit
                ? isNight
                  ? '0 0 6px 2px rgba(254, 240, 138, 0.85)'
                  : '0 0 4px 1px rgba(252, 211, 77, 0.6)'
                : 'none',
            }}
          />
        </div>
      </div>
    </button>
  );
});
