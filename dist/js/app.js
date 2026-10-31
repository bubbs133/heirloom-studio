import { SHOP } from "./config.js";
import {
  ARTWORK,
  TOMATOES,
  TOMATO_SIZES,
  COLORS,
  TYPES,
  CLASPS,
  PRODUCTS,
  defaultDesign,
  bead,
  beadName,
} from "./catalog.js";
import {
  clone,
  money,
  escapeHTML as esc,
  restoreDesign,
  sanitizeCart,
  priceDesign,
  priceSummary,
  components,
  itemComponents,
  describeDesign,
} from "./core.js";
import { charmSVG, tomatoIcon, beadArt, claspArt } from "./art.js";
import {
  live,
  configured,
  loadPrices,
  createCheckout,
  demoPrices,
} from "./commerce.js";
import {
  moveBead,
  randomDesign,
  createHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  designHash,
  designFromHash,
  replaceCustomDesign,
} from "./builder.js";
const $ = (s) => document.querySelector(s);
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
let storageWarning = false;
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (!storageWarning) {
      toast("Saving is unavailable in this browser. Keep this tab open.");
      storageWarning = true;
    }
  }
};
const saved = restoreDesign(read("lt-design-v1", null)),
  shared = designFromHash(location.hash);
let design = saved,
  cart = sanitizeCart(read("lt-cart-v1", [])),
  step = 0,
  selected = [0, 0],
  hist = createHistory(saved),
  editingId = null;
if (shared) {
  design = clone(shared);
  hist = commit(hist, design);
  step = 3;
}
let prices = { ...demoPrices },
  availability = {},
  liveReady = false,
  busy = false,
  toastTimer;
const fmt = (c) => money(c, SHOP.currency);
const price = (k) => prices[k];
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}
function persist() {
  write("lt-design-v1", design);
  write("lt-cart-v1", cart);
}
const itemDesign = (item) =>
  item.kind === "custom"
    ? item.design
    : PRODUCTS.find((p) => p.id === item.productId).design;
const itemName = (item) =>
  item.kind === "custom"
    ? TOMATOES.find((t) => t.id === item.design.tomato).name + " · Made by you"
    : PRODUCTS.find((p) => p.id === item.productId).name;
const itemPrice = (item) =>
  item.kind === "custom"
    ? priceDesign(item.design, prices)
    : price("product-" + item.productId);
const cartTotal = () =>
  cart.reduce((sum, item) => sum + itemPrice(item) * item.quantity, 0);
const purchasable = (cs) =>
  !live() || (liveReady && cs.every((c) => availability[c.key]));
function refreshBadge() {
  $("#bag-count").textContent = cart.reduce((n, x) => n + x.quantity, 0);
  const modeLabel = $("#mode-label");
  if (modeLabel)
    modeLabel.textContent = live()
      ? liveReady
        ? "THE PATCH IS OPEN · PRICES IN " + SHOP.currency
        : "SHOP CONNECTION PENDING · CHECKOUT UNAVAILABLE"
      : "STOREFRONT PREVIEW · PRICES ARE PLACEHOLDERS";
  const priceNote = $("#builder-price-note");
  if (priceNote)
    priceNote.textContent = live()
      ? "Prices in " + SHOP.currency + " · shipping & tax at checkout"
      : "Placeholder " +
        SHOP.currency +
        " pricing · shipping & tax not included";
  if (liveReady && $("#order-faq"))
    $("#order-faq").textContent =
      "Build a custom charm or choose a ready-made, add it to your bag, and continue to Shopify’s hosted checkout. Final availability, shipping and taxes are confirmed there.";
}
function renderProducts() {
  const container = $("#products") || $("#inspiration-products");
  if (!container) return;
  const limit = Number(container.dataset.limit) || PRODUCTS.length;
  container.innerHTML = PRODUCTS.slice(0, limit)
    .map(
      (p) =>
        `<article class="product-card"><div class="product-visual ${p.background}"><span class="product-tag">${esc(p.tag)}</span>${charmSVG(p.design, { decorations: true })}</div><div class="product-info"><div class="product-title"><h3>${esc(p.name)}</h3><b>${fmt(price("product-" + p.id))}</b></div><p>${esc(p.description)}</p><p class="product-specs">${TOMATO_SIZES.find((s) => s.id === (p.design.tomatoSize || "regular")).name} tomato · dimensions and weight to be confirmed<br />Bead and clasp dimensions to be confirmed</p><div class="product-buttons"><button class="button" data-add-product="${p.id}" ${purchasable([{ key: "product-" + p.id }]) ? "" : "disabled"}>${purchasable([{ key: "product-" + p.id }]) ? "Add to bag +" : liveReady ? "Sold out" : "Unavailable"}</button></div></div></article>`,
    )
    .join("");
}
const beadSVG = (b) =>
  `<svg viewBox="-24 -24 48 48" aria-hidden="true">${beadArt(b, 0, 0, 15, ARTWORK.beads[`${b.color}-${b.type}`], ARTWORK.beadFit?.[`${b.color}-${b.type}`])}</svg>`;
const imageList = (artwork) =>
  Array.isArray(artwork)
    ? artwork.filter((url) => typeof url === "string" && url)
    : typeof artwork === "string" && artwork
      ? [artwork]
      : [];
const beadPhotos = (color, type) =>
  imageList(ARTWORK.beadGallery?.[`${color}-${type}`] ?? ARTWORK.beads[`${color}-${type}`]);
const tomatoPhotos = (tomato) =>
  imageList(ARTWORK.tomatoes[tomato]);
let imageGallery = null;
function galleryPhotos() {
  if (!imageGallery) return [];
  return imageGallery.kind === "tomato"
    ? tomatoPhotos(imageGallery.tomato)
    : beadPhotos(imageGallery.color, imageGallery.type);
}
function renderImageGallery() {
  if (!imageGallery) return;
  const { kind, index } = imageGallery;
  const photos = galleryPhotos();
  const photo = $("#photo-gallery-photo");
  const art = $("#photo-gallery-art");
  const imageId =
    kind === "tomato"
      ? imageGallery.tomato
      : `${imageGallery.color}-${imageGallery.type}`;
  let title;
  let illustration;
  if (kind === "tomato") {
    const tomato = TOMATOES.find((item) => item.id === imageGallery.tomato);
    title = `${tomato.name} tomato`;
    illustration = tomatoIcon(tomato.id, 280, "");
  } else {
    const color = COLORS.find((item) => item.id === imageGallery.color);
    const type = TYPES.find((item) => item.id === imageGallery.type);
    title = `${beadName(color.id, type.id)} bead`;
    illustration = beadSVG({ color: color.id, type: type.id });
  }
  photo.onerror = null;
  $("#photo-gallery-title").textContent = title;
  $("#photo-gallery-count").textContent = photos.length
    ? `Photo ${index + 1} of ${photos.length}`
    : `Illustrated preview · ${kind} photos coming soon`;
  $(".photo-gallery-view").classList.toggle("single-photo", photos.length < 2);
  $("#photo-gallery-previous").hidden = photos.length < 2;
  $("#photo-gallery-next").hidden = photos.length < 2;
  photo.hidden = !photos.length;
  art.hidden = Boolean(photos.length);
  art.innerHTML = illustration;
  photo.onerror = () => {
    if (
      !imageGallery ||
      imageGallery.kind !== kind ||
      (kind === "tomato"
        ? imageGallery.tomato !== imageId
        : `${imageGallery.color}-${imageGallery.type}` !== imageId) ||
      imageGallery.index !== index
    )
      return;
    photo.hidden = true;
    art.hidden = false;
    $("#photo-gallery-count").textContent =
      "This photo could not load · showing the illustrated preview";
  };
  if (photos.length) {
    photo.alt = `${title}, view ${index + 1} of ${photos.length}`;
    photo.src = photos[index];
  } else {
    photo.removeAttribute("src");
    photo.alt = "";
  }
}
function openBeadGallery(color, type) {
  imageGallery = { kind: "bead", color, type, index: 0 };
  renderImageGallery();
  $("#photo-gallery").showModal();
}
function openTomatoGallery(tomato) {
  imageGallery = { kind: "tomato", tomato, index: 0 };
  renderImageGallery();
  $("#photo-gallery").showModal();
}
function renderBuilder(focusHeading = false) {
  if (!$("#design-stage")) return;
  const focusKey = document.activeElement?.dataset.focus;
  if (editingId && !cart.some((i) => i.id === editingId && i.kind === "custom"))
    editingId = null;
  selected[0] = Math.min(selected[0], design.strands.length - 1);
  selected[1] = Math.min(selected[1], design.strands[selected[0]].length - 1);
  $("#design-stage").innerHTML = charmSVG(design, {
    decorations: true,
    selected: step === 3 ? selected : null,
    interactive: true,
  });
  $("#design-name").textContent =
    "Hello, " + TOMATOES.find((t) => t.id === design.tomato).name + ".";
  document
    .querySelectorAll("[data-step]")
    .forEach((el) =>
      el.setAttribute("aria-pressed", String(Number(el.dataset.step) === step)),
    );
  let content = "";
  if (step === 0) {
    const keychainPrice =
      price("assembly") + price("tomato-size-regular") + price("clasp-ring");
    const phoneCharmPrice =
      price("assembly") + price("tomato-size-small") + price("clasp-dust-usbc");
    content = `<h3 tabindex="-1">What are you looking to build?</h3><p class="step-description">Choose a keychain charm for everyday things like your keys or clipped onto your bag, or choose a smaller charm to decorate your phone.</p><div class="build-options" role="group" aria-label="Charm type"><button class="build-option" data-build-type="keychain" data-focus="build-keychain" aria-pressed="${!design.clasp.startsWith("dust-")}"><b>Keychain charm · starts at ${fmt(keychainPrice)}</b><small>Includes: </br>☆ One regular sized tomato 2<strong>.</strong>6cm × 2<strong>.</strong>5cm × 2<strong>.</strong>2cm</br>☆ one clasp of your choice </br>☆ one strand of 3 beads of your choice </br>☆ one star bead </br> Extra strands and beads can be added at a little extra cost.</small></button><button class="build-option" data-build-type="phone" data-focus="build-phone" aria-pressed="${design.clasp.startsWith("dust-")}"><b>Phone charm · starts at ${fmt(phoneCharmPrice)}</b><small>Includes: </br>☆ One small sized tomato </br>☆ one dust plug of your choice </br>☆ one strand of 3 beads of your choice </br> ☆ one star bead </br>Extra strands and beads can be added at a little extra cost.</small></button></div>`;
  }
  if (step === 1) {
    const selectedClasp = CLASPS.find((clasp) => clasp.id === design.clasp);
    const claspOptions = design.clasp.startsWith("dust-")
      ? CLASPS.filter((clasp) => clasp.id.startsWith("dust-"))
      : CLASPS.filter((clasp) => !clasp.id.startsWith("dust-"));
    const isPhoneCharm = design.clasp.startsWith("dust-");
    const startingPrice =
      price("assembly") +
      price("tomato-size-" + selectedClasp.tomatoSize) +
      price("clasp-" + selectedClasp.id);
    content = `<h3 tabindex="-1">Choose your ${isPhoneCharm ? "dust plug" : "keychain clasp"}.</h3><p class="step-description">${isPhoneCharm ? `Phone charms start at ${fmt(startingPrice)} and include a small sized tomato, the dust plug of your choice, one strand of 3 beads of your choice, and one star bead. Extra strands and beads can be added at an extra cost.` : `Pick one clasp of your choice. Where will your tomato go?`}</p><div class="clasp-options" role="group" aria-label="${isPhoneCharm ? "Dust plug" : "Keychain clasp"}">${claspOptions
      .map((clasp) => {
        return `<button class="clasp-option" data-clasp="${clasp.id}" data-focus="clasp-${clasp.id}" aria-pressed="${design.clasp === clasp.id}" ${purchasable([{ key: "clasp-" + clasp.id }, { key: "tomato-size-" + clasp.tomatoSize }]) ? "" : "disabled"}><svg viewBox="-40 0 80 95" aria-hidden="true">${claspArt(clasp.id)}</svg><b>${esc(clasp.name)}</b><small>Included in starting price</small></button>`;
      })
      .join(
        "",
      )}</div><p class="clasp-detail">${esc(selectedClasp.detail)} · ${selectedClasp.dimensions ? esc(selectedClasp.dimensions) : "Dimensions to be confirmed"}</p><p class="size-note">Tomato dimensions and weight are to be confirmed.</p>`;
  }
  if (step === 2) {
    content = `<h3 tabindex="-1">Pick your tomato.</h3><p class="step-description">Pick one regular sized tomato. What kind of personality will your tomato have? Enlarge a tomato to see its photos from every side.</p><p class="editor-label tomato-size-label">Choose a personality</p><div class="tomato-options" role="group" aria-label="Tomato expressions">${TOMATOES.map((t) => {const views=tomatoPhotos(t.id).length;const surcharge=price("tomato-"+t.id);const priceLabel=surcharge===0?`${fmt(surcharge)} · included`:`+${fmt(surcharge)} extra`;return `<article class="tomato-option-card"><button class="tomato-option" data-tomato="${t.id}" data-focus="tomato-${t.id}" aria-pressed="${design.tomato===t.id}" ${purchasable([{key:"tomato-"+t.id}])?"":"disabled"}>${tomatoIcon(t.id)}<span class="option-text"><b>${esc(t.name)}</b><small>${priceLabel}</small></span></button><button class="tomato-option-zoom" data-tomato-gallery="${t.id}" aria-label="Enlarge ${esc(t.name)} tomato${views>1?`, ${views} photos`:''}">Enlarge${views>1?` · ${views} views`:''} ↗</button></article>`;}).join("")}</div><p class="size-note">Tomato dimensions and weight are to be confirmed.</p>`;
  }
  if (step === 3) {
    const active = design.strands[selected[0]][selected[1]];
    const clasp = CLASPS.find((item) => item.id === design.clasp);
    const hasIncludedBeads = clasp.includedStrands > 0;
    const strandPricing = hasIncludedBeads
      ? `1 included; ${fmt(price("strand"))} per extra`
      : `${fmt(price("strand"))} each`;
    const pricingNote = hasIncludedBeads
      ? "Includes 1 strand with 3 beads; extra strands and beads are charged at the rates shown."
      : "Extra strands and beads are charged at the rates shown.";
    content = `<h3 tabindex="-1">Time to dress up your tomato.</h3><p class="step-description">Choose a bead position, pick a shape, then choose the bead you like. Use Enlarge to see a bead closer; extra photos will show its other sides.</p><div class="strand-count"><span>Strands <small>(${strandPricing})</small></span><div class="count-picker" role="group" aria-label="Number of strands">${[1, 2, 3].map((n) => `<button data-strands="${n}" data-focus="strands-${n}" aria-label="${n} ${n === 1 ? "strand" : "strands"}" aria-pressed="${design.strands.length === n}">${n}</button>`).join("")}</div></div><div class="strands-editor">${design.strands.map((strand, i) => `<div class="strand-row"><span class="strand-name">Strand ${i + 1}</span><div class="bead-slots" role="group" aria-label="Strand ${i + 1} bead positions, top to bottom">${strand.map((b, j) => `<button class="bead-slot" data-slot="${i},${j}" data-focus="slot-${i}-${j}" aria-pressed="${selected[0] === i && selected[1] === j}" aria-label="Strand ${i + 1}, bead ${j + 1}: ${esc(beadName(b.color,b.type === "pearl" ? "round" : b.type))}">${beadSVG(b)}</button>`).join("")}</div><div class="bead-length"><button data-length="${i},-1" data-focus="shorter-${i}" aria-label="Remove last bead from strand ${i + 1}" ${strand.length === 1 ? "disabled" : ""}>−</button><button data-length="${i},1" data-focus="longer-${i}" aria-label="Add bead to strand ${i + 1}" ${strand.length === 5 ? "disabled" : ""}>+</button></div></div>`).join("")}</div><div class="editor-label"><span>Bead ${selected[1] + 1} · strand ${selected[0] + 1}</span><small>${esc(beadName(active.color,active.type === "pearl" ? "round" : active.type))}</small></div><div class="bead-move" role="group" aria-label="Move this bead within strand ${selected[0] + 1}"><button data-move="-1" data-focus="move-earlier" ${selected[1] === 0 ? "disabled" : ""}>← Move earlier</button><button data-move="1" data-focus="move-later" ${selected[1] === design.strands[selected[0]].length - 1 ? "disabled" : ""}>Move later →</button></div><p class="editor-label">Choose a bead shape</p><div class="shape-options" role="group" aria-label="Bead shape">${TYPES.map((t) => `<button class="shape-option" data-type="${t.id}" data-focus="type-${t.id}" aria-pressed="${active.type === t.id}" ${purchasable([{ key: "bead-" + active.color + "-" + t.id }]) ? "" : "disabled"}>${esc(t.label)}<small>Choose shape</small></button>`).join("")}</div><p class="editor-label">Choose a bead <small>${esc(TYPES.find((t) => t.id === active.type).label)}</small></p><div class="bead-options" role="group" aria-label="${esc(TYPES.find((t) => t.id === active.type).label)} bead options">${COLORS.map((c) => {const key=`${c.id}-${active.type}`;const views=beadPhotos(c.id,active.type).length;const label=c.id==="cream"&&active.type==="bow"?"White star bow":c.name;return `<article class="bead-option"><button class="bead-option-select" data-bead-option="${c.id},${active.type}" data-focus="bead-${c.id}-${active.type}" aria-pressed="${active.color===c.id}" ${purchasable([{key:"bead-"+key}])?"":"disabled"}>${beadSVG({color:c.id,type:active.type})}<span>${esc(label)}</span><small>${fmt(price("bead-"+key))} per bead</small></button><button class="bead-option-zoom" data-gallery="${c.id},${active.type}" aria-label="View ${esc(beadName(c.id,active.type))} bead larger${views>1?`, ${views} photos`:''}">Enlarge${views>1?` · ${views} views`:''} ↗</button></article>`;}).join("")}</div><p class="editor-help">${pricingNote} 1–${clasp.maxBeads} beads per strand · shown top to bottom, left to right.</p>`;
    const beadLimit = clasp.maxBeads;
    content = content.replace(
      /<button data-length="(\d+),1"([^>]*)>/g,
      (button, strandIndex, attributes) => {
        const cleaned = attributes.replace(/\sdisabled\b/, "");
        const disabled =
          design.strands[Number(strandIndex)].length >= beadLimit
            ? " disabled"
            : "";
        return `<button data-length="${strandIndex},1"${cleaned}${disabled}>`;
      },
    );
  }
  $("#step-content").innerHTML = content;
  document.querySelectorAll(".shape-option").forEach((button) => {
    button.disabled = !COLORS.some((color) =>
      purchasable([{ key: `bead-${color.id}-${button.dataset.type}` }]),
    );
  });
  {
    const total = fmt(priceDesign(design, prices));
    $("#builder-price").textContent = total;
    $("#preview-total").textContent = total;
  }
  $("#price-breakdown").innerHTML = priceSummary(design, prices)
    .map(
      (row) =>
        `<div class="price-row"><dt>${esc(row.label)}</dt><dd>${fmt(row.amount)}</dd></div>`,
    )
    .join("");
  $("#previous-step").hidden = step === 0;
  $("#next-step").hidden = step === 3;
  $("#next-step").textContent = [
    "Next: choose attachment →",
    "Next: choose tomato →",
    "Next: choose beads →",
  ][step];
  $("#add-custom").hidden = step !== 3;
  $("#add-custom").innerHTML = editingId
    ? "Update bag <span>✓</span>"
    : "Add to bag <span>+</span>";
  $("#editing-note").hidden = !editingId;
  $("#undo-design").disabled = !canUndo(hist);
  $("#redo-design").disabled = !canRedo(hist);
  $("#add-custom").disabled = !purchasable(components(design));
  $("#builder-availability").textContent = purchasable(components(design))
    ? ""
    : liveReady
      ? "A selected component is sold out. Choose another combination."
      : "The shop is connecting. Please try again later.";
  if (focusHeading) $("#step-content h3").focus({ preventScroll: true });
  else if (focusKey) {
    const el = document.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`);
    (el && !el.disabled
      ? el
      : document.querySelector('[data-focus^="slot-"][aria-pressed="true"]')
    )?.focus({ preventScroll: true });
  }
  write("lt-design-v1", design);
}
function renderCart() {
  refreshBadge();
  $("#bag-items").innerHTML = cart.length
    ? cart
        .map((item) => {
          const d = itemDesign(item);
          return `<article class="cart-item"><div class="cart-art">${charmSVG(d)}</div><div class="cart-info"><h3>${esc(itemName(item))}</h3><p>${TOMATO_SIZES.find((s) => s.id === (d.tomatoSize || "regular")).name} tomato · ${d.strands.length} strands · ${d.strands.flat().length} beads · ${CLASPS.find((c) => c.id === d.clasp).name}</p><details><summary class="subtle-button">Design details</summary><p>${esc(describeDesign(d))}</p><p>Tomato dimensions and weight, bead sizes, and hardware dimensions are to be confirmed.</p></details>${item.kind === "custom" ? `<button class="subtle-button" data-edit-item="${item.id}">Edit in the studio ↗</button>` : `<button class="subtle-button" data-customize="${item.productId}">Make it yours ↗</button>`}<span class="cart-price">${fmt(itemPrice(item) * item.quantity)}</span>${purchasable(itemComponents(item)) ? "" : '<p class="checkout-error">Unavailable. Please remove or replace this item.</p>'}<div class="cart-row"><div class="qty"><button data-qty="${item.id},-1" aria-label="Decrease quantity of ${esc(itemName(item))}" ${item.quantity === 1 ? "disabled" : ""}>−</button><span>${item.quantity}</span><button data-qty="${item.id},1" aria-label="Increase quantity of ${esc(itemName(item))}" ${item.quantity === 10 ? "disabled" : ""}>+</button></div><button data-remove="${item.id}" class="cart-remove">Remove</button></div></div></article>`;
        })
        .join("")
    : `<div class="empty-bag"><span class="borel">Nothing picked... yet.</span><p>Your next little favorite is out in the patch.</p><button class="button secondary" data-close-bag>Go pick a tomato →</button></div>`;
  $("#bag-total").textContent = fmt(cartTotal());
  $("#cart-note").textContent = liveReady
    ? "Shipping & taxes calculated at Shopify checkout."
    : live()
      ? "Shop connection unavailable. Checkout is disabled."
      : "Preview bag · placeholder prices · no payments collected.";
  $("#checkout").disabled =
    !liveReady ||
    !cart.length ||
    busy ||
    !cart.every((i) => purchasable(itemComponents(i)));
  $("#checkout").textContent = busy
    ? "Checking your little picks…"
    : liveReady
      ? "Continue to Shopify checkout ↗"
      : "Checkout opens soon";
  write("lt-cart-v1", cart);
}
function addItem(item) {
  if (busy) return;
  if (cart.length >= 20) {
    toast("Your bag has 20 designs. Remove one before adding another.");
    return;
  }
  const id =
    crypto.randomUUID?.() ??
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
  cart.push({ id, quantity: 1, ...item });
  persist();
  renderCart();
  toast("A little happiness added to your bag.");
}
function updateDesign() {
  hist = commit(hist, design);
  renderBuilder();
  persist();
}
function stepHistory(fn) {
  if (busy) return;
  const next = fn(hist);
  if (next === hist) return;
  hist = next;
  design = clone(hist.present);
  renderBuilder();
  persist();
}
function openBag() {
  renderCart();
  $("#checkout-error").textContent = "";
  $("#bag").showModal();
}
function startEdit(id) {
  const item = cart.find((i) => i.id === id && i.kind === "custom");
  if (!item) return;
  editingId = id;
  design = clone(item.design);
  hist = commit(hist, design);
  step = 0;
  selected = [0, 0];
  $("#bag").close();
  renderBuilder(true);
  persist();
  ($("#studio") ?? $("#build"))?.scrollIntoView({ behavior: "smooth" });
  toast("Editing from your bag. Choose Update bag when you’re done.");
}
function saveImage() {
  const blob = new Blob([charmSVG(design)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-little-tomato.svg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your design image is ready.");
}
async function copyLink() {
  const url = location.href.split("#")[0] + designHash(design);
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied. Anyone with it can open this exact design.");
  } catch {
    window.prompt("Copy this link to share your design:", url);
  }
}
function clearHash() {
  try {
    history.replaceState(null, "", location.href.split("#")[0]);
  } catch {}
}
document.addEventListener("click", (event) => {
  const hit = event.target.closest?.("[data-bead]");
  if (hit && !busy) {
    const was = step;
    selected = hit.dataset.bead.split(",").map(Number);
    step = 3;
    renderBuilder(was !== 3);
    return;
  }
  const b = event.target.closest("button");
  if (!b || b.disabled || busy) return;
  if (b.hasAttribute("data-gallery")) {
    const [color, type] = b.dataset.gallery.split(",");
    openBeadGallery(color, type);
    return;
  }
  if (b.hasAttribute("data-tomato-gallery")) {
    openTomatoGallery(b.dataset.tomatoGallery);
    return;
  }
  if (b.hasAttribute("data-step")) {
    step = Number(b.dataset.step);
    renderBuilder(true);
  }
  if (b.hasAttribute("data-build-type")) {
    const clasp = CLASPS.find((item) =>
      b.dataset.buildType === "phone"
        ? item.id === "dust-usbc"
        : item.id === "ring",
    );
    design.clasp = clasp.id;
    design.tomatoSize = clasp.tomatoSize;
    design.strands = [
      [
        ...(design.strands[0] || []).slice(0, 3),
        ...Array.from(
          { length: Math.max(0, 3 - (design.strands[0] || []).length) },
          () => bead("pink"),
        ),
      ],
    ];
    updateDesign();
  }
  if (b.hasAttribute("data-tomato")) {
    design.tomato = b.dataset.tomato;
    updateDesign();
  }
  if (b.hasAttribute("data-strands")) {
    const n = Number(b.dataset.strands);
    while (design.strands.length < n) design.strands.push([bead("pink")]);
    design.strands.length = n;
    updateDesign();
  }
  if (b.hasAttribute("data-slot")) {
    selected = b.dataset.slot.split(",").map(Number);
    renderBuilder();
  }
  if (b.hasAttribute("data-length")) {
    const [i, delta] = b.dataset.length.split(",").map(Number);
    const clasp = CLASPS.find((item) => item.id === design.clasp);
    if (delta > 0 && design.strands[i].length < clasp.maxBeads)
      design.strands[i].push(bead("cream"));
    if (delta < 0 && design.strands[i].length > 1) design.strands[i].pop();
    updateDesign();
  }
  if (b.hasAttribute("data-bead-option")) {
    const [color, type] = b.dataset.beadOption.split(",");
    design.strands[selected[0]][selected[1]] = bead(color, type);
    updateDesign();
  }
  if (b.hasAttribute("data-type")) {
    design.strands[selected[0]][selected[1]].type = b.dataset.type;
    updateDesign();
  }
  if (b.hasAttribute("data-clasp")) {
    const clasp = CLASPS.find((item) => item.id === b.dataset.clasp);
    design.clasp = clasp.id;
    design.tomatoSize = clasp.tomatoSize;
    design.strands = design.strands.map((strand) =>
      strand.slice(0, clasp.maxBeads),
    );
    updateDesign();
  }
  if (b.hasAttribute("data-add-product")) {
    addItem({ kind: "ready", productId: b.dataset.addProduct });
  }
  if (b.hasAttribute("data-customize")) {
    editingId = null;
    $("#bag").close();
    design = clone(PRODUCTS.find((p) => p.id === b.dataset.customize).design);
    if (!$("#studio")) {
      location.href = "studio.html" + designHash(design);
      return;
    }
    step = 0;
    selected = [0, 0];
    updateDesign();
    $("#studio").scrollIntoView({ behavior: "smooth" });
    toast("A lovely starting point. Make it yours.");
  }
  if (b.hasAttribute("data-move")) {
    const r = moveBead(
      design,
      selected[0],
      selected[1],
      selected[1] + Number(b.dataset.move),
    );
    design = r.design;
    selected[1] = r.index;
    updateDesign();
  }
  if (b.hasAttribute("data-edit-item")) startEdit(b.dataset.editItem);
  if (b.dataset.action === "save-image") saveImage();
  if (b.dataset.action === "copy-link") copyLink();
  if (b.hasAttribute("data-remove")) {
    cart = cart.filter((i) => i.id !== b.dataset.remove);
    renderCart();
    $("#checkout-error").textContent = "";
    $("#bag-title").focus({ preventScroll: true });
  }
  if (b.hasAttribute("data-qty")) {
    const [id, delta] = b.dataset.qty.split(",");
    const item = cart.find((i) => i.id === id);
    item.quantity = Math.max(1, Math.min(10, item.quantity + Number(delta)));
    renderCart();
    document
      .querySelector(`[data-qty="${CSS.escape(b.dataset.qty)}"]`)
      ?.focus({ preventScroll: true });
    $("#checkout-error").textContent = "";
  }
  if (b.hasAttribute("data-close-bag")) $("#bag").close();
});
if ($("#photo-gallery")) {
  $("#photo-gallery-close").onclick = () => $("#photo-gallery").close();
  $("#photo-gallery-previous").onclick = () => {
    if (!imageGallery) return;
    const count = galleryPhotos().length;
    if (count < 2) return;
    imageGallery.index = (imageGallery.index + count - 1) % count;
    renderImageGallery();
  };
  $("#photo-gallery-next").onclick = () => {
    if (!imageGallery) return;
    const count = galleryPhotos().length;
    if (count < 2) return;
    imageGallery.index = (imageGallery.index + 1) % count;
    renderImageGallery();
  };
  $("#photo-gallery").addEventListener("click", (event) => {
    if (event.target === $("#photo-gallery")) $("#photo-gallery").close();
  });
  $("#photo-gallery").addEventListener("close", () => {
    imageGallery = null;
  });
}
if ($("#design-stage")) {
  $("#next-step").onclick = () => {
    step = Math.min(3, step + 1);
    renderBuilder(true);
  };
  $("#previous-step").onclick = () => {
    step = Math.max(0, step - 1);
    renderBuilder(true);
  };
  $("#add-custom").onclick = () => {
    if (busy) return;
    if (editingId) {
      const next = replaceCustomDesign(cart, editingId, design);
      editingId = null;
      if (next !== cart) {
        cart = next;
        persist();
        renderBuilder();
        openBag();
        toast("Bag updated with your changes.");
        return;
      }
    }
    addItem({ kind: "custom", design: clone(design) });
  };
  $("#undo-design").onclick = () => stepHistory(undo);
  $("#redo-design").onclick = () => stepHistory(redo);
  $("#shuffle-design").onclick = () => {
    if (busy) return;
    const next = randomDesign(Math.random, (d) => purchasable(components(d)));
    if (!next) {
      toast("Nothing to shuffle right now. Try again in a moment.");
      return;
    }
    design = next;
    selected = [0, 0];
    updateDesign();
    toast("A fresh surprise. Undo brings your last one back.");
  };
  $("#cancel-edit").onclick = () => {
    editingId = null;
    renderBuilder();
    toast("Stopped editing. Your bag is unchanged.");
  };
  document.addEventListener("keydown", (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || $("#bag").open)
      return;
    const k = event.key.toLowerCase();
    if (k === "z") {
      event.preventDefault();
      stepHistory(event.shiftKey ? redo : undo);
    } else if (k === "y" && !event.metaKey) {
      event.preventDefault();
      stepHistory(redo);
    }
  });
  $("#reset-design").onclick = () => {
    if (busy) return;
    editingId = null;
    design = defaultDesign();
    step = 0;
    selected = [0, 0];
    updateDesign();
    toast("A fresh little start. Undo brings your last one back.");
  };
}
$("#open-bag").onclick = openBag;
$("#close-bag").onclick = $("#continue-shopping").onclick = () =>
  $("#bag").close();
$("#bag").addEventListener("click", (event) => {
  if (event.target === $("#bag")) {
    const r = $("#bag").getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      $("#bag").close();
  }
});
$("#checkout").onclick = async () => {
  if (busy || !liveReady || !cart.length) return;
  busy = true;
  $("#checkout-error").textContent = "";
  renderCart();
  try {
    const before = cartTotal();
    const result = await loadPrices();
    prices = result.prices;
    availability = result.availability;
    renderProducts();
    renderBuilder();
    renderCart();
    if (!cart.every((i) => purchasable(itemComponents(i))))
      throw new Error(
        "Some picks are no longer available. Please review your bag.",
      );
    if (before !== cartTotal())
      throw new Error(
        "Prices have changed. Your bag is updated; review it and continue again.",
      );
    const checkout = await createCheckout(cart);
    const serverTotal = Math.round(
      Number(checkout.cost.subtotalAmount.amount) * 100,
    );
    if (
      checkout.cost.subtotalAmount.currencyCode !== SHOP.currency ||
      serverTotal !== cartTotal()
    )
      throw new Error(
        "The checkout total changed. Please review the shop pricing before continuing.",
      );
    window.location.assign(checkout.checkoutUrl);
  } catch (error) {
    $("#checkout-error").textContent =
      error.name === "TimeoutError"
        ? "The shop took too long to respond. Please try again."
        : error.message;
  } finally {
    busy = false;
    renderCart();
  }
};
function applyBrand() {
  const b = SHOP.brand;
  document.title = b.title + " — " + b.tagline;
  document.querySelectorAll("[data-brand]").forEach((el) => {
    const v = b[el.dataset.brand];
    if (typeof v === "string") el.textContent = v;
  });
  document.querySelectorAll("[data-brand-lead]").forEach((el) => {
    const v = b[el.dataset.brandLead],
      t = [...el.childNodes].find((n) => n.nodeType === 3);
    if (t && typeof v === "string") t.nodeValue = v;
  });
  document
    .querySelectorAll("[data-brand-home]")
    .forEach((el) => el.setAttribute("aria-label", b.title + " home"));
  document.querySelectorAll("[data-brand-working]").forEach((el) => {
    el.hidden = !b.provisional;
  });
}
applyBrand();
if ($("#hero-art")) $("#hero-art").innerHTML = charmSVG(PRODUCTS[0].design);
if ($("#postcard-art"))
  $("#postcard-art").innerHTML = charmSVG(PRODUCTS[1].design);
if ($("#artist-art")) $("#artist-art").innerHTML = tomatoIcon("sunny", 150);
if ($("#year")) $("#year").textContent = new Date().getFullYear();
$("#bag-title").tabIndex = -1;
if (SHOP.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SHOP.email)) {
  if (
    $("#contact-description") &&
    $("#contact-link") &&
    $("#contact-placeholder")
  ) {
    $("#contact-description").textContent =
      "Questions, ideas, and friendly waves are welcome. Write to " +
      SHOP.email +
      ".";
    $("#contact-link").href = "mailto:" + encodeURIComponent(SHOP.email);
    $("#contact-link").hidden = false;
    $("#contact-placeholder").hidden = true;
  }
}
renderProducts();
renderBuilder();
renderCart();
if (shared) {
  clearHash();
  ($("#studio") ?? $("#build"))?.scrollIntoView();
  toast("Opened a shared design. Undo brings your own back.");
} else if (location.hash.startsWith("#design=")) {
  clearHash();
  toast("That design link didn’t open. It may be incomplete.");
}
window.addEventListener("hashchange", () => {
  if (busy) return;
  const d = designFromHash(location.hash);
  if (!d) {
    if (location.hash.startsWith("#design=")) {
      clearHash();
      toast("That design link didn’t open. It may be incomplete.");
    }
    return;
  }
  editingId = null;
  design = clone(d);
  hist = commit(hist, design);
  step = 3;
  selected = [0, 0];
  renderBuilder(true);
  persist();
  clearHash();
  $("#studio").scrollIntoView({ behavior: "smooth" });
  toast("Opened a shared design. Undo brings your own back.");
});
if (live()) {
  if (!configured())
    toast("Shop setup is incomplete. Checkout is unavailable.");
  else
    loadPrices()
      .then((result) => {
        prices = result.prices;
        availability = result.availability;
        liveReady = true;
        renderProducts();
        renderBuilder();
        renderCart();
      })
      .catch(() =>
        toast("The shop is temporarily unavailable. Your picks are saved."),
      );
}
window.addEventListener("storage", (event) => {
  if (event.key === "lt-cart-v1" && !busy) {
    cart = sanitizeCart(read("lt-cart-v1", []));
    renderCart();
  }
});
