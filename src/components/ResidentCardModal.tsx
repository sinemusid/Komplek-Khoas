import React, { useEffect } from 'react';
import { ArrowLeftRight, Building2, Home, MapPin, Navigation, ShieldCheck, X } from 'lucide-react';
import { Resident } from '../config/khoasConfig';
import { CitizenAvatarSvg } from './CitizenAvatarSvg';

interface ResidentCardModalProps {
  resident: Resident | null;
  isOwner?: boolean;
  onClose: () => void;
  onHighlightHouse: (kavlingId: string) => void;
  onStartMoveHouse?: () => void;
  highlightLabel?: string;
}

export function ResidentCardModal({
  resident,
  isOwner = false,
  onClose,
  onHighlightHouse,
  onStartMoveHouse,
  highlightLabel = 'Sorot Rumah di Peta',
}: ResidentCardModalProps) {
  useEffect(() => {
    if (!resident) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resident, onClose]);

  if (!resident) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resident-card-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Accent Band */}
        <div className="relative bg-slate-900 px-6 pb-6 pt-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold tracking-wider text-amber-300">
                {isOwner ? 'KARTU WARGA MILIKMU' : 'KARTU WARGA RESMI'}
              </p>
              <h2
                id="resident-card-title"
                className="mt-1 text-2xl font-bold tracking-tight text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {resident.nama}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Kartu Warga"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* House & Kavling Metadata Strip (clean unboxed tabular layout) */}
          <div className="mt-4 flex items-center gap-4 border-t border-white/12 pt-4">
            {/* Avatar Portrait */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 ring-1 ring-white/15">
              <CitizenAvatarSvg
                gender={resident.jenisKelamin}
                seed={resident.colorSeed}
                width={32}
                height={38}
                showShadow={false}
              />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-medium text-slate-400">Nomor Rumah</p>
                <p className="font-mono text-lg font-bold tabular-nums text-amber-300">
                  {resident.houseNumberFormatted}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Lokasi Kavling</p>
                <p className="font-mono text-lg font-bold tabular-nums text-white">
                  {resident.kavlingId}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Body Details (strictly public fields only) */}
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-3.5 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500">Kota / Domisili</p>
                <p className="text-sm font-semibold text-slate-900">{resident.kota}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500">Instansi / Komunitas</p>
                <p className="text-sm font-semibold text-slate-900">{resident.instansi}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Home className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500">Blok Perumahan</p>
                <p className="text-sm font-semibold text-slate-900">
                  Blok {resident.kavlingId.split('-')[0]} · Kavling {resident.kavlingId}
                </p>
              </div>
            </div>
          </div>

          {/* Official Resident Seal */}
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-50/90 px-3.5 py-2.5 text-amber-950 ring-1 ring-amber-200/80">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="text-xs font-semibold">
              Warga Terdaftar Pre-Launch Komik Khoas
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {isOwner && onStartMoveHouse && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartMoveHouse();
                }}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:text-sm"
              >
                <ArrowLeftRight className="h-4 w-4 text-amber-700" />
                <span>Pindah Rumah</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                onHighlightHouse(resident.kavlingId);
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Navigation className="h-4 w-4" />
              <span>{highlightLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
