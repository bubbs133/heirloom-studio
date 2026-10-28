import test from 'node:test';
import assert from 'node:assert/strict';
import {configured,loadPrices,createCheckout} from '../dist/js/shopify.js';
import {defaultDesign,catalogEntries} from '../dist/js/catalog.js';
const variants=Object.fromEntries(catalogEntries().map(([k],i)=>[k,'gid://shopify/ProductVariant/'+(i+1)]));
const config={enabled:true,domain:'test-store.myshopify.com',publicStorefrontToken:'public-test-token',apiVersion:'2026-10',variants};
test('checkout requires an enabled and valid shop domain',()=>{
 assert.ok(configured(config));assert.equal(configured({...config,domain:'https://example.com'}),false);
 assert.equal(configured({...config,publicStorefrontToken:''}),false);assert.equal(configured({...config,enabled:false}),false);
});
test('live catalog derives prices and availability from Shopify; currency mismatch blocks',async()=>{
 const original=global.fetch;let currency='USD';
 global.fetch=async(url,options)=>{assert.ok(url.includes('/2026-10/graphql.json'));assert.equal(options.headers['X-Shopify-Storefront-Access-Token'],'public-test-token');return {ok:true,json:async()=>({data:{nodes:catalogEntries().map(([k,v])=>({id:variants[k],availableForSale:k!=='tomato-wink',price:{amount:String(v.cents/100),currencyCode:currency}}))}})}};
 try{const result=await loadPrices(config);assert.equal(result.prices['assembly'],300);assert.equal(result.availability['tomato-wink'],false);currency='EUR';await assert.rejects(loadPrices(config),/currency/)}finally{global.fetch=original}
});
test('partial carts, Shopify warnings, and user errors cannot reach payment',async()=>{
 const original=global.fetch;const bag=[{id:'test',kind:'custom',design:defaultDesign(),quantity:1}];let mode='good';
 global.fetch=async(url,options)=>{const {variables}=JSON.parse(options.body);const payload={cart:{checkoutUrl:'https://test-store.myshopify.com/checkouts/example',lines:{nodes:variables.input.lines.map(l=>({quantity:l.quantity,merchandise:{id:l.merchandiseId}}))}},userErrors:[],warnings:[]};
 if(mode==='partial')payload.cart.lines.nodes.pop();if(mode==='warning')payload.warnings=[{code:'MERCHANDISE_NOT_ENOUGH_STOCK',message:'stock changed'}];if(mode==='error')payload.userErrors=[{message:'Unavailable product'}];
 return {ok:true,json:async()=>({data:{cartCreate:payload}})}};
 try{assert.ok((await createCheckout(bag,config)).checkoutUrl);mode='partial';await assert.rejects(createCheckout(bag,config),/components/);mode='warning';await assert.rejects(createCheckout(bag,config),/Availability/);mode='error';await assert.rejects(createCheckout(bag,config),/Unavailable product/)}finally{global.fetch=original}
});

