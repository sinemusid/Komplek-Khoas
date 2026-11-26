import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNeighborhoodLayout } from './mapLayout';
import {
  applyLocalOverrides,
  assignResidentsToKavlings,
  isOwnResident,
  mergeOptimisticRows,
  normalizeGender,
  normalizeKavlingId,
  parseCsvMatrix,
  parseSheetRows,
  searchResidents,
  syncProfileWithResidents,
} from './sheetParser';
import { normalizeDuplicateResponse, normalizeLoginResponse } from './appsScriptApi';
import { getEventCountdown } from './countdown';
import { FALLBACK_WIB_TIMINGS, getNextPrayerInfo } from './prayerTimes';
import {
  buildFullShareMessage,
  buildPlatformShareLinks,
  resolveShareUrl,
  SHARE_INVITE_TEXT,
} from './shareLinks';
import { getPhaseForWibHour, getWibTimeInfo, resolveActivePhase } from './wibTime';
import {
  computeRotationStep,
  findNearestWalkNodeId,
  fisherYatesShuffle,
  getPinnedResidentKeys,
  getResidentKey,
  selectInitialWalkers,
} from './walkerRotation';
import {
  parseStoredTimestamp,
  shouldShowWelcomePopup,
  WELCOME_POPUP_ABSENCE_MS,
} from './welcomePopup';

test('buildNeighborhoodLayout creates exactly 500 unique kavling + 4 block mosques with zero overlaps', () => {
  const layout = buildNeighborhoodLayout();
  assert.equal(layout.lots.length, 500);
  assert.equal(layout.mosques.length, 4);

  const uniqueIds = new Set(layout.lots.map((l) => l.id));
  assert.equal(uniqueIds.size, 500);

  for (const block of ['A', 'B', 'C', 'D'] as const) {
    const count = layout.lots.filter((l) => l.block === block).length;
    assert.equal(count, 125, `Block ${block} should have 125 lots`);
    assert.ok(layout.lotsById[`${block}-01`], `${block}-01 must exist`);
    assert.ok(layout.lotsById[`${block}-125`], `${block}-125 must exist`);
    assert.ok(
      layout.mosques.some((m) => m.block === block),
      `Block ${block} must have a mosque`
    );
  }

  // Ensure no lot overlaps the central auditorium plaza OR any of the 4 mosques
  const { plazaX, plazaY, plazaWidth, plazaHeight } = layout.auditorium;
  for (const lot of layout.lots) {
    const overlapsAudX = lot.x < plazaX + plazaWidth && lot.x + lot.width > plazaX;
    const overlapsAudY = lot.y < plazaY + plazaHeight && lot.y + lot.height > plazaY;
    assert.equal(overlapsAudX && overlapsAudY, false, `Lot ${lot.id} should not overlap auditorium plaza`);

    for (const mosque of layout.mosques) {
      const overlapsMX = lot.x < mosque.x + mosque.width && lot.x + lot.width > mosque.x;
      const overlapsMY = lot.y < mosque.y + mosque.height && lot.y + lot.height > mosque.y;
      assert.equal(
        overlapsMX && overlapsMY,
        false,
        `Lot ${lot.id} should not overlap ${mosque.name}`
      );
    }
  }

  // Ensure no two lots overlap each other
  for (let i = 0; i < layout.lots.length; i++) {
    for (let j = i + 1; j < layout.lots.length; j++) {
      const a = layout.lots[i];
      const b = layout.lots[j];
      const ox = a.x < b.x + b.width && a.x + a.width > b.x;
      const oy = a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(ox && oy, false, `Lot ${a.id} overlaps ${b.id}`);
    }
  }

  // Walker graph must be non-empty and connected
  assert.ok(layout.walkNodeIds.length >= 40);
  for (const id of layout.walkNodeIds) {
    assert.ok(layout.walkGraph[id].neighbors.length >= 1, `Node ${id} should have neighbors`);
  }
});

test('parseCsvMatrix & parseSheetRows parse 5 columns including Kolom E Jenis Kelamin', () => {
  const csv = [
    '\uFEFFNama,Kota / Domisili,Instansi,ID Kavling,Jenis Kelamin',
    '"Raka Pratama","Bandung, Jawa Barat","Komunitas ""Khoas"" Studio",b-7,Laki-laki',
    '',
    '   ,  ,  ,  , ',
    'Siti Aisyah,Surabaya,SMAN 5 Surabaya,,Perempuan',
    '"Budi, S.Ds",Yogyakarta,ISI Yogyakarta,D-125,',
  ].join('\r\n');

  const matrix = parseCsvMatrix(csv);
  assert.equal(matrix.length, 6);

  const rows = parseSheetRows(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].nama, 'Raka Pratama');
  assert.equal(rows[0].kota, 'Bandung, Jawa Barat');
  assert.equal(rows[0].instansi, 'Komunitas "Khoas" Studio');
  assert.equal(rows[0].idKavling, 'B-07');
  assert.equal(rows[0].jenisKelamin, 'Laki-laki');

  assert.equal(rows[1].idKavling, '');
  assert.equal(rows[1].jenisKelamin, 'Perempuan');

  assert.equal(rows[2].nama, 'Budi, S.Ds');
  assert.equal(rows[2].idKavling, 'D-125');
  assert.equal(rows[2].jenisKelamin, '');
});

test('normalizeGender & normalizeKavlingId handle varied input formats cleanly', () => {
  assert.equal(normalizeKavlingId('a-1'), 'A-01');
  assert.equal(normalizeKavlingId(' B 9 '), 'B-09');
  assert.equal(normalizeKavlingId('c12'), 'C-12');
  assert.equal(normalizeKavlingId('d-125'), 'D-125');

  assert.equal(normalizeGender('Perempuan'), 'Perempuan');
  assert.equal(normalizeGender('wanita'), 'Perempuan');
  assert.equal(normalizeGender('Laki-laki'), 'Laki-laki');
  assert.equal(normalizeGender('pria'), 'Laki-laki');
  assert.equal(normalizeGender(''), '');
});

test('syncProfileWithResidents auto-syncs legacy user with empty Column D to their mapped kavling', () => {
  const layout = buildNeighborhoodLayout();
  const rows = [
    { nama: 'Peserta Satu', kota: 'Jakarta', instansi: 'UI', idKavling: '', jenisKelamin: 'Laki-laki' as const },
    { nama: 'Siti Aisyah', kota: 'Bandung', instansi: 'ITB', idKavling: '', jenisKelamin: 'Perempuan' as const },
    { nama: 'Peserta Tiga', kota: 'Depok', instansi: 'Khoas', idKavling: 'C-42', jenisKelamin: '' as const },
  ];

  const { residents } = assignResidentsToKavlings(rows, layout.lots);
  assert.equal(residents[1].kavlingId, 'A-02');
  assert.equal(residents[1].houseNumber, 2);

  // Simulate legacy user logging in where Apps Script returns idKavling: null & no gender
  const legacyLoginProfile = {
    nama: 'siti aisyah',
    email: 'siti@test.com',
    wa: '08123456',
    kota: 'Bandung',
    instansi: 'ITB',
    nomorRumah: 0,
    idKavling: null,
    jenisKelamin: '' as const,
  };

  const synced = syncProfileWithResidents(legacyLoginProfile, residents);
  assert.equal(synced.idKavling, 'A-02');
  assert.equal(synced.nomorRumah, 2);
  assert.equal(synced.jenisKelamin, 'Perempuan');
});

test('assignResidentsToKavlings assigns sequential house numbers and preserves explicit lots', () => {
  const layout = buildNeighborhoodLayout();
  const rows = [
    { nama: 'Peserta Satu', kota: 'Jakarta', instansi: 'UI', idKavling: '', jenisKelamin: 'Laki-laki' as const },
    { nama: 'Peserta Dua', kota: 'Bandung', instansi: 'ITB', idKavling: 'A-01', jenisKelamin: 'Perempuan' as const },
    { nama: 'Peserta Tiga', kota: 'Depok', instansi: 'Khoas', idKavling: 'C-42', jenisKelamin: '' as const },
    { nama: 'Peserta Empat', kota: 'Solo', instansi: 'UNS', idKavling: '', jenisKelamin: 'Laki-laki' as const },
  ];

  const { residents, byKavling } = assignResidentsToKavlings(rows, layout.lots);
  assert.equal(residents.length, 4);
  assert.equal(residents[0].houseNumberFormatted, '#001');
  assert.equal(residents[1].kavlingId, 'A-01');
  assert.equal(residents[0].kavlingId, 'A-02');
  assert.equal(residents[2].kavlingId, 'C-42');
  assert.equal(residents[3].kavlingId, 'A-03');
  assert.equal(byKavling['A-01'].jenisKelamin, 'Perempuan');

  assert.equal(searchResidents(residents, 'Bandung')[0].nama, 'Peserta Dua');
  assert.equal(searchResidents(residents, '#003')[0].kavlingId, 'C-42');
  assert.equal(searchResidents(residents, 'A-03')[0].nama, 'Peserta Empat');
});

test('mergeOptimisticRows & applyLocalOverrides handle move, assign, and gender profile update', () => {
  const layout = buildNeighborhoodLayout();
  const live = [
    { nama: 'Andi', kota: 'Jakarta', instansi: 'Studio A', idKavling: 'A-05', jenisKelamin: '' as const },
    { nama: 'Budi', kota: 'Bandung', instansi: 'Studio B', idKavling: 'B-02', jenisKelamin: 'Laki-laki' as const },
  ];

  const merged = mergeOptimisticRows(live, [
    { nama: 'Andi', kota: 'Jakarta', instansi: 'Studio A', idKavling: 'A-05', jenisKelamin: '' as const },
    { nama: 'Nadia', kota: 'Bogor', instansi: 'Studio B', idKavling: 'B-10', jenisKelamin: 'Perempuan' as const },
  ]);
  assert.equal(merged.length, 3);

  const updated = applyLocalOverrides(live, [
    {
      nama: 'Andi',
      kota: 'Jakarta',
      instansi: 'Studio A',
      oldKavling: 'A-05',
      newKavling: 'C-18',
      jenisKelamin: 'Laki-laki',
    },
    {
      nama: 'Citra',
      kota: 'Surabaya',
      instansi: 'Komik SBY',
      oldKavling: null,
      newKavling: 'D-09',
      jenisKelamin: 'Perempuan',
    },
  ]);

  const { byKavling, residents } = assignResidentsToKavlings(updated, layout.lots);
  assert.equal(byKavling['A-05'], undefined);
  assert.equal(byKavling['C-18'].nama, 'Andi');
  assert.equal(byKavling['C-18'].jenisKelamin, 'Laki-laki');
  assert.equal(byKavling['D-09'].jenisKelamin, 'Perempuan');

  const andiProfile = { nama: 'Andi', nomorRumah: 1, idKavling: 'C-18' };
  assert.equal(isOwnResident(byKavling['C-18'], andiProfile), true);
  assert.equal(isOwnResident(byKavling['B-02'], andiProfile), false);
  assert.equal(isOwnResident(residents[2], andiProfile), false);
});

test('normalizeLoginResponse & normalizeDuplicateResponse parse Apps Script payloads with gender', () => {
  const okRes = normalizeLoginResponse(
    {
      status: 'success',
      data: {
        nama: 'Nadia Putri',
        kota: 'Bandung',
        instansi: 'ITB',
        nomorRumah: 12,
        idKavling: 'b-7',
        jenisKelamin: 'Perempuan',
      },
    },
    'nadia@test.com',
    '08123'
  );
  assert.equal(okRes.found, true);
  assert.equal(okRes.profile?.idKavling, 'B-07');
  assert.equal(okRes.profile?.jenisKelamin, 'Perempuan');

  const notFound = normalizeLoginResponse({ status: 'not_found' }, 'x@y.z', '000');
  assert.equal(notFound.found, false);
  assert.equal(normalizeDuplicateResponse({ duplicate: true }).isDuplicate, true);
});

test('getEventCountdown computes days/hours/minutes/seconds and live state accurately', () => {
  const target = '2026-12-11T19:30:00+07:00';
  // Exactly 1 day, 2 hours, 3 minutes, 4 seconds before target
  const beforeMs = Date.parse(target) - (86400 + 2 * 3600 + 3 * 60 + 4) * 1000;
  const cd = getEventCountdown(beforeMs, target);
  assert.equal(cd.isLive, false);
  assert.equal(cd.days, 1);
  assert.equal(cd.hours, 2);
  assert.equal(cd.minutes, 3);
  assert.equal(cd.seconds, 4);
  assert.equal(cd.formattedHours, '02');

  const afterMs = Date.parse(target) + 5000;
  const live = getEventCountdown(afterMs, target);
  assert.equal(live.isLive, true);
});

test('getNextPrayerInfo highlights upcoming prayer and wraps cleanly after Isya', () => {
  // 16:00:00 WIB -> next prayer should be Maghrib (17:58)
  const at16 = getNextPrayerInfo(FALLBACK_WIB_TIMINGS, 16 * 3600);
  assert.equal(at16.key, 'Maghrib');
  assert.equal(at16.time, '17:58');
  assert.ok(at16.countdownLabel.includes('1 jam'));

  // 21:00:00 WIB -> next prayer should wrap to Subuh (04:22)
  const at21 = getNextPrayerInfo(FALLBACK_WIB_TIMINGS, 21 * 3600);
  assert.equal(at21.key, 'Subuh');
  assert.equal(at21.time, '04:22');
});

test('WIB day/dusk/night cycle maps hours accurately', () => {
  assert.equal(getPhaseForWibHour(6), 'day');
  assert.equal(getPhaseForWibHour(15), 'day');
  assert.equal(getPhaseForWibHour(16), 'dusk');
  assert.equal(getPhaseForWibHour(17), 'dusk');
  assert.equal(getPhaseForWibHour(18), 'night');

  const wibDusk = getWibTimeInfo(new Date('2026-11-25T09:46:00Z'));
  assert.equal(wibDusk.formattedClock, '16:46');
  assert.equal(wibDusk.autoPhase, 'dusk');
  assert.equal(resolveActivePhase('night', wibDusk).phase, 'night');
});

test('shareLinks builds clean URL, invite copy, and encoded multi-platform share intents', () => {
  assert.equal(SHARE_INVITE_TEXT, 'yuk ikutan pre launching komik digital khoas');

  const clean = resolveShareUrl('https://komplek.khoas.id/peta/?ref=abc#top');
  assert.equal(clean, 'https://komplek.khoas.id/peta');

  const rootClean = resolveShareUrl('https://komplek.khoas.id/?foo=1');
  assert.equal(rootClean, 'https://komplek.khoas.id/');

  const msg = buildFullShareMessage('https://komplek.khoas.id/');
  assert.equal(msg, 'yuk ikutan pre launching komik digital khoas\nhttps://komplek.khoas.id/');

  const links = buildPlatformShareLinks('https://komplek.khoas.id/');
  assert.equal(links.length, 5);

  const byId = Object.fromEntries(links.map((l) => [l.id, l.href]));
  assert.ok(byId.whatsapp.startsWith('https://wa.me/?text='));
  assert.ok(decodeURIComponent(byId.whatsapp).includes(SHARE_INVITE_TEXT));
  assert.ok(decodeURIComponent(byId.whatsapp).includes('https://komplek.khoas.id/'));

  assert.ok(byId.telegram.startsWith('https://t.me/share/url?'));
  assert.ok(decodeURIComponent(byId.telegram).includes(SHARE_INVITE_TEXT));

  assert.ok(byId.x.startsWith('https://twitter.com/intent/tweet?'));
  assert.ok(decodeURIComponent(byId.x).includes(SHARE_INVITE_TEXT));

  assert.ok(byId.facebook.startsWith('https://www.facebook.com/sharer/sharer.php?'));
  assert.ok(decodeURIComponent(byId.facebook).includes('https://komplek.khoas.id/'));

  assert.ok(byId.threads.startsWith('https://www.threads.net/intent/post?text='));
  assert.ok(decodeURIComponent(byId.threads).includes(SHARE_INVITE_TEXT));
});

test('fisherYatesShuffle & selectInitialWalkers randomly sample across all residents and pin logged-in user', () => {
  const layout = buildNeighborhoodLayout();
  const rows = Array.from({ length: 120 }, (_, i) => ({
    nama: `Warga ${i + 1}`,
    kota: 'Bandung',
    instansi: 'Komik Khoas',
    idKavling: '',
    jenisKelamin: (i % 2 === 0 ? 'Perempuan' : 'Laki-laki') as 'Perempuan' | 'Laki-laki',
  }));
  const { residents } = assignResidentsToKavlings(rows, layout.lots);

  // Deterministic LCG rng for reproducible unit test
  let seed = 42;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const shuffled = fisherYatesShuffle(residents, rng);
  assert.equal(shuffled.length, residents.length);
  // Original array must not be mutated
  assert.equal(residents[0].houseNumber, 1);
  // Shuffled order must differ from sequential #1..#120
  const firstTenNumbers = shuffled.slice(0, 10).map((r) => r.houseNumber);
  assert.notDeepEqual(firstTenNumbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Logged-in resident #115 must ALWAYS be included in initial 40 walkers
  const loggedInProfile = { nama: 'Warga 115', nomorRumah: 115, idKavling: residents[114].kavlingId };
  const pinnedKeys = getPinnedResidentKeys(residents, loggedInProfile);
  assert.equal(pinnedKeys.size, 1);

  const initial40 = selectInitialWalkers(residents, 40, pinnedKeys, rng);
  assert.equal(initial40.length, 40);
  assert.ok(initial40.some((r) => r.houseNumber === 115), 'Logged-in user must be included in initial walkers');
  // Must include residents beyond #040 (proving it is not strictly #001..#040)
  assert.ok(initial40.some((r) => r.houseNumber > 40), 'Initial walkers must sample beyond #040');
});

test('computeRotationStep rotates 4-6 on map & 1-2 in auditorium without evicting logged-in user or duplicating', () => {
  const layout = buildNeighborhoodLayout();
  const rows = Array.from({ length: 85 }, (_, i) => ({
    nama: `Peserta ${i + 1}`,
    kota: 'Jakarta',
    instansi: 'Khoas',
    idKavling: '',
    jenisKelamin: (i % 3 === 0 ? 'Perempuan' : 'Laki-laki') as 'Perempuan' | 'Laki-laki',
  }));
  const { residents } = assignResidentsToKavlings(rows, layout.lots);

  let seed = 1337;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const loggedInKey = getResidentKey(residents[77]);
  const pinned = new Set([loggedInKey]);
  let activeKeys = selectInitialWalkers(residents, 40, pinned, rng).map(getResidentKey);
  const seenKeys = new Set(activeKeys);

  // Run 12 map rotation cycles
  for (let cycle = 0; cycle < 12; cycle++) {
    const step = computeRotationStep(residents, activeKeys, {
      maxActive: 40,
      minSwap: 4,
      maxSwap: 6,
      pinnedKeys: pinned,
      rng,
    });
    assert.ok(step.leavingKeys.length >= 4 && step.leavingKeys.length <= 6);
    assert.equal(step.enteringResidents.length, step.leavingKeys.length);
    assert.equal(step.leavingKeys.includes(loggedInKey), false, 'Logged-in user must never be rotated out');
    assert.equal(step.nextActiveKeys.length, 40);
    assert.equal(new Set(step.nextActiveKeys).size, 40, 'No duplicate walkers allowed');
    assert.ok(step.nextActiveKeys.includes(loggedInKey), 'Logged-in user must remain active');

    for (const r of step.enteringResidents) {
      assert.equal(activeKeys.includes(getResidentKey(r)), false, 'Entering resident must come from bench');
      seenKeys.add(getResidentKey(r));
    }
    activeKeys = step.nextActiveKeys;
  }

  // Over multiple cycles, significantly more than 40 unique residents should have had a turn
  assert.ok(seenKeys.size > 60, `Expected >60 unique residents rotated over 12 cycles, got ${seenKeys.size}`);

  // Auditorium rotation (5 active, swap 1-2)
  const audInitial = selectInitialWalkers(residents, 5, new Set(), rng).map(getResidentKey);
  const audStep = computeRotationStep(residents, audInitial, {
    maxActive: 5,
    minSwap: 1,
    maxSwap: 2,
    rng,
  });
  assert.ok(audStep.leavingKeys.length >= 1 && audStep.leavingKeys.length <= 2);
  assert.equal(audStep.enteringResidents.length, audStep.leavingKeys.length);
  assert.equal(audStep.nextActiveKeys.length, 5);
  assert.equal(new Set(audStep.nextActiveKeys).size, 5);
});

test('findNearestWalkNodeId returns closest street node to any house front', () => {
  const layout = buildNeighborhoodLayout();
  const lotA01 = layout.lotsById['A-01'];
  const spawnX = lotA01.x + lotA01.width / 2;
  const spawnY = lotA01.facing === 'north' ? lotA01.y - 8 : lotA01.y + lotA01.height + 8;
  const nearestId = findNearestWalkNodeId(spawnX, spawnY, layout.walkGraph, layout.walkNodeIds);
  const nearestNode = layout.walkGraph[nearestId];
  assert.ok(nearestNode, 'Nearest node must exist in walkGraph');

  const bestDist = Math.hypot(nearestNode.x - spawnX, nearestNode.y - spawnY);
  for (const id of layout.walkNodeIds) {
    const node = layout.walkGraph[id];
    const d = Math.hypot(node.x - spawnX, node.y - spawnY);
    assert.ok(bestDist <= d + 1e-6, `Node ${nearestId} must be closest to A-01`);
  }
});

test('welcomePopup shows on first entry, stays hidden within 10 min absence, and reappears after >10 min', () => {
  const now = 1_800_000_000_000;
  assert.equal(WELCOME_POPUP_ABSENCE_MS, 10 * 60 * 1000);

  // First-ever visit (no stored timestamp) -> must show
  assert.equal(shouldShowWelcomePopup(null, now), true);

  // Returned after 1 minute or 9m59s -> must NOT show
  assert.equal(shouldShowWelcomePopup(now - 60_000, now), false);
  assert.equal(shouldShowWelcomePopup(now - (WELCOME_POPUP_ABSENCE_MS - 1000), now), false);

  // Returned at exactly 10 minutes -> still not strictly > 10 minutes
  assert.equal(shouldShowWelcomePopup(now - WELCOME_POPUP_ABSENCE_MS, now), false);

  // Returned after > 10 minutes (10m 1s and 30m) -> must show again
  assert.equal(shouldShowWelcomePopup(now - (WELCOME_POPUP_ABSENCE_MS + 1000), now), true);
  assert.equal(shouldShowWelcomePopup(now - 30 * 60_000, now), true);

  // Safe timestamp parser
  assert.equal(parseStoredTimestamp(null), null);
  assert.equal(parseStoredTimestamp(''), null);
  assert.equal(parseStoredTimestamp('abc'), null);
  assert.equal(parseStoredTimestamp('-100'), null);
  assert.equal(parseStoredTimestamp(String(now)), now);
});


