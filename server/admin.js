// Minimal Shopify Admin GraphQL client for a Dev Dashboard app using the client-credentials grant.
// Tokens last 24 h; we cache one and refresh a minute before expiry. Secrets never appear in errors.
export class ShopifyError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = "ShopifyError";
    this.status = status;
    this.detail = detail;
  }
}

export function createAdmin({
  shop,
  clientId,
  clientSecret,
  apiVersion = "2026-10",
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 8000,
}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(shop || ""))
    throw new Error(
      "SHOPIFY_SHOP must be the store subdomain, without .myshopify.com",
    );
  if (!clientId || !clientSecret)
    throw new Error("Shopify app credentials are missing.");
  if (!/^20\d{2}-(01|04|07|10)$/.test(apiVersion))
    throw new Error("SHOPIFY_API_VERSION must look like 2026-10.");
  const host = `${shop}.myshopify.com`;
  let token = null,
    expiresAt = 0,
    pending = null;
  const signal = () =>
    typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  async function getToken() {
    if (token && now() < expiresAt - 60_000) return token;
    if (pending) return pending; // concurrent callers share one refresh
    pending = (async () => {
      const r = await fetchImpl(`https://${host}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: signal(),
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      if (!r.ok)
        throw new ShopifyError("Shopify rejected the app credentials.", {
          status: r.status,
        });
      const j = await r.json();
      if (!j.access_token || !Number.isFinite(j.expires_in))
        throw new ShopifyError("Unexpected token response from Shopify.");
      token = j.access_token;
      expiresAt = now() + j.expires_in * 1000;
      return token;
    })().finally(() => {
      pending = null;
    });
    return pending;
  }

  async function graphql(query, variables = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetchImpl(
        `https://${host}/admin/api/${apiVersion}/graphql.json`,
        {
          method: "POST",
          signal: signal(),
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": await getToken(),
          },
          body: JSON.stringify({ query, variables }),
        },
      );
      if (r.status === 401 && attempt === 0) {
        token = null;
        continue;
      } // token rotated or expired early: refresh once
      if (r.status === 429)
        throw new ShopifyError("Shopify is busy.", { status: 429 });
      if (!r.ok)
        throw new ShopifyError("Shopify request failed.", { status: r.status });
      const j = await r.json();
      if (j.errors?.some((e) => e.extensions?.code === "THROTTLED"))
        throw new ShopifyError("Shopify is busy.", { status: 429 });
      if (j.errors?.length)
        throw new ShopifyError("Shopify rejected the request.", {
          detail: j.errors.map((e) => e.message),
        });
      if (!j.data) throw new ShopifyError("Empty response from Shopify.");
      return j.data;
    }
    throw new ShopifyError("Shopify rejected the access token.", {
      status: 401,
    });
  }
  return { graphql };
}
