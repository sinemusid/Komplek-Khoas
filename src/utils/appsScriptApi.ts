import {
  APPS_SCRIPT_KAVLING_URL,
  APPS_SCRIPT_URL,
  Gender,
  GOOGLE_FORM_CONFIG,
  RegistrationFormValues,
  UserProfile,
} from '../config/khoasConfig';
import { normalizeGender, normalizeKavlingId } from './sheetParser';

export interface LoginWargaResult {
  found: boolean;
  profile?: UserProfile;
  error?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  error?: string;
}

/**
 * Menormalkan berbagai kemungkinan format respons JSON dari Google Apps Script
 * untuk aksi `login_warga`.
 */
export function normalizeLoginResponse(
  raw: unknown,
  fallbackEmail: string,
  fallbackWa: string
): LoginWargaResult {
  if (!raw || typeof raw !== 'object') {
    return { found: false };
  }
  const obj = raw as Record<string, unknown>;
  const statusStr = String(obj.status ?? obj.result ?? '').toLowerCase();

  const explicitlyNotFound =
    obj.found === false ||
    obj.valid === false ||
    obj.success === false ||
    obj.ok === false ||
    statusStr === 'not_found' ||
    statusStr === 'invalid' ||
    statusStr === 'error' ||
    statusStr === 'failed';

  const nested =
    (obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : null) ??
    (obj.user && typeof obj.user === 'object' ? (obj.user as Record<string, unknown>) : null) ??
    (obj.warga && typeof obj.warga === 'object' ? (obj.warga as Record<string, unknown>) : null) ??
    obj;

  const nama = String(nested.nama ?? nested.name ?? '').trim();

  if (explicitlyNotFound || !nama) {
    return { found: false };
  }

  const rawKavling = String(
    nested.idKavling ?? nested.id_kavling ?? nested.kavling ?? nested.kavlingId ?? ''
  ).trim();
  const normalizedKav = rawKavling ? normalizeKavlingId(rawKavling) : '';

  const rawNomor = Number(
    nested.nomorRumah ?? nested.nomor_rumah ?? nested.houseNumber ?? nested.noRumah ?? 0
  );

  const jenisKelamin = normalizeGender(
    nested.jenisKelamin ?? nested.jenis_kelamin ?? nested.gender ?? ''
  );

  return {
    found: true,
    profile: {
      nama,
      email: String(nested.email ?? fallbackEmail).trim(),
      wa: String(nested.wa ?? nested.whatsapp ?? nested.noWa ?? fallbackWa).trim(),
      kota: String(nested.kota ?? nested.domisili ?? 'Indonesia').trim() || 'Indonesia',
      instansi:
        String(nested.instansi ?? nested.komunitas ?? 'Komunitas Komik Khoas').trim() ||
        'Komunitas Komik Khoas',
      nomorRumah: Number.isFinite(rawNomor) && rawNomor > 0 ? Math.floor(rawNomor) : 0,
      idKavling: normalizedKav || null,
      jenisKelamin,
    },
  };
}

/**
 * Menormalkan respons JSON dari Google Apps Script untuk aksi `check_duplicate`.
 */
export function normalizeDuplicateResponse(raw: unknown): DuplicateCheckResult {
  if (!raw || typeof raw !== 'object') {
    return { isDuplicate: false };
  }
  const obj = raw as Record<string, unknown>;
  const statusStr = String(obj.status ?? obj.result ?? '').toLowerCase();
  const isDuplicate =
    obj.duplicate === true ||
    obj.isDuplicate === true ||
    obj.exists === true ||
    obj.found === true ||
    statusStr === 'duplicate' ||
    statusStr === 'exists' ||
    statusStr === 'already_registered';

  return { isDuplicate };
}

async function postAppsScriptJson(
  payload: Record<string, unknown>,
  url = APPS_SCRIPT_URL
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function postAppsScriptWrite(payload: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify(payload);
  try {
    await fetch(APPS_SCRIPT_KAVLING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body,
    });
  } catch {
    // Fallback no-cors bila browser memblokir bacaan respons lintas-asal pada aksi tulis
    await fetch(APPS_SCRIPT_KAVLING_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    });
  }
}

export async function loginWargaApi(email: string, wa: string): Promise<LoginWargaResult> {
  try {
    const raw = await postAppsScriptJson({
      action: 'login_warga',
      email: email.trim(),
      wa: wa.trim(),
    });
    return normalizeLoginResponse(raw, email.trim(), wa.trim());
  } catch {
    return {
      found: false,
      error: 'Gagal terhubung ke server verifikasi warga. Periksa koneksi internet lalu coba lagi.',
    };
  }
}

export async function checkDuplicateApi(email: string, wa: string): Promise<DuplicateCheckResult> {
  try {
    const raw = await postAppsScriptJson({
      action: 'check_duplicate',
      email: email.trim(),
      wa: wa.trim(),
    });
    return normalizeDuplicateResponse(raw);
  } catch {
    return {
      isDuplicate: false,
      error: 'Gagal memverifikasi duplikat akun ke server. Silakan coba lagi.',
    };
  }
}

/**
 * Mengirim data registrasi ke Google Form (hanya 6 field asli; Jenis Kelamin TIDAK dikirim ke Google Form).
 */
export async function submitGoogleFormRegistration(values: RegistrationFormValues): Promise<void> {
  const formData = new FormData();
  formData.append(GOOGLE_FORM_CONFIG.entries.nama, values.nama.trim());
  formData.append(GOOGLE_FORM_CONFIG.entries.usia, values.usia.trim());
  formData.append(GOOGLE_FORM_CONFIG.entries.kota, values.kota.trim());
  formData.append(GOOGLE_FORM_CONFIG.entries.instansi, values.instansi.trim());
  formData.append(GOOGLE_FORM_CONFIG.entries.email, values.email.trim());
  formData.append(GOOGLE_FORM_CONFIG.entries.wa, values.wa.trim());

  await fetch(GOOGLE_FORM_CONFIG.actionUrl, {
    method: 'POST',
    mode: 'no-cors',
    body: formData,
  });
}

export async function assignKavlingApi(payload: {
  nama: string;
  email: string;
  wa: string;
  idKavling: string;
  jenisKelamin?: Gender;
}): Promise<void> {
  await postAppsScriptWrite({
    action: 'assign_kavling',
    nama: payload.nama,
    email: payload.email,
    wa: payload.wa,
    idKavling: payload.idKavling,
    jenisKelamin: payload.jenisKelamin ?? '',
  });
}

export async function moveHouseApi(payload: {
  nama: string;
  email: string;
  wa: string;
  oldKavling: string;
  newKavling: string;
}): Promise<void> {
  await postAppsScriptWrite({
    action: 'move_house',
    nama: payload.nama,
    email: payload.email,
    wa: payload.wa,
    oldKavling: payload.oldKavling,
    newKavling: payload.newKavling,
  });
}

export async function updateProfileApi(payload: {
  email: string;
  wa: string;
  nama: string;
  jenisKelamin: Gender;
}): Promise<void> {
  await postAppsScriptWrite({
    action: 'update_profile',
    email: payload.email,
    wa: payload.wa,
    nama: payload.nama,
    jenisKelamin: payload.jenisKelamin,
  });
}
