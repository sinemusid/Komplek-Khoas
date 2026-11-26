import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Loader2,
  MapPin,
  MoonStar,
  RefreshCw,
  Search,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { MosqueBuilding } from '../config/khoasConfig';
import {
  fetchPrayerSchedule,
  getNextPrayerInfo,
  getWibSecondsSinceMidnight,
  POPULAR_INDONESIA_CITIES,
  PRAYER_ORDER,
  PrayerKey,
  PrayerSchedule,
} from '../utils/prayerTimes';
import { WibTimeInfo } from '../utils/wibTime';

interface PrayerTimesModalProps {
  mosque: MosqueBuilding | null;
  defaultCity: string;
  wibInfo: WibTimeInfo;
  onClose: () => void;
}

const PRAYER_META: Record<PrayerKey, { label: string; arabic: string }> = {
  Subuh: { label: 'Subuh', arabic: 'الفجر' },
  Dzuhur: { label: 'Dzuhur', arabic: 'الظهر' },
  Ashar: { label: 'Ashar', arabic: 'العصر' },
  Maghrib: { label: 'Maghrib', arabic: 'المغرب' },
  Isya: { label: 'Isya', arabic: 'العشاء' },
};

export function PrayerTimesModal({
  mosque,
  defaultCity,
  wibInfo,
  onClose,
}: PrayerTimesModalProps) {
  const initialCity = defaultCity.trim() && defaultCity.trim().toLowerCase() !== 'indonesia'
    ? defaultCity.trim()
    : 'Jakarta';

  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [cityInput, setCityInput] = useState(initialCity);
  const [schedule, setSchedule] = useState<PrayerSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [nowSec, setNowSec] = useState(() => getWibSecondsSinceMidnight());

  useEffect(() => {
    if (!mosque) return;
    const cleanDefault =
      defaultCity.trim() && defaultCity.trim().toLowerCase() !== 'indonesia'
        ? defaultCity.trim()
        : 'Jakarta';
    setSelectedCity(cleanDefault);
    setCityInput(cleanDefault);
  }, [mosque, defaultCity]);

  useEffect(() => {
    if (!mosque) return;
    let cancelled = false;
    setLoading(true);
    void fetchPrayerSchedule(selectedCity).then((data) => {
      if (!cancelled) {
        setSchedule(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mosque, selectedCity]);

  // Live 1-second tick for accurate next-prayer countdown while modal is open
  useEffect(() => {
    if (!mosque) return;
    setNowSec(getWibSecondsSinceMidnight());
    const id = window.setInterval(() => {
      setNowSec(getWibSecondsSinceMidnight());
    }, 1000);
    return () => window.clearInterval(id);
  }, [mosque]);

  useEffect(() => {
    if (!mosque) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mosque, onClose]);

  const nextPrayer = useMemo(() => {
    if (!schedule) return null;
    return getNextPrayerInfo(schedule.timings, nowSec);
  }, [schedule, nowSec]);

  if (!mosque) return null;

  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cityInput.trim();
    if (!cleaned) return;
    setSelectedCity(cleaned);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prayer-modal-title"
      data-testid="prayer-times-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-emerald-200/60 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Emerald Architectural Header */}
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 px-6 pb-5 pt-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-amber-300 ring-1 ring-emerald-300/35">
                <MoonStar className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold tracking-wider text-emerald-300">
                  JADWAL WAKTU SHOLAT REAL-TIME
                </p>
                <h2
                  id="prayer-modal-title"
                  className="mt-0.5 text-lg font-bold tracking-tight text-white sm:text-xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {mosque.name} — Komplek Khoas
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Jadwal Waktu Sholat"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Date & Live WIB Clock */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3 text-xs">
            <div className="flex flex-col">
              <span className="font-semibold text-white">
                {schedule?.dateLabel ?? 'Hari ini'}
              </span>
              {schedule?.hijriLabel && (
                <span className="text-[11px] text-emerald-200/85">{schedule.hijriLabel}</span>
              )}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-black/25 px-3 py-1.5 font-mono text-xs font-bold tabular-nums text-amber-300 ring-1 ring-white/10">
              <Clock className="h-3.5 w-3.5" />
              <span>{wibInfo.formattedClock} WIB</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* City Selector (Dropdown + Custom Input) */}
          <form onSubmit={handleCitySearch} className="space-y-2">
            <label
              htmlFor="prayer-city-select"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>Kota / Wilayah (Kemenag RI)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                id="prayer-city-select"
                value={
                  POPULAR_INDONESIA_CITIES.some(
                    (c) => c.toLowerCase() === selectedCity.toLowerCase()
                  )
                    ? POPULAR_INDONESIA_CITIES.find(
                        (c) => c.toLowerCase() === selectedCity.toLowerCase()
                      )
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedCity(e.target.value);
                    setCityInput(e.target.value);
                  }
                }}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="">Pilih kota populer...</option>
                {POPULAR_INDONESIA_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <div className="relative flex flex-1 items-center">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="Atau ketik nama kota..."
                  aria-label="Ketik nama kota di Indonesia"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
                <button
                  type="submit"
                  aria-label="Cari jadwal sholat kota"
                  className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>

          {/* Upcoming Prayer Highlight Banner */}
          {nextPrayer && !loading && (
            <div
              data-testid="next-prayer-highlight"
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    Sholat Berikutnya · {schedule?.city ?? selectedCity}
                  </p>
                  <p className="text-sm font-bold text-emerald-950">
                    {nextPrayer.key} ({nextPrayer.time} WIB)
                  </p>
                </div>
              </div>
              <span className="whitespace-nowrap rounded-lg bg-emerald-700 px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums text-amber-200">
                {nextPrayer.countdownLabel}
              </span>
            </div>
          )}

          {/* 5 Daily Prayer Times List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <span className="text-xs font-medium">
                Memuat jadwal sholat untuk {selectedCity}...
              </span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {PRAYER_ORDER.map((key) => {
                const isNext = nextPrayer?.key === key;
                const time = schedule?.timings[key] ?? '--:--';
                return (
                  <div
                    key={key}
                    data-testid={`prayer-row-${key.toLowerCase()}`}
                    data-is-next={isNext ? 'true' : 'false'}
                    className={`flex items-center justify-between px-4 py-3 transition-colors ${
                      isNext
                        ? 'bg-emerald-950 text-white'
                        : 'bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isNext ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-emerald-500/40'
                        }`}
                      />
                      <div>
                        <p className="flex items-center gap-2 text-sm font-bold">
                          <span>{PRAYER_META[key].label}</span>
                          {isNext && (
                            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                              SEGERA
                            </span>
                          )}
                        </p>
                        <p
                          className={`text-[11px] ${
                            isNext ? 'text-emerald-200/80' : 'text-slate-400'
                          }`}
                        >
                          {PRAYER_META[key].arabic}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-base font-extrabold tabular-nums ${
                        isNext ? 'text-amber-300' : 'text-slate-900'
                      }`}
                    >
                      {time} <span className="text-[11px] font-semibold opacity-70">WIB</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Graceful Offline Fallback Notice */}
          {schedule?.isFallback && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Menampilkan jadwal standar WIB (server jadwal sholat sedang offline).</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void fetchPrayerSchedule(selectedCity).then((data) => {
                    setSchedule(data);
                    setLoading(false);
                  });
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-200/70 px-2 py-1 font-semibold text-amber-950 hover:bg-amber-200"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Ulangi</span>
              </button>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 sm:text-sm"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
