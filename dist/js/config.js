// Public storefront configuration ONLY. Never put a Shopify Admin or private token here.
export const SHOP = {
  // Brand fields also appear in the static HTML for crawlers and before JavaScript loads.
  brand: {
    name: 'Heirloom Studio',
    title: 'Heirloom Studio',
    sub: 'handcrafted by valeria',
    tagline: 'handcrafted by valeria',
    footerTagline: 'handcrafted by valeria',
    announcement: '☆ Grand opening November 2026 ☆',
    studioName: 'THE STUDIO',
    artistNote: 'Always fight for your dreams',
    provisional: false
  },
  email: 'heirloomstudio133@gmail.com', // Artist's public business email. Contact stays unavailable until set.
  currency: 'USD',
  // Checkout API (server/), run by the artist. This is the path for real orders: the browser sends designs
  // only and the server prices, validates and creates the Shopify checkout. See server/README.md.
  api: {
    enabled: false,
    url: '',                      // https://little-tomato-checkout.<account>.workers.dev (no trailing slash)
    allowedCheckoutHosts: []      // hostnames the returned checkout link may use, e.g. ['your-shop.myshopify.com']
  },
  // Direct Storefront API path. For testing only: nothing stops a modified browser from changing the order lines.
  // Ignored while api.enabled is true.
  shopify: {
    enabled: false,
    domain: '', // your-shop.myshopify.com (hostname only)
    publicStorefrontToken: '',
    apiVersion: '2026-10',
    // Map every catalog key to a real gid://shopify/ProductVariant/... ID.
    // See SHOPIFY_SETUP.md. Component prices are loaded from Shopify in live mode.
    variants: {}
  }
};
