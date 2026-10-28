// Checkout API. The browser sends DESIGNS, never prices or order lines; every price, quantity and
// mandatory line (assembly, strands) is derived here from the same rules the storefront uses (dist/js/core.js).
// Pure of Cloudflare specifics: pass in an `admin` client and plain config so it can be tested with mocks.
import {
  sanitizeCart,
  itemComponents,
  makeCartLines,
} from "../dist/js/core.js";
import { catalogEntries } from "../dist/js/catalog.js";
import { auditOrder } from "./audit.js";

const TAG = "lt-web";
const MAX_WEBHOOK_BYTES = 2_000_000; // a 20-design order can carry ~400 lines with long design text
const CLEANUP_MAX_PAGES = 5,
  CLEANUP_MAX_DELETES = 40; // stays under the Workers free plan's 50 subrequests per run
const CATALOG_QUERY = `query Catalog($ids:[ID!]!){shop{currencyCode} nodes(ids:$ids){... on ProductVariant{id price availableForSale inventoryQuantity inventoryPolicy}}}`;
const DRAFT_CREATE = `mutation Draft($input:DraftOrderInput!){draftOrderCreate(input:$input){draftOrder{id invoiceUrl currencyCode anyVariantPricesOverridden subtotalPriceSet{shopMoney{amount currencyCode}}} userErrors{field message}}}`;
const DRAFT_DELETE = `mutation Del($input:DraftOrderDeleteInput!){draftOrderDelete(input:$input){deletedId userErrors{field message}}}`;
const DRAFTS_OLD = `query Old($q:String!,$after:String){draftOrders(first:50,after:$after,query:$q){nodes{id status tags createdAt completedAt} pageInfo{hasNextPage endCursor}}}`;
const TAGS_ADD = `mutation Tag($id:ID!,$tags:[String!]!){tagsAdd(id:$id,tags:$tags){node{id} userErrors{field message}}}`;

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const toCents = (amount) => {
  if (typeof amount !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(amount))
    throw new ApiError(
      502,
      "bad-price",
      "The shop returned an unreadable price.",
    );
  return Math.round(Number(amount) * 100);
};
const centsToAmount = (c) => (c / 100).toFixed(2);

async function hmacBase64(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)),
  );
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin);
}
const safeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export function createApi({
  admin,
  variants,
  allowedOrigins = [],
  currency = "USD",
  turnstileSecret = "",
  webhookSecret = "",
  fetchImpl = fetch,
  now = () => Date.now(),
  maxBodyBytes = 65536,
  catalogTtlMs = 60_000,
  draftMaxAgeHours = 72,
  perIpLimit = { max: 10, windowMs: 600_000 },
  log = (...a) => console.error(...a),
}) {
  const entries = catalogEntries();
  const missing = entries
    .map(([k]) => k)
    .filter(
      (k) =>
        !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variants?.[k] || ""),
    );
  if (missing.length)
    throw new Error("Variant map is incomplete: " + missing.join(", "));
  const ids = entries.map(([k]) => variants[k]);
  if (new Set(ids).size !== ids.length)
    throw new Error(
      "Variant map reuses a variant ID for more than one catalog key.",
    );
  const keyByVariant = Object.fromEntries(
    entries.map(([k]) => [variants[k], k]),
  );
  const origins = new Set(allowedOrigins.filter(Boolean));
  if (!origins.size)
    throw new Error("At least one allowed origin is required.");

  const json = (status, body, headers = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        ...headers,
      },
    });
  const fail = (status, code, message, extra) =>
    json(status, { error: code, message, ...extra });

  // ---- catalog (prices + availability), cached briefly
  let cache = null;
  async function loadCatalog() {
    if (cache && now() < cache.exp) return cache.value;
    const ids = [...new Set(entries.map(([k]) => variants[k]))];
    const data = await admin.graphql(CATALOG_QUERY, { ids });
    if (data.shop?.currencyCode !== currency)
      throw new ApiError(
        503,
        "currency",
        "The shop currency does not match the storefront.",
      );
    const nodes = new Map(
      (data.nodes || []).filter(Boolean).map((n) => [n.id, n]),
    );
    const prices = {},
      availability = {},
      stock = {};
    for (const [key] of entries) {
      const n = nodes.get(variants[key]);
      if (!n)
        throw new ApiError(
          503,
          "catalog",
          "The shop catalog is not fully connected.",
        );
      prices[key] = toCents(n.price);
      availability[key] = n.availableForSale === true;
      stock[key] =
        n.inventoryPolicy === "DENY" && Number.isInteger(n.inventoryQuantity)
          ? n.inventoryQuantity
          : null; // null = no tracked limit
    }
    const value = { prices, availability, stock, currency };
    cache = { value, exp: now() + catalogTtlMs };
    return value;
  }

  // ---- guards
  const originOf = (request) => request.headers.get("origin") || "";
  const cors = (origin) =>
    origins.has(origin)
      ? {
          "access-control-allow-origin": origin,
          vary: "Origin",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "600",
        }
      : { vary: "Origin" };
  const hits = new Map();
  function limited(ip) {
    const t = now(),
      w = hits.get(ip)?.filter((x) => t - x < perIpLimit.windowMs) || [];
    if (w.length >= perIpLimit.max) {
      hits.set(ip, w);
      return true;
    }
    w.push(t);
    hits.set(ip, w);
    if (hits.size > 5000)
      for (const [k, v] of hits)
        if (!v.some((x) => t - x < perIpLimit.windowMs)) hits.delete(k);
    return false;
  }
  // Reads at most maxBodyBytes, even when the sender hides the real size (chunked bodies).
  async function readText(request, limit = maxBodyBytes) {
    if (Number(request.headers.get("content-length") || 0) > limit)
      throw new ApiError(413, "too-large", "That request is too large.");
    if (!request.body) return "";
    const reader = request.body.getReader(),
      parts = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(413, "too-large", "That request is too large.");
      }
      parts.push(value);
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const part of parts) {
      all.set(part, at);
      at += part.byteLength;
    }
    return new TextDecoder().decode(all);
  }
  async function readJson(request) {
    const text = await readText(request);
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(400, "bad-json", "That request could not be read.");
    }
  }
  async function verifyTurnstile(token, ip) {
    if (!turnstileSecret) return;
    if (typeof token !== "string" || !token || token.length > 2048)
      throw new ApiError(
        403,
        "challenge",
        "Please complete the check and try again.",
      );
    const body = new URLSearchParams({
      secret: turnstileSecret,
      response: token,
    });
    if (ip) body.set("remoteip", ip);
    const r = await fetchImpl(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const j = r.ok ? await r.json() : {};
    if (j.success !== true)
      throw new ApiError(
        403,
        "challenge",
        "Please complete the check and try again.",
      );
  }

  // ---- routes
  async function prices() {
    const c = await loadCatalog();
    return json(200, {
      prices: c.prices,
      availability: c.availability,
      currency: c.currency,
    });
  }

  async function checkout(request) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (limited(ip))
      throw new ApiError(
        429,
        "rate-limit",
        "Too many checkouts from this connection. Please wait a few minutes.",
      );
    const body = await readJson(request);
    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray(body.bag) ||
      !body.bag.length ||
      body.bag.length > 20
    )
      throw new ApiError(400, "bad-bag", "Your bag needs to be refreshed.");
    await verifyTurnstile(body.turnstileToken, ip);
    const safe = sanitizeCart(body.bag, { normalizeDesigns: false });
    if (safe.length !== body.bag.length)
      throw new ApiError(400, "bad-bag", "Your bag needs to be refreshed.");
    const email =
      typeof body.email === "string" &&
      body.email.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
        ? body.email
        : undefined;

    // What the bag is worth and needs, from server-side rules and prices only.
    const catalog = await loadCatalog();
    const need = new Map();
    for (const item of safe)
      for (const c of itemComponents(item))
        need.set(c.key, (need.get(c.key) || 0) + c.quantity * item.quantity);
    const short = [...need]
      .filter(
        ([k, q]) =>
          !catalog.availability[k] ||
          (catalog.stock[k] !== null && q > catalog.stock[k]),
      )
      .map(([k]) => k);
    if (short.length)
      throw new ApiError(
        409,
        "unavailable",
        "Some picks are no longer available. Please review your bag.",
        { unavailable: short },
      );
    const expectedCents = [...need].reduce(
      (n, [k, q]) => n + catalog.prices[k] * q,
      0,
    );

    const lines = makeCartLines(safe, variants);
    const input = {
      lineItems: lines.map((l) => ({
        variantId: l.merchandiseId,
        quantity: l.quantity,
        customAttributes: l.attributes,
      })),
      tags: [TAG],
      note: "Created by the Little Tomato checkout API. Each line carries its Charm group and Design code.",
      ...(email ? { email } : {}),
    };
    const data = await admin.graphql(DRAFT_CREATE, { input });
    const result = data.draftOrderCreate;
    const draft = result?.draftOrder;
    if (result?.userErrors?.length || !draft) {
      log(
        "draftOrderCreate userErrors",
        JSON.stringify(result?.userErrors || null),
      );
      throw new ApiError(
        502,
        "draft-failed",
        "Checkout is unavailable right now. No payment was taken.",
      );
    }

    // Verify what Shopify actually built before the customer sees it; discard it if anything is off.
    const reject = async (status, code, message) => {
      await discard(draft.id);
      throw new ApiError(status, code, message);
    };
    if (draft.anyVariantPricesOverridden !== false)
      await reject(
        502,
        "price-override",
        "Checkout is unavailable right now. No payment was taken.",
      );
    const sub = draft.subtotalPriceSet?.shopMoney;
    if (
      !sub ||
      sub.currencyCode !== currency ||
      draft.currencyCode !== currency
    )
      await reject(
        502,
        "currency",
        "Checkout is unavailable right now. No payment was taken.",
      );
    if (toCents(sub.amount) !== expectedCents) {
      cache = null;
      await reject(
        409,
        "price-changed",
        "Prices changed while you were building. Please review your bag.",
      );
    }
    let url;
    try {
      url = new URL(draft.invoiceUrl);
    } catch {
      url = null;
    }
    if (!url || url.protocol !== "https:")
      await reject(
        502,
        "bad-url",
        "Checkout is unavailable right now. No payment was taken.",
      );

    return json(200, {
      checkoutUrl: url.href,
      cost: {
        subtotalAmount: {
          amount: centsToAmount(expectedCents),
          currencyCode: currency,
        },
      },
    });
  }

  async function discard(id) {
    try {
      const r = await admin.graphql(DRAFT_DELETE, { input: { id } });
      return (
        !r.draftOrderDelete?.userErrors?.length &&
        !!r.draftOrderDelete?.deletedId
      );
    } catch (e) {
      log("could not delete draft", id, e.message);
      return false;
    }
  }

  // Orders/create webhook: re-check every paid order against its design codes; tag mismatches for the artist.
  async function ordersWebhook(request) {
    if (!webhookSecret) return fail(404, "not-found", "Not found.");
    const text = await readText(request, MAX_WEBHOOK_BYTES);
    const given = request.headers.get("x-shopify-hmac-sha256") || "";
    if (!safeEqual(given, await hmacBase64(webhookSecret, text)))
      return fail(401, "bad-signature", "Unauthorized.");
    let order;
    try {
      order = JSON.parse(text);
    } catch {
      return fail(400, "bad-json", "Bad request.");
    }
    const normalized = {
      id: order.admin_graphql_api_id,
      name: order.name,
      lines: (order.line_items || []).map((l) => ({
        variantId: l.variant_id
          ? `gid://shopify/ProductVariant/${l.variant_id}`
          : null,
        quantity: l.quantity,
        attributes: Object.fromEntries(
          (l.properties || []).map((p) => [p.name, p.value]),
        ),
      })),
    };
    const result = auditOrder(normalized, keyByVariant);
    if (!result.ok && normalized.id) {
      try {
        await admin.graphql(TAGS_ADD, {
          id: normalized.id,
          tags: ["needs-review"],
        });
      } catch (e) {
        log("could not tag order", normalized.name, e.message);
      }
      log(
        "order needs review",
        normalized.name,
        JSON.stringify(result.problems),
      );
    }
    return json(200, { ok: result.ok, problems: result.problems.length });
  }

  // Scheduled: delete OUR abandoned drafts (tag lt-web, still OPEN, older than draftMaxAgeHours). Never touches others.
  async function cleanup() {
    const cutoff = now() - draftMaxAgeHours * 3_600_000;
    let deleted = 0,
      after = null;
    for (
      let page = 0;
      page < CLEANUP_MAX_PAGES && deleted < CLEANUP_MAX_DELETES;
      page++
    ) {
      const data = await admin.graphql(DRAFTS_OLD, {
        q: `tag:${TAG} status:open`,
        after,
      });
      const connection = data.draftOrders;
      for (const d of connection?.nodes || []) {
        const ours =
          d.status === "OPEN" &&
          !d.completedAt &&
          Array.isArray(d.tags) &&
          d.tags.includes(TAG);
        if (
          ours &&
          Date.parse(d.createdAt) < cutoff &&
          deleted < CLEANUP_MAX_DELETES &&
          (await discard(d.id))
        )
          deleted++;
      }
      if (!connection?.pageInfo?.hasNextPage) break;
      after = connection.pageInfo.endCursor;
    }
    return deleted;
  }

  async function handle(request) {
    const url = new URL(request.url);
    const origin = originOf(request);
    try {
      if (url.pathname === "/health" && request.method === "GET")
        return json(200, { ok: true });
      if (
        url.pathname === "/webhooks/orders-create" &&
        request.method === "POST"
      )
        return await ordersWebhook(request);
      if (url.pathname !== "/prices" && url.pathname !== "/checkout")
        return fail(404, "not-found", "Not found.");
      if (!origins.has(origin))
        return fail(
          403,
          "origin",
          "This site is not allowed to use the checkout API.",
        );
      const headers = cors(origin);
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      let response;
      if (url.pathname === "/prices" && request.method === "GET")
        response = await prices();
      else if (url.pathname === "/checkout" && request.method === "POST")
        response = await checkout(request);
      else return fail(405, "method", "Method not allowed.");
      for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
      return response;
    } catch (e) {
      const headers = cors(origin);
      if (e instanceof ApiError) {
        const r = fail(e.status, e.code, e.message, e.extra);
        for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
        return r;
      }
      log(
        "unexpected",
        e?.name,
        e?.message,
        e?.detail ? JSON.stringify(e.detail) : "",
      );
      const busy = e?.status === 429;
      const r = fail(
        busy ? 503 : 500,
        busy ? "busy" : "server",
        busy
          ? "The shop is busy. Please try again in a moment."
          : "Checkout is unavailable right now. No payment was taken.",
      );
      for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
      return r;
    }
  }
  return { handle, cleanup, loadCatalog };
}
