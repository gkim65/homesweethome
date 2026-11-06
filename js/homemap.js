// The little house map: one tile per room, glowing pink when chores there are due.

import { el } from './dom.js';
import { hueFor, pixelSvg, roomIcon } from './icons.js';

/** Where each kind of room sits in the house (top-left first). */
const ORDER = ['bedroom', 'bathroom', 'office', 'living', 'kitchen', 'laundryroom', 'hallway', 'house', 'plant'];
/** Floor pattern for each kind of room. */
const FLOOR = {
  kitchen: 'tile', bathroom: 'tile', laundryroom: 'tile', bedroom: 'wood', living: 'wood',
  office: 'wood', hallway: 'carpet', plant: 'grass', house: 'wood',
};

/**
 * renderHomeMap(box, rooms, selected, onPick)
 *
 * Draw the rooms of the house.
 *
 *   - `box`      — element that holds the room tiles
 *   - `rooms`    — `[{ name, iconKey, total, due, soon }]`; `iconKey` is the room's text for picking
 *                  an icon ('' for chores with no room)
 *   - `selected` — Set of room names currently picked
 *   - `onPick`   — called with a room name when its tile is clicked
 */
export function renderHomeMap(box, rooms, selected, onPick) {
  const withIcon = rooms.map((r) => ({ ...r, icon: roomIcon(r.iconKey) }));
  withIcon.sort((a, b) => (ORDER.indexOf(a.icon) - ORDER.indexOf(b.icon)) || a.name.localeCompare(b.name));
  if (!withIcon.length) {
    box.replaceChildren(el('p', { class: 'rooms-empty', text: 'Your rooms will appear here once you add chores.' }));
    return;
  }
  box.replaceChildren(...withIcon.map((r) => {
    const state = r.due ? 'due' : r.soon ? 'soon' : 'clean';
    const wide = r.icon === 'hallway' || r.icon === 'plant' || r.total >= 5;
    const picked = selected.has(r.name);
    return el('button', {
      type: 'button',
      class: `room-tile floor-${FLOOR[r.icon] || 'wood'} state-${state}${wide ? ' wide' : ''}${picked ? ' picked' : ''}`,
      style: { '--hue': hueFor(r.name) },
      'aria-pressed': String(picked),
      'aria-label': `${r.name}: ${r.due ? `${r.due} to do` : 'all clean'}. Show its chores.`,
      onclick: () => onPick(r.name),
    },
    el('span', { class: 'room-icon' }, pixelSvg(r.icon, 34)),
    el('span', { class: 'room-name', text: r.name }),
    el('span', { class: 'room-badge', text: r.due ? `${r.due} to do` : r.soon ? `${r.soon} soon` : '✨ clean' }),
    // Dust puffs on rooms that need love, twinkles on clean ones (drawn in CSS).
    el('span', { class: 'fx fx1' }), el('span', { class: 'fx fx2' }), el('span', { class: 'fx fx3' }),
    picked ? el('span', { class: 'here', text: '▼' }) : null);
  }));
}
