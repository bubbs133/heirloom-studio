import {SHOP} from './config.js';
import {catalogEntries} from './catalog.js';
import {makeCartLines} from './core.js';
export const demoPrices=Object.fromEntries(catalogEntries().map(([k,v])=>[k,v.cents]));
export function configured(config=SHOP.shopify){
 return config.enabled && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.domain) && !!config.publicStorefrontToken && /^20\d{2}-(01|04|07|10)$/.test(config.apiVersion);
}
export async function request(query,variables={},config=SHOP.shopify){
 if(!configured(config))throw new Error('The shop is still being set up. Checkout is not open yet.');
 const response=await fetch(`https://${config.domain}/api/${config.apiVersion}/graphql.json`,{
  method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':config.publicStorefrontToken},
  body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error('The shop could not be reached. Please try again.');
 const json=await response.json();
 if(json.errors?.length||!json.data)throw new Error('Shop connection failed. Please try again later.');
 return json.data;
}
export async function loadPrices(config=SHOP.shopify){
 if(!configured(config))throw new Error('Shopify configuration is incomplete.');
 const entries=catalogEntries();
 if(entries.some(([key])=>!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(config.variants[key]||'')))throw new Error('The shop catalog is not fully connected yet.');
 const ids=[...new Set(entries.map(([key])=>config.variants[key]))];
 const data=await request(`query Catalog($ids:[ID!]!){nodes(ids:$ids){... on ProductVariant{id availableForSale price{amount currencyCode}}}}`,{ids},config);
 const nodes=new Map(data.nodes.filter(Boolean).map(n=>[n.id,n]));const prices={},availability={};
 for(const [key] of entries){
  const n=nodes.get(config.variants[key]);
  if(!n?.price || n.price.currencyCode!==SHOP.currency)throw new Error('Catalog prices are unavailable in the configured currency.');
  const cents=Math.round(Number(n.price.amount)*100);
  if(!Number.isSafeInteger(cents)||cents<0)throw new Error('Invalid shop price.');
  prices[key]=cents;availability[key]=n.availableForSale;
 }
 return {prices,availability};
}
export async function createCheckout(cart,config=SHOP.shopify){
 const lines=makeCartLines(cart,config.variants);
 const data=await request(`mutation Checkout($input:CartInput!){cartCreate(input:$input){cart{id checkoutUrl totalQuantity cost{subtotalAmount{amount currencyCode}} lines(first:250){nodes{quantity merchandise{... on ProductVariant{id}}}}} userErrors{field message} warnings{code message}}}`,{input:{lines,attributes:[{key:'Source',value:'Little Tomato custom storefront v1'}]}},config);
 const result=data.cartCreate;
 if(result.userErrors?.length)throw new Error(result.userErrors.map(e=>e.message).join(' '));
 if(result.warnings?.length)throw new Error('Availability changed. Please review your bag and try again.');
 if(!result.cart?.checkoutUrl)throw new Error('Checkout is unavailable. No payment was taken.');
 // Reject partial fulfillment/quantity adjustments rather than sending a broken custom charm to checkout.
 const expected=new Map(),actual=new Map();
 for(const l of lines)expected.set(l.merchandiseId,(expected.get(l.merchandiseId)||0)+l.quantity);
 for(const l of result.cart.lines.nodes)actual.set(l.merchandise.id,(actual.get(l.merchandise.id)||0)+l.quantity);
 if(expected.size!==actual.size||[...expected].some(([id,q])=>actual.get(id)!==q))throw new Error('Some components are unavailable. Please review your bag.');
 const url=new URL(result.cart.checkoutUrl);
 if(url.protocol!=='https:')throw new Error('Checkout address is invalid.');
 return result.cart;
}
