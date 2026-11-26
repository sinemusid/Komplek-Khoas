export const SHARE_INVITE_TEXT = 'yuk ikutan pre launching komik digital khoas';

export type SharePlatformId = 'whatsapp' | 'telegram' | 'x' | 'facebook' | 'threads';

export interface SharePlatformLink {
  id: SharePlatformId;
  label: string;
  description: string;
  href: string;
}

/**
 * Membersihkan URL halaman aktif (menghapus hash/parameter sementara)
 * agar link yang dibagikan selalu rapi dan langsung menuju Komplek Khoas.
 */
export function resolveShareUrl(rawUrl?: string): string {
  const fallback =
    typeof window !== 'undefined' && window.location?.href ? window.location.href : '';
  const candidate = (rawUrl ?? fallback).trim();
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    const cleanPath = parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return candidate;
  }
}

/**
 * Merangkai pesan ajakan lengkap yang siap dikirim atau disalin.
 */
export function buildFullShareMessage(url: string, inviteText = SHARE_INVITE_TEXT): string {
  const cleanUrl = resolveShareUrl(url);
  return cleanUrl ? `${inviteText}\n${cleanUrl}` : inviteText;
}

/**
 * Menghasilkan daftar URL intent berbagi multi-platform yang ter-encode dengan aman.
 */
export function buildPlatformShareLinks(
  url: string,
  inviteText = SHARE_INVITE_TEXT
): SharePlatformLink[] {
  const cleanUrl = resolveShareUrl(url);
  const combined = cleanUrl ? `${inviteText} ${cleanUrl}` : inviteText;
  const encodedUrl = encodeURIComponent(cleanUrl);
  const encodedText = encodeURIComponent(inviteText);
  const encodedCombined = encodeURIComponent(combined);

  return [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      description: 'Kirim ke chat atau grup',
      href: `https://wa.me/?text=${encodedCombined}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      description: 'Bagikan ke kontak & channel',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      id: 'x',
      label: 'X (Twitter)',
      description: 'Posting ajakan ke timeline',
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      description: 'Bagikan ke beranda',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    },
    {
      id: 'threads',
      label: 'Threads',
      description: 'Buat utas ajakan singkat',
      href: `https://www.threads.net/intent/post?text=${encodedCombined}`,
    },
  ];
}
