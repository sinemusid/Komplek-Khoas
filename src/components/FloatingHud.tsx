import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Building,
  Clock,
  Home,
  LogIn,
  MessageCircle,
  Minus,
  Moon,
  Music,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  LightingOverride,
  MapInteractionMode,
  MAX_KAVLING_QUOTA,
  Resident,
  TimeOfDay,
  UserProfile,
  WHATSAPP_GROUP_URL,
} from '../config/khoasConfig';
import { computeNameSeed, searchResidents } from '../utils/sheetParser';
import { MAP_THEMES } from '../utils/themePalette';
import { WibTimeInfo } from '../utils/wibTime';
import { CitizenAvatarSvg } from './CitizenAvatarSvg';

interface FloatingHudProps {
  residents: Resident[];
  userProfile: UserProfile | null;
  wibInfo: WibTimeInfo;
  activePhase: TimeOfDay;
  activePhaseLabel: string;
  lightingOverride: LightingOverride;
  mapMode: MapInteractionMode;
  isRefreshing: boolean;
  isQuotaFull: boolean;
  dataError: string | null;
  zoomPercent: number;
  isLofiPlaying: boolean;
  onToggleLofi: () => void;
  onLightingChange: (mode: LightingOverride) => void;
  onOpenAccountGateway: () => void;
  onOpenProfilePanel: () => void;
  onCancelMapMode: () => void;
  onRefresh: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onSelectSearchResult: (resident: Resident) => void;
  onEnterAuditorium: () => void;
  onOpenShareModal: () => void;
}

export function FloatingHud({
  residents,
  userProfile,
  wibInfo,
  activePhase,
  activePhaseLabel,
  lightingOverride,
  mapMode,
  isRefreshing,
  isQuotaFull,
  dataError,
  zoomPercent,
  isLofiPlaying,
  onToggleLofi,
  onLightingChange,
  onOpenAccountGateway,
  onOpenProfilePanel,
  onCancelMapMode,
  onRefresh,
  onZoomIn,
  onZoomOut,
  onResetView,
  onSelectSearchResult,
  onEnterAuditorium,
  onOpenShareModal,
}: FloatingHudProps) {
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const theme = MAP_THEMES[activePhase];
  const isDarkHud = activePhase !== 'day';
  const occupiedCount = residents.length;
  const fillPct = Math.min(100, (occupiedCount / MAX_KAVLING_QUOTA) * 100);

  const searchResults = useMemo(() => searchResidents(residents, query), [residents, query]);

  const handlePickResult = (resident: Resident) => {
    onSelectSearchResult(resident);
    setQuery('');
    setSearchFocused(false);
    setMobileSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const lightingOptions: Array<{ id: LightingOverride; label: string; icon: React.ReactNode }> = [
    { id: 'auto', label: 'Auto', icon: <Clock className="h-3 w-3" /> },
    { id: 'day', label: 'Siang', icon: <Sun className="h-3 w-3" /> },
    { id: 'dusk', label: 'Sore', icon: <Sunset className="h-3 w-3" /> },
    { id: 'night', label: 'Malam', icon: <Moon className="h-3 w-3" /> },
  ];

  const cycleLighting = () => {
    const order: LightingOverride[] = ['auto', 'day', 'dusk', 'night'];
    const idx = order.indexOf(lightingOverride);
    onLightingChange(order[(idx + 1) % order.length]);
  };

  const userHouseNumStr = userProfile
    ? `#${String(userProfile.nomorRumah || 1).padStart(3, '0')}`
    : '';

  return (
    <>
      {/* Top Floating HUD Bar */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-2.5">
          {/* Left Zone: Title, Live Counter + Progress, WIB Clock & Time Switcher */}
          <div
            className={`pointer-events-auto flex flex-col gap-1.5 rounded-2xl border px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5 ${theme.hudGlass}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h1
                className="truncate whitespace-nowrap text-xs font-extrabold tracking-tight sm:text-base"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Komplek Khoas
              </h1>
              <span
                data-testid="wib-clock"
                className={`whitespace-nowrap font-mono text-[11px] font-semibold tabular-nums sm:text-xs ${theme.hudMuted}`}
              >
                {wibInfo.formattedClock} WIB · {activePhaseLabel}
              </span>
            </div>

            {/* Occupancy Progress & Counter + Segmented Time Control */}
            <div className="flex items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex min-w-[140px] flex-1 flex-col gap-1 sm:min-w-[175px]">
                <div className="flex items-center justify-between text-[11px] sm:text-xs">
                  <span
                    data-testid="occupancy-counter"
                    className="font-mono font-bold tabular-nums"
                  >
                    {occupiedCount} / {MAX_KAVLING_QUOTA} Rumah Terisi
                  </span>
                  <span className={`font-mono text-[10px] tabular-nums sm:text-[11px] ${theme.hudMuted}`}>
                    {Math.round(fillPct)}%
                  </span>
                </div>
                <div
                  className={`h-1.5 w-full overflow-hidden rounded-full ${
                    isDarkHud ? 'bg-white/15' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>

              {/* Desktop Segmented Time-of-Day Switcher */}
              <div
                role="group"
                aria-label="Mode pencahayaan peta"
                className={`hidden items-center gap-0.5 rounded-lg p-0.5 sm:flex ${
                  isDarkHud ? 'bg-white/10' : 'bg-slate-100'
                }`}
              >
                {lightingOptions.map((opt) => {
                  const active = lightingOverride === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onLightingChange(opt.id)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? isDarkHud
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'bg-white text-slate-900 shadow-sm'
                          : isDarkHud
                            ? 'text-slate-300 hover:text-white'
                            : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Compact Cycle Button */}
              <button
                type="button"
                onClick={cycleLighting}
                aria-label="Ganti suasana waktu peta"
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold sm:hidden ${
                  isDarkHud ? 'bg-white/12 text-amber-200' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {lightingOptions.find((o) => o.id === lightingOverride)?.icon}
                <span>{lightingOptions.find((o) => o.id === lightingOverride)?.label}</span>
              </button>
            </div>
          </div>

          {/* Right Zone: Search Bar, Unified Account Gateway / Profile Badge, Refresh + Share Button below */}
          <div className="pointer-events-none flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end sm:gap-2">
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
            {/* Mobile Search Toggle Icon */}
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen((prev) => !prev);
                window.setTimeout(() => searchInputRef.current?.focus(), 60);
              }}
              aria-label="Buka pencarian warga"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border sm:hidden ${theme.hudGlass}`}
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Search Box */}
            <div className={`${mobileSearchOpen ? 'block' : 'hidden'} relative sm:block`}>
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${theme.hudGlass}`}
              >
                <Search className={`h-4 w-4 shrink-0 ${theme.hudMuted}`} />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults.length > 0) {
                      e.preventDefault();
                      handlePickResult(searchResults[0]);
                    }
                  }}
                  placeholder="Cari nama, kota, #001, A-12..."
                  aria-label="Cari warga berdasarkan nama, kota, instansi, atau nomor rumah"
                  className={`w-40 bg-transparent text-xs font-medium outline-none sm:w-52 sm:text-sm ${
                    isDarkHud
                      ? 'text-white placeholder:text-slate-400'
                      : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Hapus pencarian"
                    onClick={() => setQuery('')}
                    className={`rounded p-0.5 ${theme.hudMuted} hover:opacity-80`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Search Autocomplete Dropdown */}
              {searchFocused && query.trim().length > 0 && (
                <div
                  role="listbox"
                  aria-label="Hasil pencarian warga"
                  className="absolute right-0 mt-1.5 max-h-72 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 text-slate-900 shadow-2xl sm:w-80"
                >
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-500">
                      Tidak ditemukan warga untuk &ldquo;{query}&rdquo;
                    </p>
                  ) : (
                    searchResults.map((res) => (
                      <button
                        key={`${res.houseNumber}-${res.kavlingId}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePickResult(res)}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-amber-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {res.nama}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {res.kota} · {res.instansi}
                          </p>
                        </div>
                        <div className="shrink-0 text-right font-mono text-xs">
                          <p className="font-bold text-amber-700">{res.houseNumberFormatted}</p>
                          <p className="text-[11px] text-slate-500">{res.kavlingId}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Unified Primary Action: Logged Out -> "Masuk / Daftar Warga" | Logged In -> Grup WA + Badge Profil Warga */}
            {userProfile ? (
              <>
                <a
                  data-testid="hud-wa-group-button"
                  href={WHATSAPP_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Gabung Grup WhatsApp Warga"
                  title="Gabung Grup WhatsApp Warga"
                  className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:h-10 sm:px-3.5"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span>Grup WA</span>
                </a>

                <button
                  type="button"
                  data-testid="profile-badge-button"
                  onClick={onOpenProfilePanel}
                  className={`inline-flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${theme.hudGlass} hover:brightness-95`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900/90 ring-1 ring-amber-400/50">
                    <CitizenAvatarSvg
                      gender={userProfile.jenisKelamin}
                      seed={computeNameSeed(`${userProfile.nama}-${userProfile.idKavling ?? 'new'}`)}
                      width={20}
                      height={24}
                      showShadow={false}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="max-w-[115px] truncate text-xs font-bold sm:max-w-[155px]">
                      {userProfile.nama}
                    </span>
                    <span
                      data-testid="profile-badge-subtitle"
                      className={`whitespace-nowrap font-mono text-[10px] font-semibold tabular-nums ${
                        userProfile.idKavling
                          ? isDarkHud
                            ? 'text-amber-300'
                            : 'text-amber-700'
                          : 'text-emerald-500'
                      }`}
                    >
                      {userProfile.idKavling
                        ? `Rumah ${userHouseNumStr} • ${userProfile.idKavling}`
                        : 'Belum Pilih Rumah'}
                    </span>
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="account-gateway-button"
                onClick={onOpenAccountGateway}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg transition-all hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>Masuk / Daftar Warga</span>
              </button>
            )}

            {/* Lofi Backsound Toggle Button (Play / Mute) */}
            <button
              type="button"
              data-testid="lofi-music-toggle"
              onClick={onToggleLofi}
              aria-pressed={isLofiPlaying}
              aria-label={isLofiPlaying ? 'Matikan musik lofi' : 'Putar musik lofi'}
              title={isLofiPlaying ? 'Musik Lofi Aktif (Klik untuk Mute)' : 'Putar Musik Lofi Tenang'}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-10 sm:px-3 ${
                isLofiPlaying
                  ? isDarkHud
                    ? 'border-amber-400/50 bg-amber-400/20 text-amber-200 backdrop-blur-md hover:bg-amber-400/30'
                    : 'border-amber-400 bg-amber-50 text-amber-900 shadow-md hover:bg-amber-100'
                  : `${theme.hudGlass} hover:brightness-95`
              }`}
            >
              {isLofiPlaying ? (
                <Volume2 className="h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <VolumeX className="h-4 w-4 shrink-0 opacity-70" />
              )}
              <Music className="hidden h-3 w-3 shrink-0 md:inline" />
              <span className="hidden whitespace-nowrap lg:inline">
                {isLofiPlaying ? 'Lofi On' : 'Lofi Off'}
              </span>
            </button>

            {/* Refresh Live Data Button */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh data Google Sheet"
              title="Refresh Data Live"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-10 sm:w-10 ${theme.hudGlass} hover:brightness-95`}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            </div>

            {/* Share Button: bottom-left of top HUD on mobile, top-right below controls on desktop */}
            <button
              type="button"
              data-testid="hud-share-button"
              onClick={onOpenShareModal}
              aria-label="Bagikan link Komplek Khoas"
              className={`pointer-events-auto inline-flex self-start items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-bold shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:self-end sm:text-[13px] ${theme.hudGlass} hover:brightness-95`}
            >
              <Share2
                className={`h-3.5 w-3.5 shrink-0 ${
                  isDarkHud ? 'text-amber-300' : 'text-amber-600'
                }`}
              />
              <span>bantu ramein komplek ini yuk</span>
            </button>
          </div>
        </div>

        {/* Quota Full Banner */}
        {isQuotaFull && (
          <div className="pointer-events-auto mx-auto rounded-xl border border-rose-300 bg-rose-600 px-4 py-2 text-center text-xs font-bold text-white shadow-lg sm:text-sm">
            Kuota 500 Peserta Pre-Launch Komik Khoas Telah Penuh!
          </div>
        )}

        {/* Mode Pilih Tempat Tinggal Banner */}
        {mapMode === 'pick_house' && userProfile && !isQuotaFull && (
          <div
            role="status"
            data-testid="pick-house-banner"
            className="pointer-events-auto mx-auto flex items-center gap-3 rounded-xl border border-emerald-400/50 bg-slate-950/92 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md sm:text-sm"
          >
            <Home className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Halo <strong>{userProfile.nama}</strong>! Klik salah satu rumah kosong di peta untuk
              jadi tempat tinggalmu.
            </span>
            <button
              type="button"
              onClick={onCancelMapMode}
              className="ml-1 shrink-0 rounded-md bg-white/12 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/20"
            >
              Batal
            </button>
          </div>
        )}

        {/* Mode Pindah Rumah Banner */}
        {mapMode === 'move_house' && userProfile?.idKavling && (
          <div
            role="status"
            data-testid="move-house-banner"
            className="pointer-events-auto mx-auto flex items-center gap-3 rounded-xl border border-amber-400/60 bg-slate-950/92 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md sm:text-sm"
          >
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Pilih kavling kosong baru di peta untuk pindah dari{' '}
              <strong className="font-mono text-amber-300">Kavling {userProfile.idKavling}</strong>
            </span>
            <button
              type="button"
              onClick={onCancelMapMode}
              className="ml-1 shrink-0 rounded-md bg-white/12 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/20"
            >
              Batal
            </button>
          </div>
        )}

        {/* Non-intrusive Live Fetch Error Notice */}
        {dataError && (
          <div className="pointer-events-auto mx-auto flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-950/90 px-3.5 py-2 text-xs font-medium text-amber-100 shadow-lg">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={onRefresh}
              className="underline decoration-amber-300 underline-offset-2 hover:text-white"
            >
              Coba Lagi
            </button>
          </div>
        )}
      </header>

      {/* Bottom Controls: Quick Auditorium Shortcut + Map Legend (left) & Zoom Controls (right) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between gap-3 p-3 sm:p-4">
        {/* Compact Legend & Enter Auditorium Quick Button */}
        <div
          className={`pointer-events-auto hidden items-center gap-4 rounded-xl border px-3.5 py-2 text-xs sm:flex ${theme.hudGlass}`}
        >
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-[3px] bg-orange-500 ring-1 ring-black/15" />
            <span>Rumah Terisi</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-[3px] bg-slate-400 ring-1 ring-black/15" />
            <span>Kavling Kosong</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-full bg-emerald-600 ring-1 ring-amber-400" />
            <span>Masjid Blok</span>
          </span>
          <button
            type="button"
            onClick={onEnterAuditorium}
            className={`inline-flex items-center gap-1.5 border-l pl-3 font-semibold transition-colors ${theme.hudBorder} hover:text-amber-500`}
          >
            <Building className="h-3.5 w-3.5 text-amber-500" />
            <span>Masuk Auditorium</span>
          </button>
        </div>

        {/* Zoom + / - / Reset View Controls */}
        <div
          className={`pointer-events-auto ml-auto flex items-center gap-1 rounded-xl border p-1 ${theme.hudGlass}`}
        >
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Perkecil peta"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              isDarkHud ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-11 text-center font-mono text-xs font-semibold tabular-nums">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Perbesar peta"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              isDarkHud ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className={`mx-0.5 h-5 w-px ${isDarkHud ? 'bg-white/15' : 'bg-slate-200'}`} />
          <button
            type="button"
            onClick={onResetView}
            aria-label="Reset posisi peta ke tengah"
            className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors ${
              isDarkHud ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset View</span>
          </button>
        </div>
      </div>
    </>
  );
}
