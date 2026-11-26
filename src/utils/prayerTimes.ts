export type PrayerKey = 'Subuh' | 'Dzuhur' | 'Ashar' | 'Maghrib' | 'Isya';

export interface PrayerSchedule {
  city: string;
  dateLabel: string;
  hijriLabel?: string;
  isFallback: boolean;
  timings: Record<PrayerKey, string>;
}

export interface NextPrayerInfo {
  key: PrayerKey;
  time: string;
  countdownLabel: string;
  minutesRemaining: number;
}

export const POPULAR_INDONESIA_CITIES = [
  'Jakarta',
  'Bandung',
  'Surabaya',
  'Yogyakarta',
  'Semarang',
  'Bogor',
  'Depok',
  'Tangerang',
  'Bekasi',
  'Solo',
  'Malang',
  'Medan',
  'Palembang',
  'Makassar',
  'Denpasar',
  'Pontianak',
  'Balikpapan',
  'Padang',
  'Pekanbaru',
  'Banjarmasin',
] as const;

export const FALLBACK_WIB_TIMINGS: Record<PrayerKey, string> = {
  Subuh: '04:22',
  Dzuhur: '11:51',
  Ashar: '15:12',
  Maghrib: '17:58',
  Isya: '19:11',
};

export const PRAYER_ORDER: PrayerKey[] = ['Subuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'];

function cleanTimeString(raw: unknown, fallback: string): string {
  const str = String(raw ?? '').trim();
  const match = str.match(/(\d{1,2}:\d{2})/);
  if (!match) return fallback;
  const [h, m] = match[1].split(':');
  return `${String(Number(h)).padStart(2, '0')}:${String(Number(m)).padStart(2, '0')}`;
}

export function formatIndonesianDateWib(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function getWibSecondsSinceMidnight(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const s = Number(parts.find((p) => p.type === 'second')?.value ?? '0');
  return h * 3600 + m * 60 + s;
}

/**
 * Menentukan waktu sholat berikutnya beserta hitung mundur singkat menuju Adzan.
 */
export function getNextPrayerInfo(
  timings: Record<PrayerKey, string>,
  nowSecondsSinceMidnight: number
): NextPrayerInfo {
  const parsed = PRAYER_ORDER.map((key) => {
    const [hh, mm] = timings[key].split(':').map(Number);
    return {
      key,
      time: timings[key],
      seconds: (hh || 0) * 3600 + (mm || 0) * 60,
    };
  });

  let next = parsed.find((p) => p.seconds > nowSecondsSinceMidnight);
  let diffSec = 0;

  if (next) {
    diffSec = next.seconds - nowSecondsSinceMidnight;
  } else {
    // Setelah Isya -> menuju Subuh esok hari
    next = parsed[0];
    diffSec = 86400 - nowSecondsSinceMidnight + next.seconds;
  }

  const hours = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;

  const countdownLabel =
    hours > 0
      ? `${hours} jam ${String(mins).padStart(2, '0')} menit lagi`
      : mins > 0
        ? `${mins} menit ${String(secs).padStart(2, '0')} detik lagi`
        : `${secs} detik lagi`;

  return {
    key: next.key,
    time: next.time,
    countdownLabel,
    minutesRemaining: Math.ceil(diffSec / 60),
  };
}

/**
 * Mengambil jadwal sholat real-time dari Aladhan API (Kemenag RI method=20),
 * dengan fallback otomatis ke jadwal standar WIB apabila offline/gagal.
 */
export async function fetchPrayerSchedule(cityRaw: string): Promise<PrayerSchedule> {
  const city = cityRaw.trim() || 'Jakarta';
  const dateLabel = formatIndonesianDateWib();

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7500);
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Indonesia&method=20`;
    const response = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      data?: {
        timings?: Record<string, string>;
        date?: {
          hijri?: {
            day?: string;
            month?: { en?: string };
            year?: string;
          };
        };
      };
    };

    const t = json.data?.timings;
    if (!t) throw new Error('Empty timings');

    const hijri = json.data?.date?.hijri;
    const hijriLabel =
      hijri?.day && hijri?.month?.en && hijri?.year
        ? `${hijri.day} ${hijri.month.en} ${hijri.year} H`
        : undefined;

    return {
      city,
      dateLabel,
      hijriLabel,
      isFallback: false,
      timings: {
        Subuh: cleanTimeString(t.Fajr, FALLBACK_WIB_TIMINGS.Subuh),
        Dzuhur: cleanTimeString(t.Dhuhr, FALLBACK_WIB_TIMINGS.Dzuhur),
        Ashar: cleanTimeString(t.Asr, FALLBACK_WIB_TIMINGS.Ashar),
        Maghrib: cleanTimeString(t.Maghrib, FALLBACK_WIB_TIMINGS.Maghrib),
        Isya: cleanTimeString(t.Isha, FALLBACK_WIB_TIMINGS.Isya),
      },
    };
  } catch {
    return {
      city,
      dateLabel,
      isFallback: true,
      timings: { ...FALLBACK_WIB_TIMINGS },
    };
  }
}
