import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  Check,
  ExternalLink,
  Home,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Gender, UserProfile, WHATSAPP_GROUP_URL } from '../config/khoasConfig';
import { computeNameSeed } from '../utils/sheetParser';
import { CitizenAvatarSvg } from './CitizenAvatarSvg';

interface ProfilePanelModalProps {
  isOpen: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onViewMyHouse: () => void;
  onStartPickHouse: () => void;
  onStartMoveHouse: () => void;
  onUpdateGender: (jenisKelamin: Gender) => Promise<void>;
  onLogout: () => void;
}

export function ProfilePanelModal({
  isOpen,
  profile,
  onClose,
  onViewMyHouse,
  onStartPickHouse,
  onStartMoveHouse,
  onUpdateGender,
  onLogout,
}: ProfilePanelModalProps) {
  const [selectedGender, setSelectedGender] = useState<Gender>(profile?.jenisKelamin ?? '');
  const [savingGender, setSavingGender] = useState(false);

  useEffect(() => {
    if (!isOpen || !profile) return;
    setSelectedGender(profile.jenisKelamin ?? '');
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !savingGender) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, savingGender]);

  if (!isOpen || !profile) return null;

  const formattedNum =
    profile.nomorRumah > 0 ? `#${String(profile.nomorRumah).padStart(3, '0')}` : 'Menunggu';
  const avatarSeed = computeNameSeed(`${profile.nama}-${profile.idKavling ?? 'new'}`);
  const currentGender: Gender = profile.jenisKelamin ?? '';
  const hasUnsavedGenderChange = Boolean(selectedGender) && selectedGender !== currentGender;

  const handleSaveGender = async () => {
    if (!selectedGender || savingGender) return;
    setSavingGender(true);
    try {
      await onUpdateGender(selectedGender);
    } finally {
      setSavingGender(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-panel-title"
      data-testid="profile-panel-modal"
      className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
      onClick={() => !savingGender && onClose()}
    >
      <div
        className="mt-14 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:mt-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Profile Header */}
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 ring-1 ring-white/15">
                <CitizenAvatarSvg
                  gender={selectedGender || currentGender}
                  seed={avatarSeed}
                  width={32}
                  height={38}
                  showShadow={false}
                />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold tracking-wider text-amber-300">
                  PROFIL WARGA SAYA
                </p>
                <h2
                  id="profile-panel-title"
                  className="truncate text-lg font-bold text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {profile.nama}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={savingGender}
              aria-label="Tutup Panel Profil Saya"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/12 pt-3.5">
            <div>
              <p className="text-[11px] text-slate-400">Nomor Rumah</p>
              <p className="font-mono text-base font-bold tabular-nums text-amber-300">
                {formattedNum}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Status Tempat Tinggal</p>
              <p className="font-mono text-base font-bold tabular-nums text-white">
                {profile.idKavling ? `Kavling ${profile.idKavling}` : 'Belum Pilih Rumah'}
              </p>
            </div>
          </div>
        </div>

        {/* Full Profile Details (visible only to logged-in owner) */}
        <div className="space-y-4 px-6 py-5">
          {/* Jenis Kelamin Selector & Live Avatar Sync */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">Jenis Kelamin & Avatar</span>
              {!currentGender && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <Sparkles className="h-3 w-3" />
                  <span>Lengkapi profil</span>
                </span>
              )}
            </div>

            {!currentGender && (
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Pilih jenis kelamin agar karakter avatarmu di peta & auditorium tampil sesuai
                (termasuk avatar berhijab untuk perempuan).
              </p>
            )}

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {(['Laki-laki', 'Perempuan'] as const).map((option) => {
                const active = selectedGender === option;
                return (
                  <button
                    key={option}
                    type="button"
                    data-testid={`profile-gender-${option === 'Laki-laki' ? 'male' : 'female'}`}
                    aria-pressed={active}
                    disabled={savingGender}
                    onClick={() => setSelectedGender(option)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-bold transition-all ${
                      active
                        ? 'border-slate-900 bg-white text-slate-950 shadow-sm ring-2 ring-amber-400/60'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <CitizenAvatarSvg
                      gender={option}
                      seed={avatarSeed}
                      width={18}
                      height={22}
                      showShadow={false}
                    />
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              data-testid="save-gender-button"
              disabled={!selectedGender || savingGender || !hasUnsavedGenderChange}
              onClick={handleSaveGender}
              className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {savingGender ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : hasUnsavedGenderChange ? (
                <>
                  <Check className="h-3.5 w-3.5 text-amber-300" />
                  <span>Simpan</span>
                </>
              ) : (
                <span>{currentGender ? `Tersimpan (${currentGender})` : 'Pilih & Simpan'}</span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-slate-100 pb-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Kota / Domisili</p>
                <p className="font-semibold text-slate-900">{profile.kota}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Instansi / Komunitas</p>
                <p className="font-semibold text-slate-900">{profile.instansi}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Email Akun</p>
                <p className="truncate font-medium text-slate-800">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">No. WhatsApp</p>
                <p className="font-mono text-xs font-semibold tabular-nums text-slate-800">
                  {profile.wa}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-amber-50/90 px-3.5 py-2 text-xs font-semibold text-amber-950 ring-1 ring-amber-200/80">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Sesi Akun Warga Aktif · Email & WA bersifat privat</span>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-col gap-2">
            <a
              data-testid="profile-wa-group-button"
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Gabung Grup WhatsApp Warga</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-85" />
            </a>

            {profile.idKavling ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewMyHouse();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                >
                  <Navigation className="h-4 w-4 text-amber-300" />
                  <span>Lihat Rumah Saya</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartMoveHouse();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-100"
                >
                  <ArrowLeftRight className="h-4 w-4 text-amber-700" />
                  <span>Pindah Rumah</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartPickHouse();
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
              >
                <Home className="h-4 w-4" />
                <span>Pilih Rumah</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
