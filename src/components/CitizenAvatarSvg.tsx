import React from 'react';
import { Gender } from '../config/khoasConfig';
import { getAvatarAppearance } from '../utils/themePalette';

interface CitizenAvatarSvgProps {
  gender?: Gender;
  seed: number;
  width?: number;
  height?: number;
  showShadow?: boolean;
  className?: string;
}

const HIJAB_PALETTES = [
  { main: '#f472b6', shade: '#db2777', dress: '#fbcfe8', accent: '#be185d' }, // Soft Rose
  { main: '#c084fc', shade: '#9333ea', dress: '#e9d5ff', accent: '#7e22ce' }, // Pastel Lavender
  { main: '#38bdf8', shade: '#0284c7', dress: '#bae6fd', accent: '#0369a1' }, // Sky Pastel
  { main: '#34d399', shade: '#059669', dress: '#a7f3d0', accent: '#047857' }, // Sage Mint
  { main: '#fbbf24', shade: '#d97706', dress: '#fef08a', accent: '#b45309' }, // Cream Gold
  { main: '#fb7185', shade: '#e11d48', dress: '#fecdd3', accent: '#be123c' }, // Peach Coral
  { main: '#a78bfa', shade: '#7c3aed', dress: '#ddd6fe', accent: '#6d28d9' }, // Lilac Mist
  { main: '#2dd4bf', shade: '#0d9488', dress: '#99f6e4', accent: '#0f766e' }, // Soft Teal
];

const MALE_CAP_COLORS = ['#1e293b', '#0f172a', '#334155', '#7c2d12', '#1e3a8a'];

export const CitizenAvatarSvg = React.memo(function CitizenAvatarSvg({
  gender = '',
  seed,
  width = 20,
  height = 24,
  showShadow = true,
  className = '',
}: CitizenAvatarSvgProps) {
  const safeSeed = Math.abs(seed || 0);
  const appearance = getAvatarAppearance(safeSeed);

  if (gender === 'Perempuan') {
    const hijab = HIJAB_PALETTES[safeSeed % HIJAB_PALETTES.length];
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 22 26"
        fill="none"
        aria-hidden="true"
        data-avatar-gender="Perempuan"
        className={className}
      >
        {showShadow && (
          <ellipse cx="11" cy="24.2" rx="6.5" ry="1.8" fill="rgba(15,23,42,0.34)" />
        )}
        {/* Shoes peeking under modest gamis/skirt */}
        <rect x="7.4" y="21.4" width="2.7" height="2.4" rx="1.1" fill="#334155" />
        <rect x="11.9" y="21.4" width="2.7" height="2.4" rx="1.1" fill="#334155" />
        {/* Modest tunic / gamis body */}
        <path
          d="M6.4 12.6C6.4 11.4 7.4 10.6 8.6 10.6H13.4C14.6 10.6 15.6 11.4 15.6 12.6L16.8 21.8C16.8 22.3 16.4 22.6 15.9 22.6H6.1C5.6 22.6 5.2 22.3 5.2 21.8L6.4 12.6Z"
          fill={hijab.dress}
          stroke={hijab.shade}
          strokeWidth="0.7"
        />
        {/* Outer Hijab / Kerudung Hood covering head, neck & chest gracefully */}
        <path
          d="M4.8 8.3C4.8 4.4 7.5 2 11 2C14.5 2 17.2 4.4 17.2 8.3L17.9 14.3C17.9 15.2 17.1 15.9 16.1 15.8C14.4 15.6 12.8 16.7 11 16.7C9.2 16.7 7.6 15.6 5.9 15.8C4.9 15.9 4.1 15.2 4.1 14.3L4.8 8.3Z"
          fill={hijab.main}
          stroke={hijab.shade}
          strokeWidth="0.75"
        />
        {/* Soft hijab fold highlight */}
        <path
          d="M7.3 13.8C8.6 14.7 10.1 15.1 11.7 14.9C13.1 14.7 14.4 14.1 15.4 13.3"
          stroke={hijab.accent}
          strokeWidth="0.75"
          strokeLinecap="round"
          opacity="0.55"
        />
        {/* Inner ciput rim */}
        <path
          d="M7.1 7.6C7.1 5.3 8.8 3.9 11 3.9C13.2 3.9 14.9 5.3 14.9 7.6"
          fill={hijab.shade}
        />
        {/* Face framed cleanly inside hijab */}
        <ellipse cx="11" cy="8.3" rx="3.5" ry="3.6" fill={appearance.skin} />
        {/* Cute eyes & rosy cheeks */}
        <circle cx="9.6" cy="8.2" r="0.65" fill="#0f172a" />
        <circle cx="12.4" cy="8.2" r="0.65" fill="#0f172a" />
        <circle cx="8.7" cy="9.2" r="0.55" fill="#fda4af" opacity="0.75" />
        <circle cx="13.3" cy="9.2" r="0.55" fill="#fda4af" opacity="0.75" />
        {/* Warm smile */}
        <path
          d="M10.1 9.7C10.5 10.2 11.5 10.2 11.9 9.7"
          stroke="#7c2d12"
          strokeWidth="0.65"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (gender === 'Laki-laki') {
    // 0 = short hair, 1 = peci/kopiah, 2 = casual cap
    const headStyle = safeSeed % 3;
    const capColor = MALE_CAP_COLORS[(safeSeed >> 2) % MALE_CAP_COLORS.length];

    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 22 26"
        fill="none"
        aria-hidden="true"
        data-avatar-gender="Laki-laki"
        className={className}
      >
        {showShadow && (
          <ellipse cx="11" cy="24.2" rx="6.5" ry="1.8" fill="rgba(15,23,42,0.34)" />
        )}
        {/* Legs / trousers */}
        <rect x="7.2" y="17.5" width="3" height="6" rx="1.2" fill="#1e293b" />
        <rect x="11.8" y="17.5" width="3" height="6" rx="1.2" fill="#1e293b" />
        {/* Shirt / Jacket Torso */}
        <rect
          x="5.6"
          y="11"
          width="10.8"
          height="7.6"
          rx="3"
          fill={appearance.shirt}
          stroke="rgba(15,23,42,0.22)"
          strokeWidth="0.7"
        />
        {/* Collar accent */}
        <path d="M9.2 11.2L11 13.1L12.8 11.2" stroke="rgba(255,255,255,0.65)" strokeWidth="0.9" />
        {/* Head */}
        <circle cx="11" cy="7.5" r="4.1" fill={appearance.skin} />
        {/* Male Hair / Kopiah / Casual Cap */}
        {headStyle === 1 ? (
          /* Kopiah / Peci */
          <>
            <path
              d="M6.8 6.4C6.8 5.2 7.5 3.3 11 3.3C14.5 3.3 15.2 5.2 15.2 6.4H6.8Z"
              fill="#0f172a"
            />
            <rect x="7.1" y="3.2" width="7.8" height="3.1" rx="1.2" fill="#1e293b" />
            <line x1="7.5" y1="5.7" x2="14.5" y2="5.7" stroke="#f59e0b" strokeWidth="0.7" opacity="0.85" />
          </>
        ) : headStyle === 2 ? (
          /* Casual Cap */
          <>
            <path
              d="M6.9 6.6C6.9 4.2 8.7 2.9 11 2.9C13.3 2.9 15.1 4.2 15.1 6.6H6.9Z"
              fill={capColor}
            />
            <rect x="6.5" y="5.7" width="10.4" height="1.5" rx="0.75" fill={capColor} />
          </>
        ) : (
          /* Neat Short Hair */
          <path
            d="M6.8 7.2C6.7 4.4 8.5 3.1 11 3.1C13.5 3.1 15.3 4.4 15.2 7.2C14.1 6.1 12.7 5.6 11 5.6C9.3 5.6 7.9 6.1 6.8 7.2Z"
            fill={appearance.hair}
          />
        )}
        {/* Eyes & Smile */}
        <circle cx="9.6" cy="7.9" r="0.65" fill="#0f172a" />
        <circle cx="12.4" cy="7.9" r="0.65" fill="#0f172a" />
        <path
          d="M10.1 9.5C10.6 9.9 11.4 9.9 11.9 9.5"
          stroke="#7c2d12"
          strokeWidth="0.65"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Fallback Neutral Avatar (Belum Diisi)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 22 26"
      fill="none"
      aria-hidden="true"
      data-avatar-gender="neutral"
      className={className}
    >
      {showShadow && (
        <ellipse cx="11" cy="24.2" rx="6.5" ry="1.8" fill="rgba(15,23,42,0.34)" />
      )}
      <rect x="7.4" y="17.5" width="2.8" height="6" rx="1.2" fill="#334155" />
      <rect x="11.8" y="17.5" width="2.8" height="6" rx="1.2" fill="#334155" />
      <rect
        x="5.8"
        y="11.2"
        width="10.4"
        height="7.4"
        rx="3"
        fill={appearance.shirt}
        stroke="rgba(15,23,42,0.18)"
        strokeWidth="0.7"
      />
      <circle cx="11" cy="7.5" r="4" fill={appearance.skin} />
      <path
        d="M7 7.1C7 4.5 8.7 3.2 11 3.2C13.3 3.2 15 4.5 15 7.1C13.9 6.3 12.6 5.9 11 5.9C9.4 5.9 8.1 6.3 7 7.1Z"
        fill={appearance.hair}
      />
      <circle cx="9.6" cy="7.9" r="0.65" fill="#0f172a" />
      <circle cx="12.4" cy="7.9" r="0.65" fill="#0f172a" />
    </svg>
  );
});
