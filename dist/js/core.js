import {
  TOMATOES,
  TOMATO_SIZES,
  CLASPS,
  COLORS,
  TYPES,
  PRODUCTS,
  catalogEntries,
  defaultDesign,
  beadName,
} from "./catalog.js";
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const money = (cents, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function validDesignShape(d) {
  return (
    !!d &&
    TOMATOES.some((x) => x.id === d.tomato) &&
    CLASPS.some((x) => x.id === d.clasp) &&
    (d.tomatoSize === undefined ||
      TOMATO_SIZES.some((x) => x.id === d.tomatoSize)) &&
    Array.isArray(d.strands) &&
    d.strands.length >= 1 &&
    d.strands.length <= 3 &&
    d.strands.every(
      (s) =>
        Array.isArray(s) &&
        s.length >= 1 &&
        s.length <= 5 &&
        s.every(
          (b) =>
            b &&
            COLORS.some((c) => c.id === b.color) &&
            (TYPES.some((t) => t.id === b.type) || b.type === "pearl"),
        ),
    )
  );
}
export function validDesign(d) {
  if (!validDesignShape(d)) return false;
  const clasp = CLASPS.find((x) => x.id === d.clasp);
  return (
    (d.tomatoSize === undefined
      ? clasp.tomatoSize === "regular"
      : d.tomatoSize === clasp.tomatoSize) &&
    d.strands.every((s) => s.length <= clasp.maxBeads)
  );
}
export function normalizeDesign(input) {
  if (!input || typeof input !== "object") return null;
  const design = clone(input);
  if (design?.tomato === "love" || design?.tomato === "wink")
    design.tomato = "serious";
  if (!validDesignShape(design)) return null;
  const clasp = CLASPS.find((x) => x.id === design.clasp);
  design.strands = design.strands.map((s) =>
    s.map((b) => (b.type === "pearl" ? { ...b, type: "round" } : b)),
  );
  design.tomatoSize = clasp.tomatoSize;
  design.strands = design.strands.map((s) => s.slice(0, clasp.maxBeads));
  return design;
}
// Compact text form of a design: "v2.<tomato>.<clasp>.<size>.<color>-<type>+...~<next strand>".
// Used for share links and as the machine-readable 'Design code' on every order line.
// Decoding re-validates everything, so a hand-edited or hostile code can only yield a design the builder could make.
const CODE_VERSION = "v2";
export function encodeDesign(d) {
  if (!validDesign(d))
    throw new Error(
      "Choose a tomato, 1–3 strands with a clasp-appropriate number of beads each, and a clasp.",
    );
  return [
    CODE_VERSION,
    d.tomato,
    d.clasp,
    d.tomatoSize || "regular",
    d.strands
      .map((s) => s.map((b) => b.color + "-" + b.type).join("+"))
      .join("~"),
  ].join(".");
}
export function decodeDesign(text) {
  if (typeof text !== "string" || text.length > 400) return null;
  const parts = text.split(".");
  const legacy = parts.length === 4 && parts[0] === "v1";
  if (!legacy && (parts.length !== 5 || parts[0] !== CODE_VERSION)) return null;
  const d = {
    tomato: parts[1],
    clasp: parts[2],
    tomatoSize: legacy ? "regular" : parts[3],
  };
  const strandCode = parts[legacy ? 3 : 4];
  const strands = strandCode.split("~").map((s) =>
    s.split("+").map((b) => {
      const f = b.split("-");
      return f.length === 2 ? { color: f[0], type: f[1] } : null;
    }),
  );
  d.strands = strands;
  return normalizeDesign(d);
}
export function components(d) {
  if (!validDesign(d))
    throw new Error(
      "Choose a tomato, 1–3 strands with a clasp-appropriate number of beads each, and a clasp.",
    );
  const clasp = CLASPS.find((x) => x.id === d.clasp);
  const includedStrands = clasp.includedStrands || 0;
  const includedBeadsPerStrand = clasp.includedBeadsPerStrand || 0;
  const counts = new Map([
    ["assembly", 1],
    ["tomato-size-" + (d.tomatoSize || "regular"), 1],
    ["tomato-" + d.tomato, 1],
    ["clasp-" + d.clasp, 1],
  ]);
  const extraStrands = Math.max(0, d.strands.length - includedStrands);
  if (extraStrands) counts.set("strand", extraStrands);
  d.strands.forEach((s, i) =>
    s.slice(i < includedStrands ? includedBeadsPerStrand : 0).forEach((b) => {
      const k =
        "bead-" + b.color + "-" + (b.type === "pearl" ? "round" : b.type);
      counts.set(k, (counts.get(k) || 0) + 1);
    }),
  );
  return [...counts].map(([key, quantity]) => ({ key, quantity }));
}
export function priceDesign(
  d,
  prices = Object.fromEntries(catalogEntries().map(([k, v]) => [k, v.cents])),
) {
  return components(d).reduce((n, c) => {
    if (!Number.isInteger(prices[c.key]))
      throw new Error("Pricing unavailable for " + c.key);
    return n + prices[c.key] * c.quantity;
  }, 0);
}
export function priceSummary(
  d,
  prices = Object.fromEntries(catalogEntries().map(([k, v]) => [k, v.cents])),
) {
  const designComponents = components(d);
  const amount = (key) => {
    if (!Number.isInteger(prices[key]))
      throw new Error("Pricing unavailable for " + key);
    return prices[key];
  };
  const rows = [
    {
      label: "Starting base",
      amount:
        amount("assembly") +
        amount("tomato-size-" + (d.tomatoSize || "regular")) +
        amount("clasp-" + d.clasp),
    },
  ];
  const mood = amount("tomato-" + d.tomato);
  if (mood > 0) rows.push({ label: "Mood extra", amount: mood });
  const strands = designComponents.find((c) => c.key === "strand");
  if (strands)
    rows.push({
      label: `Extra strands × ${strands.quantity}`,
      amount: amount("strand") * strands.quantity,
    });
  const beads = designComponents.filter((c) => c.key.startsWith("bead-"));
  const beadCount = beads.reduce((count, c) => count + c.quantity, 0);
  if (beadCount)
    rows.push({
      label: `Extra beads × ${beadCount}`,
      amount: beads.reduce((total, c) => total + amount(c.key) * c.quantity, 0),
    });
  return rows;
}
export function describeDesign(d) {
  if (!validDesign(d)) throw new Error("Invalid design");
  const size = TOMATO_SIZES.find((s) => s.id === (d.tomatoSize || "regular"));
  return `${TOMATOES.find((t) => t.id === d.tomato).name} tomato (${size.name}); ${d.strands.map((s, i) => `strand ${i + 1} (top to bottom): ${s.map((b) => beadName(b.color, b.type === "pearl" ? "round" : b.type)).join(", ")}`).join("; ")}; one included cream star bead on the side; ${CLASPS.find((c) => c.id === d.clasp).name}`;
}
export function itemComponents(item) {
  if (item.kind === "ready" && PRODUCTS.some((p) => p.id === item.productId))
    return [{ key: "product-" + item.productId, quantity: 1 }];
  if (item.kind === "custom") return components(item.design);
  throw new Error("Invalid bag item");
}
export function sanitizeCart(input, { normalizeDesigns = true } = {}) {
  if (!Array.isArray(input)) return [];
  const ids = new Set();
  return input
    .slice(0, 20)
    .map((x) => {
      if (normalizeDesigns && x?.kind === "custom")
        return { ...x, design: normalizeDesign(x.design) };
      return x;
    })
    .filter((x) => {
      if (
        !x ||
        typeof x.id !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(x.id) ||
        ids.has(x.id) ||
        !Number.isInteger(x.quantity) ||
        x.quantity < 1 ||
        x.quantity > 10
      )
        return false;
      const valid =
        x.kind === "custom"
          ? validDesign(x.design)
          : x.kind === "ready" && PRODUCTS.some((p) => p.id === x.productId);
      if (valid) ids.add(x.id);
      return valid;
    })
    .map((x) =>
      x.kind === "custom"
        ? {
            id: x.id,
            kind: x.kind,
            quantity: x.quantity,
            design: {
              ...clone(x.design),
              tomatoSize: x.design.tomatoSize || "regular",
            },
          }
        : {
            id: x.id,
            kind: x.kind,
            quantity: x.quantity,
            productId: x.productId,
          },
    );
}
export function restoreDesign(input) {
  return normalizeDesign(input) || defaultDesign();
}
export function makeCartLines(cart, variants) {
  const safe = sanitizeCart(cart);
  if (!safe.length || safe.length !== cart.length)
    throw new Error("Your bag needs to be refreshed.");
  const lines = [];
  safe.forEach((item) => {
    const d =
      item.kind === "custom"
        ? item.design
        : PRODUCTS.find((p) => p.id === item.productId).design;
    itemComponents(item).forEach((c) => {
      const merchandiseId = variants[c.key];
      if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(merchandiseId || ""))
        throw new Error("This item is not connected to the shop yet.");
      lines.push({
        merchandiseId,
        quantity: c.quantity * item.quantity,
        attributes: [
          { key: "Charm group", value: item.id },
          { key: "Charm quantity", value: String(item.quantity) },
          { key: "Design", value: describeDesign(d) },
          { key: "Design code", value: encodeDesign(d) },
          { key: "Component", value: c.key },
        ],
      });
    });
  });
  if (lines.length > 250) throw new Error("Please place a smaller order.");
  return lines;
}
