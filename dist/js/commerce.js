// One entry point for the storefront. Picks the checkout path from SHOP:
//   server     SHOP.api.enabled      — artist-owned checkout API enforces prices and assembly rules (use for real orders)
//   storefront SHOP.shopify.enabled  — browser talks to Shopify directly; nothing enforces the bill of materials (testing only)
//   preview    neither               — placeholder prices, checkout disabled
import { SHOP } from "./config.js";
import * as storefront from "./shopify.js";
import * as remote from "./remote.js";
export const demoPrices = storefront.demoPrices;
export const mode = (shop = SHOP) =>
  shop.api?.enabled
    ? "server"
    : shop.shopify?.enabled
      ? "storefront"
      : "preview";
export const live = (shop = SHOP) => mode(shop) !== "preview";
const pick = (shop, s, r) => (mode(shop) === "server" ? r : s);
export const configured = (shop = SHOP) =>
  mode(shop) === "server"
    ? remote.configured(shop.api)
    : mode(shop) === "storefront"
      ? storefront.configured(shop.shopify)
      : false;
export const loadPrices = (shop = SHOP) =>
  pick(
    shop,
    () => storefront.loadPrices(shop.shopify),
    () => remote.loadPrices(shop.api),
  )();
export const createCheckout = (cart, shop = SHOP, options) =>
  pick(
    shop,
    () => storefront.createCheckout(cart, shop.shopify),
    () => remote.createCheckout(cart, shop.api, options),
  )();
