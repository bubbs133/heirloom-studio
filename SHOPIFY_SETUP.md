# Shopify setup and launch gate

## Which checkout path to use

| Path | Config | Use |
| --- | --- | --- |
| **Checkout API** (`server/`) | `SHOP.api.enabled` | The path for real orders. The browser sends designs; the artist-owned Worker prices them, adds the mandatory lines and creates the Shopify checkout. Read `server/README.md` first. |
| Direct Storefront API | `SHOP.shopify.enabled` | Described below. For testing only: the browser builds the order lines, so a modified browser can drop a line. Ignored while `SHOP.api.enabled` is true. |
| Preview | neither | Placeholder prices; checkout disabled. This is what ships. |

The sections that follow describe the direct Storefront path and the catalog both paths share (sections 1 and 3 apply to both; section 2's `shopify` block is only for the direct path).

## Integration implemented

This static frontend calls the **Storefront API**, pinned to `2026-10`, using a **public Storefront access token**. Shopify owns merchandise prices and its hosted checkout. The frontend never collects card data or calls an Admin API.

The adapter loads `ProductVariant.price` and `availableForSale`, then creates a cart with `cartCreate`. It sends selected component quantities and human-readable design instructions as cart-line attributes, checks for errors/warnings and unexpected quantity adjustments, and redirects to the returned HTTPS `checkoutUrl` only after comparing subtotal and currency. These are implemented code paths, tested with mocks; they have not been exercised against a real store.

Official references consulted October 24, 2026:

- [Storefront API and public access](https://shopify.dev/docs/api/storefront/2026-10)
- [CartLineInput: merchandise, quantities and attributes](https://shopify.dev/docs/api/storefront/2026-10/input-objects/CartLineInput)
- [cartCreate and checkoutUrl](https://shopify.dev/docs/api/storefront/2026-10/mutations/cartCreate)
- [ProductVariant](https://shopify.dev/docs/api/storefront/2026-10/objects/ProductVariant)
- [Shopify Storefront API learning kit](https://github.com/Shopify/storefront-api-learning-kit)

## 1. Store ownership and catalog

Use an artist-owned Shopify store with the appropriate headless/custom storefront setup. Confirm available account features and costs before subscribing; no subscription is set up by this project. Create a public Storefront token through Shopify's supported headless workflow with the product/cart access required by the API. Publish these products/variants to that storefront channel. Never expose an Admin token, a private Storefront token, or any payment credential in `dist/`.

The current implementation maps **43 catalog keys**:

| Catalog key | Meaning | Example demo price |
| --- | --- | --- |
| `assembly` | Custom assembly labor, one per finished custom charm | $3.00 |
| `strand` | Stringing labor/materials, one per strand | $1.50 |
| `tomato-size-regular`, `tomato-size-small`, `tomato-size-mini` | Tomato base price by size | $5.50–$7.50 (placeholders) |
| `tomato-serious`, `tomato-grumpy`, `tomato-formal`, `tomato-bday`, `tomato-love`, `tomato-wink` | Personality surcharge; Serious is included at $0.00 | $0.00–$1.00 (placeholders) |
| `clasp-ring`, `clasp-lobster`, `clasp-phone`, `clasp-dust-usbc`, `clasp-dust-lightning` | Hardware, one per custom charm | $2.00–$3.00 |
| `bead-{color}-{type}` | Color-specific bead component, one per selected bead | $0.75–$1.25 |
| `product-garden-party`, `product-sweet-thing`, `product-cherry-on-top` | Complete ready-made item, one SKU per design | $22.00–$26.00 |

Colors: `poppy`, `pink`, `cream`, `green`, `blue`, `lavender`.

Types: `round`, `pearl`, `flower`, `star`. All 24 combinations are separate catalog keys. Use product variants for these options. Extract real ProductVariant GIDs through Shopify's supported admin/API workflow; do not substitute product GIDs or handles.

Set assembly and strand-labor variants as non-shipping service entries as appropriate for the actual store. Track stock on tomatoes, beads, and clasps as appropriate; configure physical weights and shipping on actual physical items so the resulting component cart has correct delivery calculations. Do not track finite inventory on a labor-only service unless the artist wants a capacity limit.

Ready-made stock is modeled separately. Selling a ready-made currently does not deduct its constituent raw bead/tomato stock. Decide whether these are preassembled units with dedicated inventory or need a real bundle/BOM solution before launch.

## 2. Public configuration

Update `dist/js/config.js`:

```js
shopify: {
  enabled: true,
  domain: 'YOUR-REAL-SHOP.myshopify.com',
  publicStorefrontToken: 'PUBLIC-STOREFRONT-TOKEN-ONLY',
  apiVersion: '2026-10',
  variants: {
    assembly: 'gid://shopify/ProductVariant/REAL_ID',
    strand: 'gid://shopify/ProductVariant/REAL_ID',
    // ... every key emitted by catalogEntries()
  }
}
```

The example values intentionally fail validation. Map every key before enabling the store; missing entries disable checkout. To print the exact keys locally:

```sh
node --input-type=module -e "import {catalogEntries} from './dist/js/catalog.js'; console.log(catalogEntries().map(([k])=>k).join('\n'))"
```

Set `SHOP.currency` to the store's selling currency. This version supports a single currency; it blocks mismatched API currencies. It requests default store pricing without a country context. Market-aware pricing, duty estimates, market selectors, and localization require a separate implementation. Final shipping/tax are Shopify's responsibility; verify those store settings before launch.

## 3. Understand the custom-charm model

Custom designs use actual component merchandise lines rather than a fake base product with a client-supplied price. For example, a quantity of 2 charms with two 3-bead strands submits 2 assemblies, 2 tomatoes, 4 strands, 2 clasps, and 12 beads, aggregated by bead variant within that design.

Each line has these attributes:

- `Charm group`: stable ID linking lines belonging to one design.
- `Charm quantity`: number of finished charms represented by those components.
- `Design`: tomato, numbered strands with ordered color/shape instructions, and clasp.
- `Component`: the frontend catalog key.

Verify the exact resulting order display in Shopify Admin, fulfillment documents, and customer notifications. Shopify line item quantities will count **components**, not just finished charms; the site bag counts finished charms. Do not label Shopify's component quantity as a count of completed charms.

### Important limitation to resolve

**Resolved by the Checkout API, on paper.** `server/` enforces the design limits, adds the assembly and strand lines itself, rejects price overrides and audits finished orders. That has been tested against a mock only; the facts below still need a real store. The limitation below describes the direct Storefront path.

The direct Storefront path is a component-cart foundation, **not a server-enforced bundle**. The browser enforces design bounds and checks cart output, but those rules do not independently secure a headless API. Cart-line attributes are customer-supplied instructions, not trusted pricing or inventory controls. A buyer could alter component lines later in a checkout flow if the merchant's configuration permits it.

Before real orders, implement and test a supported Shopify validation/bundle/cart-transform strategy that preserves one complete charm and its inventory, or explicitly choose an artist-reviewed made-to-order workflow. Check feature availability on the selected store plan; do not assume all Shopify Functions/bundle capabilities are available. If custom assembly labor must always be charged, enforce it server-side. Never rely on the UI or a hidden field for that rule.

## 4. Live acceptance checklist

- [ ] Artist owns the Shopify account, domain, and hosting access.
- [ ] Real branding, photos, materials, item dimensions, hardware compatibility, prices, dispatch times, and business email are approved.
- [ ] All 38 keys are mapped and published; API prices, currency and sold-out states match Admin.
- [ ] Complete-charm composition and mandatory labor charges are enforced using the selected Shopify strategy.
- [ ] Ready-made versus raw-component inventory accounting is agreed and tested.
- [ ] A maximum design (3 strands × 5 beads), quantity 2, yields the correct BOM and price.
- [ ] A mixed ready-made/custom order retains each configuration through checkout, Admin, confirmation email, and fulfillment view.
- [ ] A real Shopify test-mode order completes without charging a live card; verify payment status, order creation, inventory decrement and configuration instructions.
- [ ] Inventory exhaustion and concurrent ordering never create an incomplete charm. `availableForSale` is only a coarse status; checkout is responsible for quantity-level validation.
- [ ] Price changes, missing variants, offline/timeout, API errors, cancelled checkout, and browser back navigation behave correctly.
- [ ] Shipping, tax, returns, privacy, refund, and any required business disclosures are configured and published.
- [ ] Final mobile, keyboard, contrast, screen reader, and touch-target checks pass.
- [ ] Remove preview-only copy and do a full purchase-path retest before public opening.

## 5. What only a real store can confirm

Run these on a development store with the Checkout API deployed, before any real order. Until each is confirmed, treat the related behavior as unproven.

1. Plan tier (Basic, Grow, Advanced, Plus): drives rate limits and whether Functions are possible later.
2. Dev Dashboard access for the artist's login, and that the client-credentials grant succeeds (it fails with `shop_not_permitted` if the app and store are in different organizations).
3. Whether `draftOrderCreate` accepts a variant that is **not published to any channel**, and the invoice checkout lets it be bought. This decides whether un-publishing the components makes the API the only way to buy them.
4. Whether `DraftOrder.invoiceUrl` works as a plain redirect without sending the invoice email, whether it expires, and whether prices are locked for an API-created draft.
5. What the draft checkout collects (email, address, shipping method) and which shipping rates it offers when the draft has no shipping line; whether Shop Pay and Apple Pay appear.
6. Whether the `orders/create` webhook fires when a draft is paid and carries `line_items[].properties` (needed by the order audit; the Shopify docs disagree on the trigger).
7. Inventory: each tracked component decrements once per sale, the untracked assembly line causes no stock error, and one bead at zero stops checkout with nothing charged. The API checks stock when the draft is created; a draft does not necessarily hold stock afterwards, so two buyers could both reach checkout for the last bead. Find out what the paid checkout does then, and whether holding stock on the draft (Shopify's draft-order inventory reservation option) is worth adding.
8. Draft-order line limits: a bag of 20 designs can reach about 380 lines. Check that `draftOrderCreate` accepts it and how long it takes.
9. Bypass test: with components un-published, a hand-built Storefront `cartCreate` must not be able to buy them, while the public token still reads the ready-made products.
10. Protected customer data: whether this app receives order webhooks with the fields the audit needs on the artist's plan (Shopify's developer docs and help center disagree).
11. Tax category of the assembly-labor line, shipping weights for physical components, and the production-time promise shown at checkout.
12. Currency: a draft follows the buyer's market. Confirm single-currency behavior matches the site's check.

Not run: Cart Transform and Validation Functions (Plus-only for custom apps; a public app needs Shopify review). They are the upgrade path if the draft-order checkout proves too limited.

No live order, payment, inventory decrement, refund, fulfillment action, webhook, or administrative operation has been performed in this build.
