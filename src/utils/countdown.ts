import { EVENT_TARGET_ISO } from '../config/khoasConfig';

export interface EventCountdown {
  isLive: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedDays: string;
  formattedHours: string;
  formattedMinutes: string;
  formattedSeconds: string;
}

/**
 * Menghitung mundur waktu menuju Pre-Launch Komik Khoas (11 Desember 2026, 19:30 WIB).
 */
export function getEventCountdown(
  nowMs: number = Date.now(),
  targetIso: string = EVENT_TARGET_ISO
): EventCountdown {
  const targetMs = Date.parse(targetIso);
  const diffMs = targetMs - nowMs;

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return {
      isLive: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formattedDays: '00',
      formattedHours: '00',
      formattedMinutes: '00',
      formattedSeconds: '00',
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    isLive: false,
    days,
    hours,
    minutes,
    seconds,
    formattedDays: String(days).padStart(2, '0'),
    formattedHours: String(hours).padStart(2, '0'),
    formattedMinutes: String(minutes).padStart(2, '0'),
    formattedSeconds: String(seconds).padStart(2, '0'),
  };
}
