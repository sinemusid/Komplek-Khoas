import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Send,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import {
  buildFullShareMessage,
  buildPlatformShareLinks,
  resolveShareUrl,
  SHARE_INVITE_TEXT,
  SharePlatformId,
} from '../utils/shareLinks';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopied?: () => void;
}

const PLATFORM_STYLES: Record<
  SharePlatformId,
  {
    badgeBg: string;
    badgeText: string;
    borderHover: string;
    icon: React.ReactNode;
  }
> = {
  whatsapp: {
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    borderHover: 'hover:border-emerald-300 hover:bg-emerald-50/70',
    icon: <MessageCircle className="h-4 w-4" />,
  },
  telegram: {
    badgeBg: 'bg-sky-500',
    badgeText: 'text-white',
    borderHover: 'hover:border-sky-300 hover:bg-sky-50/70',
    icon: <Send className="h-4 w-4" />,
  },
  x: {
    badgeBg: 'bg-slate-900',
    badgeText: 'text-white',
    borderHover: 'hover:border-slate-400 hover:bg-slate-100/80',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  facebook: {
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    borderHover: 'hover:border-blue-300 hover:bg-blue-50/70',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M13.5 21v-8.2h2.76l.41-3.2H13.5V7.55c0-.93.26-1.56 1.59-1.56h1.7V3.13A22.8 22.8 0 0 0 14.32 3c-2.44 0-4.12 1.49-4.12 4.22V9.6H7.44v3.2h2.76V21z" />
      </svg>
    ),
  },
  threads: {
    badgeBg: 'bg-neutral-900',
    badgeText: 'text-white',
    borderHover: 'hover:border-neutral-400 hover:bg-neutral-100/80',
    icon: (
      <span className="font-mono text-sm font-extrabold leading-none" aria-hidden="true">
        @
      </span>
    ),
  },
};

export function ShareModal({ isOpen, onClose, onCopied }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => (isOpen ? resolveShareUrl() : ''), [isOpen]);
  const fullMessage = useMemo(() => buildFullShareMessage(shareUrl), [shareUrl]);
  const platforms = useMemo(() => buildPlatformShareLinks(shareUrl), [shareUrl]);

  const supportsNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    let success = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(fullMessage);
        success = true;
      }
    } catch {
      success = false;
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = fullMessage;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      onCopied?.();
    }
  };

  const handleNativeShare = async () => {
    if (!supportsNativeShare) return;
    try {
      await navigator.share({
        title: 'Komplek Khoas',
        text: SHARE_INVITE_TEXT,
        url: shareUrl,
      });
    } catch {
      // Pengguna membatalkan sheet share native — abaikan dengan tenang
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      data-testid="share-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Slate Header matching AccountGateway & ProfilePanel */}
        <div className="bg-slate-900 px-6 pb-5 pt-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/35">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold tracking-wider text-amber-300">
                  BAGIKAN KOMPLEK KHOAS
                </p>
                <h2
                  id="share-modal-title"
                  className="mt-0.5 text-lg font-bold tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Bantu Ramein Komplek Ini Yuk!
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal bagikan"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Preview of exact invitation copy & live URL */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500">Pesan yang dibagikan</p>
            <p
              data-testid="share-preview-text"
              className="mt-1 text-sm font-semibold text-slate-900"
            >
              {SHARE_INVITE_TEXT}
            </p>
            <p
              data-testid="share-preview-url"
              className="mt-1 truncate font-mono text-xs text-slate-600"
              title={shareUrl}
            >
              {shareUrl}
            </p>
          </div>

          {/* Multi-Platform Share Grid */}
          <div>
            <p className="mb-2.5 text-xs font-semibold text-slate-600">Pilih platform</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {platforms.map((platform) => {
                const style = PLATFORM_STYLES[platform.id];
                return (
                  <a
                    key={platform.id}
                    data-testid={`share-platform-${platform.id}`}
                    href={platform.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left transition-colors ${style.borderHover}`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.badgeBg} ${style.badgeText}`}
                      >
                        {style.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {platform.label}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {platform.description}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Copy Message & Link + Optional Native Share */}
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              data-testid="share-copy-button"
              onClick={handleCopy}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                copied
                  ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 shrink-0" />
                  <span>Salin Teks &amp; Link</span>
                </>
              )}
            </button>

            {supportsNativeShare && (
              <button
                type="button"
                data-testid="share-native-button"
                onClick={handleNativeShare}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
              >
                <Smartphone className="h-4 w-4 shrink-0 text-slate-600" />
                <span>Bagikan lewat Aplikasi Lain</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
