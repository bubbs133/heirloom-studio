// Client for the artist-owned checkout API (server/). The browser sends designs only;
// prices, order lines and the final total are decided by the server.
import {SHOP} from './config.js';
import {catalogEntries} from './catalog.js';

const hostOk=h=>typeof h==='string'&&/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h);
const localhost=u=>u.protocol==='http:'&&(u.hostname==='localhost'||u.hostname==='127.0.0.1');
const baseUrl=api=>{try{const u=new URL(api.url);return u.protocol==='https:'||localhost(u)?u.origin+u.pathname.replace(/\/+$/,''):null}catch{return null}};

export function configured(api=SHOP.api){
  return !!api?.enabled&&!!baseUrl(api)&&Array.isArray(api.allowedCheckoutHosts)&&api.allowedCheckoutHosts.length>0&&api.allowedCheckoutHosts.every(hostOk);
}

async function call(path,init,api){
  if(!configured(api))throw new Error('The shop is still being set up. Checkout is not open yet.');
  let response;
  try{response=await fetch(baseUrl(api)+path,{...init,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)})}
  catch(error){if(error.name==='TimeoutError')throw error;throw new Error('The shop could not be reached. Please try again.')}
  let body=null;try{body=await response.json()}catch{}
  if(!response.ok){
    // The server only ever sends short, customer-safe messages; anything else gets a generic line.
    const message=typeof body?.message==='string'&&body.message.length<=240?body.message:'The shop could not be reached. Please try again.';
    throw Object.assign(new Error(message),{status:response.status,code:body?.error});
  }
  if(!body||typeof body!=='object')throw new Error('Shop connection failed. Please try again later.');
  return body;
}

export async function loadPrices(api=SHOP.api){
  const body=await call('/prices',{method:'GET'},api);
  if(body.currency!==SHOP.currency)throw new Error('Catalog prices are unavailable in the configured currency.');
  const prices={},availability={};
  for(const [key] of catalogEntries()){
    const cents=body.prices?.[key];
    if(!Number.isSafeInteger(cents)||cents<0)throw new Error('Invalid shop price.');
    if(typeof body.availability?.[key]!=='boolean')throw new Error('Shop availability is incomplete.');
    prices[key]=cents;availability[key]=body.availability[key];
  }
  return {prices,availability};
}

export async function createCheckout(cart,api=SHOP.api,{turnstileToken}={}){
  const payload={bag:cart};if(turnstileToken)payload.turnstileToken=turnstileToken;
  const body=await call('/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},api);
  let url;try{url=new URL(body.checkoutUrl)}catch{throw new Error('Checkout address is invalid.')}
  if(url.protocol!=='https:'||!api.allowedCheckoutHosts.includes(url.hostname))throw new Error('Checkout address is invalid.');
  const sub=body.cost?.subtotalAmount;
  if(!sub||!/^\d+\.\d{2}$/.test(String(sub.amount))||typeof sub.currencyCode!=='string')throw new Error('Checkout did not return a total. No payment was taken.');
  return {checkoutUrl:url.href,cost:{subtotalAmount:{amount:String(sub.amount),currencyCode:sub.currencyCode}}};
}
