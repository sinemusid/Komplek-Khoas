import { Gender, KavlingLot, MAX_KAVLING_QUOTA, Resident, UserProfile } from '../config/khoasConfig';

export interface RawSheetRow {
  nama: string;
  kota: string;
  instansi: string;
  idKavling: string;
  jenisKelamin: Gender;
}

/**
 * Parser CSV RFC 4180 yang kuat: mendukung koma di dalam tanda kutip,
 * kutip ganda ter-escape (""), CRLF/LF, dan UTF-8 BOM.
 */
export function parseCsvMatrix(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i += 1;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

function looksLikeHeaderRow(row: string[]): boolean {
  const joined = row
    .slice(0, 5)
    .map((c) => c.toLowerCase().trim())
    .join('|');
  return (
    /\bnama\b/.test(joined) ||
    /\bkota\b/.test(joined) ||
    /\bdomisili\b/.test(joined) ||
    /\binstansi\b/.test(joined) ||
    /\bkavling\b/.test(joined) ||
    /\bkelamin\b/.test(joined) ||
    /\bgender\b/.test(joined) ||
    /\btimestamp\b/.test(joined)
  );
}

/**
 * Normalisasi input ID Kavling, misal "b-5" atau "B 5" -> "B-05", "c-125" -> "C-125".
 */
export function normalizeKavlingId(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return '';
  const match = trimmed.match(/^([A-D])\s*[-_\s]?\s*(\d{1,3})$/);
  if (!match) return trimmed;
  const block = match[1];
  const num = Number(match[2]);
  if (!Number.isFinite(num) || num < 1 || num > 125) return trimmed;
  const formattedNum = num < 10 ? `0${num}` : String(num);
  return `${block}-${formattedNum}`;
}

/**
 * Normalisasi nilai Jenis Kelamin dari Kolom E Google Sheet atau Apps Script.
 */
export function normalizeGender(raw: unknown): Gender {
  const val = String(raw ?? '').trim().toLowerCase();
  if (!val) return '';
  if (
    val === 'perempuan' ||
    val === 'p' ||
    val === 'wanita' ||
    val === 'female' ||
    val === 'f' ||
    val === 'akhwat' ||
    val === 'cewek'
  ) {
    return 'Perempuan';
  }
  if (
    val === 'laki-laki' ||
    val === 'laki laki' ||
    val === 'laki' ||
    val === 'l' ||
    val === 'pria' ||
    val === 'male' ||
    val === 'm' ||
    val === 'ikhwan' ||
    val === 'cowok'
  ) {
    return 'Laki-laki';
  }
  return '';
}

export function computeNameSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Mem-parse CSV mentah menjadi baris peserta valid (5 Kolom):
 * Kolom A=Nama, B=Kota/Domisili, C=Instansi, D=ID Kavling, E=Jenis Kelamin.
 * Baris header dan baris kosong otomatis diabaikan.
 */
export function parseSheetRows(csvText: string): RawSheetRow[] {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length === 0) return [];

  const startIndex = looksLikeHeaderRow(matrix[0]) ? 1 : 0;
  const result: RawSheetRow[] = [];

  for (let i = startIndex; i < matrix.length; i++) {
    const row = matrix[i];
    const nama = (row[0] ?? '').trim();
    if (!nama) continue; // Abaikan baris kosong

    result.push({
      nama,
      kota: (row[1] ?? '').trim() || 'Indonesia',
      instansi: (row[2] ?? '').trim() || 'Komunitas Komik Khoas',
      idKavling: normalizeKavlingId(row[3] ?? ''),
      jenisKelamin: normalizeGender(row[4] ?? ''),
    });

    if (result.length >= MAX_KAVLING_QUOTA) break;
  }

  return result;
}

/**
 * Memetakan peserta terdaftar ke 500 kavling secara deterministik:
 * - Nomor rumah otomatis (#001..#500) sesuai urutan baris data di Google Sheet.
 * - Pass 1: Jika Kolom D berisi ID Kavling valid yang belum dipakai, tempatkan tepat di sana.
 * - Pass 2: Jika Kolom D kosong (atau duplikat/tidak valid), tempatkan di kavling kosong pertama yang tersedia.
 */
export function assignResidentsToKavlings(
  rows: RawSheetRow[],
  orderedLots: KavlingLot[]
): {
  residents: Resident[];
  byKavling: Record<string, Resident>;
} {
  const validLotSet = new Set(orderedLots.map((l) => l.id));
  const cappedRows = rows.slice(0, Math.min(MAX_KAVLING_QUOTA, orderedLots.length));

  const assignedLotForIndex = new Array<string | null>(cappedRows.length).fill(null);
  const usedLots = new Set<string>();

  // Pass 1: Explicit valid kavling IDs from Column D
  for (let i = 0; i < cappedRows.length; i++) {
    const requested = normalizeKavlingId(cappedRows[i].idKavling);
    if (requested && validLotSet.has(requested) && !usedLots.has(requested)) {
      assignedLotForIndex[i] = requested;
      usedLots.add(requested);
    }
  }

  // Pass 2: First available empty lot in canonical order for rows without explicit lot
  let cursor = 0;
  for (let i = 0; i < cappedRows.length; i++) {
    if (assignedLotForIndex[i]) continue;
    while (cursor < orderedLots.length && usedLots.has(orderedLots[cursor].id)) {
      cursor += 1;
    }
    if (cursor < orderedLots.length) {
      const lotId = orderedLots[cursor].id;
      assignedLotForIndex[i] = lotId;
      usedLots.add(lotId);
      cursor += 1;
    }
  }

  const residents: Resident[] = [];
  const byKavling: Record<string, Resident> = {};

  for (let i = 0; i < cappedRows.length; i++) {
    const kavlingId = assignedLotForIndex[i];
    if (!kavlingId) continue;
    const houseNumber = i + 1;
    const row = cappedRows[i];
    const resident: Resident = {
      houseNumber,
      houseNumberFormatted: `#${String(houseNumber).padStart(3, '0')}`,
      kavlingId,
      nama: row.nama,
      kota: row.kota,
      instansi: row.instansi,
      jenisKelamin: normalizeGender(row.jenisKelamin),
      colorSeed: computeNameSeed(`${row.nama}-${kavlingId}`),
    };
    residents.push(resident);
    byKavling[kavlingId] = resident;
  }

  return { residents, byKavling };
}

export interface LocalKavlingOverride {
  nama: string;
  kota: string;
  instansi: string;
  oldKavling: string | null;
  newKavling: string | null;
  nomorRumah?: number;
  jenisKelamin?: Gender;
}

/**
 * Menerapkan pembaruan optimistik (pilih kavling baru, pindah rumah, atau ubah jenis kelamin)
 * di atas data CSV live agar perubahan langsung terlihat di peta & avatar.
 */
export function applyLocalOverrides(
  liveRows: RawSheetRow[],
  overrides: LocalKavlingOverride[]
): RawSheetRow[] {
  if (overrides.length === 0) return liveRows;
  const rows = liveRows.map((r) => ({ ...r }));

  for (const ov of overrides) {
    const targetName = ov.nama.trim().toLowerCase();
    const targetOld = ov.oldKavling ? normalizeKavlingId(ov.oldKavling) : '';
    const targetNew = ov.newKavling ? normalizeKavlingId(ov.newKavling) : '';
    const nextGender = ov.jenisKelamin !== undefined ? normalizeGender(ov.jenisKelamin) : undefined;

    let matchIdx = -1;
    if (targetOld) {
      matchIdx = rows.findIndex(
        (r) =>
          normalizeKavlingId(r.idKavling) === targetOld &&
          r.nama.trim().toLowerCase() === targetName
      );
    }
    if (matchIdx === -1 && ov.nomorRumah && ov.nomorRumah > 0 && ov.nomorRumah <= rows.length) {
      const candidate = rows[ov.nomorRumah - 1];
      if (candidate && candidate.nama.trim().toLowerCase() === targetName) {
        matchIdx = ov.nomorRumah - 1;
      }
    }
    if (matchIdx === -1) {
      matchIdx = rows.findIndex((r) => r.nama.trim().toLowerCase() === targetName);
    }

    if (matchIdx !== -1) {
      rows[matchIdx] = {
        ...rows[matchIdx],
        idKavling: targetNew || rows[matchIdx].idKavling,
        jenisKelamin: nextGender !== undefined ? nextGender : rows[matchIdx].jenisKelamin,
      };
    } else if (targetNew) {
      rows.push({
        nama: ov.nama,
        kota: ov.kota || 'Indonesia',
        instansi: ov.instansi || 'Komunitas Komik Khoas',
        idKavling: targetNew,
        jenisKelamin: nextGender ?? '',
      });
    }
  }

  return rows.slice(0, MAX_KAVLING_QUOTA);
}

/**
 * Sinkronisasi Otomatis Profil Warga (v5) dengan daftar warga yang sudah dipetakan di peta.
 * - Cocokkan berdasarkan `nomorRumah` (bila cocok namanya atau nomor valid) atau `nama` (case-insensitive).
 * - Jika `idKavling` dari login Apps Script kosong (warga lama yang Kolom D-nya kosong),
 *   segera sinkronkan kavling yang sudah otomatis dipetakan di peta ke `profile.idKavling`!
 * - Sekaligus sinkronkan `nomorRumah` dan `jenisKelamin` jika tersedia di peta.
 */
export function syncProfileWithResidents(
  profile: UserProfile,
  residents: Resident[]
): UserProfile {
  if (residents.length === 0) return profile;

  const targetName = profile.nama.trim().toLowerCase();
  const normalizedProfKav = profile.idKavling ? normalizeKavlingId(profile.idKavling) : '';

  // Prioritas 1: cocokkan nomorRumah + nama
  let matched =
    profile.nomorRumah > 0
      ? residents.find(
          (r) =>
            r.houseNumber === profile.nomorRumah &&
            r.nama.trim().toLowerCase() === targetName
        )
      : undefined;

  // Prioritas 2: cocokkan idKavling + nama
  if (!matched && normalizedProfKav) {
    matched = residents.find(
      (r) =>
        normalizeKavlingId(r.kavlingId) === normalizedProfKav &&
        r.nama.trim().toLowerCase() === targetName
    );
  }

  // Prioritas 3: cocokkan nama secara case-insensitive
  if (!matched && targetName) {
    matched = residents.find((r) => r.nama.trim().toLowerCase() === targetName);
  }

  // Prioritas 4: cocokkan nomorRumah saja (fallback jika ada perbedaan spasi/ejaan kecil)
  if (!matched && profile.nomorRumah > 0) {
    matched = residents.find((r) => r.houseNumber === profile.nomorRumah);
  }

  if (!matched) return profile;

  const nextKavling = normalizedProfKav || matched.kavlingId;
  const nextNomor = profile.nomorRumah > 0 ? profile.nomorRumah : matched.houseNumber;
  const nextGender = normalizeGender(profile.jenisKelamin) || matched.jenisKelamin;

  if (
    nextKavling === profile.idKavling &&
    nextNomor === profile.nomorRumah &&
    nextGender === (profile.jenisKelamin ?? '')
  ) {
    return profile;
  }

  return {
    ...profile,
    nomorRumah: nextNomor,
    idKavling: nextKavling,
    jenisKelamin: nextGender,
  };
}

/**
 * Memeriksa secara ketat apakah suatu rumah di peta adalah milik pengguna yang sedang login.
 */
export function isOwnResident(
  resident: Resident | null | undefined,
  profile: { nama: string; nomorRumah: number; idKavling: string | null } | null
): boolean {
  if (!resident || !profile) return false;
  const resKav = normalizeKavlingId(resident.kavlingId);
  const profKav = profile.idKavling ? normalizeKavlingId(profile.idKavling) : '';
  if (profKav && resKav === profKav) {
    return resident.nama.trim().toLowerCase() === profile.nama.trim().toLowerCase();
  }
  if (profile.nomorRumah > 0 && resident.houseNumber === profile.nomorRumah) {
    return resident.nama.trim().toLowerCase() === profile.nama.trim().toLowerCase();
  }
  return false;
}

/**
 * Menggabungkan pendaftar optimistik (yang baru saja mendaftar di sesi browser ini
 * sementara cache Google Sheets CSV belum ter-refresh) tanpa duplikasi.
 */
export function mergeOptimisticRows(
  liveRows: RawSheetRow[],
  optimisticRows: RawSheetRow[]
): RawSheetRow[] {
  if (optimisticRows.length === 0) return liveRows;
  const liveKeys = new Set(
    liveRows.map((r) => `${r.nama.toLowerCase()}|${normalizeKavlingId(r.idKavling)}`)
  );
  const liveNames = new Set(liveRows.map((r) => r.nama.toLowerCase()));

  const pending = optimisticRows.filter((opt) => {
    const key = `${opt.nama.toLowerCase()}|${normalizeKavlingId(opt.idKavling)}`;
    if (liveKeys.has(key)) return false;
    if (liveNames.has(opt.nama.toLowerCase())) return false;
    return true;
  });

  return [...liveRows, ...pending].slice(0, MAX_KAVLING_QUOTA);
}

/**
 * Mencari warga berdasarkan Nama, Kota, Instansi, Nomor Rumah (#005 / 5), atau ID Kavling (B-12).
 */
export function searchResidents(residents: Resident[], query: string): Resident[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const normalizedNum = q.replace(/^#/, '').replace(/^0+/, '');

  return residents
    .filter((r) => {
      if (r.nama.toLowerCase().includes(q)) return true;
      if (r.kota.toLowerCase().includes(q)) return true;
      if (r.instansi.toLowerCase().includes(q)) return true;
      if (r.kavlingId.toLowerCase().includes(q)) return true;
      if (r.houseNumberFormatted.toLowerCase().includes(q)) return true;
      if (normalizedNum && String(r.houseNumber) === normalizedNum) return true;
      return false;
    })
    .slice(0, 12);
}
