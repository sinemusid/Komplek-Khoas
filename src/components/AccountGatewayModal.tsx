import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  Loader2,
  LogIn,
  MapPin,
  UserPlus,
  X,
} from 'lucide-react';
import { Gender, MAX_KAVLING_QUOTA, RegistrationFormValues, UserProfile } from '../config/khoasConfig';
import {
  checkDuplicateApi,
  loginWargaApi,
  registerWargaApi,
} from '../utils/appsScriptApi';
import { CitizenAvatarSvg } from './CitizenAvatarSvg';

export type AccountTab = 'login' | 'register';

interface AccountGatewayModalProps {
  isOpen: boolean;
  initialTab?: AccountTab;
  pendingKavlingId: string | null;
  occupiedCount: number;
  onClose: () => void;
  onLoginSuccess: (profile: UserProfile) => void;
  onRegisterSuccess: (profile: UserProfile) => void;
}

const SUMBER_OPTIONS = [
  'Website Komplek',
  'Instagram',
  'TikTok',
  'WhatsApp / Teman',
  'Komunitas / Sekolah',
] as const;

const EMPTY_REGISTER: RegistrationFormValues = {
  nama: '',
  usia: '',
  kota: '',
  instansi: '',
  email: '',
  wa: '',
  jenisKelamin: '',
  sumber: 'Website Komplek',
};

export function AccountGatewayModal({
  isOpen,
  initialTab = 'login',
  pendingKavlingId,
  occupiedCount,
  onClose,
  onLoginSuccess,
  onRegisterSuccess,
}: AccountGatewayModalProps) {
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);

  // Login tab state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginWa, setLoginWa] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotFound, setLoginNotFound] = useState(false);

  // Register tab state
  const [regValues, setRegValues] = useState<RegistrationFormValues>(EMPTY_REGISTER);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regDuplicate, setRegDuplicate] = useState(false);

  const isQuotaFull = occupiedCount >= MAX_KAVLING_QUOTA;
  const isBusy = loginBusy || regBusy;

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setLoginError(null);
    setLoginNotFound(false);
    setRegError(null);
    setRegDuplicate(false);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  const switchToRegister = (prefillFromLogin = false) => {
    if (prefillFromLogin) {
      setRegValues((prev) => ({
        ...prev,
        email: loginEmail.trim() || prev.email,
        wa: loginWa.trim() || prev.wa,
      }));
    }
    setRegError(null);
    setRegDuplicate(false);
    setActiveTab('register');
  };

  const switchToLogin = (prefillFromRegister = false) => {
    if (prefillFromRegister) {
      setLoginEmail(regValues.email.trim());
      setLoginWa(regValues.wa.trim());
    }
    setLoginError(null);
    setLoginNotFound(false);
    setActiveTab('login');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginEmail.trim();
    const wa = loginWa.trim();

    if (!email || !wa) {
      setLoginError('Mohon isi Email dan No. WhatsApp terlebih dahulu.');
      setLoginNotFound(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError('Format alamat email belum valid.');
      setLoginNotFound(false);
      return;
    }

    setLoginBusy(true);
    setLoginError(null);
    setLoginNotFound(false);

    const res = await loginWargaApi(email, wa);
    setLoginBusy(false);

    if (res.error) {
      setLoginError(res.error);
      return;
    }

    if (!res.found || !res.profile) {
      setLoginNotFound(true);
      setLoginError('Email atau No. WA belum terdaftar.');
      return;
    }

    onLoginSuccess(res.profile);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isQuotaFull) {
      setRegError('Kuota 500 Peserta Pre-Launch Komik Khoas Telah Penuh!');
      return;
    }

    const nama = regValues.nama.trim();
    const usia = regValues.usia.trim();
    const kota = regValues.kota.trim();
    const instansi = regValues.instansi.trim();
    const email = regValues.email.trim();
    const wa = regValues.wa.trim();
    const jenisKelamin: Gender = regValues.jenisKelamin;
    const sumber = regValues.sumber.trim() || 'Website Komplek';

    if (!nama || !usia || !kota || !instansi || !email || !wa || !jenisKelamin) {
      setRegError('Mohon lengkapi seluruh kolom formulir termasuk Jenis Kelamin.');
      setRegDuplicate(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRegError('Format alamat email belum valid.');
      setRegDuplicate(false);
      return;
    }

    setRegBusy(true);
    setRegError(null);
    setRegDuplicate(false);

    // Langkah 1: Cegah daftar ganda lewat Apps Script `check_duplicate`
    const dupCheck = await checkDuplicateApi(email, wa);
    if (dupCheck.error) {
      setRegBusy(false);
      setRegError(dupCheck.error);
      return;
    }

    if (dupCheck.isDuplicate) {
      setRegBusy(false);
      setRegDuplicate(true);
      setLoginEmail(email);
      setLoginWa(wa);
      setLoginNotFound(false);
      setLoginError(
        'Email atau Nomor WhatsApp sudah terdaftar! Silakan masuk lewat tab Masuk Warga.'
      );
      setActiveTab('login');
      return;
    }

    // Langkah 2: Simpan pendaftar baru langsung ke Apps Script (`action: "register_warga"`)
    const regResult = await registerWargaApi(
      { nama, usia, kota, instansi, email, wa, jenisKelamin, sumber },
      pendingKavlingId ?? '',
      Math.min(MAX_KAVLING_QUOTA, occupiedCount + 1)
    );

    setRegBusy(false);

    if (regResult.isDuplicate) {
      setRegDuplicate(true);
      setLoginEmail(email);
      setLoginWa(wa);
      setLoginNotFound(false);
      setLoginError(
        'Email atau Nomor WhatsApp sudah terdaftar! Silakan masuk lewat tab Masuk Warga.'
      );
      setActiveTab('login');
      return;
    }

    if (!regResult.ok || !regResult.profile) {
      setRegError(
        regResult.error ?? 'Gagal menyimpan pendaftaran. Silakan periksa koneksi lalu coba lagi.'
      );
      return;
    }

    // Langkah 3: Auto-Login dengan profil dari respons Apps Script
    setRegValues(EMPTY_REGISTER);
    onRegisterSuccess(regResult.profile);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-gateway-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={() => !isBusy && onClose()}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 pb-4 pt-5">
          <div>
            <p className="font-mono text-xs font-semibold tracking-wider text-amber-600">
              GERBANG AKUN WARGA
            </p>
            <h2
              id="account-gateway-title"
              className="mt-1 text-xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Komplek Khoas
            </h2>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            aria-label="Tutup Modal Akun Warga"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contextual Notice when opened by clicking an empty kavling while logged out */}
        {pendingKavlingId && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-950">
            <MapPin className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Masuk atau Daftar Jadi Warga dulu untuk menempati{' '}
              <strong className="font-mono text-amber-800">Kavling {pendingKavlingId}</strong>!
            </span>
          </div>
        )}

        {/* Segmented 2-Tab Navigation */}
        <div className="px-6 pt-4">
          <div
            role="tablist"
            aria-label="Pilihan akun warga"
            className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'login'}
              disabled={isBusy}
              onClick={() => switchToLogin(false)}
              className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
                activeTab === 'login'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="h-4 w-4" />
              <span>Masuk Warga</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'register'}
              disabled={isBusy}
              onClick={() => switchToRegister(false)}
              className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
                activeTab === 'register'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Daftar Jadi Warga</span>
            </button>
          </div>
        </div>

        {/* TAB A: MASUK WARGA */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} noValidate className="space-y-4 px-6 py-5">
            <p className="text-xs leading-relaxed text-slate-500">
              Sudah terdaftar di Pre-Launch Komik Khoas? Masukkan <strong>Email</strong> dan{' '}
              <strong>No. WhatsApp</strong> yang digunakan saat mendaftar.
            </p>

            {loginError && (
              <div
                role="alert"
                className="space-y-2.5 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 ring-1 ring-rose-200"
              >
                <div className="flex items-start gap-2 font-semibold">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
                {loginNotFound && (
                  <button
                    type="button"
                    onClick={() => switchToRegister(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                  >
                    <span>Daftar Jadi Warga Sekarang</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700">
                Email Terdaftar <span className="text-rose-500">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="nama@email.com"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  if (loginError) {
                    setLoginError(null);
                    setLoginNotFound(false);
                  }
                }}
                disabled={loginBusy}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="login-wa" className="block text-xs font-semibold text-slate-700">
                No. WhatsApp <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  id="login-wa"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="08xxxxxxxxxx"
                  value={loginWa}
                  onChange={(e) => {
                    setLoginWa(e.target.value);
                    if (loginError) {
                      setLoginError(null);
                      setLoginNotFound(false);
                    }
                  }}
                  disabled={loginBusy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-9 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
                />
                <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Nomor WhatsApp digunakan sebagai sandi verifikasi akun wargamu.
              </p>
            </div>

            <button
              type="submit"
              disabled={loginBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50"
            >
              {loginBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 text-amber-300" />
                  <span>Masuk</span>
                </>
              )}
            </button>

            <div className="border-t border-slate-100 pt-3 text-center">
              <button
                type="button"
                disabled={loginBusy}
                onClick={() => switchToRegister(true)}
                className="text-xs font-semibold text-slate-600 transition-colors hover:text-amber-700 hover:underline"
              >
                Belum terdaftar? <span className="text-amber-700">Daftar Jadi Warga Pre-Launch</span>
              </button>
            </div>
          </form>
        ) : (
          /* TAB B: DAFTAR JADI WARGA */
          <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3.5 px-6 py-5">
            {isQuotaFull && (
              <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Kuota 500 Peserta Pre-Launch Komik Khoas Telah Penuh!</span>
              </div>
            )}

            {regError && (
              <div
                role="alert"
                className="space-y-2.5 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 ring-1 ring-rose-200"
              >
                <div className="flex items-start gap-2 font-semibold">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span>{regError}</span>
                </div>
                {regDuplicate && (
                  <button
                    type="button"
                    onClick={() => switchToLogin(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                  >
                    <LogIn className="h-3.5 w-3.5 text-amber-300" />
                    <span>Masuk dengan Akun Ini</span>
                  </button>
                )}
              </div>
            )}

            <div>
              <label htmlFor="reg-nama" className="block text-xs font-semibold text-slate-700">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input
                id="reg-nama"
                type="text"
                required
                autoComplete="name"
                placeholder="Contoh: Raka Pratama"
                value={regValues.nama}
                onChange={(e) => {
                  setRegValues((p) => ({ ...p, nama: e.target.value }));
                  if (regError) setRegError(null);
                }}
                disabled={regBusy || isQuotaFull}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
              />
            </div>

            {/* Pilihan Wajib Jenis Kelamin (disimpan ke Kolom E saat pilih rumah) */}
            <div>
              <span className="block text-xs font-semibold text-slate-700">
                Jenis Kelamin <span className="text-rose-500">*</span>
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2.5">
                {(['Laki-laki', 'Perempuan'] as const).map((option) => {
                  const selected = regValues.jenisKelamin === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      data-testid={`reg-gender-${option === 'Laki-laki' ? 'male' : 'female'}`}
                      aria-pressed={selected}
                      disabled={regBusy || isQuotaFull}
                      onClick={() => {
                        setRegValues((p) => ({ ...p, jenisKelamin: option }));
                        if (regError) setRegError(null);
                      }}
                      className={`flex items-center justify-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
                        selected
                          ? 'border-slate-900 bg-amber-50 text-slate-950 ring-2 ring-amber-400/60'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <CitizenAvatarSvg
                        gender={option}
                        seed={option === 'Perempuan' ? 12 : 24}
                        width={20}
                        height={24}
                        showShadow={false}
                      />
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label htmlFor="reg-usia" className="block text-xs font-semibold text-slate-700">
                  Usia <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reg-usia"
                  type="number"
                  min={5}
                  max={99}
                  required
                  placeholder="21"
                  value={regValues.usia}
                  onChange={(e) => {
                    setRegValues((p) => ({ ...p, usia: e.target.value }));
                    if (regError) setRegError(null);
                  }}
                  disabled={regBusy || isQuotaFull}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="reg-kota" className="block text-xs font-semibold text-slate-700">
                  Kota / Domisili <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reg-kota"
                  type="text"
                  required
                  placeholder="Contoh: Bandung"
                  value={regValues.kota}
                  onChange={(e) => {
                    setRegValues((p) => ({ ...p, kota: e.target.value }));
                    if (regError) setRegError(null);
                  }}
                  disabled={regBusy || isQuotaFull}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-instansi" className="block text-xs font-semibold text-slate-700">
                Instansi / Sekolah / Komunitas <span className="text-rose-500">*</span>
              </label>
              <input
                id="reg-instansi"
                type="text"
                required
                placeholder="Contoh: Universitas / SMA / Komunitas Komik"
                value={regValues.instansi}
                onChange={(e) => {
                  setRegValues((p) => ({ ...p, instansi: e.target.value }));
                  if (regError) setRegError(null);
                }}
                disabled={regBusy || isQuotaFull}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={regValues.email}
                  onChange={(e) => {
                    setRegValues((p) => ({ ...p, email: e.target.value }));
                    if (regError) {
                      setRegError(null);
                      setRegDuplicate(false);
                    }
                  }}
                  disabled={regBusy || isQuotaFull}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label htmlFor="reg-wa" className="block text-xs font-semibold text-slate-700">
                  No. WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reg-wa"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="08xxxxxxxxxx"
                  value={regValues.wa}
                  onChange={(e) => {
                    setRegValues((p) => ({ ...p, wa: e.target.value }));
                    if (regError) {
                      setRegError(null);
                      setRegDuplicate(false);
                    }
                  }}
                  disabled={regBusy || isQuotaFull}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-sumber" className="block text-xs font-semibold text-slate-700">
                Tahu Event Ini Dari Mana?
              </label>
              <select
                id="reg-sumber"
                value={regValues.sumber}
                onChange={(e) => setRegValues((p) => ({ ...p, sumber: e.target.value }))}
                disabled={regBusy || isQuotaFull}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-slate-50"
              >
                {SUMBER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-500">
              Privasi terjaga: Hanya <strong>Nama</strong>, <strong>Kota</strong>,{' '}
              <strong>Instansi</strong>, dan <strong>Nomor/Kavling Rumah</strong> yang tampil di
              peta publik. Email dan WhatsApp hanya digunakan untuk verifikasi login.
            </p>

            <button
              type="submit"
              disabled={regBusy || isQuotaFull}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memeriksa & Mendaftarkan...</span>
                </>
              ) : (
                <>
                  <span>Daftar & Lanjut Pilih Rumah</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
