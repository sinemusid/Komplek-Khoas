import { LightingOverride, TimeOfDay } from '../config/khoasConfig';

export interface WibTimeInfo {
  hours: number;
  minutes: number;
  seconds: number;
  /** Format HH:mm */
  formattedClock: string;
  /** Fase otomatis berdasarkan jam WIB */
  autoPhase: TimeOfDay;
  /** Label bahasa Indonesia untuk fase */
  phaseLabel: string;
}

export function getPhaseForWibHour(hour: number): TimeOfDay {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  if (normalized >= 6 && normalized < 16) {
    return 'day';
  }
  if (normalized >= 16 && normalized < 18) {
    return 'dusk';
  }
  return 'night';
}

export function getPhaseLabel(phase: TimeOfDay, hour?: number): string {
  if (phase === 'day') {
    if (typeof hour === 'number' && hour >= 6 && hour < 11) {
      return 'Pagi';
    }
    return 'Siang';
  }
  if (phase === 'dusk') {
    return 'Senja';
  }
  return 'Malam';
}

/**
 * Mengambil jam WIB (Asia/Jakarta, UTC+7) secara akurat tanpa tergantung zona waktu perangkat.
 */
export function getWibTimeInfo(date: Date = new Date()): WibTimeInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const rawHours = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
    const hours = rawHours === 24 ? 0 : rawHours;
    const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const seconds = Number(parts.find((p) => p.type === 'second')?.value ?? '0');
    const autoPhase = getPhaseForWibHour(hours);

    return {
      hours,
      minutes,
      seconds,
      formattedClock: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      autoPhase,
      phaseLabel: getPhaseLabel(autoPhase, hours),
    };
  } catch {
    // Fallback manual UTC+7 jika Intl timeZone tidak tersedia
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const wibDate = new Date(utcMs + 7 * 3600000);
    const hours = wibDate.getHours();
    const minutes = wibDate.getMinutes();
    const seconds = wibDate.getSeconds();
    const autoPhase = getPhaseForWibHour(hours);
    return {
      hours,
      minutes,
      seconds,
      formattedClock: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      autoPhase,
      phaseLabel: getPhaseLabel(autoPhase, hours),
    };
  }
}

export function resolveActivePhase(
  override: LightingOverride,
  wibInfo: WibTimeInfo
): { phase: TimeOfDay; label: string } {
  if (override === 'auto') {
    return { phase: wibInfo.autoPhase, label: wibInfo.phaseLabel };
  }
  return {
    phase: override,
    label: override === 'day' ? 'Siang' : override === 'dusk' ? 'Senja' : 'Malam',
  };
}
