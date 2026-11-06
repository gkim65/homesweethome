// Wires the page together: drawing the chore board, the editor, marking chores done, and sync.

import { calm, el } from './dom.js';
import { renderHomeMap } from './homemap.js';
import { hueFor, pixelSvg, roomIcon, typeIcon } from './icons.js';
import { cheerLines, createBun, floatText, levelUpBanner } from './mascot.js';
import { forgetSheetId, sheetUrl } from './sheet.js';
import {
  agoText, choreStatus, emptyStore, eraseStore, everyText, EXP_PER_CHORE, formatDate, lastDoneMap, levelInfo, loadStore,
  newId, normalizeData, saveStore, starterChores, todayISO,
} from './store.js';
import { createSync } from './sync.js';

const $ = (id) => document.getElementById(id);

// ── State ──────────────────────────────────────────────────────────────

let data = emptyStore();
const view = { group: 'room', rooms: new Set(), types: new Set(), query: '' };
try { view.group = localStorage.getItem('hsh_group') || 'room'; } catch (e) {}
if (!['room', 'type', 'due'].includes(view.group)) view.group = 'room';

/** After any change: save here first, redraw, then let sync carry it to the sheet. */
function commit(next) {
  data = normalizeData(next);
  if (!saveStore(data)) toast('could not save in this browser (storage full or blocked)');
  render();
  sync.changed();
}

const ROOMLESS = 'Around the house';
const TYPELESS = 'Other';
const roomName = (c) => c.room || ROOMLESS;
const typeName = (c) => c.type || TYPELESS;

/** Unique non-empty values, sorted, with their counts. */
function tally(list, key) {
  const m = new Map();
  list.forEach((c) => m.set(key(c), (m.get(key(c)) || 0) + 1));
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// ── Drawing ────────────────────────────────────────────────────────────

const STATUS_ORDER = { overdue: 0, never: 1, due: 2, soon: 3, fresh: 4, whenever: 5 };
const DUE_GROUPS = [
  ['overdue', 'Needs love', 'heart'], ['never', 'Never done yet', 'sparkle'], ['due', 'Due today', 'broom'],
  ['soon', 'Coming up', 'box'], ['fresh', 'Sparkly clean', 'check'], ['whenever', 'Whenever you like', 'plant'],
];

function render() {
  const today = new Date();
  const last = lastDoneMap(data);
  const items = data.chores.map((c) => ({ c, last: last.get(c.id) || '', st: choreStatus(c, last.get(c.id) || '', today) }));

  // Drop filters for rooms/types that no longer exist.
  const rooms = tally(data.chores, roomName);
  const types = tally(data.chores, typeName);
  [...view.rooms].forEach((r) => { if (!rooms.some(([n]) => n === r)) view.rooms.delete(r); });
  [...view.types].forEach((t) => { if (!types.some(([n]) => n === t)) view.types.delete(t); });

  renderSummary(items);
  renderPlayer();
  renderHomeMap($('plan'), rooms.map(([name, total]) => {
    const here = items.filter((x) => roomName(x.c) === name);
    return {
      name, total, iconKey: name === ROOMLESS ? '' : name,
      due: here.filter((x) => ['overdue', 'due', 'never'].includes(x.st.key)).length,
      soon: here.filter((x) => x.st.key === 'soon').length,
    };
  }), view.rooms, pickRoom);
  renderChips($('room-chips'), rooms, view.rooms, (n) => roomIcon(n === ROOMLESS ? '' : n));
  renderChips($('type-chips'), types, view.types, (n) => typeIcon(n === TYPELESS ? '' : n));
  fillDatalist($('room-options'), ['Kitchen', 'Bedroom', 'Bathroom', 'Hallway', 'Living room', 'Laundry room', 'Office', 'Garden'], data.chores.map((c) => c.room));
  fillDatalist($('type-options'), ['Sweeping', 'Mopping', 'Vacuuming', 'Windows & mirrors', 'Laundry', 'Dishes', 'Dusting', 'Trash', 'Scrubbing', 'Wiping', 'Bedding', 'Plants', 'Tidying'], data.chores.map((c) => c.type));
  document.querySelectorAll('[data-group]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.group === view.group)));

  const q = view.query.trim().toLowerCase();
  const shown = items.filter(({ c }) => (!view.rooms.size || view.rooms.has(roomName(c)))
    && (!view.types.size || view.types.has(typeName(c)))
    && (!q || [c.name, c.room, c.type, c.notes].some((t) => t.toLowerCase().includes(q))));
  shown.sort((a, b) => (STATUS_ORDER[a.st.key] - STATUS_ORDER[b.st.key]) || (b.st.ratio - a.st.ratio) || a.c.name.localeCompare(b.c.name));

  const board = $('board');
  board.replaceChildren();
  $('empty').hidden = data.chores.length > 0;
  if (!data.chores.length) return;
  if (!shown.length) {
    board.append(el('p', { class: 'muted nothing', text: 'No chores match. Try clearing a filter or the search.' }));
    return;
  }

  let groups;
  if (view.group === 'due') {
    groups = DUE_GROUPS.map(([key, title, icon]) => ({ title, icon, hue: null, list: shown.filter((x) => x.st.key === key) }));
  } else {
    const keyOf = view.group === 'room' ? (x) => roomName(x.c) : (x) => typeName(x.c);
    const names = [...new Set(shown.map(keyOf))].sort((a, b) => a.localeCompare(b));
    groups = names.map((n) => ({
      title: n,
      icon: view.group === 'room' ? roomIcon(n === ROOMLESS ? '' : n) : typeIcon(n === TYPELESS ? '' : n),
      hue: hueFor(n),
      list: shown.filter((x) => keyOf(x) === n),
    }));
  }
  groups.filter((g) => g.list.length).forEach((g) => board.append(groupCard(g)));
}

/** Tap a spot on the floorplan: show only its rooms' chores (tap again to show everything). */
function pickRoom(names) {
  const only = view.rooms.size === names.length && names.every((n) => view.rooms.has(n));
  view.rooms = only ? new Set() : new Set(names);
  render();
  if (!only) $('board').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
}

/** Level, title and EXP bar under Bun. */
function renderPlayer() {
  const lv = levelInfo(data.history.length);
  $('lv').textContent = `Lv. ${lv.level}`;
  $('lv-title').textContent = lv.title;
  $('exp-fill').style.setProperty('--fill', lv.pct.toFixed(3));
  $('exp-text').textContent = `EXP ${lv.exp} / ${lv.need}`;
}

function renderSummary(items) {
  const n = (keys) => items.filter((x) => keys.includes(x.st.key)).length;
  const due = n(['overdue', 'due', 'never']);
  const soon = n(['soon']);
  const clean = n(['fresh', 'whenever']);
  const doneToday = data.history.filter((h) => h.date === todayISO()).length;
  const stat = (icon, num, label, cls) => el('div', { class: `stat ${cls}` }, pixelSvg(icon, 28), el('strong', { text: String(num) }), el('span', { text: label }));
  $('summary').replaceChildren(
    stat('heart', due, due === 1 ? 'needs doing' : 'need doing', due ? 'hot' : ''),
    stat('box', soon, 'coming up', ''),
    stat('sparkle', clean, 'sparkly clean', ''),
    stat('check', doneToday, 'done today', doneToday ? 'yay' : ''),
  );
}

function renderChips(box, entries, selected, iconFor) {
  box.replaceChildren(...entries.map(([name, count]) => el('button', {
    class: 'chip',
    'aria-pressed': String(selected.has(name)),
    style: { '--hue': hueFor(name) },
    onclick: () => { if (selected.has(name)) selected.delete(name); else selected.add(name); render(); },
  }, pixelSvg(iconFor(name), 16), el('span', { text: name }), el('span', { class: 'count', text: String(count) }))));
  if (selected.size) box.append(el('button', { class: 'mini', text: 'clear', onclick: () => { selected.clear(); render(); } }));
}

function fillDatalist(list, defaults, used) {
  const names = [...new Set([...used.filter(Boolean), ...defaults])].sort((a, b) => a.localeCompare(b));
  list.replaceChildren(...names.map((n) => el('option', { value: n })));
}

function groupCard(g) {
  const due = g.list.filter((x) => ['overdue', 'due', 'never'].includes(x.st.key)).length;
  return el('article', { class: 'group', style: g.hue == null ? {} : { '--hue': g.hue } },
    el('header', { class: 'group-head' },
      el('span', { class: 'group-icon' }, pixelSvg(g.icon, 30)),
      el('h2', { text: g.title }),
      due ? el('span', { class: 'pill hot', text: `${due} to do` }) : el('span', { class: 'pill', text: 'all good ✨' })),
    el('ul', { class: 'chores' }, g.list.map(choreRow)));
}

function choreRow({ c, last, st }) {
  const doneToday = last === todayISO();
  const fill = st.key === 'never' ? 1 : st.key === 'whenever' ? 0 : Math.min(1, st.ratio);
  const sub = [view.group !== 'room' && c.room, view.group !== 'type' && c.type, everyText(c.everyDays)].filter(Boolean).join(' · ');
  return el('li', { class: `chore st-${st.key}${['overdue', 'due', 'never'].includes(st.key) ? ' needs-love' : ''}` },
    el('button', { class: 'chore-main', onclick: () => openEditor(c), 'aria-label': `Edit ${c.name}` },
      el('span', { class: 'chore-icon', style: { '--hue': hueFor(typeName(c)) } }, pixelSvg(typeIcon(c.type, c.name), 26)),
      el('span', { class: 'chore-text' },
        el('span', { class: 'chore-name', text: c.name }),
        el('span', { class: 'chore-sub', text: sub }),
        meterRow(c, st, fill)),
      el('span', { class: 'chore-when' },
        el('span', { class: `pill st-${st.key}`, text: st.label }),
        el('span', { class: 'ago', text: last ? `done ${agoText(Math.max(0, st.days))}` : '' }))),
    el('button', {
      class: `done-btn${doneToday ? ' is-done' : ''}`,
      title: doneToday ? 'done today (tap to undo)' : 'mark done today',
      'aria-label': doneToday ? `${c.name} done today, tap to undo` : `Mark ${c.name} done today`,
      onclick: (e) => toggleDoneToday(c, e.currentTarget),
    }, pixelSvg('check', 22)));
}

/**
 * meterRow(chore, status, fill) -> HTMLElement|null
 *
 * The bar under a chore: days since it was last done out of its schedule, e.g. "3 of 7 days".
 * It is full on the day the chore is due. Chores with no schedule have no bar.
 */
function meterRow(c, st, fill) {
  if (!c.everyDays) return null;
  const days = st.key === 'never' ? null : Math.max(0, st.days);
  const label = days == null ? 'not done yet' : `${days} of ${c.everyDays} day${c.everyDays === 1 ? '' : 's'}`;
  return el('span', { class: `meter-row${fill >= 1 ? ' meter-full' : ''}`, title: 'days since you last did it, out of how often it repeats' },
    el('span', { class: 'meter', 'aria-hidden': 'true' }, el('span', { class: 'meter-fill', style: { '--fill': fill.toFixed(3) } })),
    el('span', { class: 'meter-label', text: label }));
}

// ── Marking chores done ────────────────────────────────────────────────

function toggleDoneToday(chore, button) {
  const today = todayISO();
  const mine = data.history.filter((h) => h.choreId === chore.id && h.date === today);
  if (mine.length) {
    commit({ ...data, history: data.history.filter((h) => !mine.includes(h)) });
    toast(`unmarked "${chore.name}"`, () => commit({ ...data, history: [...data.history, ...mine] }));
    return;
  }
  sparkle(button);
  floatText(button, `+${EXP_PER_CHORE} EXP`, 'exp');
  const before = levelInfo(data.history.length);
  const entry = { id: newId(), choreId: chore.id, date: today };
  commit({ ...data, history: [...data.history, entry] });
  toast(`"${chore.name}" done ✓`, () => commit({ ...data, history: data.history.filter((h) => h.id !== entry.id) }));

  const after = levelInfo(data.history.length);
  const doneToday = data.history.filter((h) => h.date === today).length;
  const last = lastDoneMap(data);
  const allClean = data.chores.every((c) => !['overdue', 'due', 'never'].includes(choreStatus(c, last.get(c.id) || '').key));
  if (after.level > before.level) {
    levelUpBanner(after.level, after.title);
    bun.say([`LEVEL UP!! Lv. ${after.level}!`, `You're a ${after.title} now!`, cheerLines({ doneToday, allClean })[1]], { big: true });
  } else {
    bun.say(cheerLines({ doneToday, allClean }), { big: allClean });
  }
}

/** A little burst of pastel pixels from a button. */
function sparkle(from) {
  if (calm() || !from) return;
  const r = from.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
    const d = 30 + Math.random() * 30;
    const p = el('span', {
      class: 'burst',
      style: {
        left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`,
        '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, '--c': ['#ff8fb8', '#c3a4ff', '#ffd6e6', '#ffe08a'][i % 4],
      },
    });
    document.body.append(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

// ── Editor ─────────────────────────────────────────────────────────────

const editor = $('editor');
const form = $('editor-form');
let editing = null;   // chore being edited, or null for a new one
let draftHistory = []; // history rows for this chore while the editor is open

function openEditor(chore = null) {
  editing = chore;
  $('editor-title').textContent = chore ? 'Edit chore' : 'New chore';
  form.name.value = chore?.name || '';
  form.room.value = chore?.room ?? ([...view.rooms][0] || '');
  form.type.value = chore?.type ?? ([...view.types][0] || '');
  form.every.value = chore?.everyDays || (chore ? '' : 7);
  form.notes.value = chore?.notes || '';
  form.doneDate.value = todayISO();
  form.doneDate.max = todayISO();
  draftHistory = chore ? data.history.filter((h) => h.choreId === chore.id) : [];
  $('done-add').textContent = chore ? '✓ log it' : '✓ add';
  $('history-title').textContent = chore ? 'Done on' : 'Already done it? When?';
  $('editor-delete').hidden = !chore;
  drawEditorIcons();
  drawHistory();
  editor.showModal();
  if (!chore) form.name.focus();
}

function drawEditorIcons() {
  const box = $('editor-icons');
  box.replaceChildren(
    el('span', {}, pixelSvg(roomIcon(form.room.value), 28), el('small', { text: form.room.value || ROOMLESS })),
    el('span', {}, pixelSvg(typeIcon(form.type.value, form.name.value), 28), el('small', { text: form.type.value || TYPELESS })),
  );
}

function drawHistory() {
  const list = $('history-list');
  const sorted = [...draftHistory].sort((a, b) => b.date.localeCompare(a.date));
  list.replaceChildren(...sorted.map((h) => el('li', {},
    el('span', { text: formatDate(h.date) }),
    el('button', {
      type: 'button', class: 'mini', text: 'remove', 'aria-label': `Remove ${formatDate(h.date)}`,
      onclick: () => { draftHistory = draftHistory.filter((x) => x !== h); drawHistory(); },
    }))));
  if (!sorted.length) list.append(el('li', { class: 'muted', text: 'not logged yet' }));
}

['input', 'change'].forEach((ev) => form.addEventListener(ev, (e) => {
  if (['room', 'type', 'name'].includes(e.target.name)) drawEditorIcons();
}));
$('quick-every').addEventListener('click', (e) => {
  const b = e.target.closest('[data-days]');
  if (b) form.every.value = b.dataset.days;
});
$('done-add').addEventListener('click', () => {
  const d = form.doneDate.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  if (d > todayISO()) { toast('that date is in the future'); return; }
  if (draftHistory.some((h) => h.date === d)) return;
  draftHistory.push({ id: newId(), choreId: editing?.id || '', date: d });
  drawHistory();
});

editor.addEventListener('close', () => {
  if (editor.returnValue !== 'save') return;
  const name = form.name.value.trim();
  if (!name) return;
  const every = Number(form.every.value);
  const chore = {
    id: editing?.id || newId(),
    name,
    room: form.room.value.trim(),
    type: form.type.value.trim(),
    everyDays: Number.isInteger(every) && every > 0 ? every : 0,
    notes: form.notes.value,
  };
  const history = [...data.history.filter((h) => h.choreId !== chore.id), ...draftHistory.map((h) => ({ ...h, choreId: chore.id }))];
  const chores = editing ? data.chores.map((c) => (c.id === chore.id ? chore : c)) : [...data.chores, chore];
  commit({ ...data, chores, history });
  toast(editing ? 'saved' : `added "${name}"`);
});

$('editor-delete').addEventListener('click', async () => {
  if (!editing) return;
  const chore = editing;
  const ok = await askYesNo(`Delete "${chore.name}" and its history?`);
  if (!ok) return;
  editor.close('cancel');
  const gone = data.history.filter((h) => h.choreId === chore.id);
  commit({ ...data, chores: data.chores.filter((c) => c.id !== chore.id), history: data.history.filter((h) => h.choreId !== chore.id) });
  toast(`deleted "${chore.name}"`, () => commit({ ...data, chores: [...data.chores, chore], history: [...data.history, ...gone] }));
});

// ── Small dialogs and the toast ─────────────────────────────────────────

const askDialog = $('ask-dialog');
function askYesNo(message, yes = 'yes', no = 'no') {
  askDialog.querySelector('.ask-message').textContent = message;
  askDialog.querySelector('[value=yes]').textContent = yes;
  askDialog.querySelector('[value=no]').textContent = no;
  askDialog.returnValue = '';
  askDialog.showModal();
  return new Promise((resolve) => askDialog.addEventListener('close', () => resolve(askDialog.returnValue === 'yes'), { once: true }));
}

let toastTimer = null;
function toast(message, undo = null) {
  const t = $('toast');
  t.querySelector('.toast-text').textContent = message;
  const b = t.querySelector('.toast-undo');
  b.hidden = !undo;
  b.onclick = undo ? () => { undo(); t.classList.remove('show'); } : null;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), undo ? 6000 : 3500);
}

// ── Sync ───────────────────────────────────────────────────────────────

const syncBtn = $('sync-status');
const syncMenu = $('sync-menu');
const STATUS_TEXT = {
  local: 'connect Google Sheets', reconnect: 'reconnect Google', syncing: 'syncing…',
  synced: 'synced', offline: 'offline, retrying', paused: 'sync paused',
};

const sync = createSync({
  getData: () => data,
  applyData: (d) => { data = normalizeData(d); saveStore(data); render(); },
  onStatus: (status, detail) => {
    syncBtn.dataset.status = status;
    syncBtn.dataset.detail = detail || '';
    syncBtn.querySelector('.sync-label').textContent = STATUS_TEXT[status] || status;
    syncBtn.title = detail || '';
    showSheetLink();
  },
  ask: (message) => askYesNo(message),
  notify: (message) => toast(message),
});

function showSheetLink() {
  const id = sync.sheetId();
  const link = $('sheet-link');
  link.hidden = !id || !sync.linked();
  if (id) link.href = sheetUrl(id);
}

syncBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const status = syncBtn.dataset.status;
  if (status === 'local' || status === 'reconnect') sync.connectNow();
  else if (status === 'offline' || status === 'paused') {
    if (syncBtn.dataset.detail) toast(`retrying… last problem: ${syncBtn.dataset.detail}`);
    sync.syncNow();
  } else if (status === 'synced') syncMenu.hidden = !syncMenu.hidden;
});
document.addEventListener('click', (e) => { if (!syncMenu.contains(e.target)) syncMenu.hidden = true; });
$('sync-now').addEventListener('click', () => { syncMenu.hidden = true; sync.syncNow(); });
$('sync-off').addEventListener('click', async () => {
  syncMenu.hidden = true;
  if (await askYesNo('Disconnect from Google? Your chores stay in this browser and in your sheet.', 'disconnect', 'cancel')) sync.stop();
});
$('sync-erase').addEventListener('click', async () => {
  syncMenu.hidden = true;
  if (sync.hasUnsynced()) { toast('some changes have not reached your sheet yet; sync first, then erase'); return; }
  const ok = await askYesNo('Disconnect and erase the copy of your chores saved in this browser? Your Google Sheet is not touched.', 'erase', 'cancel');
  if (!ok) return;
  sync.stop();
  eraseStore();
  forgetSheetId();
  data = emptyStore();
  render();
  showSheetLink();
  toast('this browser\'s copy was erased; your sheet is safe in Google Drive');
});

// ── Controls ───────────────────────────────────────────────────────────

$('add-chore').addEventListener('click', () => openEditor());
$('empty-add').addEventListener('click', () => openEditor());
$('empty-starter').addEventListener('click', () => {
  const s = starterChores();
  commit({ ...data, chores: [...data.chores, ...s.chores], history: [...data.history, ...s.history] });
  toast('added some starter chores; edit or delete any of them');
});
$('search').addEventListener('input', (e) => { view.query = e.target.value; render(); });
document.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
  view.group = b.dataset.group;
  try { localStorage.setItem('hsh_group', view.group); } catch (e) {}
  render();
}));
$('about-open').addEventListener('click', () => $('about').showModal());

const themeBtn = $('theme-toggle');
function drawThemeBtn() {
  themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀︎' : '☾';
}
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('hsh_theme', next); } catch (e) {}
  drawThemeBtn();
});
drawThemeBtn();

$('logo').append(pixelSvg('house', 40));
const bun = createBun($('bun-spot'), document.body);
bun.setIdleLine(() => {
  const last = lastDoneMap(data);
  const due = data.chores.filter((c) => ['overdue', 'due', 'never'].includes(choreStatus(c, last.get(c.id) || '').key)).length;
  const today = data.history.filter((h) => h.date === todayISO()).length;
  if (!data.chores.length) return ['hi, I\'m Bun!', 'Add a chore and I\'ll cheer you on!'];
  if (!due) return ['hi hi!', 'Everything is sparkly! Wanna rest with me?'];
  return ['hi hi!', `${due} ${due === 1 ? 'chore could' : 'chores could'} use some love.`, today ? `You've done ${today} today already!` : 'You got this! 💪'];
});
// Drifting pixel clouds behind everything.
const sky = $('sky');
[[8, 120, 70], [22, 80, 95], [40, 150, 120], [62, 96, 80], [78, 130, 140]].forEach(([top, size, secs], i) => {
  sky.append(el('span', { class: 'cloud', style: { top: `${top}%`, '--secs': `${secs}s`, '--delay': `${-i * secs / 2.3}s` } }, pixelSvg('cloud', size)));
});
const mapToggle = $('map-toggle');
function showMap(on) {
  $('house').hidden = !on;
  mapToggle.textContent = on ? 'hide map' : 'show map';
  try { localStorage.setItem('hsh_map', on ? '1' : '0'); } catch (e) {}
}
mapToggle.addEventListener('click', () => showMap($('house').hidden));
let mapPref = '1';
try { mapPref = localStorage.getItem('hsh_map') ?? '1'; } catch (e) {}
showMap(mapPref !== '0');
document.querySelector('.welcome-logo').append(pixelSvg('house', 64));
$('empty').querySelector('.empty-icon').append(pixelSvg('broom', 56));

// Redraw at midnight-ish and whenever the tab comes back, so "days ago" stays right.
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(render, 10 * 60 * 1000);

// ── Start ──────────────────────────────────────────────────────────────

const welcome = $('welcome');
async function enter(withGoogle) {
  if (withGoogle && !(await sync.signIn())) return;
  try { localStorage.setItem('hsh_entered', '1'); } catch (e) {}
  data = loadStore();
  welcome.hidden = true;
  render();
  if (withGoogle) await sync.syncNow();
}

sync.start();
let entered = false;
try { entered = localStorage.getItem('hsh_entered') === '1'; } catch (e) {}
if (entered) {
  data = loadStore();
  render();
  if (sync.linked()) {
    // Google needs a click to hand out a sign-in token, so returning users get one button.
    welcome.querySelector('.welcome-title').textContent = 'Welcome home';
    welcome.querySelector('.welcome-signin').textContent = 'continue with Google';
    welcome.hidden = false;
  }
} else {
  render();
  welcome.hidden = false;
}
welcome.querySelector('.welcome-signin').addEventListener('click', () => enter(true));
welcome.querySelector('.welcome-offline').addEventListener('click', () => enter(false));
