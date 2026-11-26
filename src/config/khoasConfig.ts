// Konfigurasi Live Data, Google Form, & Apps Script (Nilai Resmi)
export const GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJ0_YrZVwdovrYvpsPkU9eXoyc-HYV7cn5NRSdEC-En9Skvy6wMGEKjAoSJyMSQIOgZxEXF5ecI2hF/pub?gid=1874013273&single=true&output=csv';

export const GOOGLE_FORM_CONFIG = {
  actionUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLSeLsgXBqoPX6USVOnuqcNT-Kyq2MXLtZeSo1nVT8vOckoNZ3g/formResponse',
  entries: {
    nama: 'entry.494143995',
    usia: 'entry.508261183',
    kota: 'entry.709205135',
    instansi: 'entry.231039422',
    email: 'entry.1327063026',
    wa: 'entry.1625132496',
  },
} as const;

export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwMhjeQLOr_Qoe-DA-mly9q8dqbfRjYBM1hkZcOMSE851U3ladd5IapkSQauSBYc44jwQ/exec';

export const APPS_SCRIPT_KAVLING_URL = APPS_SCRIPT_URL;

export const MAX_KAVLING_QUOTA = 500;
export const MAX_ACTIVE_WALKERS = 40;
export const EVENT_TARGET_ISO = '2026-12-11T19:30:00+07:00';
export const WHATSAPP_GROUP_URL =
  'https://chat.whatsapp.com/FQO2vYW2TMLD2OLIGonw6P?s=cl&p=i&iam=2';

export type TimeOfDay = 'day' | 'dusk' | 'night';
export type LightingOverride = 'auto' | TimeOfDay;
export type BlockLetter = 'A' | 'B' | 'C' | 'D';
export type MapInteractionMode = 'browse' | 'pick_house' | 'move_house';
export type Gender = 'Laki-laki' | 'Perempuan' | '';

export interface UserProfile {
  nama: string;
  email: string;
  wa: string;
  kota: string;
  instansi: string;
  nomorRumah: number;
  idKavling: string | null;
  jenisKelamin?: Gender;
}

export interface Resident {
  /** Nomor rumah otomatis 1..500 */
  houseNumber: number;
  /** Format #001 .. #500 */
  houseNumberFormatted: string;
  /** ID Kavling di peta, misal A-01 .. D-125 */
  kavlingId: string;
  /** Nama lengkap peserta (publik) */
  nama: string;
  /** Kota / Domisili peserta (publik) */
  kota: string;
  /** Instansi / Sekolah / Komunitas (publik) */
  instansi: string;
  /** Jenis kelamin peserta dari Kolom E Google Sheet */
  jenisKelamin: Gender;
  /** Indeks palet rumah/avatar deterministik */
  colorSeed: number;
  /** Menandakan data baru ditambahkan/diperbarui optimistik di sesi ini */
  isOptimistic?: boolean;
}

export interface RegistrationFormValues {
  nama: string;
  usia: string;
  kota: string;
  instansi: string;
  email: string;
  wa: string;
  jenisKelamin: Gender;
}

export interface KavlingLot {
  id: string;
  block: BlockLetter;
  indexInBlock: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Arah hadap jalan untuk orientasi pintu/halaman */
  facing: 'north' | 'south';
  /** Variasi gaya atap rumah (0..4) */
  roofVariant: number;
}

export interface MosqueBuilding {
  id: string;
  block: BlockLetter;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
