# Heirloom Studio — storefront foundation

A portable, working storefront prototype for a handmade polymer clay tomato charm shop. **Heirloom Studio** is the store's chosen name. Products, prices, and artwork are illustrative. Real payments are disabled by default.

## Run it

No installation or frontend build is required. Use Node 20+ for tests and Python 3 for a local server.

```sh
python3 -m http.server 3000 --directory dist
# Open http://localhost:3000
npm test
```

Serve over HTTP; do not open index.html directly with file:// because the JavaScript uses ES modules. Deploy the entire `dist` directory to a static host. HTTPS is required for a real store.

## Implemented

- Responsive landing page, collection, artist story, FAQ, contact section, and honest empty reviews state.
- Borel headings/accents and Urbanist body text, self-hosted with OFL licenses.
- Original SVG tomato/chain illustrations as placeholders, with optional per-character and per-color/shape image overrides for your own artwork.
- Two-window studio: rendered design on the left and four numbered steps on the right; stacked on mobile. Add the custom design directly from the beads step.
- Undo/redo (buttons and Ctrl/Cmd+Z), a “Surprise me” shuffle, moving a bead earlier or later in its strand, tapping a bead on the drawing to select it, a running total in the sticky phone preview, copy-a-link share URLs (re-validated on open), and editing a custom design from the bag.
- Four-step builder: choose a keychain or phone charm, then pick its attachment, tomato personality, and beads. Keychains start at $15.99 with a Regular tomato; phone charms start at $8.49 with a Small tomato. Dimensions use placeholders until confirmed.
- Every custom charm includes one strand of three beads and a little star bead on the side. Extra strands and beads are charged separately. Keychains offer a key ring, lobster clasp, or loop; phone charms offer USB-C and Lightning dust plugs. Tomato moods keep their own placeholder surcharges.
- 1–3 strands; phone charms allow 1–3 editable beads per strand, and keychains allow 1–5. Bead, clasp, loop, and dust-plug dimensions are marked as unconfirmed rather than estimated.
- Per-component integer-cent pricing with an expandable bill of materials; assembly and strand labor are explicit.
- Three ready-made designs, independent product pricing, and “Make it yours” as a builder starting point.
- A dedicated predesigned ideas page that renders every entry in the shared product catalog; the homepage keeps a three-item featured preview and links to the full collection.
- A three-item predesigned inspiration section at the bottom of the studio page, with a “See more” link to the full ideas collection.
- Saved design and shopping bag, quantities 1–10, item removal, design details, and SVG image download.
- Checkout API (`server/`, a Cloudflare Worker for the artist to deploy): the browser sends designs only; the server reads prices from Shopify, adds the assembly and strand lines, checks availability and stock, creates a draft-order checkout, and deletes it if Shopify's answer differs from the catalog. Optional order audit tags altered orders for review. See `server/README.md`.
- Shopify Storefront GraphQL adapter for mapped product/component variants, live prices, sale availability, cart creation, and hosted checkout. Testing only: it does not enforce the bill of materials.
- Fail-closed checkout when unconfigured, offline, missing catalog mappings, sold-out components, currency mismatches, adjusted cart quantities, or API warnings/errors occur.
- Automated tests for configuration limits, pricing, restore validation, component quantities, Shopify mapping, and checkout errors.

## File map

| File | Responsibility |
| --- | --- |
| `dist/index.html` | Semantic page sections and static copy |
| `dist/ideas.html` | Full predesigned ideas catalog |
| `dist/styles.css` | Responsive design system and layouts |
| `dist/fonts.css`, `dist/fonts/` | Self-hosted fonts and their licenses |
| `dist/js/catalog.js` | Expressions, tomato sizes, colors, bead types, artwork image paths, clasps, presets, demo prices |
| `dist/js/core.js` | Validation, integer-cent totals, BOM, backward-compatible design serialization, cart line generation |
| `dist/js/art.js` | SVG illustrations and live charm renderer |
| `dist/js/app.js` | Builder interactions, storage, shopping bag, UI updates |
| `dist/js/commerce.js` | Picks the checkout path (server, direct Storefront, or preview) |
| `dist/js/remote.js` | Client for the checkout API; checks the returned link and total |
| `dist/js/shopify.js` | Direct Storefront API requests (testing path) |
| `server/` | Checkout API Worker: `api.js` routes and rules, `admin.js` Shopify client, `audit.js` order check |
| `dist/js/config.js` | Public store configuration; no secrets |
| `tests/` | Dependency-free Node tests |
| `SHOPIFY_SETUP.md` | Shopify catalog and checkout setup |
| `CLAUDE_HANDOFF.md` | Copyable Sonnet/Opus continuation brief |
| `QA_REPORT.md` | Verification evidence and limitations |

## Change the demo

1. The brand name, tagline, announcement bar, studio name, artist note and footer line come from `SHOP.brand` in `dist/js/config.js`. Keep the static HTML defaults in `dist/index.html` and `dist/studio.html` aligned for search crawlers and before JavaScript loads. Hero and how-it-works copy still live in `index.html`.
2. Edit demo products, bead colors, shapes, and prices in `catalog.js`. The bead picker shows shapes first, then image-led bead options for the selected shape. Each clasp sets its tomato size, included one-strand/three-bead bundle, and per-strand bead limit; the tomato-size base prices and personality surcharges are separate placeholder catalog entries. Cents are integers (800 = $8.00). Ready-made prices are independent of custom-component totals.
3. Set the artist's public business email in `config.js` to activate the contact email link. No contact form silently submits anywhere.
4. Replace the illustrated character and bead placeholders with your photos by setting `ARTWORK.tomatoes` and `ARTWORK.beads` paths in `dist/js/catalog.js`. Use transparent PNG or WebP images; tomato images are fitted into the character area, while bead images are clipped to their selected bead shape. A tomato or bead entry can be one path or an array of paths for multiple angles, for example `tomatoes: { serious: ["./assets/tomatoes/serious-front.webp", "./assets/tomatoes/serious-back.webp"] }` or `beads: { "pink-round": ["./assets/beads/pink-round-front.webp", "./assets/beads/pink-round-back.webp"] }`. The first photo is used in previews; the Enlarge control opens the photo viewer and lets customers switch between the rest. The White star bow uses its small transparent image in the builder and its large dimension photo in the Enlarge viewer. Leave a path blank to keep the illustrated placeholder.
5. Add real product photography and the artist's brand assets.
6. Read `SHOPIFY_SETUP.md` before enabling Shopify. Live prices override demo pricing. This prototype intentionally uses one configured currency and no market selector.

## Handing it to the artist

Give them the source ZIP and these instructions, then transfer the chosen hosting/domain and Shopify ownership through those providers' supported account flows. This preview is private to its current owner and does not transfer account ownership. The artist should own the production Shopify account, domain, and billing. No paid service was purchased or connected in this build.

## Limits before launch

No real store credentials, brand file, product photos, verified reviews, shipping/return/privacy policies, artist contact address, or live Shopify test order were provided. Those are pending. Component line items are not an atomic Shopify bundle; the checkout API enforces the rules on the server, and `SHOPIFY_SETUP.md` lists what a development-store rehearsal must confirm before opening checkout. The checkout API in `server/` has only been tested against a mock Shopify. There is no admin dashboard, authentication, order database, review moderation, or email automation; Shopify owns commerce operations once configured. Do not describe this as a launch-ready store yet.
