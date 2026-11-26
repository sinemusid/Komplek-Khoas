import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Home, Loader2, X } from 'lucide-react';
import { UserProfile } from '../config/khoasConfig';

export interface HouseConfirmRequest {
  type: 'assign' | 'move';
  targetKavlingId: string;
  oldKavlingId?: string | null;
}

interface ConfirmHouseModalProps {
  request: HouseConfirmRequest | null;
  profile: UserProfile | null;
  onCancel: () => void;
  onConfirm: (request: HouseConfirmRequest) => Promise<void>;
}

export function ConfirmHouseModal({
  request,
  profile,
  onCancel,
  onConfirm,
}: ConfirmHouseModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setIsSaving(false);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, isSaving, onCancel]);

  if (!request || !profile) return null;

  const formattedNum = `#${String(profile.nomorRumah || 1).padStart(3, '0')}`;
  const isMove = request.type === 'move' && Boolean(request.oldKavlingId);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm(request);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-house-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onClick={() => !isSaving && onCancel()}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <p className="font-mono text-[11px] font-semibold tracking-wider text-amber-600">
                {isMove ? 'KONFIRMASI PINDAH RUMAH' : 'KONFIRMASI TEMPAT TINGGAL'}
              </p>
              <h2
                id="confirm-house-title"
                className="text-base font-bold text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {isMove ? 'Pindah Lokasi Kavling?' : 'Konfirmasi Pilihan Kavling'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            aria-label="Batal konfirmasi rumah"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {isMove ? (
            <>
              <p className="text-sm leading-relaxed text-slate-700">
                Pindahkan <strong>Rumah {formattedNum}</strong> milik{' '}
                <strong>{profile.nama}</strong> ke lokasi kavling baru ini?
              </p>
              <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-50 px-4 py-3 font-mono text-sm font-bold ring-1 ring-slate-200/80">
                <span className="text-slate-500">Kavling {request.oldKavlingId}</span>
                <ArrowRight className="h-4 w-4 text-amber-500" />
                <span className="text-emerald-700">Kavling {request.targetKavlingId}</span>
              </div>
              <p className="text-xs text-slate-500">
                Kavling lama ({request.oldKavlingId}) akan langsung dikosongkan dan dapat dipilih
                warga lain.
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-slate-700">
              Pilih{' '}
              <strong className="font-mono text-slate-950">
                Kavling {request.targetKavlingId}
              </strong>{' '}
              sebagai{' '}
              <strong className="font-mono text-amber-700">Rumah {formattedNum}</strong> milikmu?
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirm}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-amber-300" />
                  <span>{isMove ? 'Ya, Pindah Rumah' : 'Ya, Tempati Kavling Ini'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
