import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  Gender,
  GOOGLE_SHEET_CSV_URL,
  LightingOverride,
  MapInteractionMode,
  MAX_KAVLING_QUOTA,
  MosqueBuilding,
  Resident,
  UserProfile,
} from './config/khoasConfig';
import { AccountGatewayModal, AccountTab } from './components/AccountGatewayModal';
import { AuditoriumInterior } from './components/AuditoriumInterior';
import { ConfirmHouseModal, HouseConfirmRequest } from './components/ConfirmHouseModal';
import { FloatingHud } from './components/FloatingHud';
import { MapCameraHandle, NeighborhoodMap } from './components/NeighborhoodMap';
import { PrayerTimesModal } from './components/PrayerTimesModal';
import { ProfilePanelModal } from './components/ProfilePanelModal';
import { ResidentCardModal } from './components/ResidentCardModal';
import { ShareModal } from './components/ShareModal';
import { WelcomeEventModal } from './components/WelcomeEventModal';
import { WhatsAppGroupModal } from './components/WhatsAppGroupModal';
import {
  assignKavlingApi,
  buildLiveSheetCsvUrl,
  moveHouseApi,
  updateProfileApi,
} from './utils/appsScriptApi';
import { lofiAudio } from './utils/lofiAudio';
import {
  readWelcomePopupLastExit,
  recordWelcomePopupExit,
  shouldShowWelcomePopup,
} from './utils/welcomePopup';
import { getNeighborhoodLayout } from './utils/mapLayout';
import {
  applyLocalOverrides,
  assignResidentsToKavlings,
  isOwnResident,
  LocalKavlingOverride,
  normalizeGender,
  parseSheetRows,
  RawSheetRow,
  syncProfileWithResidents,
} from './utils/sheetParser';
import { getWibTimeInfo, resolveActivePhase } from './utils/wibTime';

const USER_PROFILE_STORAGE_KEY = 'khoas_user_profile_v1';
const LOCAL_OVERRIDES_STORAGE_KEY = 'khoas_kavling_overrides_v1';

function loadStoredUserProfile(): UserProfile | null {
  try {
    const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (!parsed || typeof parsed.nama !== 'string' || !parsed.nama.trim()) return null;
    return {
      nama: parsed.nama,
      email: String(parsed.email ?? ''),
      wa: String(parsed.wa ?? ''),
      kota: String(parsed.kota ?? 'Indonesia'),
      instansi: String(parsed.instansi ?? 'Komunitas Komik Khoas'),
      nomorRumah: Number(parsed.nomorRumah) || 0,
      idKavling: parsed.idKavling ? String(parsed.idKavling) : null,
      jenisKelamin: normalizeGender(parsed.jenisKelamin),
    };
  } catch {
    return null;
  }
}

function saveStoredUserProfile(profile: UserProfile | null) {
  try {
    if (!profile) {
      window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function loadStoredOverrides(): LocalKavlingOverride[] {
  try {
    const raw = window.sessionStorage.getItem(LOCAL_OVERRIDES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredOverrides(overrides: LocalKavlingOverride[]) {
  try {
    window.sessionStorage.setItem(LOCAL_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Ignore storage errors
  }
}

export default function App() {
  const layout = useMemo(() => getNeighborhoodLayout(), []);
  const mapRef = useRef<MapCameraHandle | null>(null);

  // Live Google Sheet rows + optimistic local overrides (assign_kavling / move_house / update_profile)
  const [liveRows, setLiveRows] = useState<RawSheetRow[]>([]);
  const [localOverrides, setLocalOverrides] = useState<LocalKavlingOverride[]>(() =>
    typeof window !== 'undefined' ? loadStoredOverrides() : []
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [shuffleNonce, setShuffleNonce] = useState(0);

  // Logged-in resident profile persisted in localStorage
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() =>
    typeof window !== 'undefined' ? loadStoredUserProfile() : null
  );

  // Real-time WIB Clock & Day/Dusk/Night Cycle
  const [wibInfo, setWibInfo] = useState(() => getWibTimeInfo());
  const [lightingOverride, setLightingOverride] = useState<LightingOverride>('auto');

  // Lofi Web Audio Backsound state (persists seamlessly between map & auditorium)
  const [isLofiPlaying, setIsLofiPlaying] = useState(() => lofiAudio.isPlaying());

  // Navigation & Interactive Modal / Mode States
  const [viewMode, setViewMode] = useState<'map' | 'entering' | 'auditorium'>('map');
  const [mapMode, setMapMode] = useState<MapInteractionMode>('browse');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountInitialTab, setAccountInitialTab] = useState<AccountTab>('login');
  const [pendingKavlingId, setPendingKavlingId] = useState<string | null>(null);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [welcomePopupOpen, setWelcomePopupOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const lastExit = readWelcomePopupLastExit();
    return shouldShowWelcomePopup(lastExit, Date.now());
  });
  const [waGroupPopupOpen, setWaGroupPopupOpen] = useState(false);
  const [deferredAssignLotId, setDeferredAssignLotId] = useState<string | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<HouseConfirmRequest | null>(null);
  const [activeResident, setActiveResident] = useState<Resident | null>(null);
  const [activeMosque, setActiveMosque] = useState<MosqueBuilding | null>(null);
  const [highlightedLotId, setHighlightedLotId] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState(50);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to Lofi engine & gently start music on first user click (respecting autoplay & manual mute)
  useEffect(() => {
    const unsubscribe = lofiAudio.subscribe(setIsLofiPlaying);

    const handleFirstInteraction = (e: PointerEvent) => {
      // Abaikan bila klik pertama langsung pada tombol toggle Lofi agar tidak double-toggle
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-testid="lofi-music-toggle"], [data-testid="auditorium-lofi-toggle"]')) {
        window.removeEventListener('pointerdown', handleFirstInteraction, true);
        return;
      }
      if (!lofiAudio.isPlaying() && !lofiAudio.isMutedByUser()) {
        void lofiAudio.play(false);
      }
      window.removeEventListener('pointerdown', handleFirstInteraction, true);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, true);
    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', handleFirstInteraction, true);
    };
  }, []);

  const handleToggleLofi = useCallback(() => {
    void lofiAudio.toggle();
  }, []);

  // Track exit/return timestamp for Welcome Event Popup (re-opens only after >10 minutes away)
  useEffect(() => {
    // Catat timestamp kunjungan saat ini agar refresh cepat (<10 menit) tidak memunculkan pop-up berulang
    recordWelcomePopupExit(Date.now());

    const handleLeave = () => {
      recordWelcomePopupExit(Date.now());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        recordWelcomePopupExit(Date.now());
      } else if (document.visibilityState === 'visible') {
        const lastExit = readWelcomePopupLastExit();
        const now = Date.now();
        if (shouldShowWelcomePopup(lastExit, now)) {
          setWelcomePopupOpen(true);
        }
        recordWelcomePopupExit(now);
      }
    };

    // Heartbeat ringan saat tab aktif agar waktu keluar tercatat akurat bila browser menutup tab mendadak
    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        recordWelcomePopupExit(Date.now());
      }
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleLeave);
    window.addEventListener('beforeunload', handleLeave);

    return () => {
      window.clearInterval(heartbeatId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleLeave);
      window.removeEventListener('beforeunload', handleLeave);
    };
  }, []);

  // Update real-time WIB clock every 5 seconds
  useEffect(() => {
    const id = window.setInterval(() => {
      setWibInfo(getWibTimeInfo());
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const { phase: activePhase, label: activePhaseLabel } = useMemo(
    () => resolveActivePhase(lightingOverride, wibInfo),
    [lightingOverride, wibInfo]
  );

  // Fetch Live CSV Data from Google Sheets with dynamic cache-buster `&t=...`
  // (5 columns: Nama, Kota, Instansi, ID Kavling, Jenis Kelamin)
  const fetchLiveSheet = useCallback(async () => {
    setIsRefreshing(true);
    setDataError(null);
    try {
      const response = await fetch(buildLiveSheetCsvUrl(GOOGLE_SHEET_CSV_URL), {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      const parsed = parseSheetRows(csvText);
      setLiveRows(parsed);
      setShuffleNonce((n) => n + 1);
    } catch {
      setDataError('Gagal memuat data terbaru dari Google Sheet.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLiveSheet();
  }, [fetchLiveSheet]);

  // Combine live rows with local optimistic overrides & assign deterministically to 500 lots
  const { residents, byKavling } = useMemo(() => {
    const merged = applyLocalOverrides(liveRows, localOverrides);
    const mapped = assignResidentsToKavlings(merged, layout.lots);

    const optimisticNames = new Set(localOverrides.map((o) => o.nama.trim().toLowerCase()));
    const taggedResidents = mapped.residents.map((r) =>
      optimisticNames.has(r.nama.trim().toLowerCase()) ? { ...r, isOptimistic: true } : r
    );
    const taggedByKavling: Record<string, Resident> = {};
    for (const r of taggedResidents) {
      taggedByKavling[r.kavlingId] = r;
    }

    return { residents: taggedResidents, byKavling: taggedByKavling };
  }, [layout.lots, liveRows, localOverrides]);

  const occupiedCount = residents.length;
  const isQuotaFull = occupiedCount >= MAX_KAVLING_QUOTA;

  const updateUserProfile = useCallback((next: UserProfile | null) => {
    setUserProfile(next);
    saveStoredUserProfile(next);
  }, []);

  // Sinkronisasi Otomatis Profil vs Peta (v5) setiap kali CSV selesai dimuat atau berubah
  useEffect(() => {
    if (!userProfile || residents.length === 0) return;
    const synced = syncProfileWithResidents(userProfile, residents);
    if (synced !== userProfile) {
      updateUserProfile(synced);
      // Jika warga lama sebelumnya terjebak di mode pick_house padahal sudah punya rumah di peta, normalkan!
      if (synced.idKavling && mapMode === 'pick_house') {
        setMapMode('browse');
      }
    }
  }, [mapMode, residents, updateUserProfile, userProfile]);

  // Auto-clear toast after 5.5s
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 5500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Auto-clear house pulse highlight after 4.5s
  useEffect(() => {
    if (!highlightedLotId) return;
    const timer = window.setTimeout(() => setHighlightedLotId(null), 4500);
    return () => window.clearTimeout(timer);
  }, [highlightedLotId]);

  const focusKavling = useCallback(
    (kavlingId: string) => {
      const lot = layout.lotsById[kavlingId];
      if (!lot) return;
      if (viewMode !== 'map') {
        setViewMode('map');
        window.setTimeout(() => {
          mapRef.current?.focusPoint(lot.x + lot.width / 2, lot.y + lot.height / 2, 1.35);
          setHighlightedLotId(kavlingId);
        }, 120);
      } else {
        mapRef.current?.focusPoint(lot.x + lot.width / 2, lot.y + lot.height / 2, 1.35);
        setHighlightedLotId(kavlingId);
      }
    },
    [layout.lotsById, viewMode]
  );

  const openAccountGateway = useCallback((tab: AccountTab = 'login', pendingLot: string | null = null) => {
    setAccountInitialTab(tab);
    setPendingKavlingId(pendingLot);
    setAccountModalOpen(true);
  }, []);

  // Click handler when user clicks ANY empty lot on the map
  const handleSelectEmptyLot = useCallback(
    (lotId: string) => {
      if (isQuotaFull && mapMode !== 'move_house') return;

      // 1. User belum login -> buka Gerbang Akun Warga dengan info pendingKavlingId
      if (!userProfile) {
        openAccountGateway('login', lotId);
        return;
      }

      // 2. User sudah login & dalam Mode Pindah Rumah
      if (mapMode === 'move_house' && userProfile.idKavling) {
        setConfirmRequest({
          type: 'move',
          targetKavlingId: lotId,
          oldKavlingId: userProfile.idKavling,
        });
        return;
      }

      // 3. User sudah login tapi BELUM punya kavling -> konfirmasi pilih tempat tinggal
      if (!userProfile.idKavling) {
        setConfirmRequest({
          type: 'assign',
          targetKavlingId: lotId,
        });
        return;
      }

      // 4. User sudah login & sudah punya kavling -> tawarkan pindah rumah
      setConfirmRequest({
        type: 'move',
        targetKavlingId: lotId,
        oldKavlingId: userProfile.idKavling,
      });
    },
    [isQuotaFull, mapMode, openAccountGateway, userProfile]
  );

  // Login success from AccountGatewayModal — v5 Auto-Sync with mapped residents!
  const handleLoginSuccess = useCallback(
    (profile: UserProfile) => {
      // Sinkronkan dengan daftar warga di peta agar warga lama yang Kolom D-nya kosong
      // langsung mendapat nomorRumah & idKavling yang sudah otomatis dipetakan!
      let resolvedProfile = syncProfileWithResidents(profile, residents);

      if (!resolvedProfile.nomorRumah) {
        resolvedProfile = {
          ...resolvedProfile,
          nomorRumah: Math.min(MAX_KAVLING_QUOTA, occupiedCount + 1),
        };
      }

      updateUserProfile(resolvedProfile);
      setAccountModalOpen(false);
      setToastMessage(`Selamat datang kembali, ${resolvedProfile.nama}!`);

      if (resolvedProfile.idKavling) {
        // Warga lama / sudah punya rumah di peta: JANGAN paksa Mode Pilih Tempat Tinggal!
        // Arahkan langsung dan sorot rumahnya di peta.
        setMapMode('browse');
        focusKavling(resolvedProfile.idKavling);
      } else {
        // Benar-benar belum memiliki kavling di peta -> aktifkan Mode Pilih Tempat Tinggal
        if (viewMode !== 'map') {
          setViewMode('map');
        }
        setMapMode('pick_house');
        if (pendingKavlingId && !byKavling[pendingKavlingId]) {
          setConfirmRequest({
            type: 'assign',
            targetKavlingId: pendingKavlingId,
          });
        }
      }

      setPendingKavlingId(null);
    },
    [byKavling, focusKavling, occupiedCount, pendingKavlingId, residents, updateUserProfile, viewMode]
  );

  // Register success from AccountGatewayModal (`register_warga` via Apps Script)
  const handleRegisterSuccess = useCallback(
    (newProfile: UserProfile) => {
      const resolvedNomor =
        newProfile.nomorRumah > 0
          ? newProfile.nomorRumah
          : Math.min(MAX_KAVLING_QUOTA, occupiedCount + 1);

      const finalProfile: UserProfile = {
        ...newProfile,
        nomorRumah: resolvedNomor,
      };

      updateUserProfile(finalProfile);
      setAccountModalOpen(false);
      if (viewMode !== 'map') {
        setViewMode('map');
      }

      if (finalProfile.idKavling) {
        // Pendaftar sudah memiliki kavling (misal dari klik kavling kosong atau respons server)
        setLocalOverrides((prev) => {
          const filtered = prev.filter(
            (o) => o.nama.trim().toLowerCase() !== finalProfile.nama.trim().toLowerCase()
          );
          const next: LocalKavlingOverride[] = [
            ...filtered,
            {
              nama: finalProfile.nama,
              kota: finalProfile.kota,
              instansi: finalProfile.instansi,
              oldKavling: null,
              newKavling: finalProfile.idKavling,
              nomorRumah: resolvedNomor,
              jenisKelamin: finalProfile.jenisKelamin,
            },
          ];
          saveStoredOverrides(next);
          return next;
        });

        const formattedNum = `#${String(resolvedNomor).padStart(3, '0')}`;
        setMapMode('browse');
        setDeferredAssignLotId(null);
        setToastMessage(
          `Pendaftaran berhasil! Selamat datang ${finalProfile.nama}, kamu menempati Kavling ${finalProfile.idKavling} (${formattedNum}).`
        );
        focusKavling(finalProfile.idKavling);
      } else {
        // Belum memilih kavling -> aktifkan Mode Pilih Tempat Tinggal di peta
        setMapMode('pick_house');
        setToastMessage(
          `Pendaftaran berhasil! Halo ${finalProfile.nama}, yuk masuk Grup WA & pilih rumahmu di peta.`
        );
        if (pendingKavlingId && !byKavling[pendingKavlingId]) {
          setDeferredAssignLotId(pendingKavlingId);
        } else {
          setDeferredAssignLotId(null);
        }
      }

      setPendingKavlingId(null);
      setWaGroupPopupOpen(true);
    },
    [byKavling, focusKavling, occupiedCount, pendingKavlingId, updateUserProfile, viewMode]
  );

  const handleCloseWaGroupPopup = useCallback(() => {
    setWaGroupPopupOpen(false);
    if (deferredAssignLotId && !byKavling[deferredAssignLotId]) {
      setConfirmRequest({
        type: 'assign',
        targetKavlingId: deferredAssignLotId,
      });
    }
    setDeferredAssignLotId(null);
  }, [byKavling, deferredAssignLotId]);

  // Update Jenis Kelamin from ProfilePanelModal (Kolom E via update_profile)
  const handleUpdateGender = useCallback(
    async (jenisKelamin: Gender) => {
      if (!userProfile) return;

      const res = await updateProfileApi({
        email: userProfile.email,
        wa: userProfile.wa,
        nama: userProfile.nama,
        jenisKelamin,
      });

      if (!res.ok) {
        throw new Error(
          res.error ?? 'Gagal memperbarui jenis kelamin ke server. Silakan coba lagi.'
        );
      }

      const updatedProfile: UserProfile = {
        ...userProfile,
        jenisKelamin,
      };
      updateUserProfile(updatedProfile);

      // Update local overrides so avatar on map & auditorium refreshes immediately
      setLocalOverrides((prev) => {
        const existing = prev.find(
          (o) => o.nama.trim().toLowerCase() === userProfile.nama.trim().toLowerCase()
        );
        const filtered = prev.filter(
          (o) => o.nama.trim().toLowerCase() !== userProfile.nama.trim().toLowerCase()
        );
        const next: LocalKavlingOverride[] = [
          ...filtered,
          {
            nama: userProfile.nama,
            kota: userProfile.kota,
            instansi: userProfile.instansi,
            oldKavling: existing?.oldKavling ?? userProfile.idKavling,
            newKavling: existing?.newKavling ?? userProfile.idKavling,
            nomorRumah: userProfile.nomorRumah,
            jenisKelamin,
          },
        ];
        saveStoredOverrides(next);
        return next;
      });

      setToastMessage(`Jenis kelamin (${jenisKelamin}) berhasil disimpan & avatar diperbarui!`);
    },
    [updateUserProfile, userProfile]
  );

  // Confirm pilih rumah / pindah rumah via Apps Script (`move_house`)
  const handleConfirmHouse = useCallback(
    async (request: HouseConfirmRequest) => {
      if (!userProfile) return;

      if (request.type === 'move' && request.oldKavlingId) {
        const res = await moveHouseApi({
          nama: userProfile.nama,
          email: userProfile.email,
          wa: userProfile.wa,
          oldKavling: request.oldKavlingId,
          newKavling: request.targetKavlingId,
          jenisKelamin: userProfile.jenisKelamin ?? '',
        });

        if (!res.ok) {
          throw new Error(
            res.error ?? 'Gagal memindahkan kavling di server. Silakan coba lagi.'
          );
        }

        const resolvedKavling = res.idKavling || request.targetKavlingId;
        const resolvedNum = res.nomorRumah || userProfile.nomorRumah;

        const updatedProfile: UserProfile = {
          ...userProfile,
          nomorRumah: resolvedNum,
          idKavling: resolvedKavling,
        };
        updateUserProfile(updatedProfile);

        setLocalOverrides((prev) => {
          const filtered = prev.filter(
            (o) => o.nama.trim().toLowerCase() !== userProfile.nama.trim().toLowerCase()
          );
          const next: LocalKavlingOverride[] = [
            ...filtered,
            {
              nama: userProfile.nama,
              kota: userProfile.kota,
              instansi: userProfile.instansi,
              oldKavling: request.oldKavlingId ?? null,
              newKavling: resolvedKavling,
              nomorRumah: resolvedNum,
              jenisKelamin: userProfile.jenisKelamin,
            },
          ];
          saveStoredOverrides(next);
          return next;
        });

        setConfirmRequest(null);
        setMapMode('browse');
        setToastMessage(
          `Berhasil pindah dari Kavling ${request.oldKavlingId} ke Kavling ${resolvedKavling}!`
        );
        focusKavling(resolvedKavling);
      } else {
        const res = await assignKavlingApi({
          nama: userProfile.nama,
          email: userProfile.email,
          wa: userProfile.wa,
          idKavling: request.targetKavlingId,
          jenisKelamin: userProfile.jenisKelamin ?? '',
        });

        if (!res.ok) {
          throw new Error(
            res.error ?? 'Gagal menyimpan pilihan kavling ke server. Silakan coba lagi.'
          );
        }

        const resolvedKavling = res.idKavling || request.targetKavlingId;
        const assignedHouseNum =
          res.nomorRumah || userProfile.nomorRumah || Math.min(MAX_KAVLING_QUOTA, occupiedCount + 1);
        const updatedProfile: UserProfile = {
          ...userProfile,
          nomorRumah: assignedHouseNum,
          idKavling: resolvedKavling,
        };
        updateUserProfile(updatedProfile);

        setLocalOverrides((prev) => {
          const filtered = prev.filter(
            (o) => o.nama.trim().toLowerCase() !== userProfile.nama.trim().toLowerCase()
          );
          const next: LocalKavlingOverride[] = [
            ...filtered,
            {
              nama: userProfile.nama,
              kota: userProfile.kota,
              instansi: userProfile.instansi,
              oldKavling: null,
              newKavling: resolvedKavling,
              nomorRumah: assignedHouseNum,
              jenisKelamin: userProfile.jenisKelamin,
            },
          ];
          saveStoredOverrides(next);
          return next;
        });

        const formattedNum = `#${String(assignedHouseNum).padStart(3, '0')}`;
        setConfirmRequest(null);
        setMapMode('browse');
        setToastMessage(
          `Selamat! Kamu resmi menempati Kavling ${resolvedKavling} sebagai Rumah ${formattedNum}`
        );
        focusKavling(resolvedKavling);
      }
    },
    [focusKavling, occupiedCount, updateUserProfile, userProfile]
  );

  const handleStartPickHouse = useCallback(() => {
    if (viewMode !== 'map') {
      setViewMode('map');
      window.setTimeout(() => mapRef.current?.resetView(), 80);
    }
    setMapMode('pick_house');
  }, [viewMode]);

  const handleStartMoveHouse = useCallback(() => {
    if (!userProfile?.idKavling) return;
    if (viewMode !== 'map') {
      setViewMode('map');
      window.setTimeout(() => mapRef.current?.resetView(), 80);
    }
    setMapMode('move_house');
  }, [userProfile?.idKavling, viewMode]);

  const handleLogout = useCallback(() => {
    updateUserProfile(null);
    setMapMode('browse');
    setConfirmRequest(null);
    setPendingKavlingId(null);
    setToastMessage('Kamu telah keluar dari akun warga.');
  }, [updateUserProfile]);

  const handleEnterAuditorium = useCallback(() => {
    setMapMode('browse');
    setViewMode('entering');
    mapRef.current?.focusPoint(
      layout.auditorium.centerX,
      layout.auditorium.centerY,
      1.35
    );
    window.setTimeout(() => {
      setViewMode('auditorium');
    }, 460);
  }, [layout.auditorium.centerX, layout.auditorium.centerY]);

  const handleExitAuditorium = useCallback(() => {
    setViewMode('map');
    window.setTimeout(() => {
      mapRef.current?.resetView();
    }, 60);
  }, []);

  const isActiveResidentOwner = useMemo(
    () => isOwnResident(activeResident, userProfile),
    [activeResident, userProfile]
  );

  return (
    <div
      data-testid="app-shell"
      data-view={viewMode}
      data-map-mode={mapMode}
      className="relative h-full w-full overflow-hidden"
    >
      {/* Neighborhood Map View */}
      {viewMode !== 'auditorium' ? (
        <>
          <NeighborhoodMap
            ref={mapRef}
            layout={layout}
            residents={residents}
            byKavling={byKavling}
            userProfile={userProfile}
            shuffleNonce={shuffleNonce}
            phase={activePhase}
            isSelectMode={mapMode === 'pick_house' || mapMode === 'move_house'}
            isQuotaFull={isQuotaFull && mapMode !== 'move_house'}
            highlightedLotId={highlightedLotId}
            isEnteringAuditorium={viewMode === 'entering'}
            onSelectEmptyLot={handleSelectEmptyLot}
            onSelectResident={setActiveResident}
            onSelectMosque={setActiveMosque}
            onEnterAuditorium={handleEnterAuditorium}
            onZoomChange={setZoomPercent}
          />

          <FloatingHud
            residents={residents}
            userProfile={userProfile}
            wibInfo={wibInfo}
            activePhase={activePhase}
            activePhaseLabel={activePhaseLabel}
            lightingOverride={lightingOverride}
            mapMode={mapMode}
            isRefreshing={isRefreshing}
            isQuotaFull={isQuotaFull}
            dataError={dataError}
            zoomPercent={zoomPercent}
            isLofiPlaying={isLofiPlaying}
            onToggleLofi={handleToggleLofi}
            onLightingChange={setLightingOverride}
            onOpenAccountGateway={() => openAccountGateway('login', null)}
            onOpenProfilePanel={() => setProfilePanelOpen(true)}
            onCancelMapMode={() => setMapMode('browse')}
            onRefresh={fetchLiveSheet}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onResetView={() => mapRef.current?.resetView()}
            onSelectSearchResult={(res) => {
              focusKavling(res.kavlingId);
            }}
            onEnterAuditorium={handleEnterAuditorium}
            onOpenShareModal={() => setShareModalOpen(true)}
          />
        </>
      ) : (
        <AuditoriumInterior
          residents={residents}
          userProfile={userProfile}
          shuffleNonce={shuffleNonce}
          isQuotaFull={isQuotaFull}
          isLofiPlaying={isLofiPlaying}
          onToggleLofi={handleToggleLofi}
          onExit={handleExitAuditorium}
          onSelectResident={setActiveResident}
          onOpenAccountOrProfile={() => {
            if (userProfile) {
              setProfilePanelOpen(true);
            } else {
              openAccountGateway('login', null);
            }
          }}
        />
      )}

      {/* Kartu Warga Modal (with owner-only Pindah Rumah button) */}
      <ResidentCardModal
        resident={activeResident}
        isOwner={isActiveResidentOwner}
        onClose={() => setActiveResident(null)}
        onHighlightHouse={focusKavling}
        onStartMoveHouse={handleStartMoveHouse}
        highlightLabel={
          viewMode === 'auditorium' ? 'Lihat Rumah di Peta' : 'Sorot Rumah di Peta'
        }
      />

      {/* Mosque Real-Time Prayer Times Modal */}
      <PrayerTimesModal
        mosque={activeMosque}
        defaultCity={userProfile?.kota || 'Jakarta'}
        wibInfo={wibInfo}
        onClose={() => setActiveMosque(null)}
      />

      {/* Unified Account Gateway Modal (Masuk Warga & Daftar Jadi Warga) */}
      <AccountGatewayModal
        isOpen={accountModalOpen}
        initialTab={accountInitialTab}
        pendingKavlingId={pendingKavlingId}
        occupiedCount={occupiedCount}
        onClose={() => {
          setAccountModalOpen(false);
          setPendingKavlingId(null);
        }}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleRegisterSuccess}
      />

      {/* Logged-in Profile Panel Modal (with Jenis Kelamin editor) */}
      <ProfilePanelModal
        isOpen={profilePanelOpen}
        profile={userProfile}
        onClose={() => setProfilePanelOpen(false)}
        onViewMyHouse={() => {
          if (userProfile?.idKavling) {
            focusKavling(userProfile.idKavling);
          }
        }}
        onStartPickHouse={handleStartPickHouse}
        onStartMoveHouse={handleStartMoveHouse}
        onUpdateGender={handleUpdateGender}
        onLogout={handleLogout}
      />

      {/* Multi-Platform Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onCopied={() => setToastMessage('Teks ajakan & link Komplek Khoas berhasil disalin!')}
      />

      {/* Post-Registration WhatsApp Group Popup */}
      <WhatsAppGroupModal
        isOpen={waGroupPopupOpen}
        userName={userProfile?.nama ?? 'Warga Baru'}
        onClose={handleCloseWaGroupPopup}
      />

      {/* Welcome Event Poster Popup (appears on first entry & after >10 min absence) */}
      <WelcomeEventModal
        isOpen={welcomePopupOpen}
        isLoggedIn={Boolean(userProfile)}
        onClose={() => {
          setWelcomePopupOpen(false);
          recordWelcomePopupExit(Date.now());
        }}
        onJoinEvent={() => {
          setWelcomePopupOpen(false);
          recordWelcomePopupExit(Date.now());
          openAccountGateway('register', null);
        }}
      />

      {/* Confirmation Dialog for Assign Kavling & Move House */}
      <ConfirmHouseModal
        request={confirmRequest}
        profile={userProfile}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={handleConfirmHouse}
      />

      {/* Success Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="success-toast"
          className="fixed bottom-20 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-400/50 bg-slate-950/95 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur-md sm:text-sm"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{toastMessage}</span>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            onClick={() => setToastMessage(null)}
            className="ml-1 shrink-0 rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
