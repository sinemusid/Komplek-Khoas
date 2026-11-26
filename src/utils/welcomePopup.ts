export const WELCOME_POPUP_STORAGE_KEY = 'khoas_welcome_popup_last_exit_v1';
export const WELCOME_POPUP_ABSENCE_MS = 10 * 60 * 1000; // 10 menit
export const WELCOME_POSTER_SRC = '/assets/aistudio/Proyek_Baru_14_701234c2.jpg';

/**
 * Mem-parse timestamp milidetik yang tersimpan di localStorage secara aman.
 */
export function parseStoredTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Menentukan apakah pop-up sambutan harus ditampilkan:
 * - Kunjungan pertama (`lastExitAt === null`) -> tampil (`true`)
 * - Kembali setelah keluar lebih dari 10 menit (`now - lastExitAt > 10 menit`) -> tampil (`true`)
 * - Kembali dalam waktu <= 10 menit -> tidak tampil (`false`)
 */
export function shouldShowWelcomePopup(
  lastExitAt: number | null,
  now: number = Date.now(),
  absenceThresholdMs: number = WELCOME_POPUP_ABSENCE_MS
): boolean {
  if (lastExitAt === null || !Number.isFinite(lastExitAt)) {
    return true;
  }
  return now - lastExitAt > absenceThresholdMs;
}

export function readWelcomePopupLastExit(): number | null {
  try {
    return parseStoredTimestamp(window.localStorage.getItem(WELCOME_POPUP_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function recordWelcomePopupExit(timestamp: number = Date.now()): void {
  try {
    window.localStorage.setItem(WELCOME_POPUP_STORAGE_KEY, String(timestamp));
  } catch {
    // Ignore storage errors in restricted environments
  }
}
