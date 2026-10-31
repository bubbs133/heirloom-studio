import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../server/api.js';
import {createAdmin,ShopifyError} from '../server/admin.js';
import {auditOrder} from '../server/audit.js';
import {catalogEntries,defaultDesign,PRODUCTS,bead} from '../dist/js/catalog.js';
import {makeCartLines,encodeDesign} from '../dist/js/core.js';

const ORIGIN='https://littletomato.example';
const variants=Object.fromEntries(catalogEntries().map(([k],i)=>[k,'gid://shopify/ProductVariant/'+(1000+i)]));
const keyOf=Object.fromEntries(Object.entries(variants).map(([k,id])=>[id,k]));
const cents=Object.fromEntries(catalogEntries().map(([k,v])=>[variants[k],v.cents]));
const silent=()=>{};
const custom=(over={})=>({id:'c1',kind:'custom',quantity:1,design:defaultDesign(),...over});
const ready=(over={})=>({id:'r1',kind:'ready',quantity:2,productId:'garden-party',...over});

// A stand-in for the Shopify Admin client that behaves like a well-behaved store unless told otherwise.
function mockAdmin(opts={}){
  const calls=[];
  return {calls,async graphql(query,vars){
    calls.push({query,vars});
    if(query.includes('query Catalog')){
      const nodes=vars.ids.map(id=>({id,price:((opts.price?.(id)??cents[id])/100).toFixed(2),availableForSale:opts.available?.(id)??true,
        inventoryQuantity:opts.qty?.(id)??null,inventoryPolicy:'DENY'}));
      return {shop:{currencyCode:opts.shopCurrency??'USD'},nodes};
    }
    if(query.includes('draftOrderCreate')){
      if(opts.userErrors)return {draftOrderCreate:{draftOrder:null,userErrors:opts.userErrors}};
      const subtotal=vars.input.lineItems.reduce((n,l)=>n+(opts.draftPrice?.(l.variantId)??cents[l.variantId])*l.quantity,0);
      return {draftOrderCreate:{userErrors:[],draftOrder:{id:'gid://shopify/DraftOrder/1',invoiceUrl:opts.invoiceUrl??'https://little-tomato.myshopify.com/1/invoices/abc',
        currencyCode:opts.draftCurrency??'USD',anyVariantPricesOverridden:opts.overridden??false,
        subtotalPriceSet:{shopMoney:{amount:(subtotal/100).toFixed(2),currencyCode:opts.draftCurrency??'USD'}}}}};
    }
    if(query.includes('draftOrderDelete'))return {draftOrderDelete:{deletedId:vars.input.id,userErrors:[]}};
    if(query.includes('draftOrders('))return opts.pages?{draftOrders:opts.pages[vars.after??0]}:{draftOrders:{nodes:opts.drafts??[]}};
    if(query.includes('tagsAdd'))return {tagsAdd:{node:{id:vars.id},userErrors:[]}};
    throw new Error('unexpected query '+query.slice(0,40));
  }};
}
function setup(opts={},apiOpts={}){
  const admin=opts.admin??mockAdmin(opts);let t=1_000_000;
  const api=createApi({admin,variants,allowedOrigins:[ORIGIN],now:()=>t,log:silent,...apiOpts});
  return {admin,api,advance:ms=>{t+=ms}};
}
const post=(body,{origin=ORIGIN,ip='1.1.1.1',headers={}}={})=>new Request('https://api.test/checkout',{method:'POST',
  headers:{'content-type':'application/json',...(origin?{origin}:{}),'cf-connecting-ip':ip,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const get=(path,origin=ORIGIN)=>new Request('https://api.test'+path,{headers:origin?{origin}:{}});
const drafts=admin=>admin.calls.filter(c=>c.query.includes('draftOrderCreate'));
const deletes=admin=>admin.calls.filter(c=>c.query.includes('draftOrderDelete'));

test('a valid bag becomes a draft order priced from catalog variants, with the mandatory lines added by the server',async()=>{
 const {api,admin}=setup();
 const res=await api.handle(post({bag:[custom({quantity:2}),ready()]}));
 const body=await res.json();
 assert.equal(res.status,200);
 assert.equal(res.headers.get('access-control-allow-origin'),ORIGIN);
 assert.match(body.checkoutUrl,/^https:\/\//);
 const input=drafts(admin)[0].vars.input;
 const keys=input.lineItems.map(l=>keyOf[l.variantId]);
 assert.ok(keys.includes('assembly')&&!keys.includes('strand'),'included strands are not separately charged');
 assert.equal(input.lineItems.find(l=>keyOf[l.variantId]==='assembly').quantity,2);
 assert.ok(input.lineItems.every(l=>l.customAttributes.some(a=>a.key==='Design code'&&a.value.startsWith('v2.'))));
 assert.ok(input.lineItems.every(l=>l.customAttributes.some(a=>a.key==='Design'&&a.value.startsWith('Serious tomato (Regular)'))));
 assert.deepEqual(input.tags,['lt-web']);
 const text=JSON.stringify(input);
 for(const forbidden of ['priceOverride','appliedDiscount','originalUnitPrice','price"'])assert.ok(!text.includes(forbidden),forbidden);
 const expected=2*1599+2*2200;
 assert.equal(body.cost.subtotalAmount.amount,(expected/100).toFixed(2));
 assert.equal(body.cost.subtotalAmount.currencyCode,'USD');
});

test('anything a tampering browser adds (prices, lines, totals) is ignored; only the design decides the price',async()=>{
 const {api,admin}=setup();
 const evil={...custom(),price:1,total:1,unitPrice:1,lines:[{merchandiseId:variants['bead-pink-round'],quantity:1}]};
 const res=await api.handle(post({bag:[evil],lines:[{variantId:variants['assembly'],quantity:0}],total:'0.01'}));
 assert.equal(res.status,200);
 const input=drafts(admin)[0].vars.input;
 assert.equal(input.lineItems.find(l=>keyOf[l.variantId]==='assembly').quantity,1);
 assert.equal((await res.json()).cost.subtotalAmount.amount,'15.99');
});

test('invalid or oversized bags are rejected before any draft order exists',async()=>{
 const bad=[
  {bag:[]},{bag:'x'},{bag:null},{},[],'null',{bag:Array.from({length:21},(_,i)=>custom({id:'c'+i}))},
  {bag:[custom({quantity:0})]},{bag:[custom({quantity:11})]},{bag:[custom({quantity:1.5})]},{bag:[custom({quantity:'2'})]},
  {bag:[custom({design:{...defaultDesign(),tomato:'evil'}})]},{bag:[custom({design:{...defaultDesign(),strands:[]}})]},
  {bag:[custom({design:{...defaultDesign(),clasp:'dust'}})]},
  {bag:[custom({design:{...defaultDesign(),strands:[Array.from({length:6},()=>bead('pink'))]}})]},
  {bag:[custom({design:{...defaultDesign(),clasp:'dust-usbc',tomatoSize:'small',strands:[Array.from({length:4},()=>bead('pink'))]}})]},
  {bag:[custom(),custom()]},{bag:[ready({productId:'free-stuff'})]},{bag:[{id:'x',kind:'other',quantity:1}]}
 ];
 for(const body of bad){
  const {api,admin}=setup();
  const res=await api.handle(post(body));
  assert.ok([400].includes(res.status),JSON.stringify(body).slice(0,80)+' -> '+res.status);
  assert.equal(drafts(admin).length,0);
 }
 const {api}=setup();
 assert.equal((await api.handle(post('{not json'))).status,400);
});

test('requests from other sites, and unknown routes or methods, never reach Shopify',async()=>{
 const {api,admin}=setup();
 for(const origin of ['https://evil.example','',null]){
  const res=await api.handle(post({bag:[custom()]},{origin}));
  assert.equal(res.status,403);assert.equal(res.headers.get('access-control-allow-origin'),null);
 }
 assert.equal((await api.handle(get('/prices','https://evil.example'))).status,403);
 const pre=await api.handle(new Request('https://api.test/checkout',{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST'}}));
 assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),ORIGIN);
 assert.equal((await api.handle(get('/admin'))).status,404);
 assert.equal((await api.handle(new Request('https://api.test/prices',{method:'DELETE',headers:{origin:ORIGIN}}))).status,405);
 assert.equal((await api.handle(get('/health',null))).status,200);
 assert.equal(admin.calls.length,0);
});

test('oversized bodies are refused, including ones that hide their size',async()=>{
 const {api,admin}=setup();
 const big=JSON.stringify({bag:[custom()],pad:'x'.repeat(70000)});
 assert.equal((await api.handle(post(big))).status,413);
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"bag":"'));for(let i=0;i<20;i++)c.enqueue(new Uint8Array(5000).fill(120));c.close()}});
 const chunked=new Request('https://api.test/checkout',{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json'},body:stream,duplex:'half'});
 assert.equal((await api.handle(chunked)).status,413);
 assert.equal(admin.calls.length,0);
});

test('sold-out or short-stock components block checkout without creating a draft',async()=>{
 const extraBeadDesign=defaultDesign();
 extraBeadDesign.strands[0].push(bead('pink'));
 let {api,admin}=setup({available:id=>id!==variants['bead-pink-round']});
 let res=await api.handle(post({bag:[custom({design:extraBeadDesign})]}));
 assert.equal(res.status,409);assert.deepEqual((await res.json()).unavailable,['bead-pink-round']);
 assert.equal(drafts(admin).length,0);
 ({api,admin}=setup({qty:id=>id===variants['bead-pink-round']?2:null}));
 res=await api.handle(post({bag:[custom({quantity:3,design:extraBeadDesign})]}));
 assert.equal(res.status,409);assert.equal(drafts(admin).length,0);
 res=await api.handle(post({bag:[custom({quantity:2,design:extraBeadDesign})]},{ip:'2.2.2.2'}));
 assert.equal(res.status,200);
});

test('if Shopify builds a draft that disagrees with the catalog, it is deleted and the buyer is told to review',async()=>{
 let {api,admin}=setup({draftPrice:id=>id===variants['assembly']?500:cents[id]});
 let res=await api.handle(post({bag:[custom()]}));
 assert.equal(res.status,409);assert.equal((await res.json()).error,'price-changed');
 assert.equal(deletes(admin).length,1);
 const before=admin.calls.filter(c=>c.query.includes('query Catalog')).length;
 await api.handle(get('/prices'));
 assert.equal(admin.calls.filter(c=>c.query.includes('query Catalog')).length,before+1,'catalog cache is dropped after a drift');

 for(const [opts,code] of [[{overridden:true},'price-override'],[{draftCurrency:'EUR'},'currency'],[{invoiceUrl:'http://insecure.example/x'},'bad-url'],[{invoiceUrl:'not a url'},'bad-url']]){
  ({api,admin}=setup(opts));
  res=await api.handle(post({bag:[custom()]}));
  assert.equal(res.status,502);assert.equal((await res.json()).error,code);
  assert.equal(deletes(admin).length,1,code);
 }
});

test('shop errors surface as generic messages and never echo internal details or secrets',async()=>{
 let {api}=setup({userErrors:[{field:['lineItems'],message:'Variant SECRET-DETAIL cannot be added'}]});
 let res=await api.handle(post({bag:[custom()]}));let text=await res.text();
 assert.equal(res.status,502);assert.ok(!text.includes('SECRET-DETAIL'));assert.match(text,/No payment was taken/);

 const boom={calls:[],async graphql(){throw new ShopifyError('Shopify rejected the request.',{detail:['access token shpat_SECRET123 invalid']})}};
 ({api}=setup({admin:boom}));
 res=await api.handle(post({bag:[custom()]}));text=await res.text();
 assert.equal(res.status,500);assert.ok(!text.includes('SECRET123'));
 const busy={calls:[],async graphql(){throw new ShopifyError('Shopify is busy.',{status:429})}};
 ({api}=setup({admin:busy}));
 res=await api.handle(post({bag:[custom()]}));assert.equal(res.status,503);assert.equal((await res.json()).error,'busy');
 ({api}=setup({shopCurrency:'EUR'}));
 assert.equal((await api.handle(get('/prices'))).status,503);
});

test('one connection cannot flood checkout; the window reopens later',async()=>{
 const {api,advance}=setup({},{perIpLimit:{max:3,windowMs:60_000}});
 for(let i=0;i<3;i++)assert.equal((await api.handle(post({bag:[custom()]}))).status,200);
 assert.equal((await api.handle(post({bag:[custom()]}))).status,429);
 assert.equal((await api.handle(post({bag:[custom()]},{ip:'9.9.9.9'}))).status,200);
 advance(61_000);
 assert.equal((await api.handle(post({bag:[custom()]}))).status,200);
});

test('when a Turnstile secret is set, checkout needs a token Cloudflare accepts',async()=>{
 const seen=[];
 const fetchImpl=async(url,init)=>{seen.push([url,String(init.body)]);return new Response(JSON.stringify({success:String(init.body).includes('response=good')}))};
 const {api,admin}=setup({},{turnstileSecret:'ts-secret',fetchImpl});
 assert.equal((await api.handle(post({bag:[custom()]}))).status,403);
 assert.equal((await api.handle(post({bag:[custom()],turnstileToken:'bad'}))).status,403);
 assert.equal(drafts(admin).length,0);
 assert.equal((await api.handle(post({bag:[custom()],turnstileToken:'good'}))).status,200);
 assert.ok(seen[0][0].startsWith('https://challenges.cloudflare.com/'));
});

test('prices endpoint returns every catalog key in cents and caches for a minute',async()=>{
 const {api,admin,advance}=setup();
 const body=await (await api.handle(get('/prices'))).json();
 assert.equal(Object.keys(body.prices).length,catalogEntries().length);
 assert.equal(body.prices['product-garden-party'],2200);assert.equal(body.currency,'USD');
 assert.ok(!JSON.stringify(body).includes('gid://'),'variant ids stay on the server');
 await api.handle(get('/prices'));
 assert.equal(admin.calls.filter(c=>c.query.includes('query Catalog')).length,1);
 advance(61_000);await api.handle(get('/prices'));
 assert.equal(admin.calls.filter(c=>c.query.includes('query Catalog')).length,2);
});

test('a half-configured server refuses to start instead of selling blind',()=>{
 assert.throws(()=>createApi({admin:mockAdmin(),variants,allowedOrigins:[]}),/origin/);
 assert.throws(()=>createApi({admin:mockAdmin(),variants:{...variants,'bead-pink-star':variants['bead-pink-round']},allowedOrigins:[ORIGIN]}),/reuses/);
 const partial={...variants};delete partial['assembly'];delete partial['bead-pink-star'];
 assert.throws(()=>createApi({admin:mockAdmin(),variants:partial,allowedOrigins:[ORIGIN]}),/assembly, bead-pink-star/);
 assert.throws(()=>createApi({admin:mockAdmin(),variants:{...variants,assembly:'12345'},allowedOrigins:[ORIGIN]}),/assembly/);
});

async function sign(secret,text){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))).toString('base64');
}
const orderPayload=(cart,drop=null)=>{
 const lines=makeCartLines(cart,variants).filter((_,i)=>i!==drop).map(l=>({variant_id:Number(l.merchandiseId.split('/').pop()),quantity:l.quantity,properties:l.attributes.map(a=>({name:a.key,value:a.value}))}));
 return {admin_graphql_api_id:'gid://shopify/Order/77',name:'#1001',line_items:lines};
};
const hook=async(api,payload,secret='whsec')=>{const text=JSON.stringify(payload);
 return api.handle(new Request('https://api.test/webhooks/orders-create',{method:'POST',headers:{'x-shopify-hmac-sha256':secret===null?'':await sign(secret,text)},body:text}))};

test('order webhook accepts a maximum-size order, far above the checkout body limit',async()=>{
 const {api,admin}=setup({},{webhookSecret:'whsec'});
 const cart=Array.from({length:20},(_,i)=>custom({id:'c'+i,design:{...defaultDesign(),strands:[[bead('pink','round'),bead('blue','star'),bead('green','pearl'),bead('cream','flower'),bead('poppy','round')],[bead('pink','round'),bead('blue','star'),bead('green','pearl'),bead('cream','flower'),bead('lavender','round')],[bead('pink','round'),bead('blue','star'),bead('green','pearl'),bead('cream','flower'),bead('lavender','star')]]}}));
 const payload=orderPayload(cart);
 assert.ok(JSON.stringify(payload).length>65536,'fixture really exceeds the checkout body limit');
 const res=await hook(api,payload);
 assert.equal(res.status,200);
 assert.equal((await res.json()).ok,true,'distinct charm groups: ids differ per item');
 assert.equal(admin.calls.filter(c=>c.query.includes('tagsAdd')).length,0);
});

test('order webhook: wrong signature is refused, consistent orders pass, altered orders are tagged for review',async()=>{
 const {api,admin}=setup({},{webhookSecret:'whsec'});
 assert.equal((await hook(api,orderPayload([custom()]),'wrong')).status,401);
 assert.equal((await hook(api,orderPayload([custom()]),null)).status,401);
 let res=await hook(api,orderPayload([custom({quantity:2}),ready()]));
 assert.equal(res.status,200);assert.equal((await res.json()).ok,true);
 assert.equal(admin.calls.filter(c=>c.query.includes('tagsAdd')).length,0);
 res=await hook(api,orderPayload([custom()],2)); // one component line vanished
 assert.equal((await res.json()).ok,false);
 const tag=admin.calls.find(c=>c.query.includes('tagsAdd'));
 assert.deepEqual(tag.vars,{id:'gid://shopify/Order/77',tags:['needs-review']});
 const off=setup().api;
 assert.equal((await hook(off,orderPayload([custom()]))).status,404);
});

test('cleanup deletes only our own abandoned open drafts',async()=>{
 const day=24*3_600_000,t=1_000_000;
 const old=new Date(t-5*day).toISOString(),fresh=new Date(t-1*day).toISOString();
 const {api,admin}=setup({drafts:[
  {id:'d-old',status:'OPEN',tags:['lt-web'],createdAt:old,completedAt:null},
  {id:'d-fresh',status:'OPEN',tags:['lt-web'],createdAt:fresh,completedAt:null},
  {id:'d-done',status:'COMPLETED',tags:['lt-web'],createdAt:old,completedAt:old},
  {id:'d-paidopen',status:'OPEN',tags:['lt-web'],createdAt:old,completedAt:old},
  {id:'d-artist',status:'OPEN',tags:['wholesale'],createdAt:old,completedAt:null},
  {id:'d-untagged',status:'OPEN',tags:[],createdAt:old,completedAt:null}
 ]});
 assert.equal(await api.cleanup(),1);
 assert.deepEqual(deletes(admin).map(c=>c.vars.input.id),['d-old']);
});

test('cleanup follows pages, but never deletes more than a run can afford',async()=>{
 const t=1_000_000,old=new Date(t-5*24*3_600_000).toISOString();
 const drafts=(from,n)=>Array.from({length:n},(_,i)=>({id:'d'+(from+i),status:'OPEN',tags:['lt-web'],createdAt:old,completedAt:null}));
 let {api,admin}=setup({pages:{0:{nodes:drafts(0,3),pageInfo:{hasNextPage:true,endCursor:1}},1:{nodes:drafts(3,2),pageInfo:{hasNextPage:false,endCursor:null}}}});
 assert.equal(await api.cleanup(),5);
 assert.equal(admin.calls.filter(c=>c.query.includes('draftOrders(')).length,2);
 const endless={};for(let i=0;i<10;i++)endless[i]={nodes:drafts(i*50,50),pageInfo:{hasNextPage:true,endCursor:i+1}};
 ({api,admin}=setup({pages:endless}));
 assert.equal(await api.cleanup(),40);
 assert.ok(admin.calls.length<=1+5+40,'bounded subrequests');
});

test('the Admin client caches its token, refreshes once on 401, and keeps secrets out of errors',async()=>{
 let tokens=0,t=0,graphqlStatus=[200];const seen=[];
 const fetchImpl=async(url,init)=>{
  seen.push(url);
  if(url.endsWith('/admin/oauth/access_token')){
   tokens++;assert.match(String(init.body),/grant_type=client_credentials/);
   return new Response(JSON.stringify({access_token:'tok'+tokens,scope:'read_products',expires_in:86399}));
  }
  const status=graphqlStatus.shift()??200;
  if(status===401)return new Response('{}',{status});
  return new Response(JSON.stringify({data:{ok:init.headers['X-Shopify-Access-Token']}}));
 };
 const admin=createAdmin({shop:'little-tomato',clientId:'id',clientSecret:'TOPSECRET',fetchImpl,now:()=>t});
 assert.equal((await admin.graphql('{a}')).ok,'tok1');
 await admin.graphql('{a}');assert.equal(tokens,1);
 graphqlStatus=[401];assert.equal((await admin.graphql('{a}')).ok,'tok2');
 t+=86_400_000;await admin.graphql('{a}');assert.equal(tokens,3);
 assert.ok(seen.every(u=>u.startsWith('https://little-tomato.myshopify.com/')));
 const denied=createAdmin({shop:'little-tomato',clientId:'id',clientSecret:'TOPSECRET',fetchImpl:async()=>new Response('shop_not_permitted TOPSECRET',{status:400})});
 await assert.rejects(()=>denied.graphql('{a}'),e=>e instanceof ShopifyError&&!e.message.includes('TOPSECRET'));
 const throttled=createAdmin({shop:'s',clientId:'id',clientSecret:'x',fetchImpl:async u=>u.endsWith('access_token')?new Response(JSON.stringify({access_token:'t',expires_in:100})):new Response(JSON.stringify({errors:[{message:'Throttled',extensions:{code:'THROTTLED'}}]}))});
 await assert.rejects(()=>throttled.graphql('{a}'),e=>e.status===429);
 for(const bad of [{shop:'evil.com/x'},{shop:''},{shop:'ok',clientId:''},{shop:'ok',apiVersion:'latest'}])
  assert.throws(()=>createAdmin({clientId:'i',clientSecret:'s',...bad}));
});

// ---- audit
const toAudit=(cart,mutate=l=>l)=>({id:'o1',name:'#1',lines:makeCartLines(cart,variants).map(l=>mutate({variantId:l.merchandiseId,quantity:l.quantity,attributes:Object.fromEntries(l.attributes.map(a=>[a.key,a.value]))}))});
test('audit passes a faithful order and ignores products that are not part of the catalog',()=>{
 const order=toAudit([custom({quantity:3}),ready({quantity:2}),custom({id:'c2',design:PRODUCTS[1].design})]);
 order.lines.push({variantId:'gid://shopify/ProductVariant/99999',quantity:1,attributes:{}});
 assert.deepEqual(auditOrder(order,keyOf),{ok:true,problems:[]});
});
test('audit flags missing, extra, mis-quantified and orphaned lines',()=>{
 const codes=o=>auditOrder(o,keyOf).problems.map(p=>p.code);
 const base=toAudit([custom({quantity:2})]);
 assert.deepEqual(codes({...base,lines:base.lines.slice(1)}),['component-mismatch']);
 assert.deepEqual(codes({...base,lines:base.lines.map(l=>({...l,quantity:l.quantity+1}))}).every(c=>c==='component-mismatch'),true);
 const extra=[...base.lines,{...base.lines[0],variantId:variants['bead-blue-star'],quantity:1}];
 assert.ok(codes({...base,lines:extra}).includes('unexpected-component'));
 const orphan=[...base.lines,{variantId:variants['bead-pink-round'],quantity:1,attributes:{}}];
 assert.ok(codes({...base,lines:orphan}).includes('untracked-line'));
 const cheaper=toAudit([custom()],l=>({...l,attributes:{...l.attributes,'Design code':encodeDesign({...defaultDesign(),tomato:'formal'})}}));
 assert.ok(codes(cheaper).includes('component-mismatch'),'design code that disagrees with the lines is caught');
 const split=toAudit([custom()],(l)=>l);split.lines[0].attributes['Design code']='v1.sunny.ring.pink-round+pink-round+pink-round';
 assert.deepEqual(codes(split),['inconsistent']);
 assert.deepEqual(codes(toAudit([custom()],l=>({...l,attributes:{...l.attributes,'Design code':'garbage'}}))),['bad-design']);
 assert.deepEqual(codes(toAudit([custom()],l=>({...l,attributes:{...l.attributes,'Charm quantity':'99'}}))),['bad-quantity']);
});
test('audit checks ready-made items against their own design and quantity',()=>{
 const codes=o=>auditOrder(o,keyOf).problems.map(p=>p.code);
 assert.deepEqual(codes(toAudit([ready()],l=>({...l,attributes:{...l.attributes,'Design code':encodeDesign(PRODUCTS[1].design)}}))),['ready-mismatch']);
 assert.deepEqual(codes(toAudit([ready()],l=>({...l,quantity:5}))),['ready-quantity']);
});
