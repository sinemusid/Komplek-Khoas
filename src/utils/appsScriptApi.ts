import {
  APPS_SCRIPT_KAVLING_URL,
  Gender,
  GOOGLE_SHEET_CSV_URL,
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

export interface RegisterWargaResult {
  ok: boolean;
  profile?: UserProfile;
  isDuplicate?: boolean;
  error?: string;
}

export interface AppsScriptWriteResult {
  ok: boolean;
  idKavling?: string | null;
  nomorRumah?: number;
  jenisKelamin?: Gender;
  error?: string;
}

/**
 * Menambahkan cache-buster dinamis `&t=<timestamp>` pada URL CSV Google Sheet publik
 * agar data terbaru dari Google Form maupun tab Daftar Web selalu dimuat segar.
 */
export function buildLiveSheetCsvUrl(
  baseUrl: string = GOOGLE_SHEET_CSV_URL,
  timestamp: number = Date.now()
): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}t=${timestamp}`;
}

function extractNestedObject(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.user && typeof obj.user === 'object') return obj.user as Record<string, unknown>;
  if (obj.data && typeof obj.data === 'object') return obj.data as Record<string, unknown>;
  if (obj.warga && typeof obj.warga === 'object') return obj.warga as Record<string, unknown>;
  return obj;
}

function extractMessage(obj: Record<string, unknown>, fallback: string): string {
  const msg = String(obj.message ?? obj.error ?? obj.msg ?? '').trim();
  return msg || fallback;
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

  const nested = extractNestedObject(obj);
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
    obj.exists === true ||
    obj.duplicate === true ||
    obj.isDuplicate === true ||
    obj.found === true ||
    statusStr === 'duplicate' ||
    statusStr === 'exists' ||
    statusStr === 'already_registered';

  return { isDuplicate };
}

/**
 * Menormalkan respons JSON dari Google Apps Script untuk aksi `register_warga`.
 */
export function normalizeRegisterResponse(
  raw: unknown,
  fallback: {
    nama: string;
    email: string;
    wa: string;
    kota: string;
    instansi: string;
    jenisKelamin: Gender;
    idKavling?: string;
    fallbackNomorRumah?: number;
  }
): RegisterWargaResult {
  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      error: 'Respons server pendaftaran tidak valid. Silakan coba lagi.',
    };
  }

  const obj = raw as Record<string, unknown>;
  const statusStr = String(obj.status ?? obj.result ?? '').toLowerCase();

  const isDuplicate =
    obj.exists === true ||
    obj.duplicate === true ||
    obj.isDuplicate === true ||
    statusStr === 'duplicate' ||
    statusStr === 'exists' ||
    statusStr === 'already_registered';

  if (isDuplicate) {
    return {
      ok: false,
      isDuplicate: true,
      error: 'Email atau Nomor WhatsApp sudah terdaftar! Silakan masuk lewat tab Masuk Warga.',
    };
  }

  const isSuccess =
    statusStr === 'success' ||
    statusStr === 'ok' ||
    obj.success === true ||
    obj.ok === true;

  if (!isSuccess) {
    return {
      ok: false,
      error: extractMessage(
        obj,
        'Gagal menyimpan pendaftaran ke server. Mohon periksa data lalu coba lagi.'
      ),
    };
  }

  const nested = extractNestedObject(obj);
  const rawNomor = Number(
    nested.nomorRumah ??
      nested.nomor_rumah ??
      obj.nomorRumah ??
      obj.nomor_rumah ??
      nested.houseNumber ??
      fallback.fallbackNomorRumah ??
      0
  );
  const rawKavling = String(
    nested.idKavling ??
      nested.id_kavling ??
      obj.idKavling ??
      obj.id_kavling ??
      nested.kavling ??
      fallback.idKavling ??
      ''
  ).trim();
  const normalizedKav = rawKavling ? normalizeKavlingId(rawKavling) : '';
  const jenisKelamin =
    normalizeGender(
      nested.jenisKelamin ?? nested.jenis_kelamin ?? obj.jenisKelamin ?? fallback.jenisKelamin
    ) || fallback.jenisKelamin;

  return {
    ok: true,
    profile: {
      nama: String(nested.nama ?? obj.nama ?? fallback.nama).trim() || fallback.nama,
      email: String(nested.email ?? obj.email ?? fallback.email).trim() || fallback.email,
      wa: String(nested.wa ?? obj.wa ?? fallback.wa).trim() || fallback.wa,
      kota: String(nested.kota ?? obj.kota ?? fallback.kota).trim() || fallback.kota,
      instansi:
        String(nested.instansi ?? obj.instansi ?? fallback.instansi).trim() || fallback.instansi,
      nomorRumah:
        Number.isFinite(rawNomor) && rawNomor > 0
          ? Math.floor(rawNomor)
          : fallback.fallbackNomorRumah ?? 0,
      idKavling: normalizedKav || null,
      jenisKelamin,
    },
  };
}

/**
 * Menormalkan respons JSON untuk aksi tulis (`move_house`, `assign_kavling`, `update_profile`).
 */
export function normalizeWriteResponse(raw: unknown): AppsScriptWriteResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Respons server tidak valid.' };
  }
  const obj = raw as Record<string, unknown>;
  const statusStr = String(obj.status ?? obj.result ?? '').toLowerCase();
  const isSuccess =
    statusStr === 'success' ||
    statusStr === 'ok' ||
    obj.success === true ||
    obj.ok === true;

  if (!isSuccess) {
    return {
      ok: false,
      error: extractMessage(obj, 'Gagal menyimpan perubahan ke server. Silakan coba lagi.'),
    };
  }

  const nested = extractNestedObject(obj);
  const rawKavling = String(
    nested.idKavling ??
      nested.newKavling ??
      obj.idKavling ??
      obj.newKavling ??
      ''
  ).trim();
  const rawNomor = Number(nested.nomorRumah ?? obj.nomorRumah ?? 0);
  const gender = normalizeGender(nested.jenisKelamin ?? obj.jenisKelamin ?? '');

  return {
    ok: true,
    idKavling: rawKavling ? normalizeKavlingId(rawKavling) : undefined,
    nomorRumah: Number.isFinite(rawNomor) && rawNomor > 0 ? Math.floor(rawNomor) : undefined,
    jenisKelamin: gender || undefined,
  };
}

/**
 * Membangun payload standar untuk aksi `register_warga` ke Google Apps Script.
 */
export function buildRegisterWargaPayload(
  values: RegistrationFormValues,
  idKavling: string = ''
): Record<string, string> {
  return {
    action: 'register_warga',
    nama: values.nama.trim(),
    usia: values.usia.trim(),
    kota: values.kota.trim(),
    instansi: values.instansi.trim(),
    email: values.email.trim(),
    wa: values.wa.trim(),
    sumber: values.sumber.trim() || 'Website Komplek',
    jenisKelamin: values.jenisKelamin,
    idKavling: idKavling ? normalizeKavlingId(idKavling) : '',
  };
}

/**
 * Mengirim POST JSON ke APPS_SCRIPT_KAVLING_URL tanpa `mode: 'no-cors'`
 * agar respons JSON dari Google Apps Script dapat dibaca akurat di Vercel maupun localhost.
 */
async function postAppsScriptJson(payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(APPS_SCRIPT_KAVLING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
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

export async function registerWargaApi(
  values: RegistrationFormValues,
  idKavling: string = '',
  fallbackNomorRumah: number = 0
): Promise<RegisterWargaResult> {
  try {
    const payload = buildRegisterWargaPayload(values, idKavling);
    const raw = await postAppsScriptJson(payload);
    return normalizeRegisterResponse(raw, {
      nama: payload.nama,
      email: payload.email,
      wa: payload.wa,
      kota: payload.kota,
      instansi: payload.instansi,
      jenisKelamin: values.jenisKelamin,
      idKavling: payload.idKavling,
      fallbackNomorRumah,
    });
  } catch {
    return {
      ok: false,
      error: 'Gagal mengirim data pendaftaran ke server Apps Script. Periksa koneksi lalu coba lagi.',
    };
  }
}

export async function moveHouseApi(payload: {
  nama: string;
  email: string;
  wa: string;
  oldKavling?: string | null;
  newKavling: string;
  jenisKelamin?: Gender;
}): Promise<AppsScriptWriteResult> {
  try {
    const normalizedNew = normalizeKavlingId(payload.newKavling);
    const normalizedOld = payload.oldKavling ? normalizeKavlingId(payload.oldKavling) : '';
    const raw = await postAppsScriptJson({
      action: 'move_house',
      email: payload.email.trim(),
      wa: payload.wa.trim(),
      nama: payload.nama.trim(),
      idKavling: normalizedNew,
      newKavling: normalizedNew,
      oldKavling: normalizedOld,
      jenisKelamin: payload.jenisKelamin ?? '',
    });
    return normalizeWriteResponse(raw);
  } catch {
    return {
      ok: false,
      error: 'Gagal menyimpan lokasi rumah ke server. Periksa koneksi internet lalu coba lagi.',
    };
  }
}

export async function assignKavlingApi(payload: {
  nama: string;
  email: string;
  wa: string;
  idKavling: string;
  jenisKelamin?: Gender;
}): Promise<AppsScriptWriteResult> {
  return moveHouseApi({
    nama: payload.nama,
    email: payload.email,
    wa: payload.wa,
    oldKavling: '',
    newKavling: payload.idKavling,
    jenisKelamin: payload.jenisKelamin,
  });
}

export async function updateProfileApi(payload: {
  email: string;
  wa: string;
  nama: string;
  jenisKelamin: Gender;
}): Promise<AppsScriptWriteResult> {
  try {
    const raw = await postAppsScriptJson({
      action: 'update_profile',
      email: payload.email.trim(),
      wa: payload.wa.trim(),
      nama: payload.nama.trim(),
      jenisKelamin: payload.jenisKelamin,
    });
    return normalizeWriteResponse(raw);
  } catch {
    return {
      ok: false,
      error: 'Gagal memperbarui profil jenis kelamin ke server. Silakan coba lagi.',
    };
  }
}
