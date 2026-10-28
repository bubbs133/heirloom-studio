import { ARTWORK, COLORS, TOMATOES, TOMATO_SIZES } from "./catalog.js";
import { escapeHTML, describeDesign } from "./core.js";
let serial = 0;
export const star = (x, y, r = 12, fill = "#d6a849") =>
  `<path d="M0,-${r} L${r * 0.28},-${r * 0.28} ${r},0 ${r * 0.28},${r * 0.28} 0,${r} -${r * 0.28},${r * 0.28} -${r},0 -${r * 0.28},-${r * 0.28}Z" transform="translate(${x} ${y})" fill="${fill}"/>`;
export function tomato(expression = "smile", uid = "t", image = "") {
  if (image)
    return `<image href="${escapeHTML(image)}" x="-77" y="-77" width="154" height="154" preserveAspectRatio="xMidYMid meet"/>`;
  const eyes =
    expression === "sleepy"
      ? '<path d="M-26 7q8 8 16 0M10 7q8 8 16 0" fill="none" stroke="#53332c" stroke-width="3.5" stroke-linecap="round"/>'
      : expression === "love"
        ? '<path d="M-19 16l-9-9c-8-9 5-14 9-6 5-8 17-3 9 6ZM19 16l-9-9c-8-9 5-14 9-6 5-8 17-3 9 6Z" fill="#582d2e"/>'
        : `<ellipse cx="-19" cy="8" rx="3.5" ry="5" fill="#53332c"/>${expression === "wink" ? '<path d="M13 9q6-6 12 0" fill="none" stroke="#53332c" stroke-width="3.5" stroke-linecap="round"/>' : '<ellipse cx="19" cy="8" rx="3.5" ry="5" fill="#53332c"/>'}`;
  return `<defs><radialGradient id="${uid}" cx="30%" cy="22%" r="82%"><stop stop-color="#f57858"/><stop offset=".55" stop-color="#e54f3b"/><stop offset="1" stop-color="#c9342d"/></radialGradient></defs><path d="M0-44C-32-70-77-41-72 4c2 41 34 60 72 58 38 2 70-17 72-58C77-41 32-70 0-44Z" fill="url(#${uid})"/><path d="M-42-27q-13 9-15 24" stroke="#ffb19a" stroke-width="8" opacity=".6" fill="none" stroke-linecap="round"/><ellipse cx="-33" cy="22" rx="10" ry="5" fill="#fba292" opacity=".6"/><ellipse cx="33" cy="22" rx="10" ry="5" fill="#fba292" opacity=".6"/>${eyes}<path d="M-7 23q7 9 14 0" stroke="#53332c" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M0-39l-28-14 24 1-5-24 16 19 20-13-11 25 26 6-31 6-17 13Z" fill="#4a7145"/><path d="M2-43q-3-17 6-26" stroke="#3c633c" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}
export function beadArt(b, x = 0, y = 0, r = 15, image = "") {
  if (image) {
    const clipId = "bead-" + ++serial;
    const clipShape =
      b.type === "star"
        ? '<path d="M0-18l5 11 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1Z"/>'
        : b.type === "flower"
          ? '<g>' +
            [0, 60, 120, 180, 240, 300]
              .map((a) => `<ellipse cy="-9" rx="8" ry="10" transform="rotate(${a})"/>`)
              .join("") +
            "</g>"
          : `<circle r="${r}"/>`;
    return `<defs><clipPath id="${clipId}">${clipShape}</clipPath></defs><g transform="translate(${x} ${y})"><image href="${escapeHTML(image)}" x="-20" y="-20" width="40" height="40" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/></g>`;
  }
  const c = COLORS.find((c) => c.id === b.color)?.hex || "#f4dfab";
  let shape =
    b.type === "star"
      ? `<path d="M0-18l5 11 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1Z" fill="${c}" stroke="#735338" stroke-opacity=".13"/>`
      : b.type === "flower"
        ? `<g fill="${c}" stroke="#735338" stroke-opacity=".1">${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cy="-9" rx="8" ry="10" transform="rotate(${a})"/>`).join("")}</g><circle r="6" fill="#fff2c5"/>`
        : `<circle r="${r}" fill="${c}" stroke="#735338" stroke-opacity=".12"/>`;
  return `<g transform="translate(${x} ${y})">${shape}<ellipse cx="-5" cy="-6" rx="4" ry="2.5" fill="white" opacity="${b.type === "pearl" ? ".8" : ".45"}"/><circle r="2" fill="#785d4c" opacity=".25"/></g>`;
}
export function claspArt(type) {
  const metal = 'stroke="#b79b68" stroke-width="5" fill="none"';
  if (type === "phone")
    return '<path d="M0 70C-55 0 55 0 0 70Z" stroke="#9b7460" stroke-width="4" fill="none"/><rect x="-9" y="58" width="18" height="19" rx="5" fill="#b79b68"/>';
  const dust = (head) =>
    `<path d="M0 22v35" ${metal}/>${head}<rect x="-11" y="43" width="22" height="15" rx="4" fill="#8e775d"/><circle cy="68" r="9" ${metal}/>`;
  if (type === "dust-usbc")
    return dust(
      '<rect x="-7" y="12" width="14" height="32" rx="7" fill="#b79b68"/><rect x="-2.5" y="18" width="5" height="20" rx="2.5" fill="#8e775d" opacity=".55"/>',
    );
  if (type === "dust-lightning")
    return dust(
      '<path d="M-7 16l3-4h8l3 4v28h-14Z" fill="#b79b68"/><path d="M-3.5 22v14M0 22v14M3.5 22v14" stroke="#8e775d" stroke-width="1.6" opacity=".6"/>',
    );
  if (type === "lobster")
    return `<path d="M-15 56V35a15 15 0 0130 0v21a15 15 0 01-30 0Z" ${metal}/><path d="M9 32v24" stroke="#f4dfb7" stroke-width="3"/><circle cy="79" r="10" ${metal}/>`;
  return `<circle cy="40" r="26" ${metal}/><path d="M20 22a25 25 0 00-35 36" stroke="#efdcaf" stroke-width="2.5" fill="none"/><circle cy="78" r="10" ${metal}/>`;
}
export function charmSVG(
  d,
  {
    className = "",
    decorations = false,
    selected = null,
    interactive = false,
    artwork = ARTWORK,
  } = {},
) {
  const id = "art-" + ++serial;
  const n = d.strands.length;
  const max = Math.max(...d.strands.map((s) => s.length));
  // selected=[strand,bead] draws a dashed ring; interactive adds an invisible tap target per bead (data-bead="strand,bead").
  const marks = (i, j, x, y) =>
    (selected && selected[0] === i && selected[1] === j
      ? `<circle class="bead-ring" cx="${x}" cy="${y}" r="21" fill="none" stroke="#bb3d30" stroke-width="2.5" stroke-dasharray="4 4"/>`
      : "") +
    (interactive
      ? `<circle class="bead-hit" data-bead="${i},${j}" cx="${x}" cy="${y}" r="17" fill="transparent"/>`
      : "");
  const stems = d.strands
    .map((s, i) => {
      const x = (i - (n - 1) / 2) * 55;
      return `<path d="M0 90Q${x} 87 ${x} 112V${112 + (s.length - 1) * 34 + 24}" stroke="#c1a373" stroke-width="2" fill="none"/>${s.map((b, j) => beadArt(b, x, 116 + j * 34, 15, artwork.beads?.[`${b.color}-${b.type}`]) + marks(i, j, x, 116 + j * 34)).join("")}<circle cx="${x}" cy="${112 + (s.length - 1) * 34 + 24}" r="4" fill="#b79b68"/>`;
    })
    .join("");
  const end = 112 + (max - 1) * 34 + 24;
  const character = TOMATOES.find((t) => t.id === d.tomato);
  const sizeScale = TOMATO_SIZES.find((s) => s.id === (d.tomatoSize || "regular"))?.scale || 1;
  return `<svg class="charm-art ${className}" viewBox="0 0 420 470" role="img" aria-label="${escapeHTML(describeDesign(d))}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="shadow-${id}" x="-60%" y="-50%" width="220%" height="230%"><feDropShadow dx="3" dy="9" stdDeviation="6" flood-color="#76513a" flood-opacity=".17"/></filter></defs>${decorations ? star(55, 130, 17) + star(355, 275, 24) + star(340, 65, 9) : ""}<g transform="translate(210 18)" filter="url(#shadow-${id})">${claspArt(d.clasp)}${stems}<path d="M0 ${end}v21" stroke="#b79b68" stroke-width="3"/><circle cy="${end + 27}" r="8" stroke="#b79b68" stroke-width="4" fill="none"/><g transform="translate(0 ${end + 82}) scale(${sizeScale})">${tomato(character?.expression, id, artwork.tomatoes?.[d.tomato])}</g></g></svg>`;
}
export function tomatoIcon(id, size = 75, image = ARTWORK.tomatoes[id]) {
  return `<svg width="${size}" height="${size}" viewBox="-90 -85 180 170" aria-hidden="true">${tomato(TOMATOES.find((t) => t.id === id)?.expression, "icon-" + ++serial, image)}</svg>`;
}
