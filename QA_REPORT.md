# Verification record — October 24, 2026

## Automated checks

`npm test`: **10 tests passed, 0 failed** using Node's built-in test runner. These cover valid/default/max configurations; invalid counts, IDs and bead types; integer-cent component pricing and price changes; missing prices; saved-cart sanitization and cloning; exact component quantity multiplication; ready-made whole-product SKUs; missing Shopify mappings; disabled/invalid store configuration; mocked authoritative live prices and currency rejection; mocked Shopify warnings, errors and partial-cart rejection.

An initial test expectation miscounted the default bead subtotal; it was corrected against the explicit bill of materials. Default custom price is **$21.50**, not $22.00. The independent Garden Party ready-made SKU is $22.00.

## Browser checks completed

On the desktop preview in Chrome:

- Landing, illustrations and self-hosted Borel/Urbanist rendered.
- Switched tomato from Sunny to Sweetheart; selected 3 strands; expanded strand 1 to 5 beads; changed bead 5 to sky blue/star. Resulting total was $28.25 with the key ring.
- Switched to lobster clasp: $29.25. Added the custom design plus a $22.00 ready-made. Bag subtotal: $51.25.
- Increased custom quantity to 2: subtotal $80.50. Reloaded and reopened bag: subtotal remained $80.50 with the saved design.
- Checkout stayed disabled in demo mode.
- A preview-only HTTP compatibility issue in `crypto.randomUUID()` was found and repaired with a `getRandomValues` fallback, then bag additions were retested successfully.

At a **390 px iframe viewport** in the same browser:

- Header, landing, navigation and typography fit the viewport.
- Builder windows stacked vertically.
- Expanded all 3 strands to 5 beads; all 15 bead positions and controls fit the studio without visible horizontal clipping.
- Color/shape selection and per-component prices stayed visible; preview description reflected all 15 beads. Selected design subtotal was $31.50.

## Not verified

- No real Shopify shop/domain/token/variants were supplied: live API authentication, catalog publishing, live checkout, payment, inventory decrement, tax, shipping, order-admin rendering, notifications, refunds, and fulfillment are **unverified**.
- Shopify adapter tests are mocked. They are not evidence of a successful Shopify purchase.
- No physical mobile device, iOS Safari, assistive-technology audit or formal contrast audit was performed.
- Contact is intentionally a disabled/coming-soon state until a business email is configured; no message delivery was tested.
- Reviews intentionally contain no fabricated entries; no reviews backend exists.
- Actual product proportions and phone plug fit cannot be verified from the supplied brief.
- Production launch gates are in `SHOPIFY_SETUP.md`.


## Update 2026-10-25 (Claude Sonnet 5.5)

Evidence from this session: `npm test` runs 48 tests, all passing (Node 26). Builder features were checked in a browser at desktop width and at a 375 px viewport by script (no horizontal overflow, 44 px touch targets, sticky preview). A read-only review by a second AI model checked the builder and checkout commits; it found nothing definite.

New and still unverified:

- The checkout API (`server/`) is tested only against a mock Admin client. It has never talked to Shopify. The 12 open questions are listed in `SHOPIFY_SETUP.md` section 5.
- The front-end adapter for the API (`dist/js/remote.js`) is tested with mocked `fetch`, not against a deployed Worker.
- No Turnstile widget on the page; the server side exists but the secret should stay unset until the widget does.
- No physical iPhone check; no screenshot review of the final visual state (the browser pane was hidden during verification).
- Dust plug fit (USB-C and Lightning) and prices are placeholders pending the artist.

### Gemini critique, checked before use (same day)

The page's HTML and CSS were sent to free Gemini (public content only). Each claim was tested against the code before anything changed:

- **Accepted, with corrected numbers.** Gemini said `--muted` on cream is 4.35:1 and red on cream is 4.29:1. Measured: 4.69 and 5.04, both pass. What does fail: `--muted` on the pink panels (3.8) and light-green panels (4.2). `--muted` is now `#5a5f4e` (4.9 on pink, 5.4 on light green, 6.0 on cream). 45 declarations at 9–11 px are now 12 px. Decorative labels at 7–8 px (wordmark subtitle, stamps, eyebrows) were left alone.
- **Found while checking.** At 390 px the decorative star in "Notes from the studio" touched the handwritten line. It is smaller and lower on phones (confirmed by screenshot).
- **Rejected as wrong.** Colour swatches are not unlabeled (each has an aria-label); the bag already closes on a backdrop click; the close button already has `aria-label="Close bag"`; the sticky preview takes about 27% of a 667 px screen, not 40%.
- **Not done, owner input needed.** Metals and nickel content, bead material, dimensions and weight, and lead time. The page must not state these until the artist confirms them.
- **Not done, judgement call.** Step buttons use `aria-pressed`; Gemini suggests a tab pattern. A real tab pattern also needs arrow-key handling, so it was left for a deliberate change. Gemini also called the hero copy generic. It is provisional until the artist's brand file arrives.

### Competitor teardown (research/competitor-builders.md)

Only 4 of 7 sites could be read (three returned 403/429), no builder was seen rendered, nothing was tested on a phone. Adopted: a running total in the sticky phone preview (verified: $30.00 to $30.75 after adding a bead). Waiting on the artist: lead time and custom-item return rule beside the price, gift note, "exactly as shown / maker may adjust" choice, real-size cue.

## Update 2026-10-27 (Tomato sizing)

- Added Regular, Small, and Mini tomato-size choices to the builder. The selection changes the illustration and is preserved in saved designs, shared links, and Shopify line-item design details; old `v1` links restore as Regular.
- Tomato dimensions/weight and bead, key-ring/clasp, phone-loop, and dust-plug measurements are still pending artist confirmation. The storefront labels them as unconfirmed rather than displaying estimates.
- Added the missing catalog entries for two expressions already used by ready-made designs; this prevents the shop homepage from failing before products and their sizing notes render.
- Browser check: selected Small and confirmed the preview updates; bead and finishing steps show pending measurements for each option. The shop homepage renders all three ready-made cards with pending sizing notes.
- Size prices are $7.50 Regular, $6.50 Small, and $5.50 Mini; personality placeholder extras range from included to $1.00. The selected size and personality are separate bill-of-materials lines and use separate Shopify catalog keys (43 keys total).
- Browser check confirms selecting Mini shows its $5.50 base price, updates the tomato preview, and displays personality add-ons.
- Focused sizing, price calculation, migration, and mocked checkout tests pass (7/7). Current full suite: 52/53 pass; one existing brand announcement copy mismatch remains.
- Added `ideas.html` as a full-catalog page; the homepage keeps its three-card preview and links to the dedicated collection. The page reuses shared product cards and bag actions, so new `PRODUCTS` entries appear without needing homepage space.

## Update 2026-10-27 (Clasp-first builder)

- Reordered the builder to clasp → tomato mood → beads → finish. Dust plugs set the tomato to Small; phone loop, key ring, and lobster clasp set it to Regular. The tomato-size base price and selected clasp price are visible before moving on; mood options and their placeholder add-ons remain.
- Kept 1–3 strands for every clasp. Dust-plug strands are limited to 1–3 beads; the other clasps allow 1–5. Existing saved/share designs are normalized to the new clasp sizing and bead limits; checkout rejects designs outside them.
- Browser check: USB-C dust plug selected Small at $6.50 base; the tomato step showed the size without a picker; bead step kept all three strand choices and disabled adding a fourth bead.
- Focused builder, core, server, and syntax checks pass. Full `npm test`: 55/56 pass; the remaining existing brand test fails because the static announcement in `dist/index.html` includes an exclamation mark absent from `SHOP.brand`.

## Update 2026-10-27 (Studio finish and inspiration)

- Removed the separate Finish step; the clasp remains selected on step one, and Add to bag/Update bag is available on the beads step. The studio now has only Clasp, Tomato, and Beads.
- Added three predesigned listings at the bottom of the studio page and a “See more” link to `ideas.html`.
- Added automated markup checks for the three-step flow and inspiration section. Browser validation confirms 3 steps, Add to bag visible on the Beads step, Next hidden there, and three inspiration cards with a `ideas.html` link.
- Full `npm test`: 56/57 pass. The sole failure is the existing brand announcement mismatch: static text in `dist/index.html` contains an exclamation mark absent from `SHOP.brand`.
- Browser check confirms all three current ideas render on the new page and a ready-made item can be added to and viewed in the shared bag. Dedicated-page test passes; current full suite is 53/54, with only the pre-existing announcement copy mismatch failing.
