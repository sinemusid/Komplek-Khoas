import React, { useEffect } from 'react';
import { CheckCircle2, ExternalLink, Gift, MessageCircle, X } from 'lucide-react';
import { WHATSAPP_GROUP_URL } from '../config/khoasConfig';

interface WhatsAppGroupModalProps {
  isOpen: boolean;
  userName: string;
  onClose: () => void;
}

export function WhatsAppGroupModal({ isOpen, userName, onClose }: WhatsAppGroupModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-group-modal-title"
      data-testid="whatsapp-group-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-emerald-200/70 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Emerald Banner */}
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 px-6 pb-5 pt-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-300/40">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold tracking-wider text-emerald-300">
                  PENDAFTARAN BERHASIL
                </p>
                <h2
                  id="wa-group-modal-title"
                  className="mt-0.5 text-lg font-bold tracking-tight text-white sm:text-xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Selamat Datang di Komplek Khoas!
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup popup grup WhatsApp"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-emerald-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700">
            Halo <strong className="text-slate-950">{userName}</strong>! Kamu resmi terdaftar sebagai
            warga Pre-Launch Komik Khoas. Yuk langsung gabung ke{' '}
            <strong className="text-emerald-800">Grup WhatsApp Warga</strong> agar tidak ketinggalan
            informasi acara.
          </p>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-xs leading-relaxed text-emerald-950">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Link <strong>Google Meet</strong> acara (Jumat, 11 Des 2026 · 19:30 WIB) dan akses
              gratis duluan <strong>Komik Digital Khoas Volume 1 Chapter 1</strong> akan dibagikan di
              Grup WhatsApp.
            </span>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <a
              data-testid="wa-popup-join-link"
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Masuk ke Grup WhatsApp</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-85" />
            </a>

            <button
              type="button"
              data-testid="wa-popup-continue"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100"
            >
              Lanjut Pilih Rumah di Peta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
