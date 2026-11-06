// The chore list: its shape, dates, status, and saving it in this browser (localStorage).
//
// A chore is { id, name, room, type, everyDays, notes }. Every time you do one, a row is added to
// `history` ({ id, choreId, date }); "last done" is always the newest history date for that chore.

const KEY = 'hsh_data';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A fresh, empty home. */
export function emptyStore() {
  return { version: 1, chores: [], history: [] };
}

/** A unique id for a new chore or history row. */
export function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Today's (or `d`'s) local calendar date as `YYYY-MM-DD`. */
export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * daysSince(isoDate, today) -> number
 *
 * Whole calendar days from `isoDate` to today; Infinity when `isoDate` is empty.
 */
export function daysSince(isoDate, today = new Date()) {
  if (!isoDate) return Infinity;
  const [y, m, d] = isoDate.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - then) / MS_PER_DAY);
}

/**
 * lastDoneMap(data) -> Map<choreId, isoDate>
 *
 * The newest history date of every chore that has been done at least once.
 */
export function lastDoneMap(data) {
  const out = new Map();
  data.history.forEach((h) => { if (!out.has(h.choreId) || h.date > out.get(h.choreId)) out.set(h.choreId, h.date); });
  return out;
}

/**
 * choreStatus(chore, lastDone, today) -> { key, label, days, ratio }
 *
 * How due a chore is.
 *
 *   - `key`   — 'never' (never done), 'overdue', 'due' (due today), 'soon' (within the last
 *               quarter of its schedule), 'fresh', or 'whenever' (no schedule set)
 *   - `days`  — days since it was last done (Infinity if never)
 *   - `ratio` — days / everyDays (0 just done, 1 due), Infinity if never, 0 with no schedule
 */
export function choreStatus(chore, lastDone, today = new Date()) {
  const days = daysSince(lastDone, today);
  const every = chore.everyDays;
  if (!every) return { key: 'whenever', label: 'whenever', days, ratio: 0 };
  if (!lastDone) return { key: 'never', label: 'never done', days, ratio: Infinity };
  const ratio = Math.max(0, days) / every;
  if (days > every) return { key: 'overdue', label: `${days - every}d overdue`, days, ratio };
  if (days === every) return { key: 'due', label: 'due today', days, ratio };
  const left = every - days;
  if (ratio >= 0.75 || left <= 1) return { key: 'soon', label: left === 1 ? 'due tomorrow' : `due in ${left}d`, days, ratio };
  return { key: 'fresh', label: `due in ${left}d`, days, ratio };
}

/** "today", "yesterday", "5 days ago", "never". */
export function agoText(days) {
  if (days === Infinity) return 'never';
  if (days < 0) return 'in the future';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** "every day", "every week", "every 10 days", or "no schedule". */
export function everyText(n) {
  if (!n) return 'no schedule';
  if (n === 1) return 'every day';
  if (n === 7) return 'every week';
  if (n === 14) return 'every 2 weeks';
  if (n === 30 || n === 31) return 'every month';
  if (n % 7 === 0) return `every ${n / 7} weeks`;
  return `every ${n} days`;
}

/** Friendly date, e.g. "Nov 6, 2026", in the viewer's locale. */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Coerce one stored chore into the expected shape. */
function normalizeChore(c) {
  const every = Number(c.everyDays);
  return {
    id: String(c.id),
    name: String(c.name ?? '').trim() || 'untitled chore',
    room: String(c.room ?? '').trim(),
    type: String(c.type ?? '').trim(),
    everyDays: Number.isInteger(every) && every > 0 ? Math.min(every, 3650) : 0,
    notes: String(c.notes ?? ''),
  };
}

/**
 * normalizeData(d) -> object
 *
 * Coerce a whole home into `emptyStore` shape. History rows for chores that no longer exist, or
 * with unreadable dates, are dropped; duplicate ids keep their first row.
 */
export function normalizeData(d) {
  const seen = new Set();
  const chores = (Array.isArray(d?.chores) ? d.chores : [])
    .filter((c) => c && c.id != null && c.id !== '' && !seen.has(String(c.id)) && seen.add(String(c.id)))
    .map(normalizeChore);
  const ids = new Set(chores.map((c) => c.id));
  const seenH = new Set();
  const history = (Array.isArray(d?.history) ? d.history : [])
    .filter((h) => h && ids.has(String(h.choreId)) && ISO.test(h.date ?? ''))
    .map((h) => ({ id: String(h.id ?? newId()), choreId: String(h.choreId), date: h.date }))
    .filter((h) => !seenH.has(h.id) && seenH.add(h.id));
  return { version: 1, chores, history };
}

/**
 * loadStore() -> object
 *
 * Read the saved home from this browser, or an empty one when nothing is saved.
 *
 * NOTE: unreadable saved data is copied to `hsh_data_unreadable` first, so the next save cannot
 * silently destroy it.
 */
export function loadStore() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { return emptyStore(); }
  if (!raw) return emptyStore();
  try {
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.chores)) throw new Error('bad shape');
    return normalizeData(d);
  } catch (e) {
    try { localStorage.setItem(`${KEY}_unreadable`, raw); } catch (e2) {}
    return emptyStore();
  }
}

/** Write the whole home to this browser. Returns false when storage is full or blocked. */
export function saveStore(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

/** Remove this browser's copy (used by "disconnect and erase"). */
export function eraseStore() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('hsh_') && k !== 'hsh_theme').forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}

/** A few everyday chores to start from, spread over the last couple of weeks. */
export function starterChores() {
  const list = [
    ['Wash the dishes', 'Kitchen', 'Dishes', 1],
    ['Wipe the counters', 'Kitchen', 'Wiping', 3],
    ['Mop the kitchen floor', 'Kitchen', 'Mopping', 7],
    ['Take out the trash', 'Kitchen', 'Trash', 3],
    ['Change the bed sheets', 'Bedroom', 'Bedding', 14],
    ['Vacuum the bedroom', 'Bedroom', 'Vacuuming', 7],
    ['Do the laundry', 'Bedroom', 'Laundry', 7],
    ['Scrub the toilet', 'Bathroom', 'Scrubbing', 7],
    ['Clean the mirror', 'Bathroom', 'Windows & mirrors', 14],
    ['Sweep the hallway', 'Hallway', 'Sweeping', 7],
    ['Dust the shelves', 'Living room', 'Dusting', 14],
    ['Clean the windows', 'Living room', 'Windows & mirrors', 30],
    ['Water the plants', 'Living room', 'Plants', 4],
  ];
  const back = [0, 2, 9, 1, 6, 3, 8, 12, 5, 4, 20, 10, 5];
  const chores = [];
  const history = [];
  list.forEach(([name, room, type, everyDays], i) => {
    const id = newId();
    chores.push({ id, name, room, type, everyDays, notes: '' });
    const d = new Date();
    d.setDate(d.getDate() - back[i]);
    history.push({ id: newId(), choreId: id, date: todayISO(d) });
  });
  return { chores, history };
}

/** EXP for each chore done. */
export const EXP_PER_CHORE = 10;
const TITLES = ['Dust Bunny Rookie', 'Tidy Sprout', 'Bubble Apprentice', 'Broom Knight', 'Mop Mage',
  'Suds Sorcerer', 'Sparkle Ranger', 'Cozy Guardian', 'Home Hero', 'Legend of Sparkle'];

/**
 * levelInfo(doneCount) -> { level, title, exp, need, pct }
 *
 * Your level from how many times you have done any chore (each is EXP_PER_CHORE). Level 1 → 2
 * takes 3 chores, then each level takes 2 more than the last.
 *
 *   - `exp`/`need` — EXP into the current level, and EXP needed to finish it
 *   - `pct`        — exp / need, 0–1
 */
export function levelInfo(doneCount) {
  let exp = Math.max(0, doneCount) * EXP_PER_CHORE;
  let level = 1;
  let need = 30;
  while (exp >= need) { exp -= need; level += 1; need = 30 + 20 * (level - 1); }
  return { level, title: TITLES[Math.min(level - 1, TITLES.length - 1)], exp, need, pct: exp / need };
}
