// Pure builder logic: reorder, shuffle, undo/redo, share links, bag edits. No DOM access.
import { TOMATOES, CLASPS, COLORS, TYPES, bead } from "./catalog.js";
import { validDesign, clone, encodeDesign, decodeDesign } from "./core.js";

// Move one bead within its strand. Always returns a fresh design; bad indices change nothing.
export function moveBead(design, strand, from, to) {
  const next = clone(design);
  const s = next.strands[strand];
  const ok = (i) => Number.isInteger(i) && i >= 0 && s && i < s.length;
  if (!ok(from) || !ok(to) || from === to) return { design: next, index: from };
  s.splice(to, 0, s.splice(from, 1)[0]);
  return { design: next, index: to };
}

// A random but always valid design. `accept` lets live mode skip sold-out components.
export function randomDesign(
  rand = Math.random,
  accept = () => true,
  tries = 40,
) {
  const pick = (list) =>
    list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const count = (lo, hi) =>
    lo + Math.min(hi - lo, Math.floor(rand() * (hi - lo + 1)));
  for (let n = 0; n < tries; n++) {
    const clasp = pick(CLASPS);
    const d = {
      tomato: pick(TOMATOES).id,
      tomatoSize: clasp.tomatoSize,
      clasp: clasp.id,
      strands: Array.from({ length: count(1, 3) }, () =>
        Array.from({ length: count(1, clasp.maxBeads) }, () =>
          bead(pick(COLORS).id, pick(TYPES).id),
        ),
      ),
    };
    if (validDesign(d) && accept(d)) return d;
  }
  return null;
}

// Undo/redo as immutable snapshots. Identical consecutive designs are not recorded.
export const createHistory = (present, limit = 60) => ({
  past: [],
  present: clone(present),
  future: [],
  limit,
});
export function commit(h, next) {
  if (JSON.stringify(h.present) === JSON.stringify(next)) return h;
  return {
    ...h,
    past: [...h.past, h.present].slice(-h.limit),
    present: clone(next),
    future: [],
  };
}
export const canUndo = (h) => h.past.length > 0;
export const canRedo = (h) => h.future.length > 0;
export const undo = (h) =>
  canUndo(h)
    ? {
        ...h,
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      }
    : h;
export const redo = (h) =>
  canRedo(h)
    ? {
        ...h,
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;

// Share links reuse the design code defined in core.js.
export { encodeDesign, decodeDesign };
export const designHash = (d) => "#design=" + encodeDesign(d);
export function designFromHash(hash) {
  const m = /^#design=([A-Za-z0-9.~+-]{1,400})$/.exec(hash || "");
  return m ? decodeDesign(m[1]) : null;
}

// Replace the design of one custom bag item, keeping its id and quantity.
// Returns the same array when nothing matched, so callers can compare by reference.
export function replaceCustomDesign(cart, id, design) {
  if (!validDesign(design))
    throw new Error(
      "Choose a tomato, 1–3 strands with a clasp-appropriate number of beads each, and a clasp.",
    );
  let changed = false;
  const next = cart.map((i) => {
    if (i.id === id && i.kind === "custom") {
      changed = true;
      return { ...i, design: clone(design) };
    }
    return i;
  });
  return changed ? next : cart;
}
