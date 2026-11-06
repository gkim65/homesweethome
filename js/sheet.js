// The Home Sweet Home Google Sheet: finding or creating it, and reading and writing every chore.

import { gfetch } from './google.js';
import { newId, normalizeData, todayISO } from './store.js';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const SHEET_KEY = 'hsh_sheet_id';
/** Marks the files this app made, so a Drive search finds only them. */
const APP_PROP = 'homesweethome';

/** Columns the app owns on each tab, in the order it writes them. Name/last_done columns are views. */
const COLUMNS = {
  Chores: ['id', 'chore', 'room', 'type', 'every_days', 'last_done', 'notes'],
  History: ['id', 'chore_id', 'date', 'chore (name)', 'room (name)'],
  Settings: ['key', 'value'],
};
const TABS = Object.keys(COLUMNS);

/** Column letter for a 0-based index (A–Z, then AA…). */
const colLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : colLetter(Math.floor(i / 26) - 1) + colLetter(i % 26));

/** Read a date typed into the sheet in any common form; '' when it is not a recognisable date. */
function parseDateCell(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : todayISO(d);
}

/**
 * ensureSheet() -> Promise<string>
 *
 * Find this user's sheet (remembered id, else a search of the files this app created), or create
 * one if there truly is none. Returns the spreadsheet id.
 *
 * NOTE: a new sheet is only created after Google confirms none exists; a failed request throws
 * instead, so a network hiccup can never start a second, empty sheet.
 */
export async function ensureSheet() {
  let id = null;
  try { id = localStorage.getItem(SHEET_KEY); } catch (e) {}
  let usable = false;
  if (id) {
    try {
      const f = await gfetch(`${DRIVE}/${encodeURIComponent(id)}?fields=id,trashed`);
      usable = !!f && !f.trashed;
    } catch (e) {
      if (e.status !== 404 && e.status !== 403) throw e;
    }
  }
  if (!usable) {
    const q = encodeURIComponent(`appProperties has { key='${APP_PROP}' and value='1' } and trashed=false`);
    const found = await gfetch(`${DRIVE}?q=${q}&orderBy=modifiedTime desc&fields=files(id)&pageSize=10`);
    id = found.files && found.files.length ? found.files[0].id : await createSheet();
    try { localStorage.setItem(SHEET_KEY, id); } catch (e) {}
  }
  await ensureTabs(id);
  return id;
}

const tabsChecked = new Set();

/** Add any missing tabs (e.g. creating the sheet was interrupted). Existing tabs are never touched. */
async function ensureTabs(id) {
  if (tabsChecked.has(id)) return;
  const book = await gfetch(`${SHEETS}/${id}?fields=sheets.properties.title`);
  const titles = book.sheets.map((s) => s.properties.title);
  const missing = TABS.filter((t) => !titles.includes(t));
  if (missing.length) {
    await gfetch(`${SHEETS}/${id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }),
    });
  }
  tabsChecked.add(id);
}

/** Create the spreadsheet with its tabs and frozen header rows. Returns its id. */
async function createSheet() {
  const file = await gfetch(DRIVE, {
    method: 'POST',
    body: JSON.stringify({ name: 'Home Sweet Home chores', mimeType: 'application/vnd.google-apps.spreadsheet', appProperties: { [APP_PROP]: '1' } }),
  });
  const book = await gfetch(`${SHEETS}/${file.id}?fields=sheets.properties.sheetId`);
  const firstId = book.sheets[0].properties.sheetId;
  const frozen = { frozenRowCount: 1 };
  await gfetch(`${SHEETS}/${file.id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        { updateSheetProperties: { properties: { sheetId: firstId, title: TABS[0], gridProperties: frozen }, fields: 'title,gridProperties.frozenRowCount' } },
        ...TABS.slice(1).map((title) => ({ addSheet: { properties: { title, gridProperties: frozen } } })),
      ],
    }),
  });
  return file.id;
}

/** Link for opening the sheet in Google Sheets. */
export function sheetUrl(id) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}`;
}

/** The sheet id this browser last synced with, if any. */
export function rememberedSheetId() {
  try { return localStorage.getItem(SHEET_KEY); } catch (e) { return null; }
}

/** Forget which sheet this browser uses (the sheet itself is untouched). */
export function forgetSheetId() {
  try { localStorage.removeItem(SHEET_KEY); } catch (e) {}
}

/**
 * readSheet(id) -> Promise<{ data, layout, needsWrite }>
 *
 * Read every tab. Columns are matched by their header, so reordering columns in Google Sheets is
 * safe; columns the app does not know are kept in `layout` and written back untouched.
 *
 * Things typed in the sheet by hand are understood too: a chore row with no id gets one; a
 * `last_done` date newer than the history becomes a new history row; a history row whose
 * `chore_id` is a chore's name is matched to that chore (or a new chore is made, so no row is lost).
 * `needsWrite` is true whenever any of that happened, so the tidied version is written back.
 */
export async function readSheet(id) {
  const ranges = TABS.map((t) => `ranges=${encodeURIComponent(t)}`).join('&');
  const reply = await gfetch(`${SHEETS}/${id}/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE`);
  const layout = {};
  let needsWrite = false;

  const tabs = {};
  reply.valueRanges.forEach((vr, i) => {
    const tab = TABS[i];
    const rows = vr.values || [];
    const header = (rows[0] || []).map((h) => String(h).trim().toLowerCase());
    const known = COLUMNS[tab];
    const pos = known.map((c, k) => (header.length ? header.indexOf(c) : k));
    const extraCols = header.map((h, k) => ({ h: (rows[0] || [])[k], k })).filter(({ h, k }) => h && !known.includes(header[k]));
    const body = rows.slice(1);
    tabs[tab] = body.map((r) => {
      const rec = {};
      known.forEach((c, k) => { rec[c] = pos[k] >= 0 ? String(r[pos[k]] ?? '').trim() : ''; });
      rec.extra = Object.fromEntries(extraCols.map(({ h, k }) => [h, r[k] ?? '']));
      return rec;
    });
    layout[tab] = { rows: body.length, extraHeaders: extraCols.map(({ h }) => h), extras: new Map(), order: [] };
  });

  const chores = [];
  const typedLastDone = new Map();
  tabs.Chores.forEach((r) => {
    if (!r.id && !r.chore) return;
    if (!r.id) { r.id = newId(); needsWrite = true; }
    let notes = r.notes;
    const every = r.every_days === '' ? 0 : Number(r.every_days);
    const last = parseDateCell(r.last_done);
    // An unreadable date is kept in the notes rather than lost.
    if (r.last_done && !last) { notes = `${notes}${notes ? '\n' : ''}(last done: ${r.last_done})`; needsWrite = true; }
    if (last) typedLastDone.set(r.id, last);
    chores.push({ id: r.id, name: r.chore, room: r.room, type: r.type, everyDays: Number.isFinite(every) ? Math.round(every) : 0, notes });
    layout.Chores.extras.set(r.id, r.extra);
    layout.Chores.order.push(r.id);
  });

  const ids = new Set(chores.map((c) => c.id));
  const toChoreId = (token, nameCell, roomCell) => {
    if (ids.has(token)) return token;
    const name = token || nameCell;
    if (!name) return null;
    needsWrite = true;
    const known = chores.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (known) return known.id;
    const added = { id: newId(), name, room: roomCell || '', type: '', everyDays: 0, notes: '' };
    chores.push(added);
    ids.add(added.id);
    return added.id;
  };

  const history = [];
  tabs.History.forEach((r) => {
    if (!r.id && !r.chore_id && !r['chore (name)']) return;
    const choreId = toChoreId(r.chore_id, r['chore (name)'], r['room (name)']);
    const date = parseDateCell(r.date);
    if (!choreId || !date) return; // nothing to attach it to; it stays visible in Google's version history
    if (!r.id) { r.id = newId(); needsWrite = true; }
    history.push({ id: r.id, choreId, date });
    layout.History.extras.set(r.id, r.extra);
    layout.History.order.push(r.id);
  });

  // A last_done typed (or changed) in the sheet that is newer than the history counts as a new "done".
  typedLastDone.forEach((date, choreId) => {
    const newest = history.filter((h) => h.choreId === choreId).reduce((m, h) => (h.date > m ? h.date : m), '');
    if (date > newest) { history.push({ id: newId(), choreId, date }); needsWrite = true; }
  });

  return { data: normalizeData({ chores, history }), layout, needsWrite };
}

/**
 * writeSheet(id, data, layout) -> Promise<void>
 *
 * Replace every tab's contents with `data` in one request. Rows keep the order they had in the
 * sheet (new ones go at the end), leftover rows below are blanked, and extra columns are kept.
 * Values are written RAW, so text that looks like a formula is stored as plain text.
 */
export async function writeSheet(id, data, layout) {
  const byId = new Map(data.chores.map((c) => [c.id, c]));
  const last = new Map();
  data.history.forEach((h) => { if (!last.has(h.choreId) || h.date > last.get(h.choreId)) last.set(h.choreId, h.date); });
  const ordered = (list, order) => {
    const at = new Map(order.map((x, i) => [x, i]));
    return [...list].sort((a, b) => (at.has(a.id) ? at.get(a.id) : 1e9) - (at.has(b.id) ? at.get(b.id) : 1e9));
  };
  const historyNew = [...data.history].sort((a, b) => a.date.localeCompare(b.date));
  const rowsFor = {
    Chores: ordered(data.chores, layout.Chores.order).map((c) => ({
      id: c.id,
      cells: [c.id, c.name, c.room, c.type, c.everyDays ? String(c.everyDays) : '', last.get(c.id) || '', c.notes],
    })),
    History: ordered(historyNew, layout.History.order).map((h) => ({
      id: h.id,
      cells: [h.id, h.choreId, h.date, byId.get(h.choreId)?.name || '', byId.get(h.choreId)?.room || ''],
    })),
    Settings: [{ cells: ['format_version', '1'] }],
  };

  const body = TABS.map((tab) => {
    const extraHeaders = layout[tab]?.extraHeaders || [];
    const extras = layout[tab]?.extras || new Map();
    const width = COLUMNS[tab].length + extraHeaders.length;
    const rows = rowsFor[tab].map((r) => [...r.cells, ...extraHeaders.map((h) => (extras.get(r.id) || {})[h] ?? '')]);
    const blanks = Math.max(0, (layout[tab]?.rows || 0) - rows.length);
    for (let i = 0; i < blanks; i++) rows.push(new Array(width).fill(''));
    return { range: `${tab}!A1:${colLetter(width - 1)}${rows.length + 1}`, values: [[...COLUMNS[tab], ...extraHeaders], ...rows] };
  });

  await gfetch(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: body }),
  });
}

/**
 * appendBackups(id, rows) -> Promise<void>
 *
 * Add `[saved_at, kind, what, details]` rows to the sheet's Backups tab, creating it the first time.
 */
export async function appendBackups(id, rows) {
  const append = () => gfetch(`${SHEETS}/${id}/values/${encodeURIComponent('Backups!A1')}:append`
    + '?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: rows }) });
  try {
    await append();
  } catch (e) {
    if (e.status !== 400) throw e;
    await gfetch(`${SHEETS}/${id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Backups', gridProperties: { frozenRowCount: 1 } } } }] }),
    });
    await gfetch(`${SHEETS}/${id}/values/${encodeURIComponent('Backups!A1:D1')}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [['saved_at', 'kind', 'what', 'details']] }),
    });
    await append();
  }
}
