# Checkout API

A small Cloudflare Worker that turns a bag of **designs** into a Shopify checkout. The browser never sends prices or order lines; this server decides both.

```
browser (static site)  ──POST /checkout {bag}──▶  Worker  ──Admin GraphQL──▶  Shopify
                       ◀── {checkoutUrl, cost} ──          draftOrderCreate (no price overrides)
                                                           ▼
                                           customer pays on Shopify's own checkout page
```

**Status: written and tested against a mock Shopify only.** Nothing here has run against a real store. `SHOPIFY_SETUP.md` lists what a rehearsal on a development store must confirm before any real order.

## What it does

| Route | Purpose |
| --- | --- |
| `GET /prices` | Catalog prices (integer cents), availability and currency, read from Shopify and cached for 60 s. Variant IDs are never sent to the browser. |
| `POST /checkout` | Body `{bag, turnstileToken?}`. Validates every design with the same rules as the site, adds the assembly and billable strand/bead lines itself (one strand of three beads is included for every clasp; extra strands and beads are billed), checks availability and stock, creates a draft order, then re-checks what Shopify built. |
| `POST /webhooks/orders-create` | Optional audit. After an order is placed, compares its lines with the design recorded on them and tags the order `needs-review` if they disagree. Only active when `ORDER_WEBHOOKS=on`; the request must carry a valid Shopify HMAC (bodies up to 2 MB, because a 20-design order is larger than a checkout request). |
| `GET /health` | `{ok:true}`. |
| daily cron | Deletes this API's own abandoned draft orders (tag `lt-web`, still open, never completed, older than `DRAFT_MAX_AGE_HOURS`), at most 40 per run so it stays inside the Workers free plan's 50 outgoing requests; the next run continues. |

A draft is deleted and the buyer sees an error if Shopify's answer is not exactly what the catalog predicts: any price override, a different currency, a different subtotal, or a non-https invoice link.

Refused before Shopify is contacted: other sites' origins, bags that fail validation (1–20 items, quantity 1–10, 1–3 strands; 1–3 beads per dust-plug strand or 1–5 per other clasp; known catalog IDs and clasp-selected tomato size), bodies over 64 KB, more than 10 checkouts per 10 minutes from one address, and (if configured) requests without a valid Turnstile token.

## Who owns what

The artist owns every production account: the Shopify store, the Shopify Dev Dashboard app, the Cloudflare account and the domain. Whoever sets this up should do it while signed in as the artist, or be added to her organization with her approval. No credentials belong in this repository.

## Setup (once, on a development store first)

1. **Shopify.** In the Dev Dashboard create an app in the *same organization* as the store. Grant only `read_products` and `write_draft_orders` (add `read_draft_orders` for the daily cleanup, and `write_orders` for the review tag). Install it on the store. Copy the client ID and secret.
2. **Catalog.** Create one product variant per catalog key (list below) and put each variant's GID in `VARIANTS_JSON`. Un-publish the component variants from every sales channel so they can only be bought through this API (needs testing: see fact 3 in `SHOPIFY_SETUP.md`).
3. **Cloudflare.** In `wrangler.toml` fill `SHOPIFY_SHOP`, `ALLOWED_ORIGINS`, `CURRENCY` and `VARIANTS_JSON`. Then:

   ```sh
   cd server
   npx wrangler secret put SHOPIFY_CLIENT_ID
   npx wrangler secret put SHOPIFY_CLIENT_SECRET
   npx wrangler secret put TURNSTILE_SECRET   # optional
   npx wrangler deploy
   ```
4. **Site.** In `dist/js/config.js` set `SHOP.api = {enabled:true, url:'https://…workers.dev', allowedCheckoutHosts:['<shop>.myshopify.com']}` and publish `dist/`.
5. **Optional order audit.** Point an `orders/create` webhook at `/webhooks/orders-create`, then set `ORDER_WEBHOOKS=on`. The webhook is signed with the app's client secret, which is the same value as `SHOPIFY_CLIENT_SECRET`.

Print the catalog keys that need a variant:

```sh
node --input-type=module -e "import {catalogEntries} from './dist/js/catalog.js'; console.log(JSON.stringify(Object.fromEntries(catalogEntries().map(([k])=>[k,'gid://shopify/ProductVariant/…'])),null,1))"
```

## Fails closed

The Worker answers `503` to every route, `/health` included, if a secret is missing, `VARIANTS_JSON` is incomplete, contains something that is not a ProductVariant ID or reuses one ID for two catalog keys, or `ALLOWED_ORIGINS` is empty. The site then keeps checkout disabled.

## Not done

- **Turnstile on the site.** The server verifies a token when `TURNSTILE_SECRET` is set, but the page does not yet show the widget, so leave the secret unset until it does.
- **Rate limit is per Worker instance.** It slows casual abuse; it is not a global limit. Use a Cloudflare rate-limiting rule if the shop gets real traffic.
- **Order audit only reports.** It tags an order for review; it does not cancel or refund anything.
- **Not rehearsed on a real store.** See `SHOPIFY_SETUP.md`, "What only a real store can confirm".

## Tests

`npm test` runs `tests/server.test.js` with a mocked Admin client: tampered bags, price and currency drift, sold-out stock, origin and size limits, rate limiting, Turnstile, webhook signatures, draft cleanup, token refresh and secret handling.
