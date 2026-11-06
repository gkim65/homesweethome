// Keeping this browser and the Google Sheet in step without ever silently dropping data.
//
// Every sync reads the sheet, three-way merges it with this browser's copy against the last copy
// both agreed on (the "base"), writes the result back in one request, and only then moves the base.
// The browser copy is always saved first, so a failed or skipped sync loses nothing.

import { AuthError, connect, disconnect, isConnected, loadGoogle } from './google.js';
import { appendBackups, ensureSheet, readSheet, rememberedSheetId, writeSheet } from './sheet.js';
import { normalizeData } from './store.js';

const DIRTY_KEY = 'hsh_dirty';
const LINKED_KEY = 'hsh_google';
const baseKey = (sheetId) => `hsh_base:${sheetId}`;

function readLS(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writeLS(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }

/** JSON with object keys sorted, so equal records compare equal whatever order their keys were set in. */
function stable(value) {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const toMaps = (d) => ({
  chores: new Map(d.chores.map((c) => [c.id, c])),
  history: new Map(d.history.map((h) => [h.id, h])),
});

/**
 * mergeMap(base, mine, theirs) -> { out, conflicts }
 *
 * Three-way merge of one record type. A record changed on only one side takes that side's version
 * (a deletion counts as a change). When both sides changed it differently nothing is dropped: an
 * edit beats a deletion, and between two edits this browser's wins while theirs is returned in
 * `conflicts` to be backed up.
 */
function mergeMap(base, mine, theirs) {
  const out = new Map();
  const conflicts = [];
  new Set([...base.keys(), ...mine.keys(), ...theirs.keys()]).forEach((k) => {
    const b = base.get(k);
    const m = mine.get(k);
    const t = theirs.get(k);
    const keep = (v) => { if (v !== undefined) out.set(k, v); };
    if (stable(m) === stable(t)) { keep(m); return; }
    const mineChanged = stable(m) !== stable(b);
    const theirsChanged = stable(t) !== stable(b);
    if (mineChanged && !theirsChanged) keep(m);
    else if (theirsChanged && !mineChanged) keep(t);
    else if (m === undefined) keep(t);
    else if (t === undefined) keep(m);
    else { keep(m); conflicts.push(t); }
  });
  return { out, conflicts };
}

/**
 * merge3(base, mine, theirs) -> { merged, conflicts }
 *
 * Three-way merge of whole homes (see `mergeMap`). Overruled sheet records come back as
 * `{ kind, value }`.
 */
export function merge3(base, mine, theirs) {
  const B = toMaps(base);
  const M = toMaps(mine);
  const T = toMaps(theirs);
  const conflicts = [];
  const merged = {};
  ['chores', 'history'].forEach((kind) => {
    const r = mergeMap(B[kind], M[kind], T[kind]);
    merged[kind] = [...r.out.values()];
    conflicts.push(...r.conflicts.map((value) => ({ kind, value })));
  });
  return { merged: normalizeData(merged), conflicts };
}

/** Whether two homes hold exactly the same data. */
export function sameData(a, b) {
  return stable(normalizeData(a)) === stable(normalizeData(b));
}

/** Plain-language reason for a failed sync, keeping Google's own message for anything unrecognised. */
function friendlyReason(err) {
  const m = String(err && err.message);
  if (/has not been used|is disabled|accessNotConfigured/i.test(m)) {
    const api = /sheets/i.test(m) ? 'Google Sheets API' : 'Google Drive API';
    return `the ${api} is not turned on in your Google Cloud project yet (APIs & Services, Library). ${m}`;
  }
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'no internet connection; your changes are saved in this browser';
  return m;
}

/** Append overruled or replaced data to a capped backup list in this browser. */
function backup(key, value) {
  let list = [];
  try { list = JSON.parse(readLS(key) || '[]'); } catch (e) { list = []; }
  list.push({ at: new Date().toISOString(), value });
  writeLS(key, JSON.stringify(list.slice(-10)));
}

/**
 * createSync({ getData, applyData, onStatus, ask, notify }) -> handles
 *
 *   - `getData`   — returns this browser's current home
 *   - `applyData` — called with a merged home to save in the browser and redraw
 *   - `onStatus`  — 'local' (never linked), 'reconnect', 'syncing', 'synced', 'offline' (will
 *                   retry; second argument is the reason), or 'paused' (waiting on the user)
 *   - `ask`       — `(message) => Promise<boolean>` for safety questions
 *   - `notify`    — `(message) => void` for short notices
 *
 * Returns `start()`, `signIn()`, `connectNow()`, `changed()`, `syncNow()`, `stop()`, `sheetId()`,
 * `linked()` and `hasUnsynced()`.
 */
export function createSync({ getData, applyData, onStatus, ask, notify }) {
  let running = false;
  let again = false;
  let timer = null;
  let retryMs = 5000;
  let lastError = null;
  let sheet = rememberedSheetId();

  const linked = () => readLS(LINKED_KEY) === '1';
  const setDirty = (on) => writeLS(DIRTY_KEY, on ? '1' : '');

  function loadBase(id) {
    try { return normalizeData(JSON.parse(readLS(baseKey(id)) || 'null') || {}); } catch (e) { return normalizeData({}); }
  }

  async function syncNow() {
    if (!isConnected()) { onStatus(linked() ? 'reconnect' : 'local'); return; }
    if (running) { again = true; return; }
    running = true;
    clearTimeout(timer);
    onStatus('syncing');
    try {
      sheet = await ensureSheet();
      const remote = await readSheet(sheet);
      let mineAtStart = getData();
      const hasBase = readLS(baseKey(sheet)) !== null;
      let base = loadBase(sheet);

      // Chores saved in this browser before it was ever linked to this sheet: ask before uploading.
      if (!hasBase && mineAtStart.chores.length && !remote.data.chores.length) {
        const upload = await ask(`This browser already has ${mineAtStart.chores.length} chores saved from before you signed in. `
          + 'Add them to your Google Sheet? (Choosing no starts fresh; this browser\'s copy is kept as a backup.)');
        if (!upload) {
          backup('hsh_backup_browser', mineAtStart);
          mineAtStart = normalizeData({});
          applyData(mineAtStart);
        }
      }

      // First sync of this browser with this sheet while both hold chores: ask before combining.
      if (!hasBase && mineAtStart.chores.length && remote.data.chores.length) {
        const combine = await ask(`Your Google Sheet has ${remote.data.chores.length} chores and this browser has `
          + `${mineAtStart.chores.length}. Combine them? (Choosing no uses only the sheet; this browser's copy is kept as a backup.)`);
        if (!combine) {
          backup('hsh_backup_browser', mineAtStart);
          base = mineAtStart; // treat the browser copy as already agreed, so the sheet's version wins
        }
      }

      const { merged, conflicts } = merge3(base, mineAtStart, remote.data);

      // Never let one sync quietly empty the sheet.
      const before = remote.data.chores.length;
      if (before >= 5 && merged.chores.length < before / 2) {
        const ok = await ask(`Syncing would leave ${merged.chores.length} of the ${before} chores in your Google Sheet. Go ahead?`);
        if (!ok) { onStatus('paused'); return; }
      }

      if (!sameData(merged, remote.data) || remote.needsWrite) {
        if (remote.data.chores.length) backup('hsh_backup_sheet', remote.data);
        await writeSheet(sheet, merged, remote.layout);
      }
      writeLS(baseKey(sheet), JSON.stringify(merged));
      writeLS(LINKED_KEY, '1');
      lastError = null;
      if (conflicts.length) {
        backup('hsh_backup_conflicts', conflicts);
        const at = new Date().toISOString();
        const rows = conflicts.map(({ kind, value }) => [at, kind, value.name || value.date || '', JSON.stringify(value)]);
        try {
          await appendBackups(sheet, rows);
          notify('a chore was changed in two places; kept this one and saved the other in the Backups tab');
        } catch (e) {
          notify('a chore was changed in two places; kept this one and saved the other in this browser');
        }
      }

      // Fold the merge into whatever was edited here while the sync was running.
      const now = getData();
      const result = sameData(now, mineAtStart) ? merged : merge3(mineAtStart, now, merged).merged;
      if (!sameData(result, now)) applyData(result);
      const pending = !sameData(result, merged);
      setDirty(pending);
      retryMs = 5000;
      onStatus('synced');
      if (pending) again = true;
    } catch (e) {
      if (e instanceof AuthError) onStatus('reconnect');
      else {
        console.warn('Home Sweet Home sync failed:', e);
        if (e.message !== lastError) notify(`could not sync: ${friendlyReason(e)}`);
        lastError = e.message;
        onStatus('offline', friendlyReason(e));
        timer = setTimeout(syncNow, retryMs);
        retryMs = Math.min(retryMs * 2, 5 * 60 * 1000);
      }
    } finally {
      running = false;
      if (again) { again = false; syncNow(); }
    }
  }

  return {
    start() {
      onStatus(linked() ? 'reconnect' : 'local');
      loadGoogle().catch(() => {});
      window.addEventListener('focus', () => { if (isConnected()) syncNow(); });
      window.addEventListener('online', () => { if (isConnected()) syncNow(); });
    },
    async signIn() {
      try {
        await connect();
        return true;
      } catch (e) {
        notify('could not connect to Google');
        return false;
      }
    },
    async connectNow() {
      if (await this.signIn()) await syncNow();
      else onStatus(linked() ? 'reconnect' : 'local');
    },
    changed() {
      setDirty(true);
      clearTimeout(timer);
      if (isConnected()) timer = setTimeout(syncNow, 1500);
      else onStatus(linked() ? 'reconnect' : 'local');
    },
    syncNow,
    stop() {
      disconnect();
      writeLS(LINKED_KEY, '');
      onStatus('local');
    },
    sheetId: () => sheet,
    linked,
    hasUnsynced: () => readLS(DIRTY_KEY) === '1',
  };
}
