import test from 'node:test';
import assert from 'node:assert/strict';
import {configured,loadPrices,createCheckout} from '../dist/js/remote.js';
import {mode,live,configured as commerceConfigured} from '../dist/js/commerce.js';
import {SHOP} from '../dist/js/config.js';
import {catalogEntries,defaultDesign} from '../dist/js/catalog.js';

const api={enabled:true,url:'https://checkout.example.workers.dev',allowedCheckoutHosts:['little-tomato.myshopify.com']};
const priceBody=(over={})=>({currency:'USD',prices:Object.fromEntries(catalogEntries().map(([k,v])=>[k,v.cents])),availability:Object.fromEntries(catalogEntries().map(([k])=>[k,true])),...over});
const bag=[{id:'c1',kind:'custom',quantity:1,design:defaultDesign()}];
const reply=(status,body)=>async()=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
async function withFetch(fn,run){const original=global.fetch;global.fetch=fn;try{return await run()}finally{global.fetch=original}}

test('the API is only used when enabled, https (or localhost) and the checkout host list is valid',()=>{
 assert.ok(configured(api));
 for(const bad of [{enabled:false},{url:''},{url:'http://checkout.example.com'},{url:'ftp://x.example.com'},{allowedCheckoutHosts:[]},{allowedCheckoutHosts:['https://a.myshopify.com']},{allowedCheckoutHosts:['*.myshopify.com']},{allowedCheckoutHosts:undefined}])
  assert.equal(configured({...api,...bad}),false,JSON.stringify(bad));
 assert.ok(configured({...api,url:'http://localhost:8787'}));
 assert.equal(configured(undefined),false);
});

test('mode: the checkout API wins over the direct Storefront path, and nothing enabled means preview',()=>{
 assert.equal(mode({shopify:{enabled:true},api:{enabled:true}}),'server');
 assert.equal(mode({shopify:{enabled:true},api:{enabled:false}}),'storefront');
 assert.equal(mode({shopify:{enabled:false}}),'preview');
 assert.equal(live({shopify:{enabled:false},api:{enabled:false}}),false);
 assert.equal(live({shopify:{enabled:false},api:{enabled:true}}),true);
 assert.equal(mode(SHOP),'preview','the shipped config is preview-only');
 assert.equal(commerceConfigured({shopify:{enabled:false},api:{enabled:false}}),false);
});

test('prices load from the API; wrong currency, bad cents or missing availability block the shop',async()=>{
 let seen;
 await withFetch(async(url,init)=>{seen=[url,init];return new Response(JSON.stringify(priceBody()))},async()=>{
  const {prices,availability}=await loadPrices(api);
  assert.equal(prices.assembly,300);assert.equal(availability.assembly,true);
 });
 assert.equal(seen[0],'https://checkout.example.workers.dev/prices');assert.equal(seen[1].credentials,'omit');assert.equal(seen[1].cache,'no-store');
 const broken=[priceBody({currency:'EUR'}),priceBody({prices:{...priceBody().prices,assembly:3.5}}),priceBody({prices:{...priceBody().prices,assembly:-1}}),
  priceBody({availability:{...priceBody().availability,assembly:'yes'}}),priceBody({prices:{}}),{}];
 for(const body of broken)await withFetch(reply(200,body),()=>assert.rejects(loadPrices(api)));
});

test('checkout posts the bag, not prices, and accepts only an https link on an allowed host',async()=>{
 const good={checkoutUrl:'https://little-tomato.myshopify.com/1/invoices/abc',cost:{subtotalAmount:{amount:'21.50',currencyCode:'USD'}}};
 let sent;
 await withFetch(async(url,init)=>{sent=[url,JSON.parse(init.body),init.method];return new Response(JSON.stringify(good))},async()=>{
  const result=await createCheckout(bag,api);
  assert.equal(result.checkoutUrl,good.checkoutUrl);assert.equal(result.cost.subtotalAmount.amount,'21.50');
 });
 assert.equal(sent[0],'https://checkout.example.workers.dev/checkout');assert.equal(sent[2],'POST');
 assert.deepEqual(Object.keys(sent[1]),['bag']);assert.ok(!JSON.stringify(sent[1]).includes('price'));
 await withFetch(async(url,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify(good))},()=>createCheckout(bag,api,{turnstileToken:'tok'}));
 assert.equal(sent.turnstileToken,'tok');
 const bad=[{...good,checkoutUrl:'http://little-tomato.myshopify.com/x'},{...good,checkoutUrl:'https://evil.example/x'},{...good,checkoutUrl:'https://little-tomato.myshopify.com.evil.example/x'},
  {...good,checkoutUrl:'javascript:alert(1)'},{...good,checkoutUrl:''},{checkoutUrl:good.checkoutUrl},{...good,cost:{subtotalAmount:{amount:'abc',currencyCode:'USD'}}}];
 for(const body of bad)await withFetch(reply(200,body),()=>assert.rejects(createCheckout(bag,api),/Checkout/),JSON.stringify(body));
});

test('server refusals show their short customer-safe message; anything odd becomes a generic one',async()=>{
 await withFetch(reply(409,{error:'unavailable',message:'Some picks are sold out.',unavailable:['tomato-formal']}),()=>assert.rejects(createCheckout(bag,api),e=>e.message==='Some picks are sold out.'&&e.status===409&&e.code==='unavailable'));
 await withFetch(reply(500,{message:'x'.repeat(500)}),()=>assert.rejects(createCheckout(bag,api),/could not be reached/));
 await withFetch(async()=>new Response('<html>oops</html>',{status:502}),()=>assert.rejects(createCheckout(bag,api),/could not be reached/));
 await withFetch(async()=>{throw new TypeError('network down')},()=>assert.rejects(createCheckout(bag,api),/could not be reached/));
 await withFetch(async()=>{throw Object.assign(new Error('t'),{name:'TimeoutError'})},()=>assert.rejects(createCheckout(bag,api),e=>e.name==='TimeoutError'));
 await withFetch(async()=>assert.fail('must not call fetch'),()=>assert.rejects(createCheckout(bag,{...api,enabled:false}),/still being set up/));
});
