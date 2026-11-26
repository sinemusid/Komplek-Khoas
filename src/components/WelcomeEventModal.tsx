import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { WELCOME_POSTER_SRC } from '../utils/welcomePopup';

interface WelcomeEventModalProps {
  isOpen: boolean;
  isLoggedIn: boolean;
  onClose: () => void;
  onJoinEvent: () => void;
}

export function WelcomeEventModal({
  isOpen,
  isLoggedIn,
  onClose,
  onJoinEvent,
}: WelcomeEventModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pre-Launching Event Baca Duluan Komik Khoas"
      data-testid="welcome-event-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3.5 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90dvh] w-full max-w-[440px] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/25">
          {/* Close Button (always visible & accessible on mobile & desktop) */}
          <button
            type="button"
            data-testid="welcome-modal-close"
            aria-label="Tutup pop up"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-slate-950/80 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Clickable Poster Graphic */}
          <button
            type="button"
            data-testid="welcome-modal-poster-button"
            aria-label={
              isLoggedIn
                ? 'Tutup poster Pre-Launching Event Komik Khoas'
                : 'Klik untuk join event dan daftar jadi warga Komplek Khoas'
            }
            onClick={() => {
              if (isLoggedIn) {
                onClose();
              } else {
                onJoinEvent();
              }
            }}
            className="block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <img
              src={WELCOME_POSTER_SRC}
              alt="Pre-Launching Event Baca Duluan Komik Khoas Volume 1 Chapter 1 — Jumat 11 Des 2026 Pukul 19.30-21.00 WIB Online via Google Meet"
              className="block max-h-[86dvh] w-auto max-w-full object-contain"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
