# Sonnet / Opus handoff — Little Tomato

## A. Full continuation brief

You are taking over an existing, functioning storefront foundation. Read `README.md`, `SHOPIFY_SETUP.md`, `QA_REPORT.md`, and the code before making changes. Preserve the work and improve it; do not replace it with a new unrelated scaffold. Ask only for information that blocks a concrete next step.

### Product brief to preserve

- A friend's tomato-themed handmade polymer clay charm store. Core experience: a Build-A-Bear-style configurator. Desktop has exactly two main windows: rendered charm on the left, three steps on the right: (1) clasp, (2) tomato expression with clasp-selected size, and (3) 1–3 strands with individually chosen beads per strand. Add the design directly after beads; there is no separate finish step. Dust plugs allow 1–3 beads per strand; other clasps allow 1–5. Choices show prices and update the rendered design. Mobile should stack those windows naturally.

Include ready-made listings, a thoughtful landing page, artist/about, contact, FAQ/care, and honest reviews. Vibe: playful, clean, polished, with subtle tomatoes and stars. Use **Borel** and **Urbanist**. The store name is **Heirloom Studio**; final logo and brand assets have not arrived. Use Shopify for real commerce, inventory, orders, and secure hosted checkout. The artist must eventually be able to own and maintain the shop.

### What exists

- Dependency-free ES modules; `dist/` is the complete deployable static site.
- Configurable SVG illustrations; no stock product images or fake product photos.
- Four tomatoes, six bead colors, four bead shapes, 24 bead combinations, four hardware options.
- Clasp-selected tomato sizes and bead limits validated in `core.js`; prices calculated in integer cents.
- Fully interactive builder, default design presets, detailed price breakdown, saved SVG download.
- Local design/bag storage with restore sanitization, quantities, removal, and ready-made/custom items.
- Storefront API adapter, pinned `2026-10`; real variant/BOM mapping, live prices/availability, cart creation, error/warning/quantity checks, subtotal comparison, checkoutUrl navigation.
- Self-hosted fonts and OFL licenses.
- 10 automated tests, desktop browser interaction checks, mobile 390 px iframe checks.

### Priorities, in order

1. **Review the existing implementation and reproduce the working demo.** Run `npm test`; serve `dist/` over HTTP. Preserve all current behavior while improving it. Report any bug with a reproduction and fix.
2. **Get the artist's actual brand file, name, photographs, component artwork, public contact, and approved prices.** Replace the placeholder brand consistently. Centralize all brand/artist copy in configuration; `SHOP.brand` is not currently wired into visible copy. Make the illustrations match the physical assembly and dimensions; the current strand layout is a concept preview.
3. **Resolve the commerce architecture before enabling payments.** Read the component-cart limitations in `SHOPIFY_SETUP.md`. Enforce complete custom-charm composition and assembly pricing server-side with a supported Shopify strategy. Verify current plan/API compatibility from official documentation; do not assume Shopify bundle/cart-transform availability. Map real variants, publish products, verify shipping/tax, test order details and inventory, and complete a test-mode order. Never put Admin/private tokens in the frontend or ask for secrets in chat.
4. **Polish the builder without changing its constraints.** Preserve clasp → tomato → beads → finish, automatic tomato size from clasp, 1–3 strands, and clasp-specific bead limits. Add or refine edit-in-bag, reorder beads, optional undo/redo, per-design save/share links, larger touch targets where needed, clear component stock feedback, and a polished mobile preview. Selected bead position should be visible on the live illustration, not just the control row. Consider direct selection from the illustration and a sticky mobile preview. Keep an accessible keyboard path and reduced-motion behavior.
5. **Improve maintainability with a purpose.** Extract the monolithic DOM event/render code into focused builder/cart/UI modules; keep core pure functions and adapters separate. TypeScript or React is optional if it helps the ongoing workflow; do not migrate frameworks merely for preference. Make products/variants/content maintainable by the artist, ideally through Shopify products/metafields rather than hand edits.
6. **Finish production content and operations.** Accurate product photography, compatibility, delivery times, shipping/returns/privacy pages, real contact delivery if requested, verified-purchase reviews with moderation, product detail pages, SEO/social previews and structured data only for actual products. Avoid invented scarcity, ratings, testimonials or environmental claims.
7. **Expand verification only where it adds evidence.** Add integration/browser tests for design edits, stocks/prices changing before checkout, multiple custom groups, component quantity propagation, ready-made BOM handling, mobile keyboard navigation, storage corruption, network failure and checkout return. Run an actual real-store Shopify test-mode order when access is available. Record what passed and what was not tested.

### Known engineering limitations

- Live Shopify is **not configured or live-tested**; the current adapter tests use mocked fetch responses.
- `availableForSale` is coarse; exact multi-item quantities and stock races require Shopify checkout/server validation.
- Custom lines are components, not an atomic bundle; prebuilt inventory is separate from component inventory.
- One currency/default store context. No country selector, multi-market pricing or localization.
- No custom backend, admin app, order database, customer accounts, review submission/moderation, contact form service, emails, or webhook handling.
- No automatic post-purchase bag cleanup: local cart remains after navigating to checkout. Reconcile checkout state before adding this; do not clear the bag on mere redirect.
- UI uses `innerHTML` for controlled catalog content; dynamic design descriptions are escaped. Preserve escaping when adding remote content.
- SVGs are concept artwork. The builder cannot promise manufacturing geometry or exact colors.
- Tiny bead and count controls could use a more generous touch treatment. Mobile was checked at 390 px using an iframe, not physical iOS Safari.
- The artist's real brand and account ownership still need onboarding; the owner's current private Site is not automatically transferred.

### Design direction

Cream `#f8f5eb`, dark leaf text `#323d2e`, tomato `#bb3d30`, leaf `#46643f`, dusty pink/lilac accents. Soft borders and restrained radii. A checked green hero backdrop, tilted postcard, original glossy tomato SVGs, editorial whitespace, small uppercase eyebrows. Borel for warm accents, Urbanist for readable body text and controls. Preserve the two-window studio and product-first composition. Improve spacing and material realism without turning it into a generic dashboard or a heavily animated page.

### Acceptance criteria

- Existing tests pass, with meaningful new tests for changed behavior.
- Constraints remain 1–3 strands, 1–3 beads per dust-plug strand, and 1–5 per other clasp, with individually editable colors/types.
- View, bill of materials, bag configuration and Shopify order instructions agree.
- No payment claims, fake inventory sync, fabricated reviews or placeholder items disguised as real products.
- Missing or broken shop configuration never initiates payment.
- Production launch requires authoritative pricing, enforced assembly/BOM rules, verified inventory behavior and a test-mode checkout.
- Artist can update real products, understand hosting, and own all production accounts.

### Suggested first response

Summarize the current code in a few bullets, identify the three highest-value gaps, and execute the first concrete improvement. Separate completed evidence from work blocked by missing artist/store inputs. Deliver a concise change log and any required owner decisions.

## B. Short continuation prompt

Continue this existing tomato charm shop. Read README.md, SHOPIFY_SETUP.md, CLAUDE_HANDOFF.md and QA_REPORT.md, run the tests, and improve the current build. Preserve Borel + Urbanist, the playful clean design, ready-made listings and the two-window live builder: left preview, right steps for clasp → tomato → beads, with add-to-bag available from the beads step (no finish step). Tomato size is selected automatically by clasp; dust plugs allow 1–3 beads on up to 3 strands, other clasps 1–5 beads on up to 3 strands. The studio page ends with three inspiration designs and a “See more” link to the full ideas page. Prioritize real branding/content, mobile polish, edit-in-bag and maintainable modules. Resolve and enforce the Shopify component/BOM and assembly-pricing model before enabling payment. Current storefront is demo mode; Shopify integration is implemented but not live-tested. Do not invent reviews or call this production-ready. Make concrete changes, test them and hand back evidence.



## C. Progress log

**2026-10-25, Claude Sonnet 5.5.** Done: undo/redo, shuffle, move-bead, tap-to-select, share links, edit-in-bag, 44 px touch targets, sticky phone preview, USB-C/Lightning dust plugs, `SHOP.brand` for all brand strings (provisional until the artist's file arrives), a server-enforced checkout API (`server/`) with a front-end adapter (`dist/js/remote.js`, `dist/js/commerce.js`), an order audit, and 45 tests. Decision record: `research/shopify-architecture.md` (Option B: draft orders created by an artist-owned Worker). Cross-family review: `research/cdxr-review-33cdf18.md`.

Next, in order:
1. A development-store rehearsal against `SHOPIFY_SETUP.md` section 5 (needs the artist's store and Dev Dashboard app; do not create accounts for her).
2. Turnstile widget on the page, then set `TURNSTILE_SECRET`.
3. Split `dist/js/app.js` (render functions vs. event wiring) once the above is stable.
4. Replace `SHOP.brand` and the artwork when the brand file arrives.
5. Physical iPhone check.

**Owner decisions needed from the artist** (nothing here may be written into the page until she confirms it): dispatch time for made-to-order items; return rule for custom items; metals in clasps and rings (nickel-free?); bead material; bead and tomato dimensions and weight, which also enable a real-size cue; whether she wants a gift note and an "exactly as shown / maker may adjust" choice; USB-C and Lightning dust plug sourcing and prices; shipping regions and charges.

Also done 2026-10-25: legibility pass (muted text colour, 45 tiny text sizes), phone preview shows a running total, star decoration no longer touches the studio note on phones. The phone preview total is `#preview-total`, set in `app.js` next to `#builder-price`.
